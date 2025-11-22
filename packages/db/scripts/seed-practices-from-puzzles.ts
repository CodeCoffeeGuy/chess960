import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess960PuzzleGenerator } from '@chess960/puzzle-generator';
import { Chess } from 'chess.js';

// Helper to convert UCI moves to PGN for solution
function uciMovesToPgn(uciMoves: string[], initialFen: string): string {
  try {
    const chess = new Chess(initialFen);
    const pgnMoves: string[] = [];
    
    for (const uci of uciMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      
      const move = chess.move({ from, to, promotion: promotion as any });
      if (move) {
        pgnMoves.push(move.san);
      } else {
        // If move fails, just use UCI
        pgnMoves.push(uci);
      }
    }
    
    return pgnMoves.join(' ');
  } catch {
    return uciMoves.join(' ');
  }
}

// Helper to generate hints from solution
function generateHints(solution: string[], initialFen: string): string[] {
  const hints: string[] = [];
  
  if (solution.length === 0) return hints;
  
  // First hint: general direction
  if (solution.length > 1) {
    hints.push('Find the best sequence of moves in this position.');
  } else {
    hints.push('Look for the best move in this position.');
  }
  
  // Second hint: more specific
  if (solution.length > 0) {
    const chess = new Chess(initialFen);
    const firstMove = solution[0];
    const from = firstMove.slice(0, 2);
    const to = firstMove.slice(2, 4);
    
    // Try to give a hint about the piece or square
    const piece = chess.get(from);
    if (piece) {
      const pieceName = piece.type === 'p' ? 'pawn' : piece.type === 'r' ? 'rook' : piece.type === 'n' ? 'knight' : piece.type === 'b' ? 'bishop' : piece.type === 'q' ? 'queen' : 'king';
      hints.push(`Consider moving the ${pieceName} from ${from}.`);
    } else {
      hints.push(`Consider a move to ${to}.`);
    }
  }
  
  // Third hint: very specific (only if single move)
  if (solution.length === 1) {
    hints.push(`The best move starts with ${solution[0].slice(0, 2)}.`);
  } else if (solution.length > 1) {
    hints.push(`The solution requires ${solution.length} moves.`);
  }
  
  return hints;
}

// Map puzzle themes to practice categories
function getCategoryFromTheme(theme?: string): 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY' {
  if (!theme) return 'TACTICS';
  
  const lower = theme.toLowerCase();
  if (lower.includes('mate') || lower.includes('checkmate')) return 'CHECKMATE';
  if (lower.includes('endgame')) return 'ENDGAME';
  if (lower.includes('strategy') || lower.includes('positional')) return 'STRATEGY';
  return 'TACTICS';
}

