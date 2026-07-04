import React from 'react';
import { ChessPiece, Color, PieceType } from '../types';
import { ChessPieceComponent } from './ChessPieces';

interface CapturedPiecesProps {
  captured: ChessPiece[]; // The pieces of THIS color that have been captured (i.e. if color is 'w', this list is white pieces captured)
  color: Color; // The color of the pieces that have been captured
}

const PIECE_SCORES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ captured, color }) => {
  // Group pieces by type to show tidy lists (e.g., 5 pawns, 1 rook)
  const pieceOrder: PieceType[] = ['p', 'n', 'b', 'r', 'q'];

  // Count occurrences
  const counts = captured.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {} as Record<PieceType, number>);

  // Compute total material points
  const totalValue = captured.reduce((sum, p) => sum + PIECE_SCORES[p.type], 0);

  return (
    <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-800/40 w-full min-h-[48px]">
      <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
        Captured:
      </span>

      {captured.length === 0 ? (
        <span className="text-xs text-slate-600 italic">None yet</span>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {pieceOrder.map((type) => {
            const count = counts[type] || 0;
            if (count === 0) return null;

            return (
              <div key={type} className="flex items-center gap-0.5 bg-slate-950/70 border border-slate-800 px-1.5 py-0.5 rounded-lg text-slate-400">
                <div className="w-5 h-5 flex items-center justify-center">
                  <ChessPieceComponent type={type} color={color} className="w-full h-full" />
                </div>
                {count > 1 && (
                  <span className="text-[10px] font-bold text-amber-500/85">
                    ×{count}
                  </span>
                )}
              </div>
            );
          })}
          
          <div className="text-[10px] bg-slate-800/60 text-slate-300 font-bold px-1.5 py-0.5 rounded-md border border-slate-700/50">
            {totalValue} pts
          </div>
        </div>
      )}
    </div>
  );
};

// Calculate net score difference between captured materials
export function getMaterialDifference(
  whiteCaptured: ChessPiece[],
  blackCaptured: ChessPiece[]
): { whiteLead: number; blackLead: number } {
  const getScore = (list: ChessPiece[]) =>
    list.reduce((sum, p) => sum + PIECE_SCORES[p.type], 0);

  const whiteLoss = getScore(whiteCaptured); // White pieces captured by black
  const blackLoss = getScore(blackCaptured); // Black pieces captured by white

  return {
    whiteLead: blackLoss > whiteLoss ? blackLoss - whiteLoss : 0,
    blackLead: whiteLoss > blackLoss ? whiteLoss - blackLoss : 0,
  };
}
