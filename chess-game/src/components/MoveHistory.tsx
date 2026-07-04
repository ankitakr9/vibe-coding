import React, { useEffect, useRef } from 'react';
import { Move } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText } from 'lucide-react';

interface MoveHistoryProps {
  history: Move[];
  currentReplayIndex: number; // -1 means live game (show final state), otherwise represents the active replay move index
  onSelectReplayIndex: (index: number) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({
  history,
  currentReplayIndex,
  onSelectReplayIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Group history into standard pairs of White / Black moves
  const renderMovePairs = () => {
    const pairs: { white: Move; black?: Move; whiteIdx: number; blackIdx?: number }[] = [];

    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        white: history[i],
        whiteIdx: i,
        black: history[i + 1],
        blackIdx: i + 1,
      });
    }

    return pairs;
  };

  const movePairs = renderMovePairs();

  // Scroll to bottom when move history changes and user is playing live
  useEffect(() => {
    if (containerRef.current && currentReplayIndex === -1) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history.length, currentReplayIndex]);

  const handleFirst = () => {
    if (history.length > 0) onSelectReplayIndex(0);
  };

  const handlePrev = () => {
    if (currentReplayIndex === -1) {
      onSelectReplayIndex(history.length - 1);
    } else if (currentReplayIndex > 0) {
      onSelectReplayIndex(currentReplayIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentReplayIndex !== -1) {
      if (currentReplayIndex === history.length - 1) {
        onSelectReplayIndex(-1); // Go back to live
      } else {
        onSelectReplayIndex(currentReplayIndex + 1);
      }
    }
  };

  const handleLast = () => {
    onSelectReplayIndex(-1); // Live game is the last state
  };

  const isLive = currentReplayIndex === -1;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl h-full shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-950 border-b border-slate-850">
        <FileText className="w-4 h-4 text-amber-500" />
        <span className="font-bold text-xs text-slate-300 uppercase tracking-wider">
          Move Log & Replay
        </span>
        {history.length > 0 && !isLive && (
          <span className="ml-auto text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full animate-pulse">
            Replaying Move {currentReplayIndex + 1}/{history.length}
          </span>
        )}
      </div>

      {/* Log Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent min-h-[160px]"
      >
        {movePairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-6 text-center">
            <span className="text-xs italic">No moves played yet.</span>
            <span className="text-[10px] mt-1 text-slate-600">The game starts now!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1">
            {movePairs.map((pair, idx) => {
              const pairNum = idx + 1;
              const isWhiteSelected = currentReplayIndex === pair.whiteIdx;
              const isBlackSelected = currentReplayIndex === pair.blackIdx;

              return (
                <div
                  key={pairNum}
                  className="flex items-center text-xs py-1 px-2 rounded-lg hover:bg-slate-850/50 transition-colors"
                >
                  {/* Turn count */}
                  <span className="w-8 font-mono text-slate-500 text-left">
                    {pairNum}.
                  </span>

                  {/* White Move */}
                  <button
                    onClick={() => onSelectReplayIndex(pair.whiteIdx)}
                    className={`flex-1 text-left py-0.5 px-2 rounded font-mono font-medium transition-colors ${
                      isWhiteSelected
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                    }`}
                  >
                    {pair.white.san}
                  </button>

                  {/* Black Move */}
                  {pair.black && pair.blackIdx !== undefined ? (
                    <button
                      onClick={() => onSelectReplayIndex(pair.blackIdx)}
                      className={`flex-1 text-left py-0.5 px-2 rounded font-mono font-medium transition-colors ${
                        isBlackSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800'
                      }`}
                    >
                      {pair.black.san}
                    </button>
                  ) : (
                    <span className="flex-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-4 border-t border-slate-850 bg-slate-950 p-1.5 gap-1">
        <button
          onClick={handleFirst}
          disabled={history.length === 0 || currentReplayIndex === 0}
          title="First Move"
          className="flex items-center justify-center py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handlePrev}
          disabled={history.length === 0 || currentReplayIndex === 0}
          title="Previous Move"
          className="flex items-center justify-center py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={history.length === 0 || isLive}
          title="Next Move"
          className="flex items-center justify-center py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleLast}
          disabled={isLive}
          title="Jump to Live"
          className="flex items-center justify-center py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
