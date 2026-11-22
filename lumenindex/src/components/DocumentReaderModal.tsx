import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { DocumentDetail } from '../types/search';

interface DocumentReaderModalProps {
  document: DocumentDetail | null;
  loading: boolean;
  onClose: () => void;
}

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

export function DocumentReaderModal({
  document: doc,
  loading,
  onClose,
}: DocumentReaderModalProps) {
  useEffect(() => {
    if (!doc && !loading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [doc, loading, onClose]);

  if (!doc && !loading) return null;

  const externalHref = doc ? getSafeExternalUrl(doc.url) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 backdrop-blur-[1px] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-200">
          <div className="min-w-0">
            {loading ? (
              <div className="h-6 w-72 bg-zinc-100 rounded animate-pulse" />
            ) : doc ? (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 mb-1.5">
                  <span className="font-mono">{doc.domain}</span>
                  <span aria-hidden="true">·</span>
                  <span>{doc.sourceType === 'webpage' ? 'Web Page' : 'Document'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{doc.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {doc.wordCount.toLocaleString()} words / {doc.termCount.toLocaleString()} indexed terms
                  </span>
                </div>
                <h2
                  id="reader-modal-title"
                  className="font-display text-xl font-semibold text-zinc-950 leading-snug"
                >
                  {doc.title}
                </h2>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close document preview"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-full bg-zinc-100 rounded animate-pulse" />
              <div className="h-4 w-11/12 bg-zinc-100 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-zinc-100 rounded animate-pulse" />
            </div>
          ) : doc ? (
            <>
              <div className="text-sm text-zinc-600 bg-zinc-50 border border-zinc-200/80 rounded-lg px-4 py-3 leading-relaxed">
                {doc.summary}
              </div>

              <div className="text-[15px] text-zinc-800 leading-7 whitespace-pre-line">
                {doc.content}
              </div>

              {doc.keywords && (
                <div className="pt-4 border-t border-zinc-200 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 mr-2">Keywords:</span>
                  <span>{doc.keywords}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {doc && (
          <div className="px-6 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between gap-4 text-xs text-zinc-500">
            <span className="font-mono truncate max-w-[65%]" title={doc.url}>
              {doc.url}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {externalHref && (
                <a
                  href={externalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors whitespace-nowrap"
                >
                  Open source
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-md border border-zinc-300 bg-white text-zinc-700 font-medium hover:bg-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
