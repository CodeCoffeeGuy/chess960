import { db } from '../src';
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

async function main() {
  console.log('Seeding practice lessons from existing puzzles in database...\n');

  // Get puzzles from database
  const puzzles = await (db as any).puzzle.findMany({
    take: 20, // Get more puzzles to have options
    orderBy: { rating: 'desc' },
  });

  console.log(`Found ${puzzles.length} puzzles in database\n`);

  if (puzzles.length === 0) {
    console.log('No puzzles found in database. Please generate puzzles first.');
    return;
  }

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

  console.log('Assigning puzzles to practices...\n');

  let puzzleIndex = 0;

  for (const practiceDef of practiceDefinitions) {
    if (puzzleIndex >= puzzles.length) {
      console.log(`  Skipping ${practiceDef.title} - no more puzzles available`);
      continue;
    }

    const puzzle = puzzles[puzzleIndex];
    puzzleIndex++;

    console.log(`Assigning puzzle to: ${practiceDef.title}`);
    console.log(`  Puzzle rating: ${puzzle.rating}`);
    console.log(`  Puzzle solution: ${puzzle.solution}`);
    console.log(`  Puzzle moves: ${puzzle.moves?.length || 0}`);

    // Convert puzzle solution to PGN
    // puzzle.moves is an array of UCI moves, puzzle.solution is just the first move
    const solutionMoves = puzzle.moves && puzzle.moves.length > 0 ? puzzle.moves : [puzzle.solution];
    const solutionPgn = uciMovesToPgn(solutionMoves, puzzle.fen);
    const hints = generateHints(solutionMoves, puzzle.fen);

    console.log(`  Solution PGN: ${solutionPgn}`);
    console.log(`  Solution moves count: ${solutionMoves.length}\n`);

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

  console.log('\nPractice lessons seeded successfully!');
  console.log('Used existing puzzles from database.');
}

main()
  .catch((e) => {
    console.error('Error seeding practices:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

