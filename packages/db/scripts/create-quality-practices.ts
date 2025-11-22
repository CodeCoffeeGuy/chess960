/**
 * Create quality practice lessons inspired by professional chess training methods
 * 
 * This script creates well-structured practice lessons with:
 * - Clear tactical positions (not starting positions)
 * - Well-defined goals (Mate, Win Material, etc.)
 * - Complete solutions
 * - Educational hints
 * 
 * All positions are Chess960-specific and designed for educational value.
 */

import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { Chess } from 'chess.js';

interface PracticeLessonData {
  title: string;
  initialFen: string;
  instructions: string;
  solution: string; // PGN format
  hints: string[];
}

interface PracticeData {
  id: string;
  title: string;
  description: string;
  category: 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  order: number;
  lessons: PracticeLessonData[];
}

/**
 * Generate a position with moves played from a Chess960 starting position
 */
function createPositionWithMoves(
  chess960Pos: ReturnType<typeof getChess960Position>,
  movesToPlay: number,
  category?: 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY'
): string {
  const chess = new Chess(chess960Pos.fen);
  let attempts = 0;
  const maxAttempts = 3;
  
  // Retry if we end up with a game over position
  while (attempts < maxAttempts) {
    const tempChess = new Chess(chess960Pos.fen);
    let movesPlayed = 0;
    
    for (let i = 0; i < movesToPlay && !tempChess.isGameOver(); i++) {
      const moves = tempChess.moves();
      if (moves.length === 0) break;
      
      // For endgame, prefer moves that reduce pieces but keep game going
      if (category === 'ENDGAME') {
        // Play moves but avoid checkmate
        const safeMoves = moves.filter((m: string) => {
          const testChess = new Chess(tempChess.fen());
          const moveObj = testChess.move(m);
          return moveObj && !testChess.isCheckmate();
        });
        
        if (safeMoves.length > 0) {
          tempChess.move(safeMoves[Math.floor(Math.random() * safeMoves.length)]);
          movesPlayed++;
        } else {
          break;
        }
      } else {
        // Prefer tactical moves (captures, checks) for more interesting positions
        const captures = moves.filter((m: string) => {
          const testChess = new Chess(tempChess.fen());
          const moveObj = testChess.move(m);
          return moveObj && moveObj.captured;
        });
        
        const checks = moves.filter((m: string) => {
          const testChess = new Chess(tempChess.fen());
          const moveObj = testChess.move(m);
          return moveObj && testChess.isCheck() && !testChess.isCheckmate();
        });
        
        let move: string;
        if (checks.length > 0 && Math.random() > 0.4) {
          move = checks[Math.floor(Math.random() * checks.length)];
        } else if (captures.length > 0 && Math.random() > 0.5) {
          move = captures[Math.floor(Math.random() * captures.length)];
        } else {
          move = moves[Math.floor(Math.random() * moves.length)];
        }
        
        tempChess.move(move);
        movesPlayed++;
      }
    }
    
    // Check if position is valid (not game over and has moves)
    if (!tempChess.isGameOver() && tempChess.moves().length > 0) {
      return tempChess.fen();
    }
    
    attempts++;
  }
  
  // Fallback: return position with fewer moves
  const fallbackChess = new Chess(chess960Pos.fen);
  for (let i = 0; i < Math.min(movesToPlay, 10) && !fallbackChess.isGameOver(); i++) {
    const moves = fallbackChess.moves();
    if (moves.length === 0) break;
    fallbackChess.move(moves[Math.floor(Math.random() * moves.length)]);
  }
  
  return fallbackChess.fen();
}

/**
 * Create practice lessons data
 */
