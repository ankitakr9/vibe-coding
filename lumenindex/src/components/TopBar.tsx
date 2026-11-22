import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppTab } from '../types/search';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'search', label: 'Search' },
  { id: 'index', label: 'Index Content' },
  { id: 'history', label: 'History' },
  { id: 'admin', label: 'Admin' },
];

export function TopBar({ activeTab, onSelectTab }: TopBarProps) {
  const { profile, firebaseUser, loading, signInWithGoogle, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName =
    profile?.displayName ||
    firebaseUser?.displayName ||
    profile?.email?.split('@')[0] ||
    'Account';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-[1220px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single clean wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('search')}
          className="font-display text-xl font-bold tracking-tight text-zinc-950 hover:text-[#2563EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          LumenIndex
        </button>

        {/* Zone 2: 4 clean single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-7 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#2563EB]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary account action */}
        <div className="shrink-0 relative" ref={menuRef}>
          {loading ? (
            <div className="w-20 h-9 rounded-lg bg-zinc-100 animate-pulse" />
          ) : firebaseUser ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span className="max-w-[140px] truncate">{displayName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-lg border border-zinc-200 bg-white shadow-lg py-2 z-40">
                  <div className="px-4 py-2 border-b border-zinc-100">
                    <p className="text-sm font-medium text-zinc-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {profile?.email || firebaseUser.email}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Role: {profile?.role === 'admin' ? 'Administrator' : 'Member'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-zinc-400" />
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-4 py-2 text-sm font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
