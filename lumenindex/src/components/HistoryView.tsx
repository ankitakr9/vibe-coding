import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { SearchHistoryItem } from '../types/search';

interface HistoryViewProps {
  onReplayQuery: (query: string) => void;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryView({ onReplayQuery }: HistoryViewProps) {
  const { firebaseUser, signInWithGoogle, apiFetch } = useAuth();
  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadHistory = useCallback(
    async (searchFilter = '') => {
      if (!firebaseUser) {
        setItems([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = searchFilter.trim()
          ? `?q=${encodeURIComponent(searchFilter.trim())}`
          : '';
        const data = await apiFetch<{ items: SearchHistoryItem[] }>(
          `/api/history${params}`
        );
        setItems(data.items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load search history.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, firebaseUser]
  );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/history/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry.');
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    setError(null);
    try {
      await apiFetch('/api/history', { method: 'DELETE' });
      setItems([]);
      setConfirmClear(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clear history.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-[1060px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950 mb-1.5">
            Search history
          </h1>
          <p className="text-[15px] text-zinc-600">
            Personal record of your queries, result counts, and execution latency.
          </p>
        </div>

        {firebaseUser && items.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs text-zinc-600">Clear all entries?</span>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  {clearing ? 'Clearing...' : 'Confirm clear'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-2 text-xs font-medium text-zinc-700 border border-zinc-300 bg-white hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Clear history
              </button>
            )}
          </div>
        )}
      </div>

      {!firebaseUser ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-950 mb-2">
            Sign in to view your search history
          </h2>
          <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
            Each search you execute while signed in is privately stored to your account so you can replay or audit past queries anytime.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 max-w-md relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                void loadHistory(e.target.value);
              }}
              placeholder="Filter past queries..."
              aria-label="Filter search history"
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          {error && (
            <div className="mb-5 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-200">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="px-5 py-4 flex items-center justify-between">
                  <div className="h-4 w-56 bg-zinc-100 rounded animate-pulse" />
                  <div className="h-4 w-28 bg-zinc-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-dashed border-zinc-300 rounded-xl p-12 text-center">
              <p className="font-display text-base font-semibold text-zinc-900 mb-1">
                {filter.trim() ? 'No matching history entries' : 'No saved searches yet'}
              </p>
              <p className="text-sm text-zinc-500 mb-5">
                {filter.trim()
                  ? 'Try a different filter term.'
                  : 'Run any keyword search while signed in and it will be recorded here.'}
              </p>
              {!filter.trim() && (
                <button
                  type="button"
                  onClick={() => onReplayQuery('apache lucene')}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors cursor-pointer"
                >
                  Run sample search
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                    <th className="py-3 px-5">Query</th>
                    <th className="py-3 px-4">Scope</th>
                    <th className="py-3 px-4 text-right">Results</th>
                    <th className="py-3 px-4 text-right">Latency</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-5 font-medium text-zinc-900 max-w-[340px]">
                        <button
                          type="button"
                          onClick={() => onReplayQuery(item.query)}
                          className="text-left hover:text-[#2563EB] hover:underline underline-offset-4 truncate block max-w-full cursor-pointer"
                        >
                          {item.query}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-xs text-zinc-500 capitalize">
                        {item.sourceFilter}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-700">
                        {item.resultCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-zinc-500">
                        {item.executionMs} ms
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-zinc-500 whitespace-nowrap">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onReplayQuery(item.query)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#2563EB] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            Run
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id)}
                            aria-label={`Delete query ${item.query}`}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
