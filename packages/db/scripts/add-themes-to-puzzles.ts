import { db } from '@chess960/db';
import { Chess } from 'chess.js';

// Enhanced theme detection
async function detectThemes(puzzle: any): Promise<string[]> {
  const themes: string[] = [];
  
  try {
    const chess = new Chess(puzzle.fen);
    const board = chess.board();
    const pieceCount = board.flat().filter(p => p !== null).length;
    const pawnCount = board.flat().filter(p => p?.type === 'p').length;
    
    // Phase detection
    if (pieceCount <= 10) {
      themes.push('endgame');
      
      const pieces = board.flat().filter(p => p !== null);
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
    
    // Analyze solution moves in detail
    const solutionMoves = puzzle.moves || [puzzle.solution];
    if (solutionMoves.length > 0) {
      const firstMove = solutionMoves[0];
      if (firstMove && firstMove.length >= 4) {
        const from = firstMove.slice(0, 2);
        const to = firstMove.slice(2, 4);
        const promotion = firstMove.length > 4 ? firstMove[4] : undefined;
        
        try {
          const tempChess = new Chess(puzzle.fen);
          const move = tempChess.move({ from, to, promotion: promotion as any });
          
          if (move) {
            // Check for checkmate
            if (tempChess.isCheckmate()) {
              themes.push('mate');
              if (solutionMoves.length === 1) themes.push('mateIn1');
              else if (solutionMoves.length === 2) themes.push('mateIn2');
              else if (solutionMoves.length === 3) themes.push('mateIn3');
              else if (solutionMoves.length === 4) themes.push('mateIn4');
              else if (solutionMoves.length >= 5) themes.push('mateIn5');
            }
            
            // Always add tactics for tactical puzzles
            themes.push('tactics');
            
            // Check for captures (common in tactics)
            if (move.captured) {
              // Could be fork, pin, skewer, etc.
              const piece = tempChess.get(to);
              if (piece) {
                const attacks = tempChess.moves({ square: to, verbose: true });
                const attackedPieces = attacks
                  .map(m => tempChess.get(m.to))
                  .filter(p => p !== null && p.color !== piece.color);
                if (attackedPieces.length >= 2) {
                  themes.push('fork');
                }
              }
            }
            
            // Check for checks
            if (tempChess.isCheck()) {
              // Could be discovered attack or double check
              const checks = tempChess.moves({ verbose: true }).filter(m => {
                const test = new Chess(tempChess.fen());
                test.move(m);
                return test.isCheck();
              });
              if (checks.length > 1) {
                themes.push('doubleCheck');
              }
            }
            
            // Check piece type and special moves
            if (move.piece === 'p') {
              if (move.promotion) {
                themes.push('promotion');
                if (move.promotion !== 'q') {
                  themes.push('underPromotion');
                }
              }
              if (move.flags?.includes('e')) {
                themes.push('enPassant');
              }
            }
            
            if (move.flags?.includes('k') || move.flags?.includes('q')) {
              themes.push('castling');
            }
            
            // Check for sacrifice (piece value decreases)
            const pieceValue: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
            const fromPiece = chess.get(from);
            const toPiece = chess.get(to);
            if (fromPiece && toPiece && pieceValue[fromPiece.type] > pieceValue[toPiece.type]) {
              themes.push('sacrifice');
            }
          }
        } catch (e) {
          // Move analysis failed, still add tactics
          themes.push('tactics');
        }
      }
    }
    
    // Ensure we have at least phase and tactics
    if (!themes.some(t => ['opening', 'middlegame', 'endgame'].includes(t))) {
      if (pieceCount >= 20) themes.push('opening');
      else if (pieceCount <= 10) themes.push('endgame');
      else themes.push('middlegame');
    }
    
    if (!themes.includes('tactics')) {
      themes.push('tactics');
    }
    
  } catch (error) {
    console.error(`Error detecting themes for puzzle ${puzzle.id}:`, error);
    // Fallback
    themes.push('tactics');
    themes.push('opening');
  }
  
  return [...new Set(themes)]; // Remove duplicates
}

async function addThemesToPuzzles() {
  try {
    console.log('Adding themes to puzzles...\n');
    
    // Get all puzzles without themes
    const puzzles = await (db as any).puzzle.findMany({
      select: {
        id: true,
        fen: true,
        solution: true,
        moves: true,
        rating: true,
      },
    });
    
    console.log(`Found ${puzzles.length} puzzles to process\n`);
    
    let updated = 0;
    let errors = 0;
    
    for (const puzzle of puzzles) {
      try {
        const themes = await detectThemes(puzzle);
        
        await (db as any).puzzle.update({
          where: { id: puzzle.id },
          data: { themes },
        });
        
        updated++;
        if (updated % 10 === 0) {
          console.log(`Updated ${updated}/${puzzles.length} puzzles...`);
        }
      } catch (error) {
        console.error(`Error updating puzzle ${puzzle.id}:`, error);
        errors++;
      }
    }
    
    console.log(`\n✅ Completed!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    
    // Verify
    const puzzlesWithThemes = await (db as any).puzzle.count({
      where: {
        themes: {
          isEmpty: false,
        },
      },
    });
    
    console.log(`\nPuzzles with themes: ${puzzlesWithThemes}/${puzzles.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding themes to puzzles:', error);
    process.exit(1);
  }
}

addThemesToPuzzles();

