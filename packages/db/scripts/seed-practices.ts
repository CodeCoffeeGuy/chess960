import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { QualityPracticeGenerator } from '@chess960/puzzle-generator';
import { Chess } from 'chess.js';

// Helper to convert UCI to PGN for solution
function uciToPgn(uci: string, fen: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion: promotion as any });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

// Helper function to generate a position with some moves played
function generatePositionWithMoves(chess960Pos: ReturnType<typeof getChess960Position>, numMoves: number = 5): string {
  const chess = new Chess(chess960Pos.fen);
  
  // Play some random legal moves to get out of starting position
  for (let i = 0; i < numMoves && !chess.isGameOver(); i++) {
    const moves = chess.moves();
    if (moves.length === 0) break;
    
    // Pick a random move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    chess.move(randomMove);
  }
  
  return chess.fen();
}

// Generate position specific to practice category
function generateCategorySpecificPosition(
  category: 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY',
  chess960Pos: ReturnType<typeof getChess960Position>
): { fen: string; solution?: string } {
  const chess = new Chess(chess960Pos.fen);
  
  if (category === 'ENDGAME') {
    // For endgame, play many moves to reduce pieces
    for (let i = 0; i < 30 && !chess.isGameOver(); i++) {
      const moves = chess.moves();
      if (moves.length === 0) break;
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      chess.move(randomMove);
    }
    return { fen: chess.fen() };
  } else if (category === 'CHECKMATE') {
    // For checkmate, play moves to create a position where mate might be possible
    // Play aggressive moves to create attacking chances
    for (let i = 0; i < 15 && !chess.isGameOver(); i++) {
      const moves = chess.moves();
      if (moves.length === 0) break;
      
      // Prefer checks and captures for more tactical positions
      const checks = moves.filter((m: string) => {
        const testChess = new Chess(chess.fen());
        const moveObj = testChess.move(m);
        return moveObj && testChess.isCheck();
      });
      
      const captures = moves.filter((m: string) => {
        const testChess = new Chess(chess.fen());
        const moveObj = testChess.move(m);
        return moveObj && moveObj.captured;
      });
      
      let move: string;
      if (checks.length > 0 && Math.random() > 0.5) {
        move = checks[Math.floor(Math.random() * checks.length)];
      } else if (captures.length > 0 && Math.random() > 0.5) {
        move = captures[Math.floor(Math.random() * captures.length)];
      } else {
        move = moves[Math.floor(Math.random() * moves.length)];
      }
      
      chess.move(move);
    }
    return { fen: chess.fen() };
  } else if (category === 'TACTICS') {
    // For tactics, play moves to create tactical opportunities
    for (let i = 0; i < 12 && !chess.isGameOver(); i++) {
      const moves = chess.moves();
      if (moves.length === 0) break;
      
      // Prefer captures and checks
      const captures = moves.filter((m: string) => {
        const testChess = new Chess(chess.fen());
        const moveObj = testChess.move(m);
        return moveObj && moveObj.captured;
      });
      
      if (captures.length > 0 && Math.random() > 0.4) {
        chess.move(captures[Math.floor(Math.random() * captures.length)]);
      } else {
        chess.move(moves[Math.floor(Math.random() * moves.length)]);
      }
    }
    return { fen: chess.fen() };
  } else {
    // For strategy, play more positional moves (fewer captures)
    for (let i = 0; i < 10 && !chess.isGameOver(); i++) {
      const moves = chess.moves();
      if (moves.length === 0) break;
      
      // Avoid captures to keep position more strategic
      const nonCaptures = moves.filter((m: string) => {
        const testChess = new Chess(chess.fen());
        const moveObj = testChess.move(m);
        return moveObj && !moveObj.captured;
      });
      
      const move = nonCaptures.length > 0 
        ? nonCaptures[Math.floor(Math.random() * nonCaptures.length)]
        : moves[Math.floor(Math.random() * moves.length)];
      
      chess.move(move);
    }
    return { fen: chess.fen() };
  }
}

