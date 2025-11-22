import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess } from 'chess.js';

// Generate basic openings for Chess960 starting positions
// For each position, generate 1-2 popular opening lines using Stockfish

async function generateChess960Openings() {
  console.log('Generating Chess960 openings...\n');

  // Initialize Stockfish engine
  console.log('Initializing Stockfish engine...');
  let engine: StockfishEngine | null = new StockfishEngine();
  await new Promise<void>((resolve) => {
    engine!.once('ready', () => {
      console.log('Stockfish engine ready\n');
      resolve();
    });
    setTimeout(() => {
      if (!engine) {
        console.log('Engine initialization timeout, continuing anyway...\n');
        resolve();
      }
    }, 10000);
  });

  // Generate openings for all 960 positions
  const positionsToGenerate = Array.from({ length: 960 }, (_, i) => i + 1);
  let openingsCreated = 0;

  for (const positionNum of positionsToGenerate) {
    try {
      if (positionNum % 10 === 0) {
        console.log(`Progress: ${positionNum}/960 positions...`);
      }
      
      const chess960Pos = getChess960Position(positionNum);
      const chess = new Chess(chess960Pos.fen);

      // Generate 2 opening lines per position
      for (let lineNum = 1; lineNum <= 2; lineNum++) {
        // Reset to starting position
        const game = new Chess(chess960Pos.fen);
        const moves: string[] = [];
        let currentFen = chess960Pos.fen;

        // Generate 4-6 moves for the opening
        const numMoves = 4 + Math.floor(Math.random() * 3); // 4-6 moves

        for (let i = 0; i < numMoves && !game.isGameOver(); i++) {
          try {
            // Use Stockfish to find best move (reduced depth/time for speed)
            const analysis = await engine!.analyzePosition(currentFen, {
              depth: 4, // Reduced from 6 to 4 for faster generation
              time: 2000, // Reduced from 3000 to 2000ms for faster generation
            });

            if (analysis.bestMove) {
              const move = game.move({
                from: analysis.bestMove.uci.slice(0, 2),
                to: analysis.bestMove.uci.slice(2, 4),
                promotion: analysis.bestMove.uci.length > 4 ? analysis.bestMove.uci[4] : undefined,
              });

              if (move) {
                moves.push(analysis.bestMove.uci);
                currentFen = game.fen();
              } else {
                break;
              }
            } else {
              // Fallback to random legal move
              const legalMoves = game.moves();
              if (legalMoves.length === 0) break;
              const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
              const move = game.move(randomMove);
              if (move) {
                moves.push(`${move.from}${move.to}${move.promotion || ''}`);
                currentFen = game.fen();
              } else {
                break;
              }
            }
          } catch (error) {
            // If Stockfish fails, use random move
            try {
              const legalMoves = game.moves();
              if (legalMoves.length === 0) break;
              const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
              const move = game.move(randomMove);
              if (move) {
                moves.push(`${move.from}${move.to}${move.promotion || ''}`);
                currentFen = game.fen();
              } else {
                break;
              }
            } catch {
              break;
            }
          }
        }

        if (moves.length >= 2) {
          // Create opening name based on first moves
          // Convert first 2-3 moves to SAN for better naming
          const tempChess = new Chess(chess960Pos.fen);
          const sanMoves: string[] = [];
          for (const uci of moves.slice(0, 3)) {
            try {
              const move = tempChess.move({
                from: uci.slice(0, 2),
                to: uci.slice(2, 4),
                promotion: uci.length > 4 ? uci[4] : undefined,
              });
              if (move) {
                sanMoves.push(move.san);
              }
            } catch {
              break;
            }
          }
          
          const openingName = sanMoves.length > 0 
            ? `Position ${positionNum}: ${sanMoves.join(' ')}`
            : `Chess960 Position ${positionNum} - Line ${lineNum}`;
          const movesString = moves.join(' ');

          // Check if opening already exists
          const existing = await (db as any).opening.findFirst({
            where: {
              moves: movesString,
              chess960Position: positionNum,
            },
          });

          if (!existing) {
            await (db as any).opening.create({
              data: {
                name: openingName,
                eco: null, // Chess960 doesn't use ECO codes
                moves: movesString,
                fen: currentFen,
                chess960Position: positionNum,
              },
            });

            openingsCreated++;
            console.log(`  Created: ${openingName} (${moves.length} moves)`);
          } else {
            console.log(`  Skipped: ${openingName} (already exists)`);
          }
        }
      }
    } catch (error) {
      console.error(`Error generating openings for position ${positionNum}:`, error);
    }
  }

  // Cleanup
  if (engine) {
    engine.removeAllListeners();
    engine = null;
  }

  console.log(`\nGenerated ${openingsCreated} Chess960 openings!`);
  console.log(`Covered ${positionsToGenerate.length} starting positions.`);
}

generateChess960Openings()
  .catch((e) => {
    console.error('Error generating openings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

