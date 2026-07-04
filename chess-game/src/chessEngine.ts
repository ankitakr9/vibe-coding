import {
  Square,
  ChessPiece,
  BoardState,
  Move,
  Color,
  PieceType,
  GameStatus,
} from './types';

export interface ChessGameState {
  board: BoardState;
  activeColor: Color;
  castlingRights: {
    w: { kingSide: boolean; queenSide: boolean };
    b: { kingSide: boolean; queenSide: boolean };
  };
  enPassantTarget: Square | null; // Square where a double-stepped pawn is located (for capture detection)
  halfmoveClock: number; // For the 50-move rule
  fullmoveNumber: number;
  moveHistory: Move[];
  status: GameStatus;
  winner: Color | null;
  positionHistory: string[]; // FEN-like strings for 3-fold repetition detection
}

// Generate unique IDs for chess pieces to keep React renders stable and allow key tracking
let pieceIdCounter = 0;
export function createPiece(type: PieceType, color: Color): ChessPiece {
  return {
    id: `${color}${type}-${pieceIdCounter++}`,
    type,
    color,
    hasMoved: false,
  };
}

// Deep clone board state
export function cloneBoard(board: BoardState): BoardState {
  return board.map((row) =>
    row.map((cell) => (cell ? { ...cell } : null))
  );
}

// Deep clone game state
export function cloneGameState(state: ChessGameState): ChessGameState {
  return {
    board: cloneBoard(state.board),
    activeColor: state.activeColor,
    castlingRights: {
      w: { ...state.castlingRights.w },
      b: { ...state.castlingRights.b },
    },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    moveHistory: [...state.moveHistory],
    status: state.status,
    winner: state.winner,
    positionHistory: [...state.positionHistory],
  };
}

// Initialize board with standard chess setup
export function createInitialBoard(): BoardState {
  const board: BoardState = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Rooks
  board[0][0] = createPiece('r', 'b');
  board[0][7] = createPiece('r', 'b');
  board[7][0] = createPiece('r', 'w');
  board[7][7] = createPiece('r', 'w');

  // Knights
  board[0][1] = createPiece('n', 'b');
  board[0][6] = createPiece('n', 'b');
  board[7][1] = createPiece('n', 'w');
  board[7][6] = createPiece('n', 'w');

  // Bishops
  board[0][2] = createPiece('b', 'b');
  board[0][5] = createPiece('b', 'b');
  board[7][2] = createPiece('b', 'w');
  board[7][5] = createPiece('b', 'w');

  // Queens
  board[0][3] = createPiece('q', 'b');
  board[7][3] = createPiece('q', 'w');

  // Kings
  board[0][4] = createPiece('k', 'b');
  board[7][4] = createPiece('k', 'w');

  // Pawns
  for (let col = 0; col < 8; col++) {
    board[1][col] = createPiece('p', 'b');
    board[6][col] = createPiece('p', 'w');
  }

  return board;
}

export function createInitialState(): ChessGameState {
  const state: ChessGameState = {
    board: createInitialBoard(),
    activeColor: 'w',
    castlingRights: {
      w: { kingSide: true, queenSide: true },
      b: { kingSide: true, queenSide: true },
    },
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    moveHistory: [],
    status: 'setup',
    winner: null,
    positionHistory: [],
  };

  state.positionHistory.push(generatePositionKey(state));
  return state;
}

// Helper to check if row and col are within board bounds
export function isWithinBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Generate FEN-like position key for threefold repetition check
export function generatePositionKey(state: ChessGameState): string {
  let fenRows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    let rowStr = '';
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const char = piece.type === 'n' ? 'n' : piece.type;
        rowStr += piece.color === 'w' ? char.toUpperCase() : char;
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    fenRows.push(rowStr);
  }

  const boardPart = fenRows.join('/');
  const activeColorPart = state.activeColor;
  
  // Castling rights part
  let castling = '';
  if (state.castlingRights.w.kingSide) castling += 'K';
  if (state.castlingRights.w.queenSide) castling += 'Q';
  if (state.castlingRights.b.kingSide) castling += 'k';
  if (state.castlingRights.b.queenSide) castling += 'q';
  if (castling === '') castling = '-';

  // En passant part
  let ep = '-';
  if (state.enPassantTarget) {
    const colName = String.fromCharCode(97 + state.enPassantTarget.col);
    const rowName = 8 - state.enPassantTarget.row;
    ep = `${colName}${rowName}`;
  }

  return `${boardPart} ${activeColorPart} ${castling} ${ep}`;
}