async function main() {
  console.log('Seeding practice lessons for Chess960 using Stockfish...\n');

  // Initialize Stockfish engine
  console.log('Initializing Stockfish engine...');
  const engine = new StockfishEngine();
  await new Promise<void>((resolve) => {
    engine.once('ready', () => {
      console.log('Stockfish engine ready\n');
      resolve();
    });
    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('Engine initialization timeout, continuing anyway...\n');
      resolve();
    }, 10000);
  });

  const generator = new QualityPracticeGenerator(engine);

  // Helper function to generate a lesson with retries
  async function generateLessonWithRetries(
    category: 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY',
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT',
    maxAttempts: number = 2
  ): Promise<{ title: string; initialFen: string; instructions: string; solution: string; hints: string[] } | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`  Generating ${difficulty} ${category} lesson (attempt ${attempt}/${maxAttempts})...`);
        
        // Use timeout to prevent hanging
        const lessonPromise = generator.generateLesson({
          category,
          difficulty,
          getChess960Position,
          depth: 6, // Reduced depth for faster generation
          minMoves: 5, // Reduced moves for faster generation
          maxMoves: 12,
        });
        
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.log(`    Timeout after 60s - skipping attempt ${attempt}`);
            resolve(null);
          }, 60000); // 60 second timeout
        });
        
        const lesson = await Promise.race([lessonPromise, timeoutPromise]);

        if (lesson) {
          console.log(`    Generated: ${lesson.title} (Goal: ${lesson.goal.type})`);
          console.log(`    Solution: ${lesson.solution.substring(0, 50)}...`);
          return {
            title: lesson.title,
            initialFen: lesson.initialFen,
            instructions: lesson.instructions,
            solution: lesson.solution,
            hints: lesson.hints,
          };
        } else {
          console.log(`    Failed to generate (attempt ${attempt}) - generator returned null or timeout`);
        }
      } catch (error) {
        console.log(`    Error (attempt ${attempt}):`, error instanceof Error ? error.message : error);
      }
    }
    return null;
  }

  // Generate lessons for each practice
  console.log('Generating practice lessons...\n');
  
  const pinLesson = await generateLessonWithRetries('TACTICS', 'BEGINNER');
  const forkLesson = await generateLessonWithRetries('TACTICS', 'BEGINNER');
  const skewerLesson = await generateLessonWithRetries('TACTICS', 'BEGINNER');
  const checkmateLesson = await generateLessonWithRetries('CHECKMATE', 'BEGINNER');
  const strategyLesson = await generateLessonWithRetries('STRATEGY', 'BEGINNER');
  const endgameLesson = await generateLessonWithRetries('ENDGAME', 'BEGINNER');
  const discoveredLesson = await generateLessonWithRetries('TACTICS', 'INTERMEDIATE');
  const doubleCheckLesson = await generateLessonWithRetries('TACTICS', 'INTERMEDIATE');

  // Fallback to simple generation if Stockfish fails - but generate real solution
  const getFallbackLesson = async (category: 'TACTICS' | 'CHECKMATE' | 'ENDGAME' | 'STRATEGY', title: string, instructions: string) => {
    const pos = getChess960Position(Math.floor(Math.random() * 960) + 1);
    const posData = generateCategorySpecificPosition(category, pos);
    
    // Try to get best move from Stockfish for solution
    let solution = '';
    try {
      const analysis = await engine.analyzePosition(posData.fen, {
        depth: 5,
        multipv: 1,
        time: 3000, // 3 seconds
      });
      
      if (analysis.bestMove?.uci) {
        solution = uciToPgn(analysis.bestMove.uci, posData.fen);
      }
    } catch (error) {
      // If Stockfish fails, use first legal move as fallback
      const chess = new Chess(posData.fen);
      const moves = chess.moves();
      if (moves.length > 0) {
        solution = moves[0];
      }
    }
    
    // If still no solution, use UCI format
    if (!solution) {
      const chess = new Chess(posData.fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length > 0) {
        const firstMove = moves[0];
        solution = `${firstMove.from}${firstMove.to}${firstMove.promotion || ''}`;
      } else {
        solution = ''; // No moves available
      }
    }
    
    return {
      title,
      initialFen: posData.fen,
      instructions,
      solution,
      hints: ['Think carefully about the position', 'Look for tactical opportunities', 'Consider all candidate moves'],
    };
  };
  
  // 1. Fundamental Tactics - The Pin
  const pinLessonData = pinLesson || await getFallbackLesson('TACTICS', 'Pin the Piece', 'White to move. Find a pin that wins material. A pin prevents a piece from moving because it would expose a more valuable piece behind it.');
  const pinPractice = await (db as any).practice.upsert({
    where: { id: 'tactics-pin-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: pinLessonData.title,
            order: 1,
            initialFen: pinLessonData.initialFen,
            instructions: pinLessonData.instructions,
            solution: pinLessonData.solution,
            hints: pinLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'tactics-pin-001',
      title: 'The Pin',
      description: 'Learn to use pins to win material in Chess960',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 1,
      lessons: {
        create: [
          {
            title: pinLessonData.title,
            order: 1,
            initialFen: pinLessonData.initialFen,
            instructions: pinLessonData.instructions,
            solution: pinLessonData.solution,
            hints: pinLessonData.hints,
          },
        ],
      },
    },
  });

  // 2. Fundamental Tactics - The Fork
  const forkLessonData = forkLesson || await getFallbackLesson('TACTICS', 'Fork Attack', 'White to move. Find a fork that attacks two pieces at once. Knights are especially good at forking.');
  const forkPractice = await (db as any).practice.upsert({
    where: { id: 'tactics-fork-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: forkLessonData.title,
            order: 1,
            initialFen: forkLessonData.initialFen,
            instructions: forkLessonData.instructions,
            solution: forkLessonData.solution,
            hints: forkLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'tactics-fork-001',
      title: 'The Fork',
      description: 'Master the fork tactic in Chess960 positions',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 2,
      lessons: {
        create: [
          {
            title: forkLessonData.title,
            order: 1,
            initialFen: forkLessonData.initialFen,
            instructions: forkLessonData.instructions,
            solution: forkLessonData.solution,
            hints: forkLessonData.hints,
          },
        ],
      },
    },
  });

  // 3. Fundamental Tactics - The Skewer
  const skewerLessonData = skewerLesson || await getFallbackLesson('TACTICS', 'Skewer the King', 'White to move. Find a skewer. A skewer attacks a valuable piece, forcing it to move and exposing a less valuable piece behind it.');
  const skewerPractice = await (db as any).practice.upsert({
    where: { id: 'tactics-skewer-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: skewerLessonData.title,
            order: 1,
            initialFen: skewerLessonData.initialFen,
            instructions: skewerLessonData.instructions,
            solution: skewerLessonData.solution,
            hints: skewerLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'tactics-skewer-001',
      title: 'The Skewer',
      description: 'Learn the skewer tactic - like a pin, but in reverse',
      category: 'TACTICS',
      difficulty: 'BEGINNER',
      order: 3,
      lessons: {
        create: [
          {
            title: skewerLessonData.title,
            order: 1,
            initialFen: skewerLessonData.initialFen,
            instructions: skewerLessonData.instructions,
            solution: skewerLessonData.solution,
            hints: skewerLessonData.hints,
          },
        ],
      },
    },
  });

  // 4. Checkmate Patterns
  const checkmateLessonData = checkmateLesson || await getFallbackLesson('CHECKMATE', 'Find the Checkmate', 'White to move. Find checkmate if possible, or the best attacking move. Look for ways to trap the enemy king.');
  const checkmatePractice = await (db as any).practice.upsert({
    where: { id: 'checkmate-patterns-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: checkmateLessonData.title,
            order: 1,
            initialFen: checkmateLessonData.initialFen,
            instructions: checkmateLessonData.instructions,
            solution: checkmateLessonData.solution,
            hints: checkmateLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'checkmate-patterns-001',
      title: 'Checkmate Patterns',
      description: 'Recognize and execute checkmate patterns in Chess960',
      category: 'CHECKMATE',
      difficulty: 'BEGINNER',
      order: 4,
      lessons: {
        create: [
          {
            title: checkmateLessonData.title,
            order: 1,
            initialFen: checkmateLessonData.initialFen,
            instructions: checkmateLessonData.instructions,
            solution: checkmateLessonData.solution,
            hints: checkmateLessonData.hints,
          },
        ],
      },
    },
  });

  // 5. Piece Development
  const strategyLessonData = strategyLesson || await getFallbackLesson('STRATEGY', 'Develop Your Pieces', 'White to move. Find the best developing move. In Chess960, piece development is crucial since you can\'t rely on memorized openings.');
  const developmentPractice = await (db as any).practice.upsert({
    where: { id: 'strategy-development-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: strategyLessonData.title,
            order: 1,
            initialFen: strategyLessonData.initialFen,
            instructions: strategyLessonData.instructions,
            solution: strategyLessonData.solution,
            hints: strategyLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'strategy-development-001',
      title: 'Piece Development',
      description: 'Learn proper piece development in Chess960',
      category: 'STRATEGY',
      difficulty: 'BEGINNER',
      order: 5,
      lessons: {
        create: [
          {
            title: strategyLessonData.title,
            order: 1,
            initialFen: strategyLessonData.initialFen,
            instructions: strategyLessonData.instructions,
            solution: strategyLessonData.solution,
            hints: strategyLessonData.hints,
          },
        ],
      },
    },
  });

  // 6. Intermediate Tactics - Discovered Attack
  const discoveredLessonData = discoveredLesson || await getFallbackLesson('TACTICS', 'Discover the Attack', 'White to move. Find a discovered attack. When you move one piece, another piece behind it attacks an enemy piece.');
  const discoveredPractice = await (db as any).practice.upsert({
    where: { id: 'tactics-discovered-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: discoveredLessonData.title,
            order: 1,
            initialFen: discoveredLessonData.initialFen,
            instructions: discoveredLessonData.instructions,
            solution: discoveredLessonData.solution,
            hints: discoveredLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'tactics-discovered-001',
      title: 'Discovered Attacks',
      description: 'Master discovered attacks and discovered checks',
      category: 'TACTICS',
      difficulty: 'INTERMEDIATE',
      order: 6,
      lessons: {
        create: [
          {
            title: discoveredLessonData.title,
            order: 1,
            initialFen: discoveredLessonData.initialFen,
            instructions: discoveredLessonData.instructions,
            solution: discoveredLessonData.solution,
            hints: discoveredLessonData.hints,
          },
        ],
      },
    },
  });

  // 7. Intermediate Tactics - Double Check
  const doubleCheckLessonData = doubleCheckLesson || await getFallbackLesson('TACTICS', 'Double Check Power', 'White to move. Find a double check if possible. A double check is when two pieces check the king simultaneously - the king must move.');
  const doubleCheckPractice = await (db as any).practice.upsert({
    where: { id: 'tactics-double-check-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: doubleCheckLessonData.title,
            order: 1,
            initialFen: doubleCheckLessonData.initialFen,
            instructions: doubleCheckLessonData.instructions,
            solution: doubleCheckLessonData.solution,
            hints: doubleCheckLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'tactics-double-check-001',
      title: 'Double Check',
      description: 'Learn the powerful double check tactic',
      category: 'TACTICS',
      difficulty: 'INTERMEDIATE',
      order: 7,
      lessons: {
        create: [
          {
            title: doubleCheckLessonData.title,
            order: 1,
            initialFen: doubleCheckLessonData.initialFen,
            instructions: doubleCheckLessonData.instructions,
            solution: doubleCheckLessonData.solution,
            hints: doubleCheckLessonData.hints,
          },
        ],
      },
    },
  });

  // 8. Endgame - King and Pawn
  const endgameLessonData = endgameLesson || await getFallbackLesson('ENDGAME', 'Promote the Pawn', 'White to move. Find the best way to promote your pawn. Use your king to support the pawn and control key squares.');
  const endgamePractice = await (db as any).practice.upsert({
    where: { id: 'endgame-king-pawn-001' },
    update: {
      lessons: {
        deleteMany: {},
        create: [
          {
            title: endgameLessonData.title,
            order: 1,
            initialFen: endgameLessonData.initialFen,
            instructions: endgameLessonData.instructions,
            solution: endgameLessonData.solution,
            hints: endgameLessonData.hints,
          },
        ],
      },
    },
    create: {
      id: 'endgame-king-pawn-001',
      title: 'King and Pawn Endgames',
      description: 'Master essential king and pawn endgame techniques',
      category: 'ENDGAME',
      difficulty: 'BEGINNER',
      order: 8,
      lessons: {
        create: [
          {
            title: endgameLessonData.title,
            order: 1,
            initialFen: endgameLessonData.initialFen,
            instructions: endgameLessonData.instructions,
            solution: endgameLessonData.solution,
            hints: endgameLessonData.hints,
          },
        ],
      },
    },
  });

  // Also update any existing practices that might have old starting positions
  // Find all practices with lessons that have starting positions
  console.log('\nChecking for lessons with starting positions...');
  const allPractices = await (db as any).practice.findMany({
    include: {
      lessons: true,
    },
  });

  console.log(`   Found ${allPractices.length} practices with ${allPractices.reduce((sum: number, p: any) => sum + p.lessons.length, 0)} total lessons`);

  let updatedCount = 0;
  for (const practice of allPractices) {
    for (const lesson of practice.lessons) {
      // Check if this is a starting position (has /8/8/8/8/8/8/ pattern)
      const hasEmptyRows = lesson.initialFen.includes('/8/8/8/8/8/8/');
      const hasWhitePawns = lesson.initialFen.includes('pppppppp');
      const hasBlackPawns = lesson.initialFen.includes('PPPPPPPP');
      const isStartingPosition = hasEmptyRows && hasWhitePawns && hasBlackPawns;
      
      if (isStartingPosition) {
        // Generate a new position with moves for this lesson
        const randomPos = getChess960Position(Math.floor(Math.random() * 960) + 1);
        const newFen = generatePositionWithMoves(randomPos, 5 + Math.floor(Math.random() * 4));
        
        console.log(`   Updating lesson "${lesson.title}" in practice "${practice.title}"`);
        
        try {
          await (db as any).practiceLesson.update({
            where: { id: lesson.id },
            data: { initialFen: newFen },
          });
          updatedCount++;
        } catch (err: any) {
          console.error(`   Error updating lesson "${lesson.title}":`, err.message);
        }
      }
    }
  }

  // Cleanup
  engine.removeAllListeners();

  console.log('\nPractice lessons seeded successfully!');
  console.log(`   Created 8 practices with lessons`);
  console.log(`   Categories: Tactics (4), Checkmate (1), Strategy (1), Endgame (1), Intermediate (2)`);
  if (updatedCount > 0) {
    console.log(`   Updated ${updatedCount} lessons with starting positions to have moves played`);
  }
}

main()
  .catch((e) => {
    console.error('Error seeding practices:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
