import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { Chess } from 'chess.js';

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

// Check if FEN is a starting position
function isStartingPosition(fen: string): boolean {
  // Extract just the board part (before the first space)
  const boardPart = fen.split(' ')[0];
  
  // Check for empty middle rows (typical of starting position)
  // Format: pieces/pppppppp/8/8/8/8/PPPPPPPP/pieces
  const hasEmptyRows = boardPart.includes('/8/8/8/8/8/8/') || 
                       boardPart.match(/\/8\/8\/8\/8\/8\/8\//) !== null ||
                       (boardPart.split('/').filter(r => r === '8').length >= 6);
  
  // Check for all pawns on starting ranks
  const hasWhitePawns = boardPart.includes('pppppppp');
  const hasBlackPawns = boardPart.includes('PPPPPPPP');
  
  // Check if it's a Chess960 starting position pattern
  // Chess960 starting positions have all pieces on back ranks and all pawns on 2nd/7th ranks
  const rows = boardPart.split('/');
  if (rows.length !== 8) return false;
  
  // Check if rows 1 and 8 have pieces (back ranks) and rows 2 and 7 have all pawns
  const row1 = rows[0]; // Black back rank
  const row2 = rows[1]; // Black pawns
  const row7 = rows[6]; // White pawns
  const row8 = rows[7]; // White back rank
  
  const hasAllPawnsOnRow2 = row2 === 'pppppppp';
  const hasAllPawnsOnRow7 = row7 === 'PPPPPPPP';
  const hasPiecesOnBackRanks = row1.length >= 8 && row8.length >= 8;
  const hasEmptyMiddleRows = rows.slice(2, 6).every(r => r === '8');
  
  return hasAllPawnsOnRow2 && hasAllPawnsOnRow7 && hasPiecesOnBackRanks && hasEmptyMiddleRows;
}

async function main() {
  console.log('Fixing practice lessons with starting positions...\n');

  try {
    // Get all practices with lessons
    const allPractices = await (db as any).practice.findMany({
      include: {
        lessons: true,
      },
    });

    console.log(`Found ${allPractices.length} practices with ${allPractices.reduce((sum: number, p: any) => sum + p.lessons.length, 0)} total lessons\n`);

    let updatedCount = 0;
    for (const practice of allPractices) {
      for (const lesson of practice.lessons) {
        if (isStartingPosition(lesson.initialFen)) {
          // Generate a new position with moves for this lesson
          const randomPos = getChess960Position(Math.floor(Math.random() * 960) + 1);
          const numMoves = 5 + Math.floor(Math.random() * 4); // 5-8 moves
          const newFen = generatePositionWithMoves(randomPos, numMoves);
          
          console.log(`   Updating lesson "${lesson.title}" in practice "${practice.title}"`);
          console.log(`     Old FEN: ${lesson.initialFen.substring(0, 50)}...`);
          console.log(`     New FEN: ${newFen.substring(0, 50)}...`);
          
          try {
            await (db as any).practiceLesson.update({
              where: { id: lesson.id },
              data: { initialFen: newFen },
            });
            updatedCount++;
            console.log(`     Updated successfully\n`);
          } catch (err: any) {
            console.error(`     Error: ${err.message}\n`);
          }
        }
      }
    }

    console.log(`\nFixed ${updatedCount} lessons with starting positions!`);
  } catch (error) {
    console.error('Error fixing positions:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

