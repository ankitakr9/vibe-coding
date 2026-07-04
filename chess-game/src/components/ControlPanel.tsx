import React from 'react';
import { GameMode, Difficulty, TimerConfig, BoardTheme, GameStatus } from '../types';
import {
  RotateCcw,
  RefreshCw,
  Undo2,
  Redo2,
  Volume2,
  VolumeX,
  Compass,
  Cpu,
  Users,
  Clock,
  Palette,
  Flag,
} from 'lucide-react';

interface ControlPanelProps {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  difficulty: Difficulty;
  setDifficulty: (diff: Difficulty) => void;
  selectedTimer: TimerConfig;
  timers: TimerConfig[];
  setSelectedTimer: (timer: TimerConfig) => void;
  boardTheme: BoardTheme;
  themes: BoardTheme[];
  setBoardTheme: (theme: BoardTheme) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onResign: () => void;
  onRestart: () => void;
  onFlip: () => void;
  canUndo: boolean;
  canRedo: boolean;
  status: GameStatus;
  activeColor: 'w' | 'b';
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  gameMode,
  setGameMode,
  difficulty,
  setDifficulty,
  selectedTimer,
  timers,
  setSelectedTimer,
  boardTheme,
  themes,
  setBoardTheme,
  soundEnabled,
  setSoundEnabled,
  onUndo,
  onRedo,
  onResign,
  onRestart,
  onFlip,
  canUndo,
  canRedo,
  status,
  activeColor,
}) => {
  const difficulties: { value: Difficulty; label: string; desc: string; color: string }[] = [
    { value: 'easy', label: 'Novice', desc: 'Plays casually, frequent slips', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { value: 'medium', label: 'Adept', desc: 'Balanced play, core principles', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { value: 'hard', label: 'Expert', desc: 'Thorough search, plays to win', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    { value: 'master', label: 'Master', desc: 'Deep foresight, flawless tactics', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-6 text-slate-200">
      {/* 1. Game Setup Parameters (Only clickable in setup mode) */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-850">
          <Compass className="w-4 h-4 text-indigo-400" /> Game Setup
        </h3>

        {/* Game Mode */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => status === 'setup' && setGameMode('pvp')}
              disabled={status !== 'setup'}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                gameMode === 'pvp'
                  ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
              } disabled:opacity-50`}
            >
              <Users className="w-4 h-4" /> Local PvP
            </button>
            <button
              onClick={() => status === 'setup' && setGameMode('ai')}
              disabled={status !== 'setup'}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                gameMode === 'ai'
                  ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
              } disabled:opacity-50`}
            >
              <Cpu className="w-4 h-4" /> Play vs AI
            </button>
          </div>
        </div>

        {/* AI Difficulty Selector (Only shown in Play vs AI mode) */}
        {gameMode === 'ai' && (
          <div className="space-y-2 animate-fadeIn">
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              AI Difficulty
            </label>
            <div className="grid grid-cols-2 gap-2">
              {difficulties.map((diff) => (
                <button
                  key={diff.value}
                  onClick={() => status === 'setup' && setDifficulty(diff.value)}
                  disabled={status !== 'setup'}
                  title={diff.desc}
                  className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-xl border text-center transition-all ${
                    difficulty === diff.value
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                  } disabled:opacity-50`}
                >
                  <span className="text-xs font-bold">{diff.label}</span>
                  <span className="text-[8px] opacity-75 mt-0.5 truncate max-w-[100px]">
                    {diff.value.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Time Control Options */}
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Time Control
          </label>
          <div className="grid grid-cols-2 gap-2">
            {timers.map((tm) => (
              <button
                key={tm.id}
                onClick={() => status === 'setup' && setSelectedTimer(tm)}
                disabled={status !== 'setup'}
                className={`flex items-center gap-2 py-2 px-3 rounded-xl border text-left transition-all ${
                  selectedTimer.id === tm.id
                    ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                } disabled:opacity-50`}
              >
                <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{tm.name}</p>
                  <p className="text-[8px] text-slate-500">
                    {tm.timeSecs > 0 ? `${tm.timeSecs / 60}m + ${tm.incrementSecs}s` : 'Unregulated'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. In-Game Interactive Actions */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-850">
          <Flag className="w-4 h-4 text-emerald-400" /> Match Controls
        </h3>

        {/* Undo, Redo, Flip */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo || status === 'setup'}
            title="Takeback Move (Undo)"
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-950 transition-all font-bold text-xs"
          >
            <Undo2 className="w-4 h-4 mb-1" />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo || status === 'setup'}
            title="Restore Move (Redo)"
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-slate-950 transition-all font-bold text-xs"
          >
            <Redo2 className="w-4 h-4 mb-1" />
            Redo
          </button>
          <button
            onClick={onFlip}
            title="Rotate Board Perspective"
            className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-slate-950 border border-slate-850 hover:bg-slate-850 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all font-bold text-xs"
          >
            <RefreshCw className="w-4 h-4 mb-1 animate-hover-spin" />
            Flip
          </button>
        </div>

        {/* Resign and Restart */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onResign}
            disabled={status !== 'playing'}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-red-950 bg-red-950/20 hover:bg-red-950/40 text-red-400 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-bold transition-all"
          >
            <Flag className="w-4 h-4" /> Resign
          </button>
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-indigo-950 bg-indigo-950/30 hover:bg-indigo-950/50 text-indigo-400 text-xs font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" /> {status === 'setup' ? 'Start Game' : 'Reset Match'}
          </button>
        </div>
      </div>

      {/* 3. Theme & Settings Customization */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-850">
          <Palette className="w-4 h-4 text-pink-400" /> Customize Board
        </h3>

        {/* Themes List */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {themes.map((th) => (
              <button
                key={th.id}
                onClick={() => setBoardTheme(th)}
                className={`flex items-center gap-2.5 py-2 px-2.5 rounded-xl border transition-all text-left ${
                  boardTheme.id === th.id
                    ? 'bg-pink-500/10 border-pink-500 text-pink-300'
                    : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                }`}
              >
                {/* Visual mini-swatch */}
                <div className="flex w-5 h-5 rounded overflow-hidden border border-slate-700/50 shrink-0">
                  <div className={`w-1/2 h-full ${th.light}`} />
                  <div className={`w-1/2 h-full ${th.dark}`} />
                </div>
                <span className="text-xs font-semibold truncate">{th.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Effects Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all text-xs font-bold ${
            soundEnabled
              ? 'bg-slate-950 border-emerald-500/20 text-emerald-400'
              : 'bg-slate-950 border-slate-850 text-slate-500'
          }`}
        >
          <span className="flex items-center gap-2">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Sound Effects
          </span>
          <span className="text-[10px] uppercase font-black">
            {soundEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </div>
  );
};
