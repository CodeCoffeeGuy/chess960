import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess } from 'chess.js';
import { detectPuzzleThemes } from '../../../apps/web/src/lib/puzzle-theme-detector';

/**
 * Extract endgame puzzles from completed games in the database.
 * Focuses on positions from the last 20-30% of games where endgame themes are likely.
 */
async function extractEndgamePuzzles(count: number = 50) {
  try {
    console.log(`\n🎯 Extracting ${count} endgame puzzles from completed games...\n`);
    
    const engine = new StockfishEngine();
    await engine.isReady();
    console.log('Stockfish engine ready\n');
    
    // Get completed games with many moves (longer games = more likely to reach endgame)
    const completedGames = await db.game.findMany({
      where: {
        endedAt: { not: null },
        result: { not: null, not: 'abort' },
        whiteRatingBefore: { gte: 1200 },
        blackRatingBefore: { gte: 1200 },
      },
      include: {
        moves: {
          orderBy: { ply: 'asc' },
          select: { uci: true, ply: true },
        },
      },
      take: 500, // Get more games to find endgame positions
    });
    
    // Sort by number of moves (longer games = better chance of endgame)
    completedGames.sort((a, b) => (b.moves?.length || 0) - (a.moves?.length || 0));
    
    console.log(`Found ${completedGames.length} completed games to analyze\n`);
    
    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let attempts = 0;
    
    for (const game of completedGames) {
      if (puzzlesCreated >= count) break;
      if (!game.moves || game.moves.length < 30) continue; // Need at least 30 moves
      
      try {
        // Compute initial FEN
        let initialFen: string;
        if (game.variant === 'CHESS960' && game.chess960Position) {
          try {
            const chess960Pos = getChess960Position(game.chess960Position);
            initialFen = chess960Pos.fen;
          } catch (error) {
            continue;
          }
        } else {
          initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        }
        
        const chess = new Chess(initialFen);
        const moves = game.moves.map((m) => m.uci);
        
        // Focus on last 20-30% of the game (endgame phase)
        const startMove = Math.max(
          Math.floor(game.moves.length * 0.7), // Start from 70% of game
          game.moves.length - 20 // But at least 20 moves from end
        );
        const endMove = Math.min(moves.length - 3, game.moves.length - 5); // Up to 5 moves from end
        
        // Look for endgame positions
        for (let i = startMove; i < endMove && puzzlesCreated < count; i++) {
          attempts++;
          
          // Replay to position
          const tempChess = new Chess(initialFen);
          for (let j = 0; j < i; j++) {
            try {
              const move = moves[j];
              tempChess.move({
                from: move.slice(0, 2),
                to: move.slice(2, 4),
                promotion: move.length > 4 ? move[4] : undefined,
              });
            } catch {
              break;
            }
          }
          
          const currentFen = tempChess.fen();
          const pieceCount = tempChess.board().flat().filter(p => p !== null).length;
          
          // Only consider endgame positions (≤12 pieces)
          if (pieceCount > 12) continue;
          
          // Analyze position with Stockfish
          try {
            const analysis = await engine.analyzePosition(currentFen, {
              depth: 8,
              time: 5000,
            });
            
            if (!analysis.bestMove || !analysis.bestMove.uci) continue;
            
            // Check if best move creates significant advantage
            const evaluation = analysis.evaluation || 0;
            const absEval = Math.abs(evaluation);
            
            // For endgame, we want clear winning chances or checkmate
            if (absEval < 150 && !analysis.mate) continue;
            
            // Build solution sequence
            const solutionMoves: string[] = [analysis.bestMove.uci];
            const solutionChess = new Chess(currentFen);
            
            try {
              const firstMove = solutionChess.move({
                from: analysis.bestMove.uci.slice(0, 2),
                to: analysis.bestMove.uci.slice(2, 4),
                promotion: analysis.bestMove.uci.length > 4 ? analysis.bestMove.uci[4] : undefined,
              });
              
              if (!firstMove) continue;
              
              if (solutionChess.isGameOver()) {
                // Checkmate or stalemate
              } else {
                // Get opponent's best response
                const followUpAnalysis = await engine.analyzePosition(solutionChess.fen(), {
                  depth: 6,
                  time: 3000,
                });
                
                if (followUpAnalysis.bestMove) {
                  const opponentMove = solutionChess.move({
                    from: followUpAnalysis.bestMove.uci.slice(0, 2),
                    to: followUpAnalysis.bestMove.uci.slice(2, 4),
                    promotion: followUpAnalysis.bestMove.uci.length > 4 ? followUpAnalysis.bestMove.uci[4] : undefined,
                  });
                  
                  if (opponentMove && !solutionChess.isGameOver()) {
                    // Get our next best move
                    const nextAnalysis = await engine.analyzePosition(solutionChess.fen(), {
                      depth: 6,
                      time: 3000,
                    });
                    
                    if (nextAnalysis.bestMove) {
                      solutionMoves.push(followUpAnalysis.bestMove.uci, nextAnalysis.bestMove.uci);
                    }
                  }
                }
              }
            } catch {
              // Invalid move sequence, skip
              continue;
            }
            
            // Detect themes
            const isCheckmate = solutionChess.isCheckmate();
            const themesResult = detectPuzzleThemes(
              currentFen,
              solutionMoves,
              evaluation,
              isCheckmate
            );
            
            // Only save if it has endgame-related themes
            const hasEndgameTheme = themesResult.themes.some(t => 
              ['endgame', 'promotion', 'underPromotion', 'pawnEndgame', 'rookEndgame', 
               'bishopEndgame', 'knightEndgame', 'queenEndgame'].includes(t)
            );
            
            if (!hasEndgameTheme) continue;
            
            // Check if puzzle already exists
            const existing = await (db as any).puzzle.findFirst({
              where: { fen: currentFen },
            });
            
            if (existing) {
              puzzlesSkipped++;
              continue;
            }
            
            // Create puzzle
            const avgRating = Math.round(
              ((game.whiteRatingBefore || 1500) + (game.blackRatingBefore || 1500)) / 2
            );
            
            const baseRating = Math.max(1200, Math.min(2500, avgRating));
            const complexityBonus = solutionMoves.length * 30;
            const evaluationBonus = Math.min(absEval / 10, 200);
            const rating = Math.round(baseRating + complexityBonus + evaluationBonus);
            
            const puzzle = await (db as any).puzzle.create({
              data: {
                gameId: game.id,
                fen: currentFen,
                solution: solutionMoves[0],
                moves: solutionMoves,
                rating: Math.max(1000, Math.min(2500, rating)),
                plays: 0,
                votes: 0,
                themes: themesResult.themes,
              },
            });
            
            puzzlesCreated++;
            console.log(`  ✅ Created puzzle ${puzzlesCreated}/${count} - ID: ${puzzle.id}`);
            console.log(`     Themes: ${themesResult.themes.join(', ')}`);
            console.log(`     Rating: ${puzzle.rating}, Pieces: ${pieceCount}, Move: ${i}/${game.moves.length}`);
            
          } catch (error) {
            // Skip this position
            continue;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing game ${game.id}:`, error);
        continue;
      }
    }
    
    console.log(`\n✅ Extraction complete!`);
    console.log(`   Created: ${puzzlesCreated}`);
    console.log(`   Skipped: ${puzzlesSkipped}`);
    console.log(`   Attempts: ${attempts}`);
    
    engine.destroy();
    await db.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error extracting endgame puzzles:', error);
    process.exit(1);
  }
}

extractEndgamePuzzles(100);

