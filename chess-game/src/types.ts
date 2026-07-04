export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Square {
  row: number; // 0 to 7
  col: number; // 0 to 7
}

export interface ChessPiece {
  id: string; // Unique id for React key rendering and key stability
  type: PieceType;
  color: Color;
  hasMoved: boolean;
}

export type BoardState = (ChessPiece | null)[][];

export interface Move {
  from: Square;
  to: Square;
  piece: ChessPiece;
  captured: ChessPiece | null;
  promotion: PieceType | null;
  isCastling: 'king' | 'queen' | null;
  isEnPassant: boolean;
  isDoublePawn: boolean;
  san: string; // Standard Algebraic Notation (e.g. e4, Nf3, Bxe5, O-O)
  fenAfter: string; // FEN representation after this move, for repetition detection
}

export type GameMode = 'pvp' | 'ai';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'master';
export type GameStatus =
  | 'setup'
  | 'playing'
  | 'checkmate'
  | 'stalemate'
  | 'draw-repetition'
  | 'draw-fifty'
  | 'draw-material'
  | 'resign'
  | 'timeout';

export interface TimerConfig {
  id: string;
  name: string;
  timeSecs: number; // 0 for infinite
  incrementSecs: number;
}

export interface PlayerProfile {
  name: string;
  rating: number;
  avatar: string;
}

export interface GameStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  streak: number;
  bestStreak: number;
  movesMade: number;
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlockedAt: string | null; // null if locked
}

export interface BoardTheme {
  id: string;
  name: string;
  light: string; // Tailwind class or Hex
  dark: string; // Tailwind class or Hex
  highlight: string; // Tailwind class for move indicators
  bg: string; // Outer application background
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  rating: number;
  title: string;
  avatar: string;
  isUser?: boolean;
}