async function main() {
  console.log('Seeding practice lessons from puzzle generator...\n');

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

  const generator = new Chess960PuzzleGenerator(engine!);

  // Practice definitions with categories
  const practiceDefinitions = [
    { id: 'tactics-pin-001', title: 'The Pin', description: 'Learn to use pins to win material in Chess960', category: 'TACTICS' as const, difficulty: 'BEGINNER' as const, order: 1 },
    { id: 'tactics-fork-001', title: 'The Fork', description: 'Master the fork tactic in Chess960 positions', category: 'TACTICS' as const, difficulty: 'BEGINNER' as const, order: 2 },
    { id: 'tactics-skewer-001', title: 'The Skewer', description: 'Learn the skewer tactic - like a pin, but in reverse', category: 'TACTICS' as const, difficulty: 'BEGINNER' as const, order: 3 },
    { id: 'checkmate-patterns-001', title: 'Checkmate Patterns', description: 'Recognize and execute checkmate patterns in Chess960', category: 'CHECKMATE' as const, difficulty: 'BEGINNER' as const, order: 4 },
    { id: 'strategy-development-001', title: 'Piece Development', description: 'Learn proper piece development in Chess960', category: 'STRATEGY' as const, difficulty: 'BEGINNER' as const, order: 5 },
    { id: 'tactics-discovered-001', title: 'Discovered Attacks', description: 'Master discovered attacks and discovered checks', category: 'TACTICS' as const, difficulty: 'INTERMEDIATE' as const, order: 6 },
    { id: 'tactics-double-check-001', title: 'Double Check', description: 'Learn the powerful double check tactic', category: 'TACTICS' as const, difficulty: 'INTERMEDIATE' as const, order: 7 },
    { id: 'endgame-king-pawn-001', title: 'King and Pawn Endgames', description: 'Master essential king and pawn endgame techniques', category: 'ENDGAME' as const, difficulty: 'BEGINNER' as const, order: 8 },
  ];

  console.log('Generating practice lessons...\n');

  for (const practiceDef of practiceDefinitions) {
    console.log(`Generating lesson for: ${practiceDef.title}...`);
    
    let puzzle = null;
    let attempts = 0;
    const maxAttempts = 5;

    // Try to generate a puzzle for this practice
    while (!puzzle && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`  Attempt ${attempts}/${maxAttempts}...`);
        puzzle = await generator.generatePuzzle({
          getChess960Position,
          depth: 8, // Lower depth for faster generation
          minMoves: 8,
          maxMoves: 20,
        });
        
        if (puzzle) {
          console.log(`  Success! Generated puzzle with rating ${puzzle.rating}`);
        } else {
          console.log(`  Failed to generate puzzle (attempt ${attempts})`);
        }
      } catch (error) {
        console.log(`  Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (!puzzle) {
      console.log(`  Skipping ${practiceDef.title} - failed to generate puzzle after ${maxAttempts} attempts`);
      continue;
    }

    // Convert puzzle moves to PGN (use moves array, not single solution)
    // puzzle.moves is an array of UCI moves, puzzle.solution is just the first move
    let solutionMoves = puzzle.moves && puzzle.moves.length > 0 ? puzzle.moves : [puzzle.solution];
    
    // Extend solution to have at least 2-3 moves for better practice lessons
    // Use quick Stockfish analysis to add follow-up moves
    if (solutionMoves.length === 1) {
      try {
        console.log(`  Extending solution from 1 to 2-3 moves...`);
        const chess = new Chess(puzzle.fen);
        const firstMove = solutionMoves[0];
        const move = chess.move({
          from: firstMove.slice(0, 2),
          to: firstMove.slice(2, 4),
          promotion: firstMove.length > 4 ? firstMove[4] : undefined,
        });
        
        if (move && !chess.isGameOver()) {
          // Get opponent's best response (quick analysis)
          const opponentAnalysis = await engine!.analyzePosition(chess.fen(), {
            depth: 4, // Lower depth for speed
            time: 3000, // Shorter timeout
          });
          
          if (opponentAnalysis.bestMove) {
            const opponentMove = chess.move({
              from: opponentAnalysis.bestMove.uci.slice(0, 2),
              to: opponentAnalysis.bestMove.uci.slice(2, 4),
              promotion: opponentAnalysis.bestMove.uci.length > 4 ? opponentAnalysis.bestMove.uci[4] : undefined,
            });
            
            if (opponentMove && !chess.isGameOver()) {
              solutionMoves.push(opponentAnalysis.bestMove.uci);
              console.log(`  Extended to 2 moves`);
              
              // Optionally add third move (our response)
              try {
                const ourNextAnalysis = await engine!.analyzePosition(chess.fen(), {
                  depth: 4,
                  time: 3000,
                });
                
                if (ourNextAnalysis.bestMove) {
                  solutionMoves.push(ourNextAnalysis.bestMove.uci);
                  console.log(`  Extended to 3 moves`);
                }
              } catch {
                // Skip third move if it fails
              }
            }
          }
        }
      } catch (error) {
        // If extending fails, just use the single move
        console.log(`  Could not extend solution: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    const solutionPgn = uciMovesToPgn(solutionMoves, puzzle.fen);
    const hints = generateHints(solutionMoves, puzzle.fen);

    // Determine instructions based on category
    let instructions = 'Find the best move in this position.';
    if (practiceDef.category === 'CHECKMATE') {
      instructions = 'Find the checkmating move.';
    } else if (practiceDef.category === 'TACTICS') {
      instructions = 'Find the tactical move that wins material or creates a winning advantage.';
    } else if (practiceDef.category === 'ENDGAME') {
      instructions = 'Find the best move in this endgame position.';
    } else if (practiceDef.category === 'STRATEGY') {
      instructions = 'Find the best strategic move.';
    }

    // Create or update practice
    try {
      await (db as any).practice.upsert({
        where: { id: practiceDef.id },
        update: {
          lessons: {
            deleteMany: {},
            create: [
              {
                title: practiceDef.title,
                order: 1,
                initialFen: puzzle.fen,
                instructions,
                solution: solutionPgn,
                hints,
              },
            ],
          },
        },
        create: {
          id: practiceDef.id,
          title: practiceDef.title,
          description: practiceDef.description,
          category: practiceDef.category,
          difficulty: practiceDef.difficulty,
          order: practiceDef.order,
          lessons: {
            create: [
              {
                title: practiceDef.title,
                order: 1,
                initialFen: puzzle.fen,
                instructions,
                solution: solutionPgn,
                hints,
              },
            ],
          },
        },
      });

      console.log(`  Created/updated practice: ${practiceDef.title}\n`);
    } catch (error) {
      console.error(`  Error creating practice ${practiceDef.title}:`, error);
    }
  }

  // Cleanup
  if (engine) {
    engine.removeAllListeners();
    engine = null;
  }

  console.log('\nPractice lessons seeded successfully!');
  console.log('Used Chess960PuzzleGenerator for reliable generation.');
}

main()
  .catch((e) => {
    console.error('Error seeding practices:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

