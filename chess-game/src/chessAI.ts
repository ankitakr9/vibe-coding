import { Square, ChessPiece, BoardState, Color, Difficulty, PieceType } from './types';
import { ChessGameState, getAllLegalMoves, makeMove, cloneGameState, isKingInCheck } from './chessEngine';

// Points for each piece type
const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (PST): Positional value bonuses based on where the piece is.
// From White's perspective (index 0 is row 0, which is White's back rank if inverted,
// but usually we represent index 0 as row 0 (top of board, i.e., black's side) and index 7 as row 7 (bottom, white's side)).
// Let's standardise: index 0 is rank 8 (black's back rank), index 7 is rank 1 (white's back rank).
// So, for White: we want white pawns to progress from row 6 (rank 2) to row 1 (rank 7) or row 0 (rank 8).
// The matrices below are oriented such that row 0 is top (index 0) and row 7 is bottom (index 7).
// White pieces start at row 7/6 and move up. Black pieces start at row 0/1 and move down.

const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

// King Middle Game PST
const KING_MID_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

// King End Game PST
const KING_END_PST = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50]
];

// Evaluate the absolute positional score of the board for a color
// (Positive if color is doing well, negative if opponent is doing well)
export function evaluateBoard(board: BoardState, isEndGame = false): number {
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const type = piece.type;
        const color = piece.color;
        
        // Base material score
        let pieceVal = PIECE_VALUES[type];
        
        // Positional square score (invert row index for black pieces)
        let pstVal = 0;
        const mapRow = color === 'w' ? r : 7 - r;
        const mapCol = color === 'w' ? c : 7 - c;

        switch (type) {
          case 'p':
            pstVal = PAWN_PST[mapRow][mapCol];
            break;
          case 'n':
            pstVal = KNIGHT_PST[mapRow][mapCol];
            break;
          case 'b':
            pstVal = BISHOP_PST[mapRow][mapCol];
            break;
          case 'r':
            pstVal = ROOK_PST[mapRow][mapCol];
            break;
          case 'q':
            pstVal = QUEEN_PST[mapRow][mapCol];
            break;
          case 'k':
            pstVal = isEndGame ? KING_END_PST[mapRow][mapCol] : KING_MID_PST[mapRow][mapCol];
            break;
        }

        const totalValue = pieceVal + pstVal;
        if (color === 'w') {
          score += totalValue;
        } else {
          score -= totalValue;
        }
      }
    }
  }

  return score;
}

// Check if it's the endgame (fewer major pieces on board)
function isEndgameScenario(board: BoardState): boolean {
  let majorPiecesCount = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type !== 'p' && piece.type !== 'k') {
        majorPiecesCount++;
      }
    }
  }
  // If 4 or fewer major pieces, it's generally considered endgame
  return majorPiecesCount <= 4;
}

// Sorts moves to optimize Alpha-Beta search.
// Search works fastest if we analyze captures and checks first.
function orderMoves(board: BoardState, moves: { from: Square; to: Square }[]): { from: Square; to: Square }[] {
  return moves.map((m) => {
    let score = 0;
    const movingPiece = board[m.from.row][m.from.col];
    const targetPiece = board[m.to.row][m.to.col];

    if (movingPiece) {
      // 1. MVV-LVA (Most Valuable Victim - Least Valuable Attacker) for captures
      if (targetPiece) {
        score += 10 * PIECE_VALUES[targetPiece.type] - PIECE_VALUES[movingPiece.type];
      }

      // 2. Pawns promoting is a high priority
      if (movingPiece.type === 'p' && (m.to.row === 0 || m.to.row === 7)) {
        score += 900;
      }
    }
    return { ...m, score };
  })
  .sort((a, b) => b.score - a.score);
}

// Alpha-Beta Minimax search
// Returns [bestScore, bestMove]
function alphaBetaSearch(
  state: ChessGameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean,
  isEndGame: boolean
): [number, { from: Square; to: Square } | null] {
  if (depth === 0 || state.status !== 'playing') {
    // Return board evaluation from White's perspective (maximizing)
    return [evaluateBoard(state.board, isEndGame), null];
  }

  const legalMoves = getAllLegalMoves(state);
  if (legalMoves.length === 0) {
    const inCheck = isKingInCheck(state.board, state.activeColor);
    if (inCheck) {
      // Checkmate: White checkmated Black (White wins, high score) or vice versa
      return [isMaximizingPlayer ? -30000 + (4 - depth) : 30000 - (4 - depth), null];
    }
    return [0, null]; // Draw / Stalemate
  }

  // Order moves for optimal pruning
  const ordered = orderMoves(state.board, legalMoves);

  let bestMove: { from: Square; to: Square } | null = null;

  if (isMaximizingPlayer) { // White is maximizing
    let maxEval = -Infinity;
    for (const move of ordered) {
      const nextState = makeMove(state, move.from, move.to);
      const [evaluation] = alphaBetaSearch(nextState, depth - 1, alpha, beta, false, isEndGame);
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // Pruning
      }
    }
    return [maxEval, bestMove];
  } else { // Black is minimizing
    let minEval = Infinity;
    for (const move of ordered) {
      const nextState = makeMove(state, move.from, move.to);
      const [evaluation] = alphaBetaSearch(nextState, depth - 1, alpha, beta, true, isEndGame);
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // Pruning
      }
    }
    return [minEval, bestMove];
  }
}

// Main AI action entry point
// Returns the chosen move and an evaluation score
export function getAIMove(
  state: ChessGameState,
  difficulty: Difficulty
): { from: Square; to: Square } | null {
  const legalMoves = getAllLegalMoves(state);
  if (legalMoves.length === 0) return null;

  const isMaximizing = state.activeColor === 'w';
  const isEndGame = isEndgameScenario(state.board);

  switch (difficulty) {
    case 'easy': {
      // Easy AI: 75% random moves, 25% simple capture moves
      if (Math.random() < 0.75) {
        const randIndex = Math.floor(Math.random() * legalMoves.length);
        return legalMoves[randIndex];
      }
      // Simple evaluation (depth 1)
      const [, move] = alphaBetaSearch(state, 1, -Infinity, Infinity, isMaximizing, isEndGame);
      return move || legalMoves[0];
    }

    case 'medium': {
      // Medium AI: Depth 2 Minimax search
      const [, move] = alphaBetaSearch(state, 2, -Infinity, Infinity, isMaximizing, isEndGame);
      return move || legalMoves[0];
    }

    case 'hard': {
      // Hard AI: Depth 3 Alpha-Beta Minimax search
      const [, move] = alphaBetaSearch(state, 3, -Infinity, Infinity, isMaximizing, isEndGame);
      return move || legalMoves[0];
    }

    case 'master': {
      // Master AI: Depth 4 Alpha-Beta Minimax search (extremely clever)
      const [, move] = alphaBetaSearch(state, 4, -Infinity, Infinity, isMaximizing, isEndGame);
      return move || legalMoves[0];
    }

    default:
      return legalMoves[0];
  }
}
