import React from 'react';
import { Color, PieceType } from '../types';
import { ChessPieceComponent } from './ChessPieces';

interface PawnPromotionModalProps {
  color: Color;
  onSelect: (type: PieceType) => void;
  onClose: () => void;
}

export const PawnPromotionModal: React.FC<PawnPromotionModalProps> = ({
  color,
  onSelect,
  onClose,
}) => {
  const options: { type: PieceType; label: string; desc: string }[] = [
    { type: 'q', label: 'Queen', desc: 'The ultimate powerhouse' },
    { type: 'r', label: 'Rook', desc: 'Orthogonal commander' },
    { type: 'b', label: 'Bishop', desc: 'Diagonal specialist' },
    { type: 'n', label: 'Knight', desc: 'Tactical jump master' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl transform scale-100 transition-all">
        {/* Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border-b border-slate-800 text-center">
          <h3 className="text-xl font-bold text-amber-400">Pawn Promotion!</h3>
          <p className="text-xs text-slate-400 mt-1">
            Your brave pawn reached the edge! Choose its upgraded form:
          </p>
        </div>

        {/* Options */}
        <div className="p-6 grid grid-cols-2 gap-4">
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onSelect(opt.type)}
              className="group relative flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-amber-500/50 transition-all duration-200 active:scale-95 text-center focus:outline-none"
            >
              {/* Piece visualization */}
              <div className="w-16 h-16 transform group-hover:scale-110 transition-transform duration-200">
                <ChessPieceComponent type={opt.type} color={color} />
              </div>
              
              <span className="font-bold text-slate-200 mt-2 group-hover:text-amber-400">
                {opt.label}
              </span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-0.5">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/40 border-t border-slate-850 text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Cancel and keep pawn on board
          </button>
        </div>
      </div>
    </div>
  );
};