// Convert Square object to algebraic coordinate (e.g. "e4")
export function squareToAlgebraic(sq: Square): string {
  const file = String.fromCharCode(97 + sq.col);
  const rank = 8 - sq.row;
  return `${file}${rank}`;
}

// Generate Standard Algebraic Notation for a move
export function generateSAN(
  boardBefore: BoardState,
  from: Square,
  to: Square,
  piece: ChessPiece,
  captured: ChessPiece | null,
  isCastling: 'king' | 'queen' | null,
  promotion: PieceType | null,
  isCheck: boolean,
  isMate: boolean
): string {
  if (isCastling === 'king') return 'O-O';
  if (isCastling === 'queen') return 'O-O-O';

  let san = '';

  if (piece.type === 'p') {
    if (captured) {
      const fileFrom = String.fromCharCode(97 + from.col);
      san += `${fileFrom}x`;
    }
    san += squareToAlgebraic(to);
    if (promotion) {
      san += `=${promotion.toUpperCase()}`;
    }
  } else {
    // Piece designation
    const pieceChar = piece.type.toUpperCase();
    san += pieceChar;

    // Disambiguation: Check if other pieces of same type and color can move to the same square
    // We search the board for other pieces that can reach 'to'
    let needsFile = false;
    let needsRank = false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === from.row && c === from.col) continue;
        const otherPiece = boardBefore[r][c];
        if (
          otherPiece &&
          otherPiece.type === piece.type &&
          otherPiece.color === piece.color
        ) {
          // If other piece can move to the same square
          const pseudoMoves = getPseudoLegalMovesForPiece(boardBefore, { row: r, col: c });
          const otherCanMove = pseudoMoves.some((m) => m.row === to.row && m.col === to.col);
          if (otherCanMove) {
            if (c !== from.col) {
              needsFile = true;
            } else {
              needsRank = true;
            }
          }
        }
      }
    }

    if (needsFile) {
      san += String.fromCharCode(97 + from.col);
    }
    if (needsRank) {
      san += 8 - from.row;
    }

    if (captured) {
      san += 'x';
    }
    san += squareToAlgebraic(to);
  }

  if (isMate) {
    san += '#';
  } else if (isCheck) {
    san += '+';
  }

  return san;
}

// Generate pseudo-legal moves (ignoring check exposure) for a piece at `from`
export function getPseudoLegalMovesForPiece(
  board: BoardState,
  from: Square,
  enPassantTarget: Square | null = null,
  castlingRights: {
    w: { kingSide: boolean; queenSide: boolean };
    b: { kingSide: boolean; queenSide: boolean };
  } | null = null
): Square[] {
  const piece = board[from.row][from.col];
  if (!piece) return [];

  const moves: Square[] = [];
  const { row, col } = from;
  const color = piece.color;
  const dir = color === 'w' ? -1 : 1; // White moves up, Black moves down

  switch (piece.type) {
    case 'p': {
      // 1. One square forward
      const nextRow = row + dir;
      if (isWithinBounds(nextRow, col) && board[nextRow][col] === null) {
        moves.push({ row: nextRow, col });

        // 2. Two squares forward (initial step)
        const isInitialRow = color === 'w' ? row === 6 : row === 1;
        const doubleRow = row + 2 * dir;
        if (isInitialRow && board[doubleRow][col] === null) {
          moves.push({ row: doubleRow, col });
        }
      }

      // 3. Captures (including diagonal and en passant)
      const captureCols = [col - 1, col + 1];
      for (const nextCol of captureCols) {
        if (isWithinBounds(nextRow, nextCol)) {
          const targetPiece = board[nextRow][nextCol];
          if (targetPiece && targetPiece.color !== color) {
            moves.push({ row: nextRow, col: nextCol });
          } else if (
            enPassantTarget &&
            enPassantTarget.row === row && // Adjacent row
            enPassantTarget.col === nextCol // Adjacent col
          ) {
            // Target pawn was double-stepped, so the capture square is behind it
            moves.push({ row: nextRow, col: nextCol });
          }
        }
      }
      break;
    }

    case 'n': {
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of knightOffsets) {
        const r = row + dr;
        const c = col + dc;
        if (isWithinBounds(r, c)) {
          const target = board[r][c];
          if (target === null || target.color !== color) {
            moves.push({ row: r, col: c });
          }
        }
      }
      break;
    }

    case 'b':
    case 'r':
    case 'q': {
      const dirs: [number, number][] = [];
      if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }

      for (const [dr, dc] of dirs) {
        let r = row + dr;
        let c = col + dc;
        while (isWithinBounds(r, c)) {
          const target = board[r][c];
          if (target === null) {
            moves.push({ row: r, col: c });
          } else {
            if (target.color !== color) {
              moves.push({ row: r, col: c });
            }
            break; // Blocked by piece
          }
          r += dr;
          c += dc;
        }
      }
      break;
    }

    case 'k': {
      const kingDirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      for (const [dr, dc] of kingDirs) {
        const r = row + dr;
        const c = col + dc;
        if (isWithinBounds(r, c)) {
          const target = board[r][c];
          if (target === null || target.color !== color) {
            moves.push({ row: r, col: c });
          }
        }
      }

      // Castling pseudo-legal moves (King-side and Queen-side)
      if (castlingRights) {
        const rights = color === 'w' ? castlingRights.w : castlingRights.b;
        const r = color === 'w' ? 7 : 0;

        // Check King side
        if (rights.kingSide && board[r][4]?.type === 'k' && !board[r][4].hasMoved) {
          if (board[r][5] === null && board[r][6] === null) {
            const rook = board[r][7];
            if (rook && rook.type === 'r' && rook.color === color && !rook.hasMoved) {
              moves.push({ row: r, col: 6 });
            }
          }
        }

        // Check Queen side
        if (rights.queenSide && board[r][4]?.type === 'k' && !board[r][4].hasMoved) {
          if (board[r][3] === null && board[r][2] === null && board[r][1] === null) {
            const rook = board[r][0];
            if (rook && rook.type === 'r' && rook.color === color && !rook.hasMoved) {
              moves.push({ row: r, col: 2 });
            }
          }
        }
      }
      break;
    }
  }

  return moves;
}

