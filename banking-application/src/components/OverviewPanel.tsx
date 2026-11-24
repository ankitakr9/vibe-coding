import React, { useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { ApiError, bankingApi } from '../services/api';
import type {
  AccountSummary,
  OperationResult,
  RecipientOption,
  TransactionRecord,
} from '../types/banking';
import {
  formatCurrency,
  formatShortDate,
  formatSignedCurrency,
  formatTimestamp,
  formatTransactionTypeLabel,
  isCreditTransaction,
  validateAmountInput,
} from '../utils/format';

type OperationMode = 'deposit' | 'withdraw' | 'transfer';

interface OverviewPanelProps {
  token: string;
  account: AccountSummary;
  recipients: RecipientOption[];
  transactions: TransactionRecord[];
  loading: boolean;
  welcomeAccountCreated: boolean;
  onDismissWelcome: () => void;
  onOperationSuccess: (result: OperationResult) => void;
  onNavigateTransactions: () => void;
  amountInputRef?: React.RefObject<HTMLInputElement | null>;
}

const QUICK_AMOUNTS = ['25', '100', '250', '500'];

export function OverviewPanel({
  token,
  account,
  recipients,
  transactions,
  loading,
  welcomeAccountCreated,
  onDismissWelcome,
  onOperationSuccess,
  onNavigateTransactions,
  amountInputRef,
}: OverviewPanelProps) {
  const [opMode, setOpMode] = useState<OperationMode>('deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [toAccount, setToAccount] = useState(recipients[0]?.accountNumber ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionRecord | null>(null);
  const fallbackRef = useRef<HTMLInputElement | null>(null);
  const inputRef = amountInputRef ?? fallbackRef;

  const recentTransactions = transactions.slice(0, 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setReceipt(null);

    const validationError = validateAmountInput(amount, false);
    if (validationError) {
      setError(validationError);
      return;
    }

    const cents = Math.round(Number(amount.trim()) * 100);
    if ((opMode === 'withdraw' || opMode === 'transfer') && cents > account.balanceCents) {
      setError(`Insufficient funds. Available balance is ${formatCurrency(account.balanceCents)}.`);
      return;
    }

    if (opMode === 'transfer') {
      const target = toAccount.trim().toUpperCase();
      if (!target) {
        setError('Enter or select a recipient account number.');
        return;
      }
      if (target === account.accountNumber) {
        setError('Cannot transfer funds to your own account.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let result: OperationResult;
      if (opMode === 'deposit') {
        result = await bankingApi.deposit(token, {
          amount: amount.trim(),
          description: description.trim(),
        });
      } else if (opMode === 'withdraw') {
        result = await bankingApi.withdraw(token, {
          amount: amount.trim(),
          description: description.trim(),
        });
      } else {
        result = await bankingApi.transfer(token, {
          toAccountNumber: toAccount.trim().toUpperCase(),
          amount: amount.trim(),
          description: description.trim(),
        });
      }

      setAmount('');
      setDescription('');
      setReceipt(result.transaction);
      onOperationSuccess(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to complete transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeChange = (next: OperationMode) => {
    setOpMode(next);
    setError(null);
    setReceipt(null);
    if (next === 'transfer' && !toAccount && recipients.length > 0) {
      setToAccount(recipients[0].accountNumber);
    }
  };

  return (
    <div className="space-y-8">
      {welcomeAccountCreated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Account opened and saved to ledger
              </p>
              <p className="text-sm text-emerald-900 mt-0.5">
                Keep your account number{' '}
                <span className="font-mono font-semibold">{account.accountNumber}</span> for future sign-ins.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissWelcome}
            className="px-3.5 py-1.5 text-xs font-medium text-emerald-900 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dominant Balance & Key Metrics Surface */}
      <section
        aria-label="Account balance summary"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="p-6 lg:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{account.accountType} Account</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{account.accountNumber}</span>
              <span aria-hidden="true">·</span>
              <span>Opened {formatShortDate(account.createdAt)}</span>
            </div>
            <p className="mt-3 font-mono tabular-nums text-4xl lg:text-5xl font-semibold tracking-tight text-slate-900">
              {formatCurrency(account.balanceCents)}
            </p>
            <p className="mt-1.5 text-sm text-slate-500">Available balance</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                handleModeChange('deposit');
                inputRef.current?.focus();
              }}
              className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Deposit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleModeChange('withdraw');
                inputRef.current?.focus();
              }}
              className="px-4 py-2.5 text-sm font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Withdraw</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleModeChange('transfer');
                inputRef.current?.focus();
              }}
              className="px-4 py-2.5 text-sm font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Transfer</span>
            </button>
          </div>
        </div>

        {/* Hairline-separated 4-column metric strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-slate-200 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/60">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Deposits</p>
            <p className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-emerald-700">
              +{formatCurrency(account.metrics.totalDepositsCents + account.metrics.totalTransfersInCents)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Total Outflows</p>
            <p className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-red-700">
              -{formatCurrency(account.metrics.totalWithdrawalsCents + account.metrics.totalTransfersOutCents)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Account Holder</p>
            <p className="mt-1.5 text-lg font-semibold text-slate-900 truncate">
              {account.fullName}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500">Recorded Entries</p>
            <p className="mt-1.5 font-mono tabular-nums text-lg font-semibold text-slate-900">
              {account.metrics.transactionCount}
            </p>
          </div>
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Perform Transaction Form */}
        <section
          aria-label="Perform banking operation"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6"
        >
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Perform Operation
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Transactions update your balance and persist to disk immediately.
          </p>

          <div className="mt-5 flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'deposit', label: 'Deposit' },
                { id: 'withdraw', label: 'Withdraw' },
                { id: 'transfer', label: 'Transfer' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleModeChange(tab.id)}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  opMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {opMode === 'transfer' && (
              <div>
                <label
                  htmlFor="transfer-recipient"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Destination Account
                </label>
                {recipients.length > 0 ? (
                  <select
                    id="transfer-recipient"
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono focus:border-emerald-700"
                  >
                    {recipients.map((r) => (
                      <option key={r.accountNumber} value={r.accountNumber}>
                        {r.accountNumber} — {r.fullName} ({r.accountType})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="transfer-recipient"
                    type="text"
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    placeholder="AB-1002"
                    className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                  />
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="op-amount" className="text-sm font-medium text-slate-700">
                  Amount (USD)
                </label>
                {(opMode === 'withdraw' || opMode === 'transfer') && (
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Max {formatCurrency(account.balanceCents)}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-500">
                  $
                </span>
                <input
                  ref={inputRef}
                  id="op-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="w-full h-11 pl-8 pr-3.5 rounded-lg border border-slate-300 bg-white font-mono tabular-nums text-base text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
                />
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(`${preset}.00`);
                      setError(null);
                    }}
                    className="px-3 py-1.5 text-xs font-mono tabular-nums font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                  >
                    +${preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="op-memo"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Memo (Optional)
              </label>
              <input
                id="op-memo"
                type="text"
                maxLength={120}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  opMode === 'deposit'
                    ? 'Payroll, cash deposit, refund...'
                    : opMode === 'withdraw'
                      ? 'ATM cash, bill payment...'
                      : 'Rent split, savings transfer...'
                }
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
              >
                <span className="font-semibold">Validation Error:</span> {error}
              </div>
            )}

            {receipt && (
              <div
                role="status"
                className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900"
              >
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span>Confirmed · {formatTransactionTypeLabel(receipt.type)}</span>
                  <span className="font-mono tabular-nums">{receipt.id}</span>
                </div>
                <p className="mt-1 text-xs text-emerald-800 font-mono tabular-nums">
                  {formatSignedCurrency(receipt.amountCents, receipt.type)} · New balance{' '}
                  {formatCurrency(receipt.balanceAfterCents)}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full h-11 px-5 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                opMode === 'withdraw'
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {submitting
                ? 'Processing...'
                : opMode === 'deposit'
                  ? 'Confirm Deposit'
                  : opMode === 'withdraw'
                    ? 'Confirm Withdrawal'
                    : 'Confirm Transfer'}
            </button>
          </form>
        </section>

        {/* Recent Activity Table */}
        <section
          aria-label="Recent activity"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Recent Activity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest ledger entries for {account.accountNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateTransactions}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View full ledger</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-44 bg-slate-100 rounded" />
                    <div className="h-3 w-32 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-900">No transactions yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Record your first deposit using the form to populate your ledger.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleModeChange('deposit');
                  inputRef.current?.focus();
                }}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                Make First Deposit
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="py-3 pl-6 pr-3">Description</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 pl-3 pr-6 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentTransactions.map((tx) => {
                    const credit = isCreditTransaction(tx.type);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 pl-6 pr-3">
                          <div className="font-medium text-slate-900 truncate max-w-[220px]">
                            {tx.description}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono tabular-nums">{tx.id}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatTimestamp(tx.timestamp)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {formatTransactionTypeLabel(tx.type)}
                          {tx.counterpartyAccount ? ` · ${tx.counterpartyAccount}` : ''}
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
        </section>
      </div>
    </div>
  );
}
