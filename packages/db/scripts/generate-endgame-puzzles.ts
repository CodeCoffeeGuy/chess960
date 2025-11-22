import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess } from 'chess.js';

// Copy of detectPuzzleThemes function to avoid import issues
type PuzzleTheme =
  | 'tactics' | 'endgame' | 'opening' | 'middlegame' | 'mate' | 'mateIn1' | 'mateIn2' | 'mateIn3' | 'mateIn4' | 'mateIn5'
  | 'fork' | 'pin' | 'skewer' | 'sacrifice' | 'discoveredAttack' | 'doubleCheck' | 'backRankMate' | 'smotheredMate'
  | 'promotion' | 'underPromotion' | 'castling' | 'enPassant' | 'hangingPiece' | 'trappedPiece'
  | 'deflection' | 'attraction' | 'clearance' | 'interference' | 'xRayAttack' | 'zugzwang' | 'advancedPawn'
  | 'rookEndgame' | 'bishopEndgame' | 'knightEndgame' | 'pawnEndgame' | 'queenEndgame';

function detectPuzzleThemes(
  fen: string,
  solutionMoves: string[],
  evaluation: number,
  isCheckmate: boolean
): { themes: PuzzleTheme[]; primaryTheme: PuzzleTheme } {
  const themes: PuzzleTheme[] = [];
  const chess = new Chess(fen);
  const pieceCount = chess.board().flat().filter(p => p !== null).length;
  const pawnCount = chess.board().flat().filter(p => p?.type === 'p').length;
  
  // Phase detection
  if (pieceCount <= 10) {
    themes.push('endgame');
    const pieces = chess.board().flat().filter(p => p !== null);
    const hasRook = pieces.some(p => p?.type === 'r');
    const hasBishop = pieces.some(p => p?.type === 'b');
    const hasKnight = pieces.some(p => p?.type === 'n');
    const hasQueen = pieces.some(p => p?.type === 'q');
    
    if (hasRook && !hasQueen && pieceCount <= 8) themes.push('rookEndgame');
    if (hasBishop && !hasQueen && !hasRook && pieceCount <= 6) themes.push('bishopEndgame');
    if (hasKnight && !hasQueen && !hasRook && !hasBishop && pieceCount <= 6) themes.push('knightEndgame');
    if (pawnCount >= 2 && pieceCount <= 8 && !hasQueen && !hasRook) themes.push('pawnEndgame');
    if (hasQueen && pieceCount <= 8) themes.push('queenEndgame');
  } else if (pieceCount >= 20) {
    themes.push('opening');
  } else {
    themes.push('middlegame');
  }

  // Checkmate themes
  if (isCheckmate) {
    themes.push('mate');
    if (solutionMoves.length === 1) themes.push('mateIn1');
    else if (solutionMoves.length === 2) themes.push('mateIn2');
    else if (solutionMoves.length === 3) themes.push('mateIn3');
    else if (solutionMoves.length === 4) themes.push('mateIn4');
    else if (solutionMoves.length >= 5) themes.push('mateIn5');
  }

  // Analyze first move for tactical patterns
  if (solutionMoves.length > 0) {
    const firstMove = solutionMoves[0];
    const from = firstMove.slice(0, 2);
    const to = firstMove.slice(2, 4);
    const promotion = firstMove.length > 4 ? firstMove[4] : undefined;
    
    try {
      const moveObj = chess.move({ from, to, promotion });
      if (moveObj) {
        if (moveObj.captured) {
          themes.push('tactics');
        }

        // Check for promotion
        if (moveObj.promotion) {
          themes.push('promotion');
          if (moveObj.promotion !== 'q') {
            themes.push('underPromotion');
          }
        }

        if (moveObj.flags.includes('e')) {
          themes.push('enPassant');
        }
        if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) {
          themes.push('castling');
        }
      }
    } catch (error) {
      // Invalid move, skip
    }
  }

  // Default to tactics if no themes
  if (themes.length === 0) {
    themes.push('tactics');
  }

  return {
    themes: themes as PuzzleTheme[],
    primaryTheme: themes[0] || 'tactics',
  };
}

/**
 * Generate endgame puzzles with specific themes like promotion, pawn endgame, etc.
 * This script generates puzzles from endgame positions (30+ moves) to ensure
 * we have puzzles for themes that require endgame positions.
 */