// Find square containing King of specified color
export function findKing(board: BoardState, color: Color): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// Check if square is attacked by color
export function isSquareAttacked(board: BoardState, sq: Square, attackerColor: Color): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === attackerColor) {
        // En passant and castling are irrelevant for attack checks
        const pseudoMoves = getPseudoLegalMovesForPiece(board, { row: r, col: c }, null, null);
        if (pseudoMoves.some((m) => m.row === sq.row && m.col === sq.col)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Check if King is in check
export function isKingInCheck(board: BoardState, color: Color): boolean {
  const kingSq = findKing(board, color);
  if (!kingSq) return false;
  const opponent = color === 'w' ? 'b' : 'w';
  return isSquareAttacked(board, kingSq, opponent);
}

// Get only strictly legal moves for a piece at `from`
export function getLegalMoves(state: ChessGameState, from: Square): Square[] {
  const piece = state.board[from.row][from.col];
  if (!piece || piece.color !== state.activeColor) return [];

  // Filter out pseudo-legal moves that result in our King being in check
  const pseudoMoves = getPseudoLegalMovesForPiece(
    state.board,
    from,
    state.enPassantTarget,
    state.castlingRights
  );

  const legalMoves: Square[] = [];
  const color = piece.color;
  const opponent = color === 'w' ? 'b' : 'w';

  for (const moveSq of pseudoMoves) {
    // Castling special check: cannot castle out of check, through check, or into check
    const isCastleMove = piece.type === 'k' && Math.abs(moveSq.col - from.col) === 2;
    if (isCastleMove) {
      // 1. Cannot castle out of check
      if (isKingInCheck(state.board, color)) continue;

      const r = color === 'w' ? 7 : 0;
      const stepCol = moveSq.col === 6 ? 5 : 3; // Square crossed by King

      // 2. Cannot pass through an attacked square
      if (isSquareAttacked(state.board, { row: r, col: stepCol }, opponent)) continue;
      // 3. Cannot land on an attacked square
      if (isSquareAttacked(state.board, moveSq, opponent)) continue;
    }

    // Simulate move
    const simulatedBoard = cloneBoard(state.board);
    const targetPiece = simulatedBoard[moveSq.row][moveSq.col];

    // Handle en passant capture in simulation
    let isEP = false;
    if (
      piece.type === 'p' &&
      state.enPassantTarget &&
      state.enPassantTarget.row === from.row &&
      state.enPassantTarget.col === moveSq.col &&
      Math.abs(moveSq.col - from.col) === 1
    ) {
      isEP = true;
    }

    // Apply move to simulation board
    simulatedBoard[moveSq.row][moveSq.col] = simulatedBoard[from.row][from.col];
    simulatedBoard[from.row][from.col] = null;
    if (isEP) {
      simulatedBoard[from.row][moveSq.col] = null; // Remove en passant captured pawn
    }

    // Verify if king is safe in simulated state
    if (!isKingInCheck(simulatedBoard, color)) {
      legalMoves.push(moveSq);
    }
  }

  return legalMoves;
}

// Generate all legal moves for current active color
export function getAllLegalMoves(state: ChessGameState): { from: Square; to: Square }[] {
  const allMoves: { from: Square; to: Square }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (piece && piece.color === state.activeColor) {
        const legalSqs = getLegalMoves(state, { row: r, col: c });
        for (const toSq of legalSqs) {
          allMoves.push({ from: { row: r, col: c }, to: toSq });
        }
      }
    }
  }
  return allMoves;
}

