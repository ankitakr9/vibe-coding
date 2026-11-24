import React, { useEffect, useState } from 'react';
import { Copy, Check, Download, RefreshCw } from 'lucide-react';
import { ApiError, bankingApi } from '../services/api';
import type { AccountSummary, LedgerSnapshot } from '../types/banking';
import { formatBytes, formatTimestamp } from '../utils/format';

interface FileStoragePanelProps {
  token: string;
  account: AccountSummary;
  refreshSignal: number;
}

export function FileStoragePanel({ token, account, refreshSignal }: FileStoragePanelProps) {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bankingApi.getLedgerSnapshot(token);
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to read ledger storage snapshot.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, [token, refreshSignal]);

  const jsonPreview = snapshot ? JSON.stringify(snapshot.sanitizedRecord, null, 2) : '';

  const handleCopy = async () => {
    if (!jsonPreview) return;
    await navigator.clipboard.writeText(jsonPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadJson = () => {
    if (!jsonPreview) return;
    const blob = new Blob([jsonPreview], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alder_record_${account.accountNumber}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            File Persistence &amp; Storage Inspector
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live view of your sanitized record inside the atomic server ledger file. Credentials remain salted and redacted.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadSnapshot}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            disabled={!snapshot}
            onClick={handleDownloadJson}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
          <button
            type="button"
            onClick={() => void bankingApi.downloadExport(token, 'csv', account.accountNumber)}
            className="px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
        >
          <span className="font-semibold">Storage Error:</span> {error}
        </div>
      )}

      {/* Storage Metadata Strip */}
      <section className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Backing File</p>
          <p className="mt-1.5 font-mono text-sm font-medium text-slate-900 truncate">
            {snapshot?.fileName ?? 'data/bank_ledger.json'}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Total File Size</p>
          <p className="mt-1.5 font-mono tabular-nums text-sm font-medium text-slate-900">
            {snapshot ? formatBytes(snapshot.fileSizeBytes) : '—'}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Account Entries</p>
          <p className="mt-1.5 font-mono tabular-nums text-sm font-medium text-slate-900">
            {snapshot ? snapshot.recordCount : '—'}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Last Persisted</p>
          <p className="mt-1.5 text-sm font-medium text-slate-900 tabular-nums">
            {snapshot ? formatTimestamp(snapshot.lastModified) : '—'}
          </p>
        </div>
      </section>

      {/* Persisted Record Viewer */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-slate-600">
            Record View · {account.accountNumber} (write-locked atomic rename)
          </span>
          <button
            type="button"
            disabled={!snapshot}
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-2.5">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-4 bg-slate-100 rounded w-3/4" />
            ))}
          </div>
        ) : (
          <pre className="p-6 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-[440px]">
            {jsonPreview}
          </pre>
        )}
      </section>

      {/* Architecture Notes */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          How Collections &amp; File I/O Work Together
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-600">
          <div>
            <h3 className="font-medium text-slate-900">Indexed Account Map</h3>
            <p className="mt-1 leading-relaxed">
              Accounts are keyed by account number (<span className="font-mono text-xs">Map&lt;String, Account&gt;</span>) for constant-time balance lookups and recipient verification during transfers.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Append-Only Ledger List</h3>
            <p className="mt-1 leading-relaxed">
              Each deposit, withdrawal, or transfer appends an immutable entry with integer cents and a post-operation running balance snapshot.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Atomic Temp-File Rename</h3>
            <p className="mt-1 leading-relaxed">
              Mutations serialize through a write queue, flush to a temporary file inside <span className="font-mono text-xs">data/</span>, and atomically rename so partial writes cannot corrupt the ledger.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