async function generateEndgamePuzzles(count: number = 50) {
  try {
    console.log(`\n🎯 Generating ${count} endgame puzzles...\n`);
    
    const engine = new StockfishEngine();
    await engine.initialize();
    
    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let attempts = 0;
    const maxAttempts = count * 3; // Allow more attempts to find good endgame positions
    
    while (puzzlesCreated < count && attempts < maxAttempts) {
      attempts++;
      
      try {
        // Generate random Chess960 position
        const positionNum = Math.floor(Math.random() * 960) + 1;
        const chess960Pos = getChess960Position(positionNum);
        const chess = new Chess(chess960Pos.fen);
        
        // Play many moves to reach endgame (30-60 moves)
        const movesToPlay = 30 + Math.floor(Math.random() * 30);
        const depth = 6; // Moderate depth for faster generation
        const timeout = 5000; // 5 seconds per move
        
        console.log(`\n[${attempts}] Playing ${movesToPlay} moves to reach endgame...`);
        
        // Play moves using Stockfish to create realistic endgame positions
        for (let i = 0; i < movesToPlay && !chess.isGameOver(); i++) {
          try {
            const analysis = await engine.analyzePosition(chess.fen(), {
              depth,
              time: timeout,
            });
            
            if (!analysis.bestMove) break;
            
            const move = chess.move({
              from: analysis.bestMove.uci.slice(0, 2),
              to: analysis.bestMove.uci.slice(2, 4),
              promotion: analysis.bestMove.uci.length > 4 ? analysis.bestMove.uci[4] : undefined,
            });
            
            if (!move) break;
            
            // Check if we've reached an endgame position (fewer pieces)
            const pieceCount = chess.board().flat().filter(p => p !== null).length;
            if (pieceCount <= 12 && i >= 25) {
              // Good endgame position, try to find a tactical puzzle
              break;
            }
          } catch (error) {
            console.error(`Error playing move ${i}:`, error);
            break;
          }
        }
        
        if (chess.isGameOver()) {
          console.log(`  ⚠️  Game ended, skipping...`);
          continue;
        }
        
        const currentFen = chess.fen();
        const pieceCount = chess.board().flat().filter(p => p !== null).length;
        
        // Only proceed if we have an endgame position
        if (pieceCount > 12) {
          console.log(`  ⚠️  Not enough pieces removed (${pieceCount}), skipping...`);
          continue;
        }
        
        console.log(`  ✓ Reached endgame position with ${pieceCount} pieces`);
        
        // Analyze position to find tactical opportunities
        const analysis = await engine.analyzePosition(currentFen, {
          depth: 10,
          time: 10000,
        });
        
        if (!analysis.bestMove || !analysis.bestMove.uci) {
          console.log(`  ⚠️  No best move found, skipping...`);
          continue;
        }
        
        // Check if the best move creates a significant advantage
        const evaluation = analysis.evaluation || 0;
        const absEval = Math.abs(evaluation);
        
        // For endgame puzzles, we want positions with clear winning chances
        // (evaluation > 200 centipawns or checkmate)
        if (absEval < 200 && !analysis.mate) {
          console.log(`  ⚠️  Evaluation too low (${evaluation}), skipping...`);
          continue;
        }
        
        // Build solution sequence
        const solutionMoves: string[] = [analysis.bestMove.uci];
        let tempChess = new Chess(currentFen);
        
        // Try to extend solution if it leads to checkmate or significant advantage
        for (let i = 0; i < 3; i++) {
          try {
            const move = tempChess.move({
              from: analysis.bestMove.uci.slice(0, 2),
              to: analysis.bestMove.uci.slice(2, 4),
              promotion: analysis.bestMove.uci.length > 4 ? analysis.bestMove.uci[4] : undefined,
            });
            
            if (!move) break;
            
            if (tempChess.isGameOver()) {
              break;
            }
            
            // Get opponent's best response
            const followUpAnalysis = await engine.analyzePosition(tempChess.fen(), {
              depth: 8,
              time: 5000,
            });
            
            if (!followUpAnalysis.bestMove) break;
            
            const opponentMove = tempChess.move({
              from: followUpAnalysis.bestMove.uci.slice(0, 2),
              to: followUpAnalysis.bestMove.uci.slice(2, 4),
              promotion: followUpAnalysis.bestMove.uci.length > 4 ? followUpAnalysis.bestMove.uci[4] : undefined,
            });
            
            if (!opponentMove) break;
            
            // Get our next best move
            const nextAnalysis = await engine.analyzePosition(tempChess.fen(), {
              depth: 8,
              time: 5000,
            });
            
            if (!nextAnalysis.bestMove) break;
            
            solutionMoves.push(followUpAnalysis.bestMove.uci, nextAnalysis.bestMove.uci);
            
            const nextMove = tempChess.move({
              from: nextAnalysis.bestMove.uci.slice(0, 2),
              to: nextAnalysis.bestMove.uci.slice(2, 4),
              promotion: nextAnalysis.bestMove.uci.length > 4 ? nextAnalysis.bestMove.uci[4] : undefined,
            });
            
            if (!nextMove || tempChess.isGameOver()) break;
          } catch (error) {
            break;
          }
        }
        
        // Detect themes for this puzzle
        const isCheckmate = tempChess.isCheckmate();
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
        
        if (!hasEndgameTheme) {
          console.log(`  ⚠️  No endgame themes detected, skipping...`);
          continue;
        }
        
        // Check if puzzle already exists
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: currentFen },
        });
        
        if (existing) {
          puzzlesSkipped++;
          console.log(`  ⚠️  Puzzle already exists, skipping...`);
          continue;
        }
        
        // Create dummy game record
        const dummyGame = await db.game.create({
          data: {
            whiteId: null,
            blackId: null,
            tc: 'TWO_PLUS_ZERO' as any,
            rated: false,
            variant: 'CHESS960' as any,
            chess960Position: positionNum,
            startedAt: new Date(),
            endedAt: new Date(),
            result: 'draw',
            whiteTimeMs: 120000,
            blackTimeMs: 120000,
            whiteIncMs: 0,
            blackIncMs: 0,
          },
        });
        
        // Calculate rating based on evaluation and complexity
        const baseRating = 1200;
        const complexityBonus = solutionMoves.length * 50;
        const evaluationBonus = Math.min(absEval / 10, 300);
        const rating = Math.round(baseRating + complexityBonus + evaluationBonus);
        
        // Create puzzle
        const puzzle = await (db as any).puzzle.create({
          data: {
            gameId: dummyGame.id,
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
        console.log(`     Rating: ${puzzle.rating}, Pieces: ${pieceCount}`);
        
      } catch (error) {
        console.error(`  ❌ Error in attempt ${attempts}:`, error);
        continue;
      }
    }
    
    console.log(`\n✅ Generation complete!`);
    console.log(`   Created: ${puzzlesCreated}`);
    console.log(`   Skipped: ${puzzlesSkipped}`);
    console.log(`   Attempts: ${attempts}`);
    
    await engine.quit();
    process.exit(0);
  } catch (error) {
    console.error('Error generating endgame puzzles:', error);
    process.exit(1);
  }
}

generateEndgamePuzzles(100);

