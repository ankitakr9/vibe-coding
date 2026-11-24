import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import { ApiError, bankingApi } from '../services/api';
import type { AccountSummary, TransactionRecord } from '../types/banking';
import {
  formatCurrency,
  formatSignedCurrency,
  formatTimestamp,
  formatTransactionTypeLabel,
  isCreditTransaction,
} from '../utils/format';

type TypeFilter = 'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

interface TransactionsPanelProps {
  token: string;
  account: AccountSummary;
  transactions: TransactionRecord[];
  loading: boolean;
  onMakeFirstTransaction: () => void;
}

export function TransactionsPanel({
  token,
  account,
  transactions,
  loading,
  onMakeFirstTransaction,
}: TransactionsPanelProps) {
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'txt' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = transactions.filter((tx) => {
      if (filter === 'DEPOSIT' && tx.type !== 'DEPOSIT') return false;
      if (filter === 'WITHDRAWAL' && tx.type !== 'WITHDRAWAL') return false;
      if (filter === 'TRANSFER' && tx.type !== 'TRANSFER_IN' && tx.type !== 'TRANSFER_OUT') {
        return false;
      }
      if (!query) return true;
      return (
        tx.id.toLowerCase().includes(query) ||
        tx.description.toLowerCase().includes(query) ||
        (tx.counterpartyAccount?.toLowerCase().includes(query) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDesc ? -diff : diff;
    });
  }, [transactions, filter, search, sortDesc]);

  const handleExport = async (format: 'csv' | 'txt') => {
    setExportError(null);
    setExporting(format);
    try {
      await bankingApi.downloadExport(token, format, account.accountNumber);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : 'Unable to export statement.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Transaction Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete audit history for {account.accountNumber} · {transactions.length} recorded{' '}
            {transactions.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('csv')}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting === 'csv' ? 'Exporting...' : 'Download CSV'}</span>
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport('txt')}
            className="px-4 py-2 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting === 'txt' ? 'Exporting...' : 'Download Statement (.txt)'}</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          <span className="font-semibold">Export Error:</span> {exportError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'DEPOSIT', label: 'Deposits' },
                { id: 'WITHDRAWAL', label: 'Withdrawals' },
                { id: 'TRANSFER', label: 'Transfers' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  filter === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, memo, or account..."
                className="w-full sm:w-64 h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
              />
            </div>

            <button
              type="button"
              onClick={() => setSortDesc((v) => !v)}
              className="h-9 px-3.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortDesc ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="h-4 w-24 bg-slate-100 rounded" />
                <div className="h-4 w-56 bg-slate-100 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
                <div className="h-4 w-24 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-medium text-slate-900">No ledger entries recorded</p>
            <p className="mt-1 text-sm text-slate-500">
              Your deposits, withdrawals, and transfers will appear here as soon as you record them.
            </p>
            <button
              type="button"
              onClick={onMakeFirstTransaction}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              Record First Transaction
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">No matching transactions</p>
            <p className="mt-1 text-sm text-slate-500">
              Try clearing your search query or switching to the All filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter('ALL');
                setSearch('');
              }}
              className="mt-4 px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-6 pr-3">Reference</th>
                  <th className="py-3 px-3">Date &amp; Time</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Memo</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 pl-3 pr-6 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((tx) => {
                  const credit = isCreditTransaction(tx.type);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pl-6 pr-3 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {tx.id}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        {formatTimestamp(tx.timestamp)}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                        {formatTransactionTypeLabel(tx.type)}
                      </td>
                      <td className="py-3 px-3 text-slate-900">
                        <span className="block truncate max-w-xs">{tx.description}</span>
                        {tx.counterpartyAccount && (
                          <span className="text-xs text-slate-500 font-mono">
                            Counterparty: {tx.counterpartyAccount}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                          credit ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {formatSignedCurrency(tx.amountCents, tx.type)}
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCurrency(tx.balanceAfterCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
