import type { TransactionType } from '../types/banking';

export function formatCurrency(cents: number): string {
  const isNegative = cents < 0;
  const formatted = (Math.abs(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}$${formatted}`;
}

export function formatSignedCurrency(cents: number, type: TransactionType): string {
  const isCredit = type === 'DEPOSIT' || type === 'TRANSFER_IN';
  return `${isCredit ? '+' : '-'}${formatCurrency(cents)}`;
}

export function isCreditTransaction(type: TransactionType): boolean {
  return type === 'DEPOSIT' || type === 'TRANSFER_IN';
}

export function formatTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'DEPOSIT':
      return 'Deposit';
    case 'WITHDRAWAL':
      return 'Withdrawal';
    case 'TRANSFER_OUT':
      return 'Transfer Out';
    case 'TRANSFER_IN':
      return 'Transfer In';
  }
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function validateAmountInput(raw: string, allowZero = false): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Enter an amount.';
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return 'Enter a positive number with up to 2 decimal places (e.g., 125.50).';
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 'Amount is out of range.';
  if (!allowZero && value <= 0) return 'Amount must be greater than $0.00.';
  if (value > 1_000_000) return 'Single transaction cannot exceed $1,000,000.00.';
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
