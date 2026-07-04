import { useState, useEffect, useRef } from 'react';
import {
  Square,
  Move,
  GameMode,
  Difficulty,
  TimerConfig,
  BoardTheme,
  GameStats,
  Achievement,
  LeaderboardEntry,
} from './types';
import {
  createInitialState,
  makeMove,
  getLegalMoves,
  isKingInCheck,
  findKing,
  ChessGameState,
} from './chessEngine';
import { getAIMove } from './chessAI';
import { soundManager } from './soundManager';
import { ChessBoard } from './components/ChessBoard';
import { CapturedPieces, getMaterialDifference } from './components/CapturedPieces';
import { MoveHistory } from './components/MoveHistory';
import { ControlPanel } from './components/ControlPanel';
import { ChessTimer } from './components/ChessTimer';
import { PawnPromotionModal } from './components/PawnPromotionModal';
import { StatsDashboard } from './components/StatsDashboard';
import {
  Trophy,
  Users,
  Cpu,
  Info,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
} from 'lucide-react';

// Time Configurations
const TIMERS: TimerConfig[] = [
  { id: 'inf', name: 'No Timer', timeSecs: 0, incrementSecs: 0 },
  { id: 'blitz', name: 'Blitz (3+2)', timeSecs: 180, incrementSecs: 2 },
  { id: 'rapid', name: 'Rapid (10+5)', timeSecs: 600, incrementSecs: 5 },
  { id: 'classical', name: 'Classic (30m)', timeSecs: 1800, incrementSecs: 0 },
];

// Board Themes
const THEMES: BoardTheme[] = [
  {
    id: 'emerald',
    name: 'Emerald Forest',
    light: 'bg-[#eeeed2]',
    dark: 'bg-[#769656]',
    highlight: 'rgba(247, 247, 105, 0.5)',
    bg: 'from-slate-950 via-slate-900 to-emerald-950/20',
  },
  {
    id: 'wood',
    name: 'Walnut Walnut',
    light: 'bg-[#f0d9b5]',
    dark: 'bg-[#b58863]',
    highlight: 'rgba(130, 151, 105, 0.5)',
    bg: 'from-slate-950 via-slate-900 to-amber-950/15',
  },
  {
    id: 'ocean',
    name: 'Marine Blue',
    light: 'bg-[#eaf2f8]',
    dark: 'bg-[#2471a3]',
    highlight: 'rgba(245, 176, 65, 0.5)',
    bg: 'from-slate-950 via-slate-900 to-blue-950/20',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Dark',
    light: 'bg-[#e5e7eb]',
    dark: 'bg-[#4b5563]',
    highlight: 'rgba(147, 197, 253, 0.5)',
    bg: 'from-slate-950 via-slate-900 to-slate-950',
  },
];

// Achievements template
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', title: 'First Blood', desc: 'Secure your first victory against another player or AI.', icon: '🏆', unlockedAt: null },
  { id: 'ai_conqueror', title: 'AI Conqueror', desc: 'Successfully defeat the Chess AI.', icon: '🤖', unlockedAt: null },
  { id: 'expert_slayer', title: 'Grandmaster Slayer', desc: 'Defeat the AI on Hard or Master difficulty.', icon: '👑', unlockedAt: null },
  { id: 'promotion', title: 'Promotion King', desc: 'Promote a pawn into a Queen or other major piece.', icon: '⭐', unlockedAt: null },
  { id: 'speed_demon', title: 'Swift Victor', desc: 'Win a game in under 20 total moves.', icon: '⚡', unlockedAt: null },
  { id: 'castle_safety', title: 'Fortress King', desc: 'Castle your king safely within the first 10 moves.', icon: '🏰', unlockedAt: null },
];

