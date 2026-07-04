import React, { useState } from 'react';
import { Square, BoardState, Move, BoardTheme } from '../types';
import { ChessPieceComponent } from './ChessPieces';

interface ChessBoardProps {
  board: BoardState;
  onMove: (from: Square, to: Square) => void;
  selectedSquare: Square | null;
  setSelectedSquare: (sq: Square | null) => void;
  legalMoves: Square[];
  lastMove: Move | null;
  checkedSquare: Square | null;
  isFlipped: boolean;
  theme: BoardTheme;
  interactive: boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  board,
  onMove,
  selectedSquare,
  setSelectedSquare,
  legalMoves,
  lastMove,
  checkedSquare,
  isFlipped,
  theme,
  interactive,
}) => {
  const [draggedSquare, setDraggedSquare] = useState<Square | null>(null);

  // Files (columns) and Ranks (rows)
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Map rows and columns based on board flip
  const getGridIndices = () => {
    const indices = Array.from({ length: 8 }, (_, i) => i);
    if (isFlipped) {
      return { rows: indices.reverse(), cols: indices.reverse() };
    }
    return { rows: indices, cols: indices };
  };

  const { rows, cols } = getGridIndices();

  const handleSquareClick = (row: number, col: number) => {
    if (!interactive) return;

    const piece = board[row][col];
    const isLegalTarget = legalMoves.some((m) => m.row === row && m.col === col);

    if (selectedSquare) {
      if (selectedSquare.row === row && selectedSquare.col === col) {
        // Toggle selection off if clicking the same square
        setSelectedSquare(null);
      } else if (isLegalTarget) {
        // Trigger move
        onMove(selectedSquare, { row, col });
        setSelectedSquare(null);
      } else if (piece) {
        // Select new piece if click is on same-color piece
        setSelectedSquare({ row, col });
      } else {
        // Clicked empty/invalid square, deselect
        setSelectedSquare(null);
      }
    } else {
      if (piece) {
        setSelectedSquare({ row, col });
      }
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, row: number, col: number) => {
    if (!interactive) {
      e.preventDefault();
      return;
    }
    setSelectedSquare({ row, col });
    setDraggedSquare({ row, col });
    
    // Set transparent image/drag effect
    e.dataTransfer.effectAllowed = 'move';
    // Firefox support
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (!interactive || !draggedSquare) return;

    const isLegalTarget = legalMoves.some((m) => m.row === row && m.col === col);
    if (isLegalTarget) {
      onMove(draggedSquare, { row, col });
    }
    
    setSelectedSquare(null);
    setDraggedSquare(null);
  };

  const handleDragEnd = () => {
    setDraggedSquare(null);
  };

  // Check visual states
  const isSquareSelected = (r: number, c: number) => {
    return selectedSquare !== null && selectedSquare.row === r && selectedSquare.col === c;
  };

  const isSquareLegalTarget = (r: number, c: number) => {
    return legalMoves.some((m) => m.row === r && m.col === c);
  };

  const isLastMoveSquare = (r: number, c: number) => {
    if (!lastMove) return false;
    return (
      (lastMove.from.row === r && lastMove.from.col === c) ||
      (lastMove.to.row === r && lastMove.to.col === c)
    );
  };

  const isSquareChecked = (r: number, c: number) => {
    return checkedSquare !== null && checkedSquare.row === r && checkedSquare.col === c;
  };

  return (
    <div id="chessboard-container" className="relative w-full aspect-square max-w-[560px] mx-auto select-none rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800/40">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {rows.map((r) =>
          cols.map((c) => {
            const piece = board[r][c];
            const isLight = (r + c) % 2 === 0;
            const isSelected = isSquareSelected(r, c);
            const isLegal = isSquareLegalTarget(r, c);
            const isLast = isLastMoveSquare(r, c);
            const isChecked = isSquareChecked(r, c);

            // Determine custom background colors based on square type and current theme
            let bgClass = isLight ? theme.light : theme.dark;

            return (
              <div
                id={`square-${r}-${c}`}
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                onDragOver={(e) => handleDragOver(e, r, c)}
                onDrop={(e) => handleDrop(e, r, c)}
                className={`relative flex items-center justify-center transition-colors duration-200 cursor-pointer aspect-square ${bgClass}`}
              >
                {/* Board highlights overlays */}
                {isLast && (
                  <div className="absolute inset-0 bg-yellow-500/25 pointer-events-none" />
                )}
                
                {isSelected && (
                  <div className="absolute inset-0 bg-indigo-500/30 border-2 border-indigo-400 pointer-events-none animate-pulse" />
                )}

                {isChecked && (
                  <div className="absolute inset-0 bg-red-500/45 border-4 border-red-600 animate-pulse pointer-events-none" />
                )}

                {/* Render Chess Piece */}
                {piece && (
                  <div
                    id={`piece-${piece.id}`}
                    draggable={interactive && piece.color === board[selectedSquare?.row || 0]?.[selectedSquare?.col || 0]?.color ? true : interactive}
                    onDragStart={(e) => handleDragStart(e, r, c)}
                    onDragEnd={handleDragEnd}
                    className={`relative w-[85%] h-[85%] z-10 transition-transform duration-100 active:scale-110 hover:scale-105 select-none touch-none`}
                  >
                    <ChessPieceComponent type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal Move Indicators */}
                {isLegal && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    {piece ? (
                      // Draw a ring around occupied squares
                      <div className="w-[85%] h-[85%] rounded-full border-4 border-emerald-500/60" />
                    ) : (
                      // Draw a centered dot on empty squares
                      <div className="w-4 h-4 rounded-full bg-emerald-500/70 shadow-lg shadow-emerald-500/25" />
                    )}
                  </div>
                )}

                {/* Rank notations (letters / numbers on borders) */}
                {c === (isFlipped ? 7 : 0) && (
                  <span
                    className={`absolute top-1 left-1.5 text-[9px] md:text-[11px] font-bold ${
                      isLight ? 'text-slate-700/60' : 'text-slate-100/60'
                    }`}
                  >
                    {ranks[r]}
                  </span>
                )}
                {r === (isFlipped ? 0 : 7) && (
                  <span
                    className={`absolute bottom-0.5 right-1.5 text-[9px] md:text-[11px] font-bold ${
                      isLight ? 'text-slate-700/60' : 'text-slate-100/60'
                    }`}
                  >
                    {files[c]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
