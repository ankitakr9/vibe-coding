import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { SearchView } from './components/SearchView';
import { IndexContentView } from './components/IndexContentView';
import { HistoryView } from './components/HistoryView';
import { AdminView } from './components/AdminView';
import type { AppTab } from './types/search';

function AppShell() {
  const { authError } = useAuth();
  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [corpusRefreshKey, setCorpusRefreshKey] = useState(0);
  const [externalQueryRequest, setExternalQueryRequest] = useState<{
    query: string;
    nonce: number;
  } | null>(null);

  const triggerSearch = (query: string) => {
    setActiveTab('search');
    setExternalQueryRequest({ query, nonce: Date.now() });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-zinc-900">
      <TopBar activeTab={activeTab} onSelectTab={setActiveTab} />

      {authError && (
        <div className="max-w-[1220px] w-full mx-auto px-6 pt-4">
          <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
            {authError}
          </div>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'search' && (
          <SearchView
            externalQueryRequest={externalQueryRequest}
            onNavigateHistory={() => setActiveTab('history')}
            onNavigateIndex={() => setActiveTab('index')}
            corpusRefreshKey={corpusRefreshKey}
          />
        )}

        {activeTab === 'index' && (
          <IndexContentView
            onIndexedSuccess={() => setCorpusRefreshKey((k) => k + 1)}
            onSearchQuery={triggerSearch}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView onReplayQuery={triggerSearch} />
        )}

        {activeTab === 'admin' && (
          <AdminView
            onCorpusChanged={() => setCorpusRefreshKey((k) => k + 1)}
            onSearchTerm={triggerSearch}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-16">
        <div className="max-w-[1220px] mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <span>LumenIndex Full-Text Search Engine</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('index')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Index Content
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
