import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  CorpusSummary,
  DocumentDetail,
  RankedSearchResult,
  SearchHistoryItem,
  SearchResponse,
} from '../types/search';
import { DocumentReaderModal } from './DocumentReaderModal';

interface SearchViewProps {
  externalQueryRequest: { query: string; nonce: number } | null;
  onNavigateHistory: () => void;
  onNavigateIndex: () => void;
  corpusRefreshKey: number;
}

const EXAMPLE_QUERIES = [
  'apache lucene',
  '"okapi bm25"',
  'spring boot rest',
  'postgresql index',
  'title:security',
  '+crawler -deprecated',
];

function getSafeExternalUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.hostname.endsWith('.local')
    ) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SearchView({
  externalQueryRequest,
  onNavigateHistory,
  onNavigateIndex,
  corpusRefreshKey,
}: SearchViewProps) {
  const { apiFetch, firebaseUser, signInWithGoogle } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'webpage' | 'document'>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'words'>('relevance');

  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<CorpusSummary | null>(null);
  const [recentHistory, setRecentHistory] = useState<SearchHistoryItem[]>([]);
  const [expandedBreakdownIds, setExpandedBreakdownIds] = useState<Set<number>>(
    () => new Set()
  );

  const [previewDoc, setPreviewDoc] = useState<DocumentDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiFetch<CorpusSummary>('/api/corpus/summary');
      setSummary(data);
    } catch (err) {
      console.error('Could not load corpus summary:', err);
    }
  }, [apiFetch]);

  const loadRecentHistory = useCallback(async () => {
    if (!firebaseUser) {
      setRecentHistory([]);
      return;
    }
    try {
      const data = await apiFetch<{ items: SearchHistoryItem[] }>('/api/history');
      setRecentHistory(data.items.slice(0, 6));
    } catch (err) {
      console.error('Could not load recent history:', err);
    }
  }, [apiFetch, firebaseUser]);

  const executeSearch = useCallback(
    async (
      queryText: string,
      opts?: {
        source?: 'all' | 'webpage' | 'document';
        category?: string;
        sort?: 'relevance' | 'newest' | 'words';
        record?: boolean;
      }
    ) => {
      const nextSource = opts?.source ?? sourceFilter;
      const nextCategory = opts?.category ?? categoryFilter;
      const nextSort = opts?.sort ?? sortBy;
      const shouldRecord = opts?.record ?? true;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: queryText,
          type: nextSource,
          category: nextCategory,
          sort: nextSort,
          record: shouldRecord ? 'true' : 'false',
        });
        const data = await apiFetch<SearchResponse>(`/api/search?${params.toString()}`);
        setSearchData(data);
        setActiveQuery(queryText);
        setExpandedBreakdownIds(new Set());
        if (shouldRecord && queryText.trim() && firebaseUser) {
          void loadRecentHistory();
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to execute search.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, categoryFilter, firebaseUser, loadRecentHistory, sortBy, sourceFilter]
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, corpusRefreshKey]);

  useEffect(() => {
    void loadRecentHistory();
  }, [loadRecentHistory]);

  // Initial corpus load
  useEffect(() => {
    void executeSearch('', { record: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpusRefreshKey]);

  // Triggered when user clicks a history item or inverted index term from another tab
  useEffect(() => {
    if (!externalQueryRequest) return;
    setInputValue(externalQueryRequest.query);
    void executeSearch(externalQueryRequest.query, { record: true });
  }, [externalQueryRequest, executeSearch]);

  // Keyboard shortcut `/` to focus search bar
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void executeSearch(inputValue, { record: true });
  };

  const handleSourceChange = (next: 'all' | 'webpage' | 'document') => {
    setSourceFilter(next);
    void executeSearch(activeQuery, { source: next, record: false });
  };

  const handleCategoryChange = (next: string) => {
    setCategoryFilter(next);
    void executeSearch(activeQuery, { category: next, record: false });
  };

  const handleSortChange = (next: 'relevance' | 'newest' | 'words') => {
    setSortBy(next);
    void executeSearch(activeQuery, { sort: next, record: false });
  };

  const toggleBreakdown = (id: number) => {
    setExpandedBreakdownIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDocumentPreview = async (docId: number) => {
    setPreviewLoading(true);
    setPreviewDoc(null);
    try {
      const doc = await apiFetch<DocumentDetail>(`/api/documents/${docId}`);
      setPreviewDoc(doc);
    } catch (err) {
      console.error('Failed to open document:', err);
      setPreviewDoc(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleQuickQuery = (q: string) => {
    setInputValue(q);
    void executeSearch(q, { record: true });
  };

  const results: RankedSearchResult[] = searchData?.results ?? [];

  return (
    <div className="max-w-[1220px] mx-auto px-6 py-10">
      {/* Search Header & Primary Query Anchor */}
      <section className="max-w-3xl mb-9">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 mb-2">
          Search indexed pages and documents
        </h1>
        <p className="text-[15px] text-zinc-600 mb-6">
          Full-text inverted index ranked with Okapi BM25, phrase matching, boolean operators, and field filters.
        </p>

        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center bg-white border border-zinc-300 focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]/15 rounded-xl transition-all">
            <Search className="w-5 h-5 text-zinc-400 ml-4 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Search keywords, "exact phrase", +required, -excluded, title:term...'
              aria-label="Search query"
              className="w-full py-3.5 px-3 text-[15px] text-zinc-950 placeholder:text-zinc-400 bg-transparent focus:outline-none"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  void executeSearch('', { record: false });
                  inputRef.current?.focus();
                }}
                aria-label="Clear query"
                className="p-2 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="m-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>

        {/* Example query triggers */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
          <span>Try:</span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleQuickQuery(example)}
              className="font-mono text-zinc-600 hover:text-[#2563EB] underline decoration-zinc-300 hover:decoration-[#2563EB] underline-offset-4 transition-colors cursor-pointer"
            >
              {example}
            </button>
          ))}
        </div>
      </section>

      {/* Filter & Sort Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-zinc-200">
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="group"
            aria-label="Filter by source type"
            className="inline-flex items-center p-1 bg-zinc-100 rounded-lg"
          >
            {(
              [
                { id: 'all', label: 'All Sources' },
                { id: 'webpage', label: 'Web Pages' },
                { id: 'document', label: 'Documents' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSourceChange(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sourceFilter === opt.id
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <label htmlFor="category-filter" className="sr-only">
              Category
            </label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#2563EB] focus:outline-none cursor-pointer"
            >
              <option value="All">All categories</option>
              {summary?.categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.count})
                </option>
              ))}
            </select>

            <label htmlFor="sort-select" className="sr-only">
              Sort order
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) =>
                handleSortChange(e.target.value as 'relevance' | 'newest' | 'words')
              }
              className="bg-white border border-zinc-200 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-[#2563EB] focus:outline-none cursor-pointer"
            >
              <option value="relevance">Sort: BM25 Relevance</option>
              <option value="newest">Sort: Recently Indexed</option>
              <option value="words">Sort: Word Count</option>
            </select>
          </div>
        </div>

        {/* Result stats line */}
        {searchData && !loading && (
          <div className="text-xs text-zinc-500 tabular-nums flex items-center gap-2">
            <span>
              {activeQuery.trim()
                ? `${searchData.totalResults} ranked ${
                    searchData.totalResults === 1 ? 'result' : 'results'
                  }`
                : `Showing ${searchData.totalResults} of ${searchData.corpusSize} indexed items`}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{searchData.executionMs} ms</span>
          </div>
        )}
      </div>

      {/* Main Two-Column Results & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-12 items-start">
        {/* Ranked Results Stream */}
        <div className="min-w-0">
          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 flex items-center justify-between gap-4">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void executeSearch(activeQuery, { record: false })}
                className="text-xs font-medium underline cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-zinc-200">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="py-6 first:pt-1 space-y-2.5">
                  <div className="h-3.5 w-60 bg-zinc-200/70 rounded animate-pulse" />
                  <div className="h-5 w-3/4 bg-zinc-200 rounded animate-pulse" />
                  <div className="h-4 w-full bg-zinc-100 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-zinc-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-zinc-300 rounded-xl bg-white px-6">
              <p className="font-display text-lg font-semibold text-zinc-900 mb-1.5">
                No matching documents found
              </p>
              <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                No indexed pages matched{' '}
                <span className="font-mono text-zinc-800">
                  {activeQuery || 'your current filters'}
                </span>
                . Try broader keywords, relax filters, or index a new document.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('');
                    setSourceFilter('all');
                    setCategoryFilter('All');
                    void executeSearch('', {
                      source: 'all',
                      category: 'All',
                      record: false,
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                >
                  Reset search
                </button>
                <button
                  type="button"
                  onClick={onNavigateIndex}
                  className="px-4 py-2 text-sm font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Index new content
                </button>
              </div>
            </div>
          ) : (
            <ol className="divide-y divide-zinc-200">
              {results.map((item) => {
                const isExpanded = expandedBreakdownIds.has(item.id);
                const externalHref = getSafeExternalUrl(item.url);

                return (
                  <li key={item.id} className="py-6 first:pt-1">
                    {/* Clean unboxed top metadata line */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 mb-1.5">
                      <span className="font-mono text-zinc-700">{item.domain}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.sourceType === 'webpage' ? 'Web Page' : 'Document'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Indexed {formatDateShort(item.indexedAt)}
                      </span>
                    </div>

                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <button
                        type="button"
                        onClick={() => void openDocumentPreview(item.id)}
                        className="text-left font-display text-lg font-semibold text-[#1D4ED8] hover:underline underline-offset-4 leading-snug cursor-pointer"
                      >
                        {item.title}
                      </button>

                      {externalHref && (
                        <a
                          href={externalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${item.title} in new tab`}
                          className="p-1.5 text-zinc-400 hover:text-zinc-800 transition-colors shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Safe highlighted snippet (React text segments only) */}
                    <p className="text-[14.5px] text-zinc-700 leading-relaxed mb-3 max-w-[74ch]">
                      {item.snippet.map((seg, i) =>
                        seg.highlighted ? (
                          <mark
                            key={i}
                            className="bg-amber-100/90 text-zinc-950 font-medium px-0.5 rounded-xs"
                          >
                            {seg.text}
                          </mark>
                        ) : (
                          <React.Fragment key={i}>{seg.text}</React.Fragment>
                        )
                      )}
                    </p>

                    {/* Footer metrics & BM25 explanation toggle */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 tabular-nums">
                      {activeQuery.trim() && item.score > 0 && (
                        <span className="font-mono font-medium text-zinc-800">
                          BM25 {item.score.toFixed(3)}
                        </span>
                      )}
                      <span>{item.wordCount.toLocaleString()} words</span>
                      <span>{item.termCount.toLocaleString()} unique terms</span>

                      {item.breakdown.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleBreakdown(item.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
                        >
                          {isExpanded ? 'Hide ranking breakdown' : 'Ranking breakdown'}
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Transparent Okapi BM25 term breakdown table */}
                    {isExpanded && item.breakdown.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-zinc-100 overflow-x-auto">
                        <table className="w-full text-left text-xs tabular-nums">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-200">
                              <th className="py-1.5 pr-4 font-medium">Stemmed Term</th>
                              <th className="py-1.5 px-3 font-medium text-right">
                                Title / KW / Body
                              </th>
                              <th className="py-1.5 px-3 font-medium text-right">
                                Weighted TF
                              </th>
                              <th className="py-1.5 px-3 font-medium text-right">DF</th>
                              <th className="py-1.5 px-3 font-medium text-right">IDF</th>
                              <th className="py-1.5 pl-3 font-medium text-right">
                                BM25 Score
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 font-mono text-zinc-700">
                            {item.breakdown.map((row) => (
                              <tr key={row.term}>
                                <td className="py-1.5 pr-4 font-medium text-zinc-900">
                                  {row.term}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  {row.titleFreq} / {row.keywordFreq} / {row.bodyFreq}
                                </td>
                                <td className="py-1.5 px-3 text-right">
                                  {row.weightedTf.toFixed(1)}
                                </td>
                                <td className="py-1.5 px-3 text-right">{row.docFreq}</td>
                                <td className="py-1.5 px-3 text-right">
                                  {row.idf.toFixed(3)}
                                </td>
                                <td className="py-1.5 pl-3 text-right font-medium text-zinc-950">
                                  +{row.bm25Contribution.toFixed(3)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Right Companion Sidebar */}
        <aside className="space-y-8 lg:sticky lg:top-24">
          {/* Recent Search History */}
          <div className="pb-7 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold text-zinc-950">
                Recent searches
              </h2>
              {firebaseUser && (
                <button
                  type="button"
                  onClick={onNavigateHistory}
                  className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                >
                  View all
                </button>
              )}
            </div>

            {!firebaseUser ? (
              <div className="space-y-2.5">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Sign in with Google to automatically store and replay your search history across sessions.
                </p>
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="text-xs font-medium text-zinc-900 underline underline-offset-4 hover:text-[#2563EB] transition-colors cursor-pointer"
                >
                  Sign in to save history
                </button>
              </div>
            ) : recentHistory.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Your recent keyword queries will appear here after your first search.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentHistory.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => handleQuickQuery(entry.query)}
                      className="w-full flex items-center justify-between gap-3 text-left text-xs group cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 text-zinc-700 group-hover:text-[#2563EB] truncate">
                        <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{entry.query}</span>
                      </span>
                      <span className="text-zinc-400 font-mono tabular-nums shrink-0">
                        {entry.resultCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Query Syntax Guide */}
          <div className="pb-7 border-b border-zinc-200">
            <h2 className="font-display text-sm font-semibold text-zinc-950 mb-3">
              Query syntax
            </h2>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-zinc-900">&quot;exact phrase&quot;</dt>
                <dd className="text-zinc-500 text-right">Phrase match</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-zinc-900">+term</dt>
                <dd className="text-zinc-500 text-right">Must include</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-zinc-900">-term</dt>
                <dd className="text-zinc-500 text-right">Exclude term</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-zinc-900">title:keyword</dt>
                <dd className="text-zinc-500 text-right">Match in title</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-zinc-900">domain:host</dt>
                <dd className="text-zinc-500 text-right">Filter domain</dd>
              </div>
            </dl>
          </div>

          {/* Corpus Summary */}
          {summary && (
            <div>
              <h2 className="font-display text-sm font-semibold text-zinc-950 mb-3">
                Indexed corpus
              </h2>
              <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-zinc-200 tabular-nums">
                <div>
                  <p className="text-lg font-semibold text-zinc-950 font-mono">
                    {summary.activeDocuments.toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">Active documents</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-950 font-mono">
                    {summary.uniqueTerms.toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-500">Unique terms</p>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs">
                {summary.categories.map((cat) => (
                  <li key={cat.category}>
                    <button
                      type="button"
                      onClick={() => handleCategoryChange(cat.category)}
                      className={`w-full flex items-center justify-between py-1 transition-colors cursor-pointer ${
                        categoryFilter === cat.category
                          ? 'text-[#2563EB] font-medium'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      <span>{cat.category}</span>
                      <span className="font-mono tabular-nums text-zinc-400">
                        {cat.count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <DocumentReaderModal
        document={previewDoc}
        loading={previewLoading}
        onClose={() => {
          setPreviewDoc(null);
          setPreviewLoading(false);
        }}
      />
    </div>
  );
}
