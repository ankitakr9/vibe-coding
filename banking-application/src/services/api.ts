import type {
  AccountPayload,
  AccountType,
  AuthResponse,
  LedgerSnapshot,
  OperationResult,
  TransactionRecord,
} from '../types/banking';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const bankingApi = {
  register(payload: {
    fullName: string;
    accountType: AccountType;
    pin: string;
    initialDeposit: string;
  }): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: { accountNumber: string; pin: string }): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout(token: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(
      '/api/auth/logout',
      { method: 'POST' },
      token
    );
  },

  getAccount(token: string): Promise<AccountPayload> {
    return requestJson<AccountPayload>('/api/account', { method: 'GET' }, token);
  },

  getTransactions(
    token: string,
    params?: { type?: string; search?: string; sort?: 'asc' | 'desc' }
  ): Promise<{ transactions: TransactionRecord[] }> {
    const query = new URLSearchParams();
    if (params?.type && params.type !== 'ALL') query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return requestJson<{ transactions: TransactionRecord[] }>(
      `/api/transactions${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      token
    );
  },

  deposit(
    token: string,
    payload: { amount: string; description: string }
  ): Promise<OperationResult> {
    return requestJson<OperationResult>(
      '/api/transactions/deposit',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  withdraw(
    token: string,
    payload: { amount: string; description: string }
  ): Promise<OperationResult> {
    return requestJson<OperationResult>(
      '/api/transactions/withdraw',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  transfer(
    token: string,
    payload: { toAccountNumber: string; amount: string; description: string }
  ): Promise<OperationResult> {
    return requestJson<OperationResult>(
      '/api/transactions/transfer',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    );
  },

  getLedgerSnapshot(token: string): Promise<LedgerSnapshot> {
    return requestJson<LedgerSnapshot>('/api/storage/ledger', { method: 'GET' }, token);
  },

  async downloadExport(token: string, format: 'csv' | 'txt', accountNumber: string): Promise<void> {
    const response = await fetch(`/api/export/${format}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new ApiError('Unable to download statement.', response.status);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alder_statement_${accountNumber}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