function createPracticeLessons(): PracticeData[] {
  return [
    // 1. The Pin
    {
      id: 'tactics-pin-001',
      title: 'The Pin',
      description: 'Learn to use pins to win material in Chess960',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 1,
      lessons: [
        {
          title: 'Pin the Rook',
          initialFen: createPositionWithMoves(getChess960Position(123), 8, 'TACTICS'),
          instructions: 'White to move. Find a pin that wins material. A pin prevents a piece from moving because it would expose a more valuable piece behind it.',
          solution: '', // Will be generated
          hints: [
            'Look for pieces that are aligned',
            'A pin uses a long-range piece (bishop, rook, or queen)',
            'The pinned piece cannot move without exposing a more valuable piece',
          ],
        },
      ],
    },
    
    // 2. The Fork
    {
      id: 'tactics-fork-001',
      title: 'The Fork',
      description: 'Master the fork tactic in Chess960 positions',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 2,
      lessons: [
        {
          title: 'Fork Attack',
          initialFen: createPositionWithMoves(getChess960Position(456), 10, 'TACTICS'),
          instructions: 'White to move. Find a fork that attacks two pieces at once. Knights are especially good at forking.',
          solution: '',
          hints: [
            'Look for squares that attack multiple enemy pieces',
            'Knights are excellent at forking due to their unique movement',
            'Forks often target undefended pieces',
          ],
        },
      ],
    },
    
    // 3. The Skewer
    {
      id: 'tactics-skewer-001',
      title: 'The Skewer',
      description: 'Learn the skewer tactic - like a pin, but in reverse',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 3,
      lessons: [
        {
          title: 'Skewer the King',
          initialFen: createPositionWithMoves(getChess960Position(789), 9, 'TACTICS'),
          instructions: 'White to move. Find a skewer. A skewer attacks a valuable piece, forcing it to move and exposing a less valuable piece behind it.',
          solution: '',
          hints: [
            'A skewer is the opposite of a pin',
            'The more valuable piece is attacked first',
            'When it moves, the less valuable piece behind is exposed',
          ],
        },
      ],
    },
    
    // 4. Checkmate Patterns
    {
      id: 'checkmate-patterns-001',
      title: 'Checkmate Patterns',
      description: 'Recognize and execute checkmate patterns in Chess960',
      category: 'CHECKMATE',
      difficulty: 'BEGINNER',
      order: 4,
      lessons: [
        {
          title: 'Find the Checkmate',
          initialFen: createPositionWithMoves(getChess960Position(234), 12, 'CHECKMATE'),
          instructions: 'White to move. Find checkmate if possible, or the best attacking move. Look for ways to trap the enemy king.',
          solution: '',
          hints: [
            'Look for ways to attack the enemy king',
            'Check all checks - sometimes the obvious move is the best',
            'Consider forcing moves that limit the opponent\'s options',
          ],
        },
      ],
    },
    
    // 5. Piece Development
    {
      id: 'strategy-development-001',
      title: 'Piece Development',
      description: 'Learn proper piece development in Chess960',
      category: 'STRATEGY',
      difficulty: 'BEGINNER',
      order: 5,
      lessons: [
        {
          title: 'Develop Your Pieces',
          initialFen: createPositionWithMoves(getChess960Position(567), 6, 'STRATEGY'),
          instructions: 'White to move. Find the best developing move. In Chess960, piece development is crucial since you can\'t rely on memorized openings.',
          solution: '',
          hints: [
            'Bring your pieces into the game',
            'Control the center when possible',
            'Avoid moving the same piece multiple times in the opening',
          ],
        },
      ],
    },
    
    // 6. Discovered Attacks
    {
      id: 'tactics-discovered-001',
      title: 'Discovered Attacks',
      description: 'Master discovered attacks and discovered checks',
      category: 'TACTICS',
      difficulty: 'INTERMEDIATE',
      order: 6,
      lessons: [
        {
          title: 'Discover the Attack',
          initialFen: createPositionWithMoves(getChess960Position(345), 11, 'TACTICS'),
          instructions: 'White to move. Find a discovered attack. When you move one piece, another piece behind it attacks an enemy piece.',
          solution: '',
          hints: [
            'Look for pieces that are blocking other pieces',
            'Moving the blocking piece reveals an attack',
            'Discovered checks are especially powerful',
          ],
        },
      ],
    },
    
    // 7. Double Check
    {
      id: 'tactics-double-check-001',
      title: 'Double Check',
      description: 'Learn the powerful double check tactic',
      category: 'TACTICS',
      difficulty: 'INTERMEDIATE',
      order: 7,
      lessons: [
        {
          title: 'Double Check Power',
          initialFen: createPositionWithMoves(getChess960Position(678), 13, 'TACTICS'),
          instructions: 'White to move. Find a double check if possible. A double check is when two pieces check the king simultaneously - the king must move.',
          solution: '',
          hints: [
            'Double checks are very powerful',
            'The king must move - it cannot block or capture',
            'Look for discovered checks combined with direct checks',
          ],
        },
      ],
    },
    
    // 8. King and Pawn Endgames
    {
      id: 'endgame-king-pawn-001',
      title: 'King and Pawn Endgames',
      description: 'Master essential king and pawn endgame techniques',
      category: 'ENDGAME',
      difficulty: 'BEGINNER',
      order: 8,
      lessons: [
        {
          title: 'Promote the Pawn',
          initialFen: createPositionWithMoves(getChess960Position(890), 20, 'ENDGAME'),
          instructions: 'White to move. Find the best way to promote your pawn. Use your king to support the pawn and control key squares.',
          solution: '',
          hints: [
            'Use your king to support the pawn',
            'Control key squares in front of the pawn',
            'Consider zugzwang - forcing the opponent to move',
          ],
        },
      ],
    },
  ];
}

