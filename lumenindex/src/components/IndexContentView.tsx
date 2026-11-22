import React, { useState } from 'react';
import { CheckCircle2, FileText, Globe, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { DocumentDetail } from '../types/search';

interface IndexContentViewProps {
  onIndexedSuccess: (doc: DocumentDetail) => void;
  onSearchQuery: (query: string) => void;
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

export function IndexContentView({
  onIndexedSuccess,
  onSearchQuery,
}: IndexContentViewProps) {
  const { firebaseUser, signInWithGoogle, apiFetch } = useAuth();
  const [mode, setMode] = useState<'crawl' | 'document'>('crawl');

  // Crawl Web Page state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlCategory, setCrawlCategory] = useState('Web Reference');
  const [crawling, setCrawling] = useState(false);

  // Manual / File Document state
  const [title, setTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [category, setCategory] = useState('Search Algorithms');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [sourceType, setSourceType] = useState<'document' | 'webpage'>('document');
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [createdDoc, setCreatedDoc] = useState<DocumentDetail | null>(null);

  const handleCrawlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedDoc(null);
    setCrawling(true);
    try {
      const doc = await apiFetch<DocumentDetail>('/api/documents/crawl', {
        method: 'POST',
        body: JSON.stringify({ url: crawlUrl.trim(), category: crawlCategory }),
      });
      setCreatedDoc(doc);
      setCrawlUrl('');
      onIndexedSuccess(doc);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to crawl web page.');
    } finally {
      setCrawling(false);
    }
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedDoc(null);
    setSubmitting(true);
    try {
      const doc = await apiFetch<DocumentDetail>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          url: docUrl.trim(),
          sourceType,
          category,
          keywords: keywords.trim(),
          summary: summary.trim(),
          content: content.trim(),
        }),
      });
      setCreatedDoc(doc);
      setTitle('');
      setDocUrl('');
      setKeywords('');
      setSummary('');
      setContent('');
      onIndexedSuccess(doc);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to index document.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 500_000) {
      setError('Please upload a text, Markdown, or HTML file smaller than 500 KB.');
      return;
    }

    try {
      const rawText = await file.text();
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      let extractedText = rawText;

      if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(rawText, 'text/html');
        parsedDoc.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
        const htmlTitle = parsedDoc.querySelector('title')?.textContent?.trim();
        if (htmlTitle && !title) setTitle(htmlTitle);
        extractedText = (parsedDoc.body?.textContent || '').replace(/\s+/g, ' ').trim();
        setSourceType('webpage');
      } else {
        setSourceType('document');
      }

      if (!title && baseName) {
        setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
      setContent(extractedText.slice(0, 35000));
      if (!summary && extractedText) {
        setSummary(extractedText.slice(0, 220));
      }
    } catch {
      setError('Could not read the selected file.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="max-w-[920px] mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-950 mb-2">
          Index web pages and documents
        </h1>
        <p className="text-[15px] text-zinc-600">
          Crawl a public web page or upload structured text to tokenize, stem, and store postings in the inverted index.
        </p>
      </div>

      {!firebaseUser ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <h2 className="font-display text-lg font-semibold text-zinc-950 mb-2">
            Sign in to index new content
          </h2>
          <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
            Authenticate with your Google account to crawl public web pages or add documents directly to the shared search index.
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
          {/* Mode Switcher */}
          <div className="inline-flex items-center p-1 bg-zinc-100 rounded-lg mb-7">
            <button
              type="button"
              onClick={() => {
                setMode('crawl');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'crawl'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Crawl Web Page URL
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('document');
                setError(null);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'document'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Index Document / Upload File
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
              {error}
            </div>
          )}

          {createdDoc && (
            <div className="mb-6 p-5 rounded-xl border border-emerald-200 bg-emerald-50/70">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-950">
                    Indexed &ldquo;{createdDoc.title}&rdquo;
                  </p>
                  <p className="text-xs text-emerald-800 mt-1 tabular-nums">
                    {createdDoc.wordCount.toLocaleString()} words tokenized into{' '}
                    {createdDoc.termCount.toLocaleString()} unique inverted index terms.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSearchQuery(createdDoc.title.split(' ').slice(0, 3).join(' '))}
                    className="mt-3 text-xs font-semibold text-emerald-900 underline underline-offset-4 hover:text-emerald-700 cursor-pointer"
                  >
                    Search for this content now
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'crawl' ? (
            <form
              onSubmit={handleCrawlSubmit}
              className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 space-y-5"
            >
              <div>
                <label
                  htmlFor="crawl-url"
                  className="block text-sm font-medium text-zinc-800 mb-1.5"
                >
                  Public Web Page URL
                </label>
                <input
                  id="crawl-url"
                  type="url"
                  required
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/Inverted_index"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none font-mono"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  The server fetches HTML over HTTP/HTTPS, strips navigation and scripts, extracts semantic text, and builds term postings automatically.
                </p>
              </div>

              <div className="max-w-xs">
                <label
                  htmlFor="crawl-category"
                  className="block text-sm font-medium text-zinc-800 mb-1.5"
                >
                  Category
                </label>
                <select
                  id="crawl-category"
                  value={crawlCategory}
                  onChange={(e) => setCrawlCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={crawling}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {crawling ? 'Fetching & Indexing...' : 'Crawl & Index Page'}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleDocumentSubmit}
              className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 space-y-5"
            >
              {/* Local file upload shortcut */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    Load from local file
                  </p>
                  <p className="text-xs text-zinc-500">
                    Import a .txt, .md, or .html document to pre-fill the form below.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  Choose file
                  <input
                    type="file"
                    accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="doc-title"
                    className="block text-sm font-medium text-zinc-800 mb-1.5"
                  >
                    Title
                  </label>
                  <input
                    id="doc-title"
                    type="text"
                    required
                    minLength={2}
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="B-Tree Indexing in Relational Databases"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-category"
                    className="block text-sm font-medium text-zinc-800 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="doc-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="doc-url"
                    className="block text-sm font-medium text-zinc-800 mb-1.5"
                  >
                    Canonical URL <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="doc-url"
                    type="url"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://example.org/docs/indexing"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label
                    htmlFor="doc-keywords"
                    className="block text-sm font-medium text-zinc-800 mb-1.5"
                  >
                    Keywords <span className="text-zinc-400 font-normal">(comma separated, 2x boost)</span>
                  </label>
                  <input
                    id="doc-keywords"
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="lucene, bm25, inverted index"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="doc-summary"
                  className="block text-sm font-medium text-zinc-800 mb-1.5"
                >
                  Summary <span className="text-zinc-400 font-normal">(optional — auto-generated from content if blank)</span>
                </label>
                <input
                  id="doc-summary"
                  type="text"
                  maxLength={500}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Concise one-sentence summary shown in search results."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="doc-content"
                  className="block text-sm font-medium text-zinc-800 mb-1.5"
                >
                  Document Body Content
                </label>
                <textarea
                  id="doc-content"
                  required
                  minLength={20}
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste full article text, technical documentation, or notes to tokenize and index..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:border-[#2563EB] focus:outline-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-4">
                <span className="text-xs text-zinc-500 tabular-nums">
                  {content.trim()
                    ? `${content.trim().split(/\s+/).length.toLocaleString()} words ready to tokenize`
                    : 'Minimum 20 characters required'}
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Indexing Document...' : 'Save & Index Document'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
