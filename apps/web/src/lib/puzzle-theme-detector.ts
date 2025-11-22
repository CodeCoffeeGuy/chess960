import { Chess } from 'chess.js';

export type PuzzleTheme =
  | 'tactics'
  | 'endgame'
  | 'opening'
  | 'middlegame'
  | 'mate'
  | 'mateIn1'
  | 'mateIn2'
  | 'mateIn3'
  | 'mateIn4'
  | 'mateIn5'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'sacrifice'
  | 'discoveredAttack'
  | 'doubleCheck'
  | 'backRankMate'
  | 'smotheredMate'
  | 'promotion'
  | 'underPromotion'
  | 'castling'
  | 'enPassant'
  | 'hangingPiece'
  | 'trappedPiece'
  | 'deflection'
  | 'attraction'
  | 'clearance'
  | 'interference'
  | 'xRayAttack'
  | 'zugzwang'
  | 'advancedPawn'
  | 'rookEndgame'
  | 'bishopEndgame'
  | 'knightEndgame'
  | 'pawnEndgame'
  | 'queenEndgame';

interface ThemeDetectionResult {
  themes: PuzzleTheme[];
  primaryTheme: PuzzleTheme;
}

/**
 * Detect puzzle themes based on position characteristics and moves
 */
export function detectPuzzleThemes(
  fen: string,
  solutionMoves: string[],
  evaluation: number,
  isCheckmate: boolean
): ThemeDetectionResult {
  const themes: PuzzleTheme[] = [];
  const chess = new Chess(fen);
  const pieceCount = chess.board().flat().filter(p => p !== null).length;
  const pawnCount = chess.board().flat().filter(p => p?.type === 'p').length;
  
  // Phase detection
  if (pieceCount <= 10) {
    themes.push('endgame');
    // Specific endgame types
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
        // Check for captures
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

        // Check for special moves
        if (moveObj.flags.includes('e')) {
          themes.push('enPassant');
        }
        if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) {
          themes.push('castling');
        }

        // Analyze position after move for tactical patterns
        const afterChess = new Chess(chess.fen());
        afterChess.move({ from, to, promotion });

        // Check for discovered attacks
        const piece = chess.get(from);
        if (piece && piece.type !== 'p') {
          // Check if moving this piece reveals an attack
          const attacks = afterChess.moves({ verbose: true });
          const beforeAttacks = chess.moves({ verbose: true });
          if (attacks.length > beforeAttacks.length) {
            themes.push('discoveredAttack');
          }
        }

        // Check for double check
        if (afterChess.isCheck()) {
          const checks = afterChess.moves({ verbose: true }).filter(m => {
            const temp = new Chess(afterChess.fen());
            temp.move(m);
            return temp.isCheck();
          });
          if (checks.length > 1) {
            themes.push('doubleCheck');
          }
        }

        // Check for forks (piece attacks multiple pieces)
        const pieceAfter = afterChess.get(to);
        if (pieceAfter) {
          const attacks = afterChess.moves({ square: to, verbose: true });
          const attackedPieces = attacks
            .map(m => afterChess.get(m.to))
            .filter(p => p !== null);
          if (attackedPieces.length >= 2) {
            themes.push('fork');
          }
        }

        // Check for pins
        const kingSquare = afterChess.board().flat().findIndex(
          (p, i) => p?.type === 'k' && p.color === afterChess.turn()
        );
        if (kingSquare !== -1) {
          const kingPos = {
            rank: Math.floor(kingSquare / 8),
            file: kingSquare % 8,
          };
          // Simplified pin check
          themes.push('pin');
        }
      }
    } catch (error) {
      // Invalid move, skip detailed analysis
    }
  }

  // Default to tactics if no specific theme
  if (themes.length === 0 || (!themes.includes('endgame') && !themes.includes('opening') && !themes.includes('middlegame'))) {
    themes.push('tactics');
  }

  // Determine primary theme (most specific first)
  const priorityOrder: PuzzleTheme[] = [
    'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
    'mate',
    'smotheredMate', 'backRankMate',
    'fork', 'pin', 'skewer',
    'sacrifice', 'discoveredAttack', 'doubleCheck',
    'promotion', 'underPromotion',
    'deflection', 'attraction', 'clearance', 'interference',
    'xRayAttack', 'zugzwang',
    'hangingPiece', 'trappedPiece',
    'rookEndgame', 'bishopEndgame', 'knightEndgame', 'pawnEndgame', 'queenEndgame',
    'endgame',
    'opening', 'middlegame',
    'tactics',
  ];

  const primaryTheme = priorityOrder.find(theme => themes.includes(theme)) || themes[0] || 'tactics';

  return { themes, primaryTheme };
}









