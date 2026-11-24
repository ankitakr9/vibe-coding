export type AccountType = 'Checking' | 'Savings';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_OUT' | 'TRANSFER_IN';

export interface TransactionRecord {
  id: string;
  accountNumber: string;
  type: TransactionType;
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  counterpartyAccount?: string;
  timestamp: string;
}

export interface AccountSummary {
  accountNumber: string;
  fullName: string;
  accountType: AccountType;
  balanceCents: number;
  createdAt: string;
  metrics: {
    totalDepositsCents: number;
    totalWithdrawalsCents: number;
    totalTransfersInCents: number;
    totalTransfersOutCents: number;
    transactionCount: number;
  };
}

export interface RecipientOption {
  accountNumber: string;
  fullName: string;
  accountType: AccountType;
}

export interface AuthResponse {
  token: string;
  account: AccountSummary;
  recipients: RecipientOption[];
}

export interface AccountPayload {
  account: AccountSummary;
  recipients: RecipientOption[];
}

export interface OperationResult {
  account: AccountSummary;
  transaction: TransactionRecord;
}

export interface LedgerSnapshot {
  fileName: string;
  fileSizeBytes: number;
  lastModified: string;
  recordCount: number;
  sanitizedRecord: {
    accountNumber: string;
    fullName: string;
    accountType: AccountType;
    balanceCents: number;
    balanceFormatted: string;
    createdAt: string;
    pinProtection: string;
    transactions: TransactionRecord[];
  };
}
