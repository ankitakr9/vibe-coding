import React from 'react';
import { GameStats, Achievement, LeaderboardEntry } from '../types';
import { Award, Trophy, User, Target, Zap, TrendingUp, Flame } from 'lucide-react';

interface StatsDashboardProps {
  stats: GameStats;
  rating: number;
  achievements: Achievement[];
  leaderboard: LeaderboardEntry[];
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  rating,
  achievements,
  leaderboard,
}) => {
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

  const cards = [
    {
      title: 'ELO Rating',
      value: rating,
      icon: <Trophy className="w-5 h-5 text-amber-400" />,
      sub: 'Simulated Grandmaster Rank',
    },
    {
      title: 'Games Played',
      value: stats.played,
      icon: <Target className="w-5 h-5 text-indigo-400" />,
      sub: `${stats.won}W / ${stats.lost}L / ${stats.drawn}D`,
    },
    {
      title: 'Win Rate',
      value: `${winRate}%`,
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      sub: 'Of total matches played',
    },
    {
      title: 'Active Streak',
      value: stats.streak,
      icon: <Flame className="w-5 h-5 text-orange-500" />,
      sub: `Best: ${stats.bestStreak} games`,
    },
  ];

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Banner Profile Summary */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-950/40 via-slate-900/40 to-emerald-950/20 p-5 rounded-2xl border border-slate-800/60 backdrop-blur-md">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-500/80 flex items-center justify-center text-slate-100 shadow-lg shadow-amber-500/10">
            <User className="w-7 h-7 text-amber-500" />
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 bg-amber-500 text-[10px] font-black text-slate-950 px-1.5 py-0.5 rounded-full border-2 border-slate-950">
            PRO
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Active Player Profile</h2>
          <p className="text-xs text-slate-400">
            Unlock achievements and defeat the Chess AI to scale the ELO leaderboard!
          </p>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className="bg-slate-900/85 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700/50 transition-all shadow-md group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300">
                {card.title}
              </span>
              <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-850">
                {card.icon}
              </div>
            </div>
            <div className="mt-2.5">
              <span className="text-2xl font-black text-slate-50 font-mono tracking-tight">
                {card.value}
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Split Leaderboard & Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Achievements Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-3">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">
              Achievements
            </h3>
            <span className="ml-auto text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {achievements.filter((a) => a.unlockedAt !== null).length} / {achievements.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {achievements.map((ach) => {
              const isUnlocked = ach.unlockedAt !== null;

              return (
                <div
                  key={ach.id}
                  className={`flex items-start gap-3.5 p-3 rounded-xl border transition-all ${
                    isUnlocked
                      ? 'bg-amber-950/10 border-amber-500/20 shadow-inner'
                      : 'bg-slate-950/40 border-slate-850 opacity-60'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
                      isUnlocked
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-600'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 text-left">
                    <h4
                      className={`text-xs font-bold tracking-tight ${
                        isUnlocked ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {ach.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
                      {ach.desc}
                    </p>
                    {isUnlocked && (
                      <span className="inline-block text-[8px] font-mono font-semibold text-amber-500 bg-amber-500/5 px-1.5 py-0.5 rounded mt-1 border border-amber-500/10">
                        Unlocked {new Date(ach.unlockedAt!).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ELO Leaderboard Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col h-[400px]">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-850 pb-3">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">
              ELO Leaderboard
            </h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400 font-mono">
              Simulated Lobby
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  entry.isUser
                    ? 'bg-indigo-950/25 border-indigo-500/40 shadow-md ring-1 ring-indigo-500/25'
                    : 'bg-slate-950/30 border-slate-850 hover:bg-slate-850/30'
                }`}
              >
                {/* Rank number badge */}
                <span
                  className={`w-6 font-mono text-center text-xs font-black ${
                    entry.rank === 1
                      ? 'text-amber-400'
                      : entry.rank === 2
                      ? 'text-slate-300'
                      : entry.rank === 3
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  #{entry.rank}
                </span>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-slate-400">
                    {entry.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Name & Title */}
                <div className="text-left flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold truncate ${
                        entry.isUser ? 'text-indigo-300' : 'text-slate-200'
                      }`}
                    >
                      {entry.name}
                    </span>
                    {entry.title && (
                      <span className="text-[8px] font-black bg-slate-800 text-slate-300 px-1 rounded uppercase tracking-wider border border-slate-700">
                        {entry.title}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500">
                    {entry.isUser ? 'Your active ranking' : 'Grandmaster Competitor'}
                  </span>
                </div>

                {/* Rating score */}
                <span className="font-mono text-xs font-bold text-indigo-400 shrink-0">
                  {entry.rating}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
