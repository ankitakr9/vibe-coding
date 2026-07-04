import React from 'react';
import { Color, PieceType } from '../types';

interface PieceProps {
  color: Color;
  className?: string;
}

// Sleek, modern, and vector-perfect Chess Piece components using responsive SVGs
export const Pawn: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Head */}
        <circle cx="22.5" cy="14.5" r="6" />
        {/* Collar */}
        <path d="M19 21.5h7" />
        {/* Body */}
        <path d="M22.5 21.5c-4 0-6.5 4.5-6.5 11h13c0-6.5-2.5-11-6.5-11z" />
        {/* Base */}
        <path d="M14.5 35h16c1 0 1 1.5 0 1.5h-16c-1 0-1-1.5 0-1.5z" />
        <path d="M11.5 38.5h22c1.5 0 1.5 2 0 2h-22c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

export const Knight: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Mane, Head & Snout */}
        <path d="M22 10c-3 1-5.5 3.5-7 6.5-1 2-1 4.5-.5 6.5.5 2 1.5 3 2 4.5s-.5 3-1.5 4.5c-1 1.5-2.5 2.5-3.5 4-1 1-1.5 2.5-.5 3 2 1 5 .5 8-.5s5-1.5 6-3.5c1-1.5 2-4.5 3.5-6.5s3.5-2 3.5-4c0-2-1.5-4-3-4.5s-2.5.5-4-1c-1-1-1.5-2.5-2.5-3.5-.5-1-1.5-2-1-2.5z" />
        {/* Eye */}
        <circle cx="27" cy="18" r="1.5" fill={stroke} />
        {/* Bottom Ring */}
        <path d="M11.5 38.5h22c1.5 0 1.5 2 0 2h-22c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

export const Bishop: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Head Chapeau */}
        <path d="M22.5 8c-3.5 0-6.5 4.5-6.5 9s3 6.5 6.5 6.5 6.5-2 6.5-6.5-3-9-6.5-9z" />
        {/* Mitre Cross Chime */}
        <path d="M22.5 5v3M21 6.5h3" />
        {/* Slit in Bishop's Cap */}
        <path d="M17.5 14.5l10 5" stroke={stroke} strokeWidth="1" />
        {/* Collar */}
        <path d="M16 26.5h13" />
        {/* Body */}
        <path d="M22.5 26.5c-4 0-6.5 3.5-6.5 8h13c0-4.5-2.5-8-6.5-8z" />
        {/* Bottom base */}
        <path d="M11.5 38.5h22c1.5 0 1.5 2 0 2h-22c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

export const Rook: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Castle Battlements */}
        <path d="M12 12h5v4h4v-4h5v4h4v-4h5v8H12v-8z" />
        {/* Pillar */}
        <path d="M15 20v13h15V20H15z" />
        {/* Inner ring line decoration */}
        <path d="M14 24h17M14 29h17" stroke={stroke} strokeWidth="1" />
        {/* Wide Base */}
        <path d="M11 35h23v3.5H11V35z" />
        <path d="M8.5 38.5h28c1.5 0 1.5 2 0 2H8.5c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

export const Queen: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Jewels on crown crown spikes */}
        <circle cx="10" cy="11" r="1.5" />
        <circle cx="16.25" cy="7.5" r="1.5" />
        <circle cx="22.5" cy="6" r="1.5" />
        <circle cx="28.75" cy="7.5" r="1.5" />
        <circle cx="35" cy="11" r="1.5" />
        {/* Crown base spikes */}
        <path d="M10 13.5l6.25 10 6.25-15 6.25 15 6.25-10v14h-25V13.5z" />
        {/* Lower body */}
        <path d="M15 27.5c-4 0-6.5 3.5-6.5 8h28c0-4.5-2.5-8-6.5-8H15z" />
        {/* Accent crown rings */}
        <circle cx="22.5" cy="22" r="3" />
        {/* Bottom base */}
        <path d="M11.5 38.5h22c1.5 0 1.5 2 0 2h-22c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

export const King: React.FC<PieceProps> = ({ color, className = 'w-full h-full' }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#FFFFFF' : '#1A1A1A';
  const stroke = isWhite ? '#2C3E50' : '#ECEFF1';
  const strokeWidth = '1.5';

  return (
    <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* Royal King Crown Cross */}
        <path d="M22.5 5v5M20 7.5h5" />
        {/* Crown Arches */}
        <path d="M14.5 15c0-4 4-5 8-5s8 1 8 5-2 3.5-4 4.5c2 1 4 4.5 4 6.5H14.5c0-2 2-5.5 4-6.5-2-1-4-.5-4-4.5z" />
        {/* Band */}
        <path d="M13.5 29.5h18" />
        {/* Main Base Body */}
        <path d="M22.5 29.5c-4 0-7.5 3-7.5 8h15c0-5-3.5-8-7.5-8z" />
        {/* Bottom Stand */}
        <path d="M11.5 38.5h22c1.5 0 1.5 2 0 2h-22c-1.5 0-1.5-2 0-2z" />
      </g>
    </svg>
  );
};

// Main dispatcher component to render the correct piece
interface PieceDispatcherProps {
  type: PieceType;
  color: Color;
  className?: string;
}

export const ChessPieceComponent: React.FC<PieceDispatcherProps> = ({ type, color, className }) => {
  switch (type) {
    case 'p':
      return <Pawn color={color} className={className} />;
    case 'n':
      return <Knight color={color} className={className} />;
    case 'b':
      return <Bishop color={color} className={className} />;
    case 'r':
      return <Rook color={color} className={className} />;
    case 'q':
      return <Queen color={color} className={className} />;
    case 'k':
      return <King color={color} className={className} />;
    default:
      return null;
  }
};
