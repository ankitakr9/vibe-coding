import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  AdminOverview,
  DocumentDetail,
  InvertedIndexTermRow,
} from '../types/search';

interface AdminViewProps {
  onCorpusChanged: () => void;
  onSearchTerm: (term: string) => void;
}

const CATEGORIES = [
  'Search Algorithms',
  'Backend Engineering',
  'Databases',
  'Frontend Engineering',
  'Security',
  'Web Reference',
  'General',
];

export function AdminView({ onCorpusChanged, onSearchTerm }: AdminViewProps) {
  const { firebaseUser, profile, signInWithGoogle, apiFetch } = useAuth();
  const [subTab, setSubTab] = useState<'content' | 'terms' | 'queries'>('content');

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [terms, setTerms] = useState<InvertedIndexTermRow[]>([]);

  const [docFilter, setDocFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'webpage' | 'document'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [termFilter, setTermFilter] = useState('');

  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentDetail | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch<AdminOverview>('/api/admin/overview');
      setOverview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load overview.');
    }
  }, [apiFetch, isAdmin]);

  const loadDocuments = useCallback(
    async (
      q = docFilter,
      type = typeFilter,
      status = statusFilter
    ) => {
      if (!isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q, type, status });
        const data = await apiFetch<{ items: DocumentDetail[] }>(
          `/api/admin/documents?${params.toString()}`
        );
        setDocuments(data.items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load indexed content.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, docFilter, isAdmin, statusFilter, typeFilter]
  );

  const loadTerms = useCallback(
    async (q = termFilter) => {
      if (!isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
        const data = await apiFetch<{ terms: InvertedIndexTermRow[] }>(
          `/api/admin/terms${params}`
        );
        setTerms(data.terms);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load inverted index.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, isAdmin, termFilter]
  );

  useEffect(() => {
    if (!isAdmin) return;
    void loadOverview();
    void loadDocuments('', 'all', 'all');
  }, [isAdmin, loadOverview, loadDocuments]);

  useEffect(() => {
    if (!isAdmin) return;
    if (subTab === 'terms') {
      void loadTerms(termFilter);
    }
  }, [isAdmin, subTab, loadTerms, termFilter]);

  const handleRebuildAll = async () => {
    setRebuilding(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await apiFetch<{ documentsIndexed: number; totalPostings: number }>(
        '/api/admin/reindex-all',
        { method: 'POST' }
      );
      setStatusMessage(
        `Rebuilt inverted index across ${res.documentsIndexed} documents (${res.totalPostings.toLocaleString()} term postings).`
      );
      await Promise.all([loadOverview(), loadDocuments()]);
      if (subTab === 'terms') await loadTerms();
      onCorpusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rebuild failed.');
    } finally {
      setRebuilding(false);
    }
  };

  const handleReindexOne = async (doc: DocumentDetail) => {
    setError(null);
    setStatusMessage(null);
    try {
      const res = await apiFetch<{ wordCount: number; termCount: number }>(
        `/api/admin/documents/${doc.id}/reindex`,
        { method: 'POST' }
      );
      setStatusMessage(
        `Re-indexed "${doc.title}" (${res.wordCount.toLocaleString()} words, ${res.termCount.toLocaleString()} terms).`
      );
      await Promise.all([loadOverview(), loadDocuments()]);
      onCorpusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Re-index failed.');
    }
  };

  const handleToggleStatus = async (doc: DocumentDetail) => {
    const nextStatus = doc.status === 'active' ? 'archived' : 'active';
    setError(null);
    setStatusMessage(null);
    try {
      await apiFetch(`/api/admin/documents/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      setStatusMessage(
        nextStatus === 'archived'
          ? `Archived "${doc.title}" (excluded from public search).`
          : `Restored "${doc.title}" to active search index.`
      );
      await Promise.all([loadOverview(), loadDocuments()]);
      onCorpusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    setStatusMessage(null);
    try {
      await apiFetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setStatusMessage('Removed document and its inverted index postings.');
      await loadOverview();
      onCorpusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    setSavingEdit(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/documents/${editingDoc.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingDoc.title,
          url: editingDoc.url,
          category: editingDoc.category,
          keywords: editingDoc.keywords,
          summary: editingDoc.summary,
          content: editingDoc.content,
          sourceType: editingDoc.sourceType,
          status: editingDoc.status,
        }),
      });
      setStatusMessage(`Updated and re-indexed "${editingDoc.title}".`);
      setEditingDoc(null);
      await Promise.all([loadOverview(), loadDocuments()]);
      onCorpusChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!firebaseUser) {
    return (
      <div className="max-w-[920px] mx-auto px-6 py-10">
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <h1 className="font-display text-2xl font-semibold text-zinc-950 mb-2">
            Administrator sign-in required
          </h1>
          <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
            Sign in with an administrator Google account to manage indexed content, edit documents, and inspect the inverted index.
          </p>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-5 py-2.5 text-sm font-medium text-white bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-[920px] mx-auto px-6 py-10">
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <h1 className="font-display text-2xl font-semibold text-zinc-950 mb-2">
            Admin access restricted
          </h1>
          <p className="text-sm text-zinc-600 max-w-md mx-auto">
            Your account ({profile?.email}) has standard member permissions. Contact the site administrator for corpus management access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1220px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950 mb-1.5">
            Index administration
          </h1>
          <p className="text-[15px] text-zinc-600">
            Manage indexed web pages and documents, inspect inverted index postings, and rebuild term frequencies.
          </p>
        </div>

        <button
          type="button"
          disabled={rebuilding}
          onClick={handleRebuildAll}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
          {rebuilding ? 'Rebuilding index...' : 'Rebuild full index'}
        </button>
      </div>

      {/* 4-column flat tabular KPI strip with hairline dividers */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-zinc-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 mb-8 tabular-nums">
          <div className="p-5">
            <p className="text-xs text-zinc-500 mb-1">Indexed Content</p>
            <p className="font-mono text-2xl font-semibold text-zinc-950">
              {overview.totalDocs.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {overview.activeDocs} active · {overview.archivedDocs} archived
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-zinc-500 mb-1">Vocabulary Terms</p>
            <p className="font-mono text-2xl font-semibold text-zinc-950">
              {overview.uniqueTerms.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {overview.totalPostings.toLocaleString()} total postings
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs text-zinc-500 mb-1">Indexed Words</p>
            <p className="font-mono text-2xl font-semibold text-zinc-950">
              {overview.totalWords.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Across stored corpus</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-zinc-500 mb-1">Recorded Searches</p>
            <p className="font-mono text-2xl font-semibold text-zinc-950">
              {overview.totalSearches.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 mt-1">Saved user query logs</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="mb-5 p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-900 flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="inline-flex items-center p-1 bg-zinc-100 rounded-lg">
          {(
            [
              { id: 'content', label: 'Indexed Content' },
              { id: 'terms', label: 'Inverted Index' },
              { id: 'queries', label: 'Popular Queries' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {subTab === 'content' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={docFilter}
                onChange={(e) => {
                  setDocFilter(e.target.value);
                  void loadDocuments(e.target.value, typeFilter, statusFilter);
                }}
                placeholder="Filter title, URL, category..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none w-56"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => {
                const next = e.target.value as 'all' | 'webpage' | 'document';
                setTypeFilter(next);
                void loadDocuments(docFilter, next, statusFilter);
              }}
              className="px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
            >
              <option value="all">All types</option>
              <option value="webpage">Web pages</option>
              <option value="document">Documents</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                const next = e.target.value as 'all' | 'active' | 'archived';
                setStatusFilter(next);
                void loadDocuments(docFilter, typeFilter, next);
              }}
              className="px-2.5 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        )}

        {subTab === 'terms' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              placeholder="Search stemmed term..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none w-56 font-mono"
            />
          </div>
        )}
      </div>

      {/* Sub-tab 1: Indexed Content Table */}
      {subTab === 'content' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                <th className="py-3 px-5">Document / Page</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Words</th>
                <th className="py-3 px-4 text-right">Terms</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                    Loading indexed content...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                    No documents match your current filters.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3.5 px-5 max-w-[360px]">
                      <p className="font-medium text-zinc-950 truncate" title={doc.title}>
                        {doc.title}
                      </p>
                      <p className="text-xs font-mono text-zinc-500 truncate mt-0.5" title={doc.url}>
                        {doc.domain}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                      {doc.sourceType === 'webpage' ? 'Web Page' : 'Document'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-600 whitespace-nowrap">
                      {doc.category}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-zinc-700">
                      {doc.wordCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-zinc-700">
                      {doc.termCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                      <span
                        className={
                          doc.status === 'active'
                            ? 'text-emerald-700 font-medium'
                            : 'text-amber-700 font-medium'
                        }
                      >
                        {doc.status === 'active' ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {confirmDeleteId === doc.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleDelete(doc.id)}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingDoc(doc)}
                            title="Edit document"
                            aria-label={`Edit ${doc.title}`}
                            className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleReindexOne(doc)}
                            title="Re-index terms"
                            aria-label={`Re-index ${doc.title}`}
                            className="p-1.5 text-zinc-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleStatus(doc)}
                            title={doc.status === 'active' ? 'Archive' : 'Restore'}
                            aria-label={
                              doc.status === 'active'
                                ? `Archive ${doc.title}`
                                : `Restore ${doc.title}`
                            }
                            className="p-1.5 text-zinc-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                          >
                            {doc.status === 'active' ? (
                              <Archive className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            title="Delete permanently"
                            aria-label={`Delete ${doc.title}`}
                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-tab 2: Inverted Index Inspector */}
      {subTab === 'terms' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                <th className="py-3 px-5">Stemmed Term</th>
                <th className="py-3 px-4 text-right">Document Freq (DF)</th>
                <th className="py-3 px-4 text-right">Title Hits</th>
                <th className="py-3 px-4 text-right">Total Occurrences</th>
                <th className="py-3 px-5 text-right">BM25 IDF Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-mono text-xs">
              {terms.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center font-sans text-sm text-zinc-500"
                  >
                    No indexed terms matched your filter.
                  </td>
                </tr>
              ) : (
                terms.map((row) => (
                  <tr key={row.term} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-2.5 px-5">
                      <button
                        type="button"
                        onClick={() => onSearchTerm(row.term)}
                        className="font-medium text-[#1D4ED8] hover:underline underline-offset-4 cursor-pointer"
                      >
                        {row.term}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700">
                      {row.docFreq}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700">
                      {row.titleHits}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700">
                      {row.totalOccurrences}
                    </td>
                    <td className="py-2.5 px-5 text-right font-medium text-zinc-950">
                      {row.idf.toFixed(3)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-tab 3: Popular Queries */}
      {subTab === 'queries' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                <th className="py-3 px-5">Query String</th>
                <th className="py-3 px-4 text-right">Search Count</th>
                <th className="py-3 px-5 text-right">Avg Results</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {!overview || overview.popularQueries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-zinc-500">
                    No user searches have been recorded yet.
                  </td>
                </tr>
              ) : (
                overview.popularQueries.map((row) => (
                  <tr key={row.query} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-5">
                      <button
                        type="button"
                        onClick={() => onSearchTerm(row.query)}
                        className="font-medium text-zinc-900 hover:text-[#2563EB] hover:underline cursor-pointer"
                      >
                        {row.query}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-zinc-700">
                      {row.count}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-zinc-700">
                      {row.avgResults}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingDoc(null)}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="font-display text-lg font-semibold text-zinc-950">
                Edit indexed content
              </h2>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editingDoc.title}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editingDoc.category}
                    onChange={(e) =>
                      setEditingDoc({ ...editingDoc, category: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editingDoc.status}
                    onChange={(e) =>
                      setEditingDoc({
                        ...editingDoc,
                        status: e.target.value as 'active' | 'archived',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Keywords
                </label>
                <input
                  type="text"
                  value={editingDoc.keywords}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, keywords: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Summary
                </label>
                <input
                  type="text"
                  value={editingDoc.summary}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, summary: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Content
                </label>
                <textarea
                  rows={7}
                  required
                  value={editingDoc.content}
                  onChange={(e) =>
                    setEditingDoc({ ...editingDoc, content: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none leading-relaxed"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 hover:bg-zinc-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {savingEdit ? 'Saving & Re-indexing...' : 'Save & Re-index'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