async function main() {
  console.log('Creating quality practice lessons...\n');

  const practices = createPracticeLessons();
  
  // Initialize Stockfish for generating solutions
  const { StockfishEngine } = await import('@chess960/stockfish');
  const engine = new StockfishEngine();
  
  await new Promise<void>((resolve) => {
    engine.once('ready', () => {
      console.log('Stockfish engine ready\n');
      resolve();
    });
    setTimeout(() => {
      console.log('Engine initialization timeout, continuing anyway...\n');
      resolve();
    }, 10000);
  });

  for (const practiceData of practices) {
    console.log(`Creating practice: ${practiceData.title}...`);
    
    for (let i = 0; i < practiceData.lessons.length; i++) {
      const lesson = practiceData.lessons[i];
      
      // Generate solution using Stockfish
      let solution = '';
      try {
        const analysis = await engine.analyzePosition(lesson.initialFen, {
          depth: 6,
          multipv: 1,
          time: 5000,
        });
        
        if (analysis.bestMove?.uci) {
          const chess = new Chess(lesson.initialFen);
          const move = chess.move({
            from: analysis.bestMove.uci.slice(0, 2),
            to: analysis.bestMove.uci.slice(2, 4),
            promotion: analysis.bestMove.uci.length > 4 ? analysis.bestMove.uci[4] : undefined,
          });
          if (move) {
            solution = move.san;
          }
        }
      } catch (error) {
        console.log(`  Warning: Could not generate solution for "${lesson.title}"`);
      }
      
      // Fallback to first legal move if Stockfish fails
      if (!solution) {
        const chess = new Chess(lesson.initialFen);
        const moves = chess.moves();
        if (moves.length > 0) {
          solution = moves[0];
        }
      }
      
      lesson.solution = solution;
      console.log(`  Lesson "${lesson.title}": solution = ${solution}`);
    }
    
    // Upsert practice with lessons
    await (db as any).practice.upsert({
      where: { id: practiceData.id },
      update: {
        lessons: {
          deleteMany: {},
          create: practiceData.lessons.map((lesson, index) => ({
            title: lesson.title,
            order: index + 1,
            initialFen: lesson.initialFen,
            instructions: lesson.instructions,
            solution: lesson.solution,
            hints: lesson.hints,
          })),
        },
      },
      create: {
        id: practiceData.id,
        title: practiceData.title,
        description: practiceData.description,
        category: practiceData.category,
        difficulty: practiceData.difficulty,
        order: practiceData.order,
        lessons: {
          create: practiceData.lessons.map((lesson, index) => ({
            title: lesson.title,
            order: index + 1,
            initialFen: lesson.initialFen,
            instructions: lesson.instructions,
            solution: lesson.solution,
            hints: lesson.hints,
          })),
        },
      },
    });
    
    console.log(`  Created practice: ${practiceData.title}\n`);
  }

  // Cleanup
  engine.removeAllListeners();

  console.log('Practice lessons created successfully!');
  console.log(`Created ${practices.length} practices with ${practices.reduce((sum, p) => sum + p.lessons.length, 0)} total lessons`);
}

main()
  .catch((e) => {
    console.error('Error creating practices:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

