import React from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface ChessTimerProps {
  whiteTime: number; // in seconds
  blackTime: number; // in seconds
  activeColor: 'w' | 'b';
  status: string;
  maxTime: number; // For percentage progress bar rendering
}

export const ChessTimer: React.FC<ChessTimerProps> = ({
  whiteTime,
  blackTime,
  activeColor,
  status,
  maxTime,
}) => {
  // Format seconds to MM:SS or MM:SS.d
  const formatTime = (secs: number) => {
    if (secs < 0) return '00:00';
    
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const formattedM = m.toString().padStart(2, '0');
    const formattedS = s.toString().padStart(2, '0');

    if (secs < 10 && secs > 0) {
      // Under 10 seconds: show sub-second decimals
      const ds = Math.floor((secs % 1) * 10);
      return `${formattedM}:${formattedS}.${ds}`;
    }

    return `${formattedM}:${formattedS}`;
  };

  const getPercent = (time: number) => {
    if (maxTime <= 0) return 100;
    return Math.min(100, Math.max(0, (time / maxTime) * 100));
  };

  const isWhiteActive = activeColor === 'w' && status === 'playing';
  const isBlackActive = activeColor === 'b' && status === 'playing';

  const whitePercent = getPercent(whiteTime);
  const blackPercent = getPercent(blackTime);

  return (
    <div className="grid grid-cols-2 gap-4 w-full">
      {/* White Player Timer Panel */}
      <div
        className={`relative p-3.5 rounded-2xl border transition-all duration-200 overflow-hidden ${
          isWhiteActive
            ? 'bg-slate-900 border-amber-500/50 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/20'
            : 'bg-slate-900/40 border-slate-800 opacity-70'
        }`}
      >
        {/* Dynamic sliding progress background */}
        <div
          style={{ width: `${whitePercent}%` }}
          className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ${
            whiteTime < 15 && isWhiteActive ? 'bg-red-500 animate-pulse' : 'bg-amber-500/75'
          }`}
        />

        <div className="flex items-center justify-between">
          <div className="text-left">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">
              White Player
            </span>
            <h4 className="text-xs font-bold text-slate-300 truncate max-w-[110px]">
              {isWhiteActive ? 'Thinking...' : 'White'}
            </h4>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {whiteTime < 15 && isWhiteActive && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
            )}
            <span className={`font-mono text-lg font-black tracking-tighter ${
              whiteTime < 15 && isWhiteActive ? 'text-red-400' : 'text-slate-100'
            }`}>
              {formatTime(whiteTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Black Player Timer Panel */}
      <div
        className={`relative p-3.5 rounded-2xl border transition-all duration-200 overflow-hidden ${
          isBlackActive
            ? 'bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/20'
            : 'bg-slate-900/40 border-slate-800 opacity-70'
        }`}
      >
        {/* Dynamic sliding progress background */}
        <div
          style={{ width: `${blackPercent}%` }}
          className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ${
            blackTime < 15 && isBlackActive ? 'bg-red-500 animate-pulse' : 'bg-indigo-500/75'
          }`}
        />

        <div className="flex items-center justify-between">
          <div className="text-left">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">
              Black Player
            </span>
            <h4 className="text-xs font-bold text-slate-300 truncate max-w-[110px]">
              {isBlackActive ? 'Thinking...' : 'Black'}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {blackTime < 15 && isBlackActive && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
            )}
            <span className={`font-mono text-lg font-black tracking-tighter ${
              blackTime < 15 && isBlackActive ? 'text-red-400' : 'text-slate-100'
            }`}>
              {formatTime(blackTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