// Check if material is insufficient for checkmate
export function isInsufficientMaterial(board: BoardState): boolean {
  let whitePieces: ChessPiece[] = [];
  let blackPieces: ChessPiece[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        if (piece.color === 'w') whitePieces.push(piece);
        else blackPieces.push(piece);
      }
    }
  }

  const whiteCount = whitePieces.length;
  const blackCount = blackPieces.length;

  // King vs King
  if (whiteCount === 1 && blackCount === 1) return true;

  // King + Knight vs King
  if (
    (whiteCount === 2 && blackCount === 1 && whitePieces.some((p) => p.type === 'n')) ||
    (whiteCount === 1 && blackCount === 2 && blackPieces.some((p) => p.type === 'n'))
  ) {
    return true;
  }

  // King + Bishop vs King
  if (
    (whiteCount === 2 && blackCount === 1 && whitePieces.some((p) => p.type === 'b')) ||
    (whiteCount === 1 && blackCount === 2 && blackPieces.some((p) => p.type === 'b'))
  ) {
    return true;
  }

  // King + Bishop vs King + Bishop where Bishops are on same colored square
  if (whiteCount === 2 && blackCount === 2) {
    const whiteBishop = whitePieces.find((p) => p.type === 'b');
    const blackBishop = blackPieces.find((p) => p.type === 'b');

    if (whiteBishop && blackBishop) {
      // Find bishop squares
      let whiteBishopSq: Square | null = null;
      let blackBishopSq: Square | null = null;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece) {
            if (piece.id === whiteBishop.id) whiteBishopSq = { row: r, col: c };
            if (piece.id === blackBishop.id) blackBishopSq = { row: r, col: c };
          }
        }
      }

      if (whiteBishopSq && blackBishopSq) {
        const isWhiteBishopLight = (whiteBishopSq.row + whiteBishopSq.col) % 2 === 0;
        const isBlackBishopLight = (blackBishopSq.row + blackBishopSq.col) % 2 === 0;
        if (isWhiteBishopLight === isBlackBishopLight) {
          return true;
        }
      }
    }
  }

  return false;
}