export default function App() {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'play' | 'stats'>('play');

  // Core Game State
  const [gameState, setGameState] = useState<ChessGameState>(createInitialState());
  const [stateHistory, setStateHistory] = useState<ChessGameState[]>([createInitialState()]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Settings & Modes
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedTimer, setSelectedTimer] = useState<TimerConfig>(TIMERS[2]); // Rapid (10+5) default
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(THEMES[0]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isBoardFlipped, setIsBoardFlipped] = useState<boolean>(false);

  // Interaction States
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [currentReplayIndex, setCurrentReplayIndex] = useState<number>(-1); // -1 = live game
  const [promotionPending, setPromotionPending] = useState<{ from: Square; to: Square } | null>(null);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);

  // Time Clocks (for Blitz/Rapid etc)
  const [whiteTime, setWhiteTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stats, Rating, Achievements from localStorage
  const [userRating, setUserRating] = useState<number>(1200);
  const [stats, setStats] = useState<GameStats>({
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    streak: 0,
    bestStreak: 0,
    movesMade: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [recentAchievement, setRecentAchievement] = useState<Achievement | null>(null);

  // Simulated Leaderboard Entries
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([
    { rank: 1, name: 'Magnus Carlsen', rating: 2882, title: 'GM', avatar: '' },
    { rank: 2, name: 'Hikaru Nakamura', rating: 2875, title: 'GM', avatar: '' },
    { rank: 3, name: 'Garry Kasparov', rating: 2851, title: 'GM', avatar: '' },
    { rank: 4, name: 'Ding Liren', rating: 2780, title: 'GM', avatar: '' },
    { rank: 5, name: 'Judit Polgár', rating: 2735, title: 'GM', avatar: '' },
    { rank: 6, name: 'You', rating: 1200, title: 'USR', avatar: '', isUser: true },
    { rank: 7, name: 'Bobby Fischer', rating: 1150, title: 'FM', avatar: '' },
  ]);

  // Load profile from localStorage on start
  useEffect(() => {
    try {
      const storedRating = localStorage.getItem('chess_user_rating');
      if (storedRating) {
        setUserRating(parseInt(storedRating));
      }

      const storedStats = localStorage.getItem('chess_user_stats');
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }

      const storedAchievements = localStorage.getItem('chess_user_achievements');
      if (storedAchievements) {
        // Overlay onto default list to preserve new definitions
        const parsed = JSON.parse(storedAchievements) as Achievement[];
        setAchievements((prev) =>
          prev.map((d) => {
            const found = parsed.find((p) => p.id === d.id);
            return found ? { ...d, unlockedAt: found.unlockedAt } : d;
          })
        );
      }
    } catch (e) {
      console.warn('Failed to load localStorage', e);
    }
  }, []);

  // Update dynamic leaderboard ranks whenever rating or stats change
  useEffect(() => {
    const updatedLeaderboard = [
      { rank: 1, name: 'Magnus Carlsen', rating: 2882, title: 'GM', avatar: '' },
      { rank: 2, name: 'Hikaru Nakamura', rating: 2875, title: 'GM', avatar: '' },
      { rank: 3, name: 'Garry Kasparov', rating: 2851, title: 'GM', avatar: '' },
      { rank: 4, name: 'Ding Liren', rating: 2780, title: 'GM', avatar: '' },
      { rank: 5, name: 'Judit Polgár', rating: 2735, title: 'GM', avatar: '' },
      { rank: 6, name: 'You', rating: userRating, title: userRating > 2000 ? 'GM' : userRating > 1800 ? 'IM' : 'USR', avatar: '', isUser: true },
      { rank: 7, name: 'Bobby Fischer', rating: 1550, title: 'FM', avatar: '' },
    ]
      .sort((a, b) => b.rating - a.rating)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    setLeaderboard(updatedLeaderboard);
  }, [userRating]);

  // Initialize timer remaining whenever Selected Timer changes (only in setup phase)
  useEffect(() => {
    if (gameState.status === 'setup') {
      setWhiteTime(selectedTimer.timeSecs);
      setBlackTime(selectedTimer.timeSecs);
    }
  }, [selectedTimer, gameState.status]);

  // Timer Interval Loop
  useEffect(() => {
    if (gameState.status === 'playing' && selectedTimer.timeSecs > 0) {
      timerIntervalRef.current = setInterval(() => {
        if (gameState.activeColor === 'w') {
          setWhiteTime((prev) => {
            if (prev <= 0.1) {
              handleTimeout('b'); // Black wins on white timeout
              return 0;
            }
            return parseFloat((prev - 0.1).toFixed(1));
          });
        } else {
          setBlackTime((prev) => {
            if (prev <= 0.1) {
              handleTimeout('w'); // White wins on black timeout
              return 0;
            }
            return parseFloat((prev - 0.1).toFixed(1));
          });
        }
      }, 100);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameState.status, gameState.activeColor, selectedTimer]);

  // Sync sound manager state
  useEffect(() => {
    soundManager.toggleSound(soundEnabled);
  }, [soundEnabled]);

  // AI Move triggers
  useEffect(() => {
    const isAITurn =
      gameMode === 'ai' &&
      gameState.activeColor === 'b' &&
      gameState.status === 'playing' &&
      currentReplayIndex === -1 &&
      !isAIThinking;

    if (isAITurn) {
      setIsAIThinking(true);
      // Give simulated thinking delay (600ms-1200ms depending on difficulty) for realistic UX
      const delay = difficulty === 'easy' ? 600 : difficulty === 'medium' ? 800 : 1200;
      
      const aiTimeout = setTimeout(() => {
        const aiMove = getAIMove(gameState, difficulty);
        if (aiMove) {
          executeMove(aiMove.from, aiMove.to);
        } else {
          // Fallback if no moves exist
          setGameState((prev) => ({ ...prev, status: 'stalemate' }));
        }
        setIsAIThinking(false);
      }, delay);

      return () => clearTimeout(aiTimeout);
    }
  }, [gameState.activeColor, gameState.status, gameMode, difficulty, currentReplayIndex]);

  // End game on timer timeout
  const handleTimeout = (winnerColor: 'w' | 'b') => {
    setGameState((prev) => {
      const next = { ...prev, status: 'timeout' as const, winner: winnerColor };
      recordGameEnd(next);
      return next;
    });
    soundManager.play('gameover');
  };

  // Replay board state reconstruction helper
  const getReplayedBoard = () => {
    if (currentReplayIndex === -1) {
      return gameState.board;
    }
    // Start with starting board and play moves up to selected index
    let tempState = createInitialState();
    for (let i = 0; i <= currentReplayIndex; i++) {
      const m = gameState.moveHistory[i];
      tempState = makeMove(tempState, m.from, m.to, m.promotion || 'q');
    }
    return tempState.board;
  };

  const activeBoard = getReplayedBoard();

  // Highlight checked king square
  const getCheckedSquare = () => {
    if (gameState.status !== 'playing' && gameState.status !== 'checkmate') return null;
    const color = gameState.activeColor;
    if (isKingInCheck(gameState.board, color)) {
      return findKing(gameState.board, color);
    }
    return null;
  };

  const checkedKingSq = getCheckedSquare();

  // Helper to trigger move execution (mutates or creates new state, checks promotion etc)
  const handleMove = (from: Square, to: Square) => {
    if (currentReplayIndex !== -1) {
      // Exit replay mode if attempting to make a live move
      setCurrentReplayIndex(-1);
    }

    const piece = gameState.board[from.row][from.col];
    if (!piece) return;

    // Check pawn promotion condition
    const isPawn = piece.type === 'p';
    const isPromotionRow = to.row === 0 || to.row === 7;
    if (isPawn && isPromotionRow) {
      // Prompt modal
      setPromotionPending({ from, to });
      return;
    }

    executeMove(from, to);
  };

  const executeMove = (from: Square, to: Square, promotionPiece: 'q' | 'r' | 'b' | 'n' = 'q') => {
    setGameState((prev) => {
      // Create next state
      let next = makeMove(prev, from, to, promotionPiece);

      // Apply increment on move finished
      if (selectedTimer.timeSecs > 0) {
        if (prev.activeColor === 'w') {
          setWhiteTime((t) => t + selectedTimer.incrementSecs);
        } else {
          setBlackTime((t) => t + selectedTimer.incrementSecs);
        }
      }

      // Check sound effects
      const beforeOpponentColor = prev.activeColor;
      const wasCheck = isKingInCheck(next.board, next.activeColor);
      const isCapture = prev.board[to.row][to.col] !== null || next.moveHistory[next.moveHistory.length - 1]?.isEnPassant;
      const isCastle = next.moveHistory[next.moveHistory.length - 1]?.isCastling !== null;
      const isPromo = next.moveHistory[next.moveHistory.length - 1]?.promotion !== null;

      if (next.status !== 'playing' && next.status !== 'setup') {
        soundManager.play('gameover');
        recordGameEnd(next);
      } else if (wasCheck) {
        soundManager.play('check');
      } else if (isCapture) {
        soundManager.play('capture');
      } else if (isCastle || isPromo) {
        soundManager.play('castle');
      } else {
        soundManager.play('move');
      }

      // Sync undo/redo history stacks
      const newHistory = stateHistory.slice(0, historyIndex + 1);
      setStateHistory([...newHistory, next]);
      setHistoryIndex(newHistory.length);

      return next;
    });

    // Reset square selection
    setSelectedSquare(null);
  };

  // Trigger Pawn Promotion decision from modal
  const resolvePromotion = (type: any) => {
    if (promotionPending) {
      executeMove(promotionPending.from, promotionPending.to, type);
      setPromotionPending(null);
      unlockAchievement('promotion');
    }
  };

  // Undo takeback
  const handleUndo = () => {
    if (historyIndex > 0) {
      // In PvP, undo 1 step. In AI mode, undo 2 steps (user + AI move) to return to user's turn
      let steps = gameMode === 'ai' && historyIndex >= 2 ? 2 : 1;
      const nextIdx = historyIndex - steps;
      
      setGameState(stateHistory[nextIdx]);
      setHistoryIndex(nextIdx);
      setSelectedSquare(null);
      setCurrentReplayIndex(-1);
      soundManager.play('move');
    }
  };

  // Redo restore
  const handleRedo = () => {
    if (historyIndex < stateHistory.length - 1) {
      let steps = gameMode === 'ai' && historyIndex + 2 < stateHistory.length ? 2 : 1;
      const nextIdx = historyIndex + steps;

      setGameState(stateHistory[nextIdx]);
      setHistoryIndex(nextIdx);
      setSelectedSquare(null);
      setCurrentReplayIndex(-1);
      soundManager.play('move');
    }
  };

  // Resignation
  const handleResign = () => {
    setGameState((prev) => {
      const next = { ...prev, status: 'resign' as const, winner: 'b' as const };
      soundManager.play('gameover');
      recordGameEnd(next);
      return next;
    });
  };

  // Reset or Start game
  const handleRestart = () => {
    const initialState = createInitialState();
    initialState.status = 'playing'; // Change from setup to active match play!

    setGameState(initialState);
    setStateHistory([initialState]);
    setHistoryIndex(0);
    setSelectedSquare(null);
    setCurrentReplayIndex(-1);
    setPromotionPending(null);

    setWhiteTime(selectedTimer.timeSecs);
    setBlackTime(selectedTimer.timeSecs);

    soundManager.play('castle');
  };

  // Save game end metrics and local storage values
  const recordGameEnd = (finalState: ChessGameState) => {
    const isWon = finalState.winner === 'w';
    const isLost = finalState.winner === 'b';
    const isDraw =
      ['stalemate', 'draw-fifty', 'draw-repetition', 'draw-material'].includes(finalState.status) ||
      (finalState.status === 'timeout' && finalState.winner === null);

    const movesCount = finalState.moveHistory.length;

    setStats((prev) => {
      const nextPlayed = prev.played + 1;
      let nextWon = prev.won;
      let nextLost = prev.lost;
      let nextDrawn = prev.drawn;
      let nextStreak = prev.streak;

      if (isWon) {
        nextWon++;
        nextStreak++;
      } else if (isLost) {
        nextLost++;
        nextStreak = 0;
      } else if (isDraw) {
        nextDrawn++;
        nextStreak = 0;
      }

      const nextBestStreak = Math.max(prev.bestStreak, nextStreak);
      const nextMovesMade = prev.movesMade + movesCount;

      const nextStats = {
        played: nextPlayed,
        won: nextWon,
        lost: nextLost,
        drawn: nextDrawn,
        streak: nextStreak,
        bestStreak: nextBestStreak,
        movesMade: nextMovesMade,
      };

      localStorage.setItem('chess_user_stats', JSON.stringify(nextStats));
      return nextStats;
    });

    // Rating adjustment (Simulated ELO)
    setUserRating((prevRating) => {
      let change = 0;
      if (isWon) {
        // Higher rewards for harder AI
        const diffBonus =
          difficulty === 'easy' ? 8 : difficulty === 'medium' ? 16 : difficulty === 'hard' ? 24 : 35;
        change = diffBonus;
      } else if (isLost) {
        change = -12;
      } else if (isDraw) {
        change = 2;
      }

      const nextRating = Math.max(100, prevRating + change);
      localStorage.setItem('chess_user_rating', nextRating.toString());
      return nextRating;
    });

    // Check Achievements unlock conditions
    if (isWon) {
      unlockAchievement('first_win');
      if (gameMode === 'ai') {
        unlockAchievement('ai_conqueror');
        if (difficulty === 'hard' || difficulty === 'master') {
          unlockAchievement('expert_slayer');
        }
      }
      if (movesCount < 40) { // Under 20 moves per side (40 ply moves total)
        unlockAchievement('speed_demon');
      }
    }

    // Check early castling achievement
    const whiteCastled = finalState.moveHistory.some(
      (m, idx) => m.piece.color === 'w' && m.isCastling !== null && idx < 20
    );
    if (whiteCastled) {
      unlockAchievement('castle_safety');
    }
  };

  const unlockAchievement = (id: string) => {
    setAchievements((prev) => {
      const next = prev.map((ach) => {
        if (ach.id === id && ach.unlockedAt === null) {
          const unlockedAch = { ...ach, unlockedAt: new Date().toISOString() };
          // Alert user beautifully
          setRecentAchievement(unlockedAch);
          return unlockedAch;
        }
        return ach;
      });
      localStorage.setItem('chess_user_achievements', JSON.stringify(next));
      return next;
    });
  };

  // Close recent achievement popup
  const dismissAchievementAlert = () => {
    setRecentAchievement(null);
  };

  // Determine legal movements highlights
  const legalMovesForSelected = selectedSquare
    ? getLegalMoves(gameState, selectedSquare)
    : [];

  const lastMoveInHistory =
    gameState.moveHistory.length > 0
      ? gameState.moveHistory[gameState.moveHistory.length - 1]
      : null;

  // Render Captured pieces materials
  const whiteLosses = gameState.board.flat().filter((p) => p !== null && p.color === 'w');
  const blackLosses = gameState.board.flat().filter((p) => p !== null && p.color === 'b');

  // Compute pieces captured: those NOT on the board anymore.
  // Starting counts: 8p, 2r, 2n, 2b, 1q, 1k
  const getCapturedList = (color: 'w' | 'b') => {
    // Collect all pieces on the board right now
    const currentOnBoardIds = new Set(
      gameState.board
        .flat()
        .filter((p) => p !== null && p.color === color)
        .map((p) => p!.id)
    );

    // Filter the initial generated pieces list
    const captured: any[] = [];
    stateHistory[0].board.flat().forEach((p) => {
      if (p && p.color === color && !currentOnBoardIds.has(p.id)) {
        captured.push(p);
      }
    });

    return captured;
  };

  const capturedWhitePieces = getCapturedList('w'); // White pieces captured by black
  const capturedBlackPieces = getCapturedList('b'); // Black pieces captured by white

  const materialBalance = getMaterialDifference(capturedWhitePieces, capturedBlackPieces);

  return (
    <div className={`min-h-screen bg-gradient-to-b ${boardTheme.bg} flex flex-col font-sans transition-all duration-300`}>
      {/* Dynamic Unlocked Achievement Toast Notification */}
      {recentAchievement && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl p-4 flex items-center gap-4 max-w-sm w-full animate-bounce">
          <span className="text-3xl">{recentAchievement.icon}</span>
          <div className="text-left flex-1">
            <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">
              Achievement Unlocked!
            </span>
            <h4 className="text-sm font-bold text-slate-100">{recentAchievement.title}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{recentAchievement.desc}</p>
          </div>
          <button
            onClick={dismissAchievementAlert}
            className="text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700"
          >
            Awesome
          </button>
        </div>
      )}

      {/* Pawn Promotion Dialog */}
      {promotionPending && (
        <PawnPromotionModal
          color={gameState.activeColor}
          onSelect={resolvePromotion}
          onClose={() => setPromotionPending(null)}
        />
      )}

      {/* Primary Application Header */}
      <header className="sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 z-40 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/10">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black tracking-tight text-slate-50 flex items-center gap-2">
                Royal Chess <span className="text-[10px] bg-amber-500/10 text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/20">v2.1</span>
              </h1>
              <p className="text-[10px] text-slate-500 hidden md:block font-medium">
                Sleek Chess engine with Alpha-Beta minimax heuristics & Career Ratings
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex bg-slate-900 border border-slate-850 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('play')}
              className={`flex items-center gap-2 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'play' ? 'bg-slate-950 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Play
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'stats' ? 'bg-slate-950 text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" /> Career Profile
            </button>
          </nav>
        </div>
      </header>

      {/* Primary Container Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {activeTab === 'stats' ? (
          <div className="animate-fadeIn">
            <StatsDashboard
              stats={stats}
              rating={userRating}
              achievements={achievements}
              leaderboard={leaderboard}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
            
            {/* LEFT / CENTER: Chessboard, Captured materials and status banners (Span 8) */}
            <div className="lg:col-span-8 space-y-6 flex flex-col items-center">
              {/* Captured Black Pieces & White Material Lead */}
              <div className="flex items-center justify-between gap-4 w-full max-w-[560px]">
                <CapturedPieces captured={capturedBlackPieces} color="b" />
                {materialBalance.whiteLead > 0 && (
                  <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-lg shrink-0 h-[48px] flex items-center justify-center border border-amber-400">
                    +{materialBalance.whiteLead} Lead
                  </span>
                )}
              </div>

              {/* Central Chessboard Component */}
              <div className="relative w-full max-w-[560px]">
                {/* AI Thinking Overlay Banner */}
                {isAIThinking && (
                  <div className="absolute top-4 left-4 z-30 bg-indigo-950 border border-indigo-500/50 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-xl animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-bold text-indigo-300">
                      AI is formulating strategy...
                    </span>
                  </div>
                )}

                <ChessBoard
                  board={activeBoard}
                  onMove={handleMove}
                  selectedSquare={selectedSquare}
                  setSelectedSquare={setSelectedSquare}
                  legalMoves={legalMovesForSelected}
                  lastMove={lastMoveInHistory}
                  checkedSquare={checkedKingSq}
                  isFlipped={isBoardFlipped}
                  theme={boardTheme}
                  interactive={gameState.status === 'playing' && !isAIThinking && currentReplayIndex === -1}
                />
              </div>

              {/* Captured White Pieces & Black Material Lead */}
              <div className="flex items-center justify-between gap-4 w-full max-w-[560px]">
                <CapturedPieces captured={capturedWhitePieces} color="w" />
                {materialBalance.blackLead > 0 && (
                  <span className="text-[10px] bg-indigo-500 text-slate-100 font-black px-2.5 py-1 rounded-lg shrink-0 h-[48px] flex items-center justify-center border border-indigo-400">
                    +{materialBalance.blackLead} Lead
                  </span>
                )}
              </div>

              {/* Turn indicators, clocks, and result notices */}
              <div className="w-full max-w-[560px] space-y-4">
                {selectedTimer.timeSecs > 0 && (
                  <ChessTimer
                    whiteTime={whiteTime}
                    blackTime={blackTime}
                    activeColor={gameState.activeColor}
                    status={gameState.status}
                    maxTime={selectedTimer.timeSecs}
                  />
                )}

                {/* Match Outcomes & Info Cards */}
                {gameState.status === 'setup' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="text-left flex-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        Setup Complete
                      </span>
                      <p className="text-xs text-slate-300">
                        Press <strong className="text-indigo-400">Start Game</strong> on the right console to activate clock timer and begin.
                      </p>
                    </div>
                  </div>
                )}

                {gameState.status !== 'playing' && gameState.status !== 'setup' && (
                  <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-50 tracking-tight">
                          Match Concluded!
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {gameState.status === 'checkmate' && (
                            <>Checkmate! Winner: <strong className="text-amber-400 uppercase">{gameState.winner === 'w' ? 'White' : 'Black'}</strong></>
                          )}
                          {gameState.status === 'stalemate' && 'Draw by stalemate (No legal moves remain)'}
                          {gameState.status === 'draw-repetition' && 'Draw by threefold repetition'}
                          {gameState.status === 'draw-fifty' && 'Draw by 50-move rule (no pawn moves or captures)'}
                          {gameState.status === 'draw-material' && 'Draw by insufficient checkmating material'}
                          {gameState.status === 'resign' && (
                            <>Resignation! Winner: <strong className="text-amber-400 uppercase">{gameState.winner === 'w' ? 'White' : 'Black'}</strong></>
                          )}
                          {gameState.status === 'timeout' && (
                            <>Time Expired! Winner: <strong className="text-amber-400 uppercase">{gameState.winner === 'w' ? 'White' : 'Black'}</strong></>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRestart}
                      className="w-full md:w-auto flex items-center justify-center gap-2 py-2 px-5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-95 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Play Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDE: Action and custom controllers (Span 4) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Move Notation logger */}
              <div className="h-[320px]">
                <MoveHistory
                  history={gameState.moveHistory}
                  currentReplayIndex={currentReplayIndex}
                  onSelectReplayIndex={setCurrentReplayIndex}
                />
              </div>

              {/* Game Controllers Panel */}
              <ControlPanel
                gameMode={gameMode}
                setGameMode={setGameMode}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                selectedTimer={selectedTimer}
                timers={TIMERS}
                setSelectedTimer={setSelectedTimer}
                boardTheme={boardTheme}
                themes={THEMES}
                setBoardTheme={setBoardTheme}
                soundEnabled={soundEnabled}
                setSoundEnabled={setSoundEnabled}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onResign={handleResign}
                onRestart={handleRestart}
                onFlip={() => setIsBoardFlipped(!isBoardFlipped)}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < stateHistory.length - 1}
                status={gameState.status}
                activeColor={gameState.activeColor}
              />
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
