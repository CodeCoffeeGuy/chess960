import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { StockfishVsStockfishGenerator } from '@chess960/puzzle-generator';
import { detectPuzzleThemes } from '../../../apps/web/src/lib/puzzle-theme-detector';

/**
 * Generate endgame puzzles by having Stockfish play against Stockfish.
 * Plays longer games (50-80 moves) to reach endgame positions, then extracts puzzles.
 */
async function generateEndgamePuzzlesStockfishVsStockfish(count: number = 50) {
  try {
    console.log(`\n🎯 Generating ${count} endgame puzzles using Stockfish vs Stockfish...\n`);

    // Create two Stockfish engines with increased timeout
    const engine1 = new StockfishEngine(); // Stronger engine
    const engine2 = new StockfishEngine(); // Weaker engine
    
    // Set max listeners to avoid warnings
    engine1.setMaxListeners(50);
    engine2.setMaxListeners(50);
    
    console.log('Waiting for Stockfish engines to initialize...');
    try {
      await engine1.isReady();
      await engine2.isReady();
      console.log('Stockfish engines ready\n');
    } catch (error) {
      console.error('Error initializing engines:', error);
      // Retry initialization
      console.log('Retrying engine initialization...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        await engine1.isReady();
        await engine2.isReady();
        console.log('Stockfish engines ready after retry\n');
      } catch (retryError) {
        console.error('Failed to initialize engines after retry:', retryError);
        throw retryError;
      }
    }
    
    const generator = new StockfishVsStockfishGenerator(engine1, engine2);

    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let attempts = 0;
    const maxAttempts = count * 15; // Allow more attempts for endgame positions

    // Save puzzle to database
    const savePuzzle = async (puzzleCandidate: any): Promise<boolean> => {
      try {
        // Check if puzzle already exists with this FEN
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: puzzleCandidate.fen },
        });

        if (existing) {
          puzzlesSkipped++;
          return false;
        }

        // Check if it's an endgame position
        const chess = new (await import('chess.js')).Chess(puzzleCandidate.fen);
        const pieceCount = chess.board().flat().filter(p => p !== null).length;
        
        if (pieceCount > 12) {
          // Not an endgame position, skip
          return false;
        }

        // Detect themes
        const themesResult = detectPuzzleThemes(
          puzzleCandidate.fen,
          puzzleCandidate.moves || [puzzleCandidate.solution],
          puzzleCandidate.evaluation || 0,
          false
        );

        // Only save if it has endgame-related themes
        const hasEndgameTheme = themesResult.themes.some(t => 
          ['endgame', 'promotion', 'underPromotion', 'pawnEndgame', 'rookEndgame', 
           'bishopEndgame', 'knightEndgame', 'queenEndgame'].includes(t)
        );

        if (!hasEndgameTheme) {
          // Add endgame theme if it's an endgame position
          themesResult.themes.push('endgame');
        }

        // Create a dummy game record for the puzzle
        const dummyGame = await db.game.create({
          data: {
            whiteId: null,
            blackId: null,
            tc: 'TWO_PLUS_ZERO' as any,
            rated: false,
            variant: 'CHESS960' as any,
            chess960Position: puzzleCandidate.chess960Position,
            startedAt: new Date(),
            endedAt: new Date(),
            result: 'draw',
            whiteTimeMs: 120000,
            blackTimeMs: 120000,
            whiteIncMs: 0,
            blackIncMs: 0,
          },
        });

        // Create puzzle with themes
        const puzzle = await (db as any).puzzle.create({
          data: {
            gameId: dummyGame.id,
            fen: puzzleCandidate.fen,
            solution: puzzleCandidate.solution,
            moves: puzzleCandidate.moves || [puzzleCandidate.solution],
            rating: puzzleCandidate.rating,
            plays: 0,
            votes: 0,
            themes: themesResult.themes,
          },
        });

        puzzlesCreated++;
        console.log(`  ✅ Created puzzle ${puzzlesCreated}/${count} - ID: ${puzzle.id}`);
        console.log(`     Themes: ${themesResult.themes.join(', ')}`);
        console.log(`     Rating: ${puzzle.rating}, Pieces: ${pieceCount}`);
        return true;
      } catch (error) {
        console.error(`  ❌ Error saving puzzle:`, error);
        return false;
      }
    };

    // Generate target ratings: 1200, 1250, 1300, 1350, ..., up to 1800
    const targetRatings: number[] = [];
    for (let rating = 1200; rating <= 1800; rating += 50) {
      targetRatings.push(rating);
    }

    console.log(`📊 Target ratings: ${targetRatings.join(', ')}\n`);

    // Custom puzzle generation loop for endgame positions
    while (puzzlesCreated < count && attempts < maxAttempts) {
      attempts++;
      
      if (attempts % 10 === 0) {
        console.log(`\n[Attempt ${attempts}] Puzzles created: ${puzzlesCreated}/${count}\n`);
      }

      try {
        // Pick a random target rating
        const targetRating = targetRatings[Math.floor(Math.random() * targetRatings.length)];

        // Generate puzzle with longer game (50-80 moves to reach endgame)
        const candidate = await generator.generatePuzzleFromGame({
          getChess960Position,
          targetRating,
          minMoves: 40, // Start checking for puzzles after 40 moves (reduced for speed)
          maxMoves: 60, // Play up to 60 moves (reduced for speed)
          depth: 8, // Reduced depth for faster generation
        });

        if (candidate) {
          // Check if it's an endgame position
          const Chess = (await import('chess.js')).Chess;
          const chess = new Chess(candidate.fen);
          const pieceCount = chess.board().flat().filter(p => p !== null).length;
          
          if (pieceCount <= 12) {
            // It's an endgame position, save it
            await savePuzzle(candidate);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`  Error in attempt ${attempts}:`, error);
        }
        continue;
      }
    }

    console.log(`\n✅ Generation complete!`);
    console.log(`   Created: ${puzzlesCreated}`);
    console.log(`   Skipped: ${puzzlesSkipped}`);
    console.log(`   Attempts: ${attempts}`);

    // Clean up engines
    engine1.removeAllListeners();
    engine2.removeAllListeners();
    
    await db.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error generating endgame puzzles:', error);
    process.exit(1);
  }
}

// Get count from command line or use default
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 50;

if (isNaN(count) || count < 1) {
  console.error('Invalid count. Please provide a positive number.');
  process.exit(1);
}

// Run the generation
generateEndgamePuzzlesStockfishVsStockfish(count);