// Executes a move, returns a new state object.
// If the move triggers pawn promotion, `promotionType` dictates which piece (defaults to 'q')
export function makeMove(
  state: ChessGameState,
  from: Square,
  to: Square,
  promotionType: PieceType = 'q'
): ChessGameState {
  const nextState = cloneGameState(state);
  const piece = nextState.board[from.row][from.col];

  if (!piece) return nextState;

  const color = piece.color;
  const opponent = color === 'w' ? 'b' : 'w';

  // Find destination piece (if any)
  let capturedPiece = nextState.board[to.row][to.col];
  let isEP = false;
  let isDoublePawn = false;
  let isCastle: 'king' | 'queen' | null = null;

  // Check if it's en passant capture
  if (
    piece.type === 'p' &&
    nextState.enPassantTarget &&
    nextState.enPassantTarget.row === from.row &&
    nextState.enPassantTarget.col === to.col &&
    Math.abs(to.col - from.col) === 1
  ) {
    isEP = true;
    capturedPiece = nextState.board[from.row][to.col];
    nextState.board[from.row][to.col] = null; // Delete en passant captured pawn
  }

  // Check if it's double pawn step
  if (piece.type === 'p' && Math.abs(to.row - from.row) === 2) {
    isDoublePawn = true;
  }

  // Check if it's castling
  if (piece.type === 'k' && Math.abs(to.col - from.col) === 2) {
    const r = color === 'w' ? 7 : 0;
    if (to.col === 6) {
      isCastle = 'king';
      // Move rook from r,7 to r,5
      const rook = nextState.board[r][7];
      if (rook) {
        rook.hasMoved = true;
        nextState.board[r][5] = rook;
        nextState.board[r][7] = null;
      }
    } else if (to.col === 2) {
      isCastle = 'queen';
      // Move rook from r,0 to r,3
      const rook = nextState.board[r][0];
      if (rook) {
        rook.hasMoved = true;
        nextState.board[r][3] = rook;
        nextState.board[r][0] = null;
      }
    }
  }

  // Trigger pawn promotion if reached bottom/top row
  const isPawnPromotion =
    piece.type === 'p' && (to.row === 0 || to.row === 7);

  // Update piece position on board
  const movingPiece = { ...piece, hasMoved: true };
  if (isPawnPromotion) {
    movingPiece.type = promotionType;
  }
  nextState.board[to.row][to.col] = movingPiece;
  nextState.board[from.row][from.col] = null;

  // Update castling rights
  if (piece.type === 'k') {
    nextState.castlingRights[color].kingSide = false;
    nextState.castlingRights[color].queenSide = false;
  } else if (piece.type === 'r') {
    const startRow = color === 'w' ? 7 : 0;
    if (from.row === startRow && from.col === 0) {
      nextState.castlingRights[color].queenSide = false;
    } else if (from.row === startRow && from.col === 7) {
      nextState.castlingRights[color].kingSide = false;
    }
  }

  // If a rook is captured, remove castling rights for the opponent
  if (capturedPiece && capturedPiece.type === 'r') {
    const enemyRow = opponent === 'w' ? 7 : 0;
    if (to.row === enemyRow && to.col === 0) {
      nextState.castlingRights[opponent].queenSide = false;
    } else if (to.row === enemyRow && to.col === 7) {
      nextState.castlingRights[opponent].kingSide = false;
    }
  }

  // Set en passant target for next turn
  if (isDoublePawn) {
    nextState.enPassantTarget = { row: to.row, col: to.col };
  } else {
    nextState.enPassantTarget = null;
  }

  // Reset/increment halfmove clock (50-move rule: reset on pawn move or capture)
  if (piece.type === 'p' || capturedPiece !== null) {
    nextState.halfmoveClock = 0;
  } else {
    nextState.halfmoveClock++;
  }

  // Increment fullmove number
  if (color === 'b') {
    nextState.fullmoveNumber++;
  }

  // Update active color
  nextState.activeColor = opponent;

  // Check if opponent king is in check/mate/stalemate
  const isOpponentInCheck = isKingInCheck(nextState.board, opponent);
  const nextLegalMoves = getAllLegalMoves(nextState);

  let finalStatus: GameStatus = 'playing';
  let winner: Color | null = null;

  if (nextLegalMoves.length === 0) {
    if (isOpponentInCheck) {
      finalStatus = 'checkmate';
      winner = color; // Current mover won
    } else {
      finalStatus = 'stalemate';
    }
  } else {
    // Check other draw conditions
    // 1. Fifty-move rule (100 half-moves)
    if (nextState.halfmoveClock >= 100) {
      finalStatus = 'draw-fifty';
    }
    // 2. Insufficient material
    else if (isInsufficientMaterial(nextState.board)) {
      finalStatus = 'draw-material';
    }
    // 3. Threefold repetition
    else {
      const nextKey = generatePositionKey(nextState);
      nextState.positionHistory.push(nextKey);
      const count = nextState.positionHistory.filter((k) => k === nextKey).length;
      if (count >= 3) {
        finalStatus = 'draw-repetition';
      }
    }
  }

  nextState.status = finalStatus;
  nextState.winner = winner;

  // Add move to history
  const isMate = finalStatus === 'checkmate';
  const san = generateSAN(
    state.board,
    from,
    to,
    piece,
    capturedPiece,
    isCastle,
    isPawnPromotion ? promotionType : null,
    isOpponentInCheck,
    isMate
  );

  const moveRecord: Move = {
    from,
    to,
    piece,
    captured: capturedPiece,
    promotion: isPawnPromotion ? promotionType : null,
    isCastling: isCastle,
    isEnPassant: isEP,
    isDoublePawn: isDoublePawn,
    san,
    fenAfter: generatePositionKey(nextState),
  };

  nextState.moveHistory.push(moveRecord);

  return nextState;
}
