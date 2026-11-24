import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';

type AccountType = 'Checking' | 'Savings';
type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER_OUT' | 'TRANSFER_IN';

interface StoredTransaction {
  id: string;
  accountNumber: string;
  type: TransactionType;
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  counterpartyAccount?: string;
  timestamp: string;
}

interface StoredAccount {
  accountNumber: string;
  fullName: string;
  accountType: AccountType;
  pinSalt: string;
  pinHash: string;
  balanceCents: number;
  createdAt: string;
}

interface BankLedgerFile {
  version: number;
  nextAccountSeq: number;
  nextTxSeq: number;
  accounts: Record<string, StoredAccount>;
  transactions: StoredTransaction[];
}

interface SessionRecord {
  accountNumber: string;
  expiresAt: number;
}

interface AuthenticatedRequest extends Request {
  authAccountNumber?: string;
  authToken?: string;
}

const PORT = 3000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_SINGLE_TX_CENTS = 100_000_000; // $1,000,000.00
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 15;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEDGER_FILE = path.resolve(DATA_DIR, 'bank_ledger.json');
if (!LEDGER_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Ledger path escaped confined data directory');
}

const sessions = new Map<string, SessionRecord>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

let writeChain: Promise<unknown> = Promise.resolve();

function withLedgerLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

function hashPin(pin: string, salt?: string): { salt: string; hash: string } {
  const resolvedSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, resolvedSalt, 64).toString('hex');
  return { salt: resolvedSalt, hash: derived };
}

function verifyPin(pin: string, salt: string, storedHash: string): boolean {
  const candidate = crypto.scryptSync(pin, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function formatCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${negative ? '-' : ''}$${dollars}`;
}

function parseAmountToCents(raw: unknown, allowZero = false): { ok: true; cents: number } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, error: 'Enter a valid amount.' };
  }
  const str = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (!str) {
    return { ok: false, error: 'Enter a valid amount.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return { ok: false, error: 'Amount must be a positive number with up to two decimal places.' };
  }
  const num = Number(str);
  if (!Number.isFinite(num)) {
    return { ok: false, error: 'Amount is out of range.' };
  }
  const cents = Math.round(num * 100);
  if (!allowZero && cents <= 0) {
    return { ok: false, error: 'Amount must be greater than $0.00.' };
  }
  if (cents < 0) {
    return { ok: false, error: 'Amount cannot be negative.' };
  }
  if (cents > MAX_SINGLE_TX_CENTS) {
    return { ok: false, error: 'Single operation cannot exceed $1,000,000.00.' };
  }
  return { ok: true, cents };
}

function sanitizeDescription(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.replace(/[\r\n\t]+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 120);
}

function sanitizeCsvCell(value: string): string {
  const trimmed = value.replace(/[\r\n]+/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function createInitialLedger(): BankLedgerFile {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const elenaPin = hashPin('1234');
  const marcusPin = hashPin('5678');

  const accounts: Record<string, StoredAccount> = {
    'AB-1001': {
      accountNumber: 'AB-1001',
      fullName: 'Elena Vance',
      accountType: 'Checking',
      pinSalt: elenaPin.salt,
      pinHash: elenaPin.hash,
      balanceCents: 245000,
      createdAt: new Date(now - 21 * day).toISOString(),
    },
    'AB-1002': {
      accountNumber: 'AB-1002',
      fullName: 'Marcus Chen',
      accountType: 'Savings',
      pinSalt: marcusPin.salt,
      pinHash: marcusPin.hash,
      balanceCents: 518000,
      createdAt: new Date(now - 30 * day).toISOString(),
    },
  };

  const transactions: StoredTransaction[] = [
    {
      id: 'TX-1001',
      accountNumber: 'AB-1002',
      type: 'DEPOSIT',
      amountCents: 450000,
      balanceAfterCents: 450000,
      description: 'Opening Savings Deposit',
      timestamp: new Date(now - 30 * day).toISOString(),
    },
    {
      id: 'TX-1002',
      accountNumber: 'AB-1001',
      type: 'DEPOSIT',
      amountCents: 120000,
      balanceAfterCents: 120000,
      description: 'Opening Account Deposit',
      timestamp: new Date(now - 21 * day).toISOString(),
    },
    {
      id: 'TX-1003',
      accountNumber: 'AB-1001',
      type: 'DEPOSIT',
      amountCents: 185000,
      balanceAfterCents: 305000,
      description: 'Direct Deposit — Northwind Payroll',
      timestamp: new Date(now - 14 * day).toISOString(),
    },
    {
      id: 'TX-1004',
      accountNumber: 'AB-1001',
      type: 'WITHDRAWAL',
      amountCents: 14500,
      balanceAfterCents: 290500,
      description: 'City Utilities Monthly Billing',
      timestamp: new Date(now - 10 * day).toISOString(),
    },
    {
      id: 'TX-1005',
      accountNumber: 'AB-1001',
      type: 'WITHDRAWAL',
      amountCents: 17500,
      balanceAfterCents: 273000,
      description: 'ATM Cash Withdrawal — Market St',
      timestamp: new Date(now - 6 * day).toISOString(),
    },
    {
      id: 'TX-1006',
      accountNumber: 'AB-1001',
      type: 'TRANSFER_OUT',
      amountCents: 28000,
      balanceAfterCents: 245000,
      description: 'Shared Studio Utilities Split',
      counterpartyAccount: 'AB-1002',
      timestamp: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'TX-1007',
      accountNumber: 'AB-1002',
      type: 'TRANSFER_IN',
      amountCents: 28000,
      balanceAfterCents: 478000,
      description: 'Shared Studio Utilities Split',
      counterpartyAccount: 'AB-1001',
      timestamp: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'TX-1008',
      accountNumber: 'AB-1002',
      type: 'DEPOSIT',
      amountCents: 40000,
      balanceAfterCents: 518000,
      description: 'Monthly Reserve Contribution',
      timestamp: new Date(now - 1 * day).toISOString(),
    },
  ];

  return {
    version: 1,
    nextAccountSeq: 1003,
    nextTxSeq: 1009,
    accounts,
    transactions,
  };
}

async function ensureLedgerFile(): Promise<BankLedgerFile> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(LEDGER_FILE, 'utf8');
    return JSON.parse(raw) as BankLedgerFile;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      const initial = createInitialLedger();
      await writeLedgerAtomically(initial);
      return initial;
    }
    throw err;
  }
}

async function writeLedgerAtomically(ledger: BankLedgerFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = path.resolve(DATA_DIR, `bank_ledger.${crypto.randomBytes(6).toString('hex')}.tmp`);
  if (!tempFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Temp file path escaped data directory');
  }
  const serialized = JSON.stringify(ledger, null, 2);
  await fs.writeFile(tempFile, serialized, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tempFile, LEDGER_FILE);
}

function buildAccountSummary(ledger: BankLedgerFile, accountNumber: string) {
  const account = ledger.accounts[accountNumber];
  if (!account) return null;

  const accountTxs = ledger.transactions.filter((tx) => tx.accountNumber === accountNumber);
  let totalDepositsCents = 0;
  let totalWithdrawalsCents = 0;
  let totalTransfersInCents = 0;
  let totalTransfersOutCents = 0;

  for (const tx of accountTxs) {
    if (tx.type === 'DEPOSIT') totalDepositsCents += tx.amountCents;
    else if (tx.type === 'WITHDRAWAL') totalWithdrawalsCents += tx.amountCents;
    else if (tx.type === 'TRANSFER_IN') totalTransfersInCents += tx.amountCents;
    else if (tx.type === 'TRANSFER_OUT') totalTransfersOutCents += tx.amountCents;
  }

  return {
    accountNumber: account.accountNumber,
    fullName: account.fullName,
    accountType: account.accountType,
    balanceCents: account.balanceCents,
    createdAt: account.createdAt,
    metrics: {
      totalDepositsCents,
      totalWithdrawalsCents,
      totalTransfersInCents,
      totalTransfersOutCents,
      transactionCount: accountTxs.length,
    },
  };
}

function buildRecipientsList(ledger: BankLedgerFile, excludeAccountNumber: string) {
  return Object.values(ledger.accounts)
    .filter((acc) => acc.accountNumber !== excludeAccountNumber)
    .map((acc) => ({
      accountNumber: acc.accountNumber,
      fullName: acc.fullName,
      accountType: acc.accountType,
    }))
    .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

function issueSession(accountNumber: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    accountNumber,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Session is invalid or has expired. Please sign in again.' });
    return;
  }
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  req.authAccountNumber = session.accountNumber;
  req.authToken = token;
  next();
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    return { allowed: true };
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedLogins(key: string): void {
  loginAttempts.delete(key);
}

async function startServer() {
  await withLedgerLock(async () => {
    await ensureLedgerFile();
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Auth: Register new bank account
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { fullName, accountType, pin, initialDeposit } = req.body ?? {};

      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 60) {
        res.status(400).json({ error: 'Full name must be between 2 and 60 characters.' });
        return;
      }

      if (accountType !== 'Checking' && accountType !== 'Savings') {
        res.status(400).json({ error: 'Account type must be Checking or Savings.' });
        return;
      }

      if (typeof pin !== 'string' || pin.trim().length < 4 || pin.trim().length > 24) {
        res.status(400).json({ error: 'PIN or password must be between 4 and 24 characters.' });
        return;
      }

      const depositRaw = initialDeposit === undefined || initialDeposit === '' ? '0' : initialDeposit;
      const parsedDeposit = parseAmountToCents(depositRaw, true);
      if (!parsedDeposit.ok) {
        res.status(400).json({ error: parsedDeposit.error });
        return;
      }

      const result = await withLedgerLock(async () => {
        const ledger = await ensureLedgerFile();
        const accountNumber = `AB-${ledger.nextAccountSeq}`;
        ledger.nextAccountSeq += 1;

        const nowIso = new Date().toISOString();
        const { salt, hash } = hashPin(pin.trim());

        ledger.accounts[accountNumber] = {
          accountNumber,
          fullName: fullName.trim().replace(/\s+/g, ' '),
          accountType,
          pinSalt: salt,
          pinHash: hash,
          balanceCents: parsedDeposit.cents,
          createdAt: nowIso,
        };

        if (parsedDeposit.cents > 0) {
          const txId = `TX-${ledger.nextTxSeq}`;
          ledger.nextTxSeq += 1;
          ledger.transactions.push({
            id: txId,
            accountNumber,
            type: 'DEPOSIT',
            amountCents: parsedDeposit.cents,
            balanceAfterCents: parsedDeposit.cents,
            description: 'Opening Account Deposit',
            timestamp: nowIso,
          });
        }

        await writeLedgerAtomically(ledger);
        const token = issueSession(accountNumber);
        return {
          token,
          account: buildAccountSummary(ledger, accountNumber),
          recipients: buildRecipientsList(ledger, accountNumber),
        };
      });

      res.status(201).json(result);
    } catch {
      res.status(500).json({ error: 'Unable to create account right now. Please try again.' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { accountNumber, pin } = req.body ?? {};
      if (typeof accountNumber !== 'string' || typeof pin !== 'string') {
        res.status(400).json({ error: 'Account number and PIN are required.' });
        return;
      }

      const normalizedAccount = accountNumber.trim().toUpperCase();
      const trimmedPin = pin.trim();
      if (!normalizedAccount || !trimmedPin) {
        res.status(400).json({ error: 'Account number and PIN are required.' });
        return;
      }

      const rateKey = `${req.ip ?? 'local'}:${normalizedAccount}`;
      const limitCheck = checkRateLimit(rateKey);
      if (!limitCheck.allowed) {
        res.status(429).json({
          error: `Too many sign-in attempts. Try again in ${limitCheck.retryAfterSec} seconds.`,
        });
        return;
      }

      const ledger = await withLedgerLock(() => ensureLedgerFile());
      const account = ledger.accounts[normalizedAccount];
      if (!account || !verifyPin(trimmedPin, account.pinSalt, account.pinHash)) {
        recordFailedLogin(rateKey);
        res.status(401).json({ error: 'Invalid account number or PIN.' });
        return;
      }

      clearFailedLogins(rateKey);
      const token = issueSession(account.accountNumber);
      res.json({
        token,
        account: buildAccountSummary(ledger, account.accountNumber),
        recipients: buildRecipientsList(ledger, account.accountNumber),
      });
    } catch {
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  // Auth: Logout
  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.authToken) {
      sessions.delete(req.authToken);
    }
    res.json({ ok: true });
  });

  // Account summary & transfer directory
  app.get('/api/account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await withLedgerLock(() => ensureLedgerFile());
      const summary = buildAccountSummary(ledger, req.authAccountNumber!);
      if (!summary) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      res.json({
        account: summary,
        recipients: buildRecipientsList(ledger, req.authAccountNumber!),
      });
    } catch {
      res.status(500).json({ error: 'Unable to load account summary.' });
    }
  });

  // Transaction list with filtering
  app.get('/api/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const typeFilter = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : 'ALL';
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const sort = req.query.sort === 'asc' ? 'asc' : 'desc';

      const ledger = await withLedgerLock(() => ensureLedgerFile());
      let items = ledger.transactions.filter((tx) => tx.accountNumber === req.authAccountNumber);

      if (typeFilter === 'DEPOSIT') {
        items = items.filter((tx) => tx.type === 'DEPOSIT');
      } else if (typeFilter === 'WITHDRAWAL') {
        items = items.filter((tx) => tx.type === 'WITHDRAWAL');
      } else if (typeFilter === 'TRANSFER') {
        items = items.filter((tx) => tx.type === 'TRANSFER_IN' || tx.type === 'TRANSFER_OUT');
      }

      if (search) {
        items = items.filter(
          (tx) =>
            tx.id.toLowerCase().includes(search) ||
            tx.description.toLowerCase().includes(search) ||
            (tx.counterpartyAccount?.toLowerCase().includes(search) ?? false)
        );
      }

      items.sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return sort === 'asc' ? diff : -diff;
      });

      res.json({ transactions: items });
    } catch {
      res.status(500).json({ error: 'Unable to load transactions.' });
    }
  });

  // Deposit
  app.post('/api/transactions/deposit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = parseAmountToCents(req.body?.amount, false);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const description = sanitizeDescription(req.body?.description, 'Cash / Check Deposit');

      const result = await withLedgerLock(async () => {
        const ledger = await ensureLedgerFile();
        const account = ledger.accounts[req.authAccountNumber!];
        if (!account) return null;

        account.balanceCents += parsed.cents;
        const tx: StoredTransaction = {
          id: `TX-${ledger.nextTxSeq}`,
          accountNumber: account.accountNumber,
          type: 'DEPOSIT',
          amountCents: parsed.cents,
          balanceAfterCents: account.balanceCents,
          description,
          timestamp: new Date().toISOString(),
        };
        ledger.nextTxSeq += 1;
        ledger.transactions.push(tx);
        await writeLedgerAtomically(ledger);

        return {
          account: buildAccountSummary(ledger, account.accountNumber)!,
          transaction: tx,
        };
      });

      if (!result) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }

      res.status(201).json(result);
    } catch {
      res.status(500).json({ error: 'Unable to process deposit.' });
    }
  });

  // Withdraw
  app.post('/api/transactions/withdraw', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = parseAmountToCents(req.body?.amount, false);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const description = sanitizeDescription(req.body?.description, 'Cash Withdrawal');

      const result = await withLedgerLock(async () => {
        const ledger = await ensureLedgerFile();
        const account = ledger.accounts[req.authAccountNumber!];
        if (!account) return { status: 404 as const, error: 'Account not found.' };

        if (parsed.cents > account.balanceCents) {
          return {
            status: 400 as const,
            error: `Insufficient funds. Available balance is ${formatCents(account.balanceCents)}.`,
          };
        }

        account.balanceCents -= parsed.cents;
        const tx: StoredTransaction = {
          id: `TX-${ledger.nextTxSeq}`,
          accountNumber: account.accountNumber,
          type: 'WITHDRAWAL',
          amountCents: parsed.cents,
          balanceAfterCents: account.balanceCents,
          description,
          timestamp: new Date().toISOString(),
        };
        ledger.nextTxSeq += 1;
        ledger.transactions.push(tx);
        await writeLedgerAtomically(ledger);

        return {
          status: 201 as const,
          payload: {
            account: buildAccountSummary(ledger, account.accountNumber)!,
            transaction: tx,
          },
        };
      });

      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(201).json(result.payload);
    } catch {
      res.status(500).json({ error: 'Unable to process withdrawal.' });
    }
  });

  // Internal Account Transfer
  app.post('/api/transactions/transfer', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = parseAmountToCents(req.body?.amount, false);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const rawTarget = typeof req.body?.toAccountNumber === 'string' ? req.body.toAccountNumber.trim().toUpperCase() : '';
      if (!rawTarget) {
        res.status(400).json({ error: 'Select or enter a destination account number.' });
        return;
      }

      if (rawTarget === req.authAccountNumber) {
        res.status(400).json({ error: 'Cannot transfer funds to the same account.' });
        return;
      }

      const description = sanitizeDescription(req.body?.description, `Transfer to ${rawTarget}`);

      const result = await withLedgerLock(async () => {
        const ledger = await ensureLedgerFile();
        const sender = ledger.accounts[req.authAccountNumber!];
        const recipient = ledger.accounts[rawTarget];
        if (!sender) return { status: 404 as const, error: 'Source account not found.' };
        if (!recipient) {
          return { status: 404 as const, error: `Recipient account ${rawTarget} was not found.` };
        }
        if (parsed.cents > sender.balanceCents) {
          return {
            status: 400 as const,
            error: `Insufficient funds. Available balance is ${formatCents(sender.balanceCents)}.`,
          };
        }

        const nowIso = new Date().toISOString();
        sender.balanceCents -= parsed.cents;
        recipient.balanceCents += parsed.cents;

        const outTx: StoredTransaction = {
          id: `TX-${ledger.nextTxSeq}`,
          accountNumber: sender.accountNumber,
          type: 'TRANSFER_OUT',
          amountCents: parsed.cents,
          balanceAfterCents: sender.balanceCents,
          description,
          counterpartyAccount: recipient.accountNumber,
          timestamp: nowIso,
        };
        ledger.nextTxSeq += 1;

        const inTx: StoredTransaction = {
          id: `TX-${ledger.nextTxSeq}`,
          accountNumber: recipient.accountNumber,
          type: 'TRANSFER_IN',
          amountCents: parsed.cents,
          balanceAfterCents: recipient.balanceCents,
          description,
          counterpartyAccount: sender.accountNumber,
          timestamp: nowIso,
        };
        ledger.nextTxSeq += 1;

        ledger.transactions.push(outTx, inTx);
        await writeLedgerAtomically(ledger);

        return {
          status: 201 as const,
          payload: {
            account: buildAccountSummary(ledger, sender.accountNumber)!,
            transaction: outTx,
          },
        };
      });

      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.status(201).json(result.payload);
    } catch {
      res.status(500).json({ error: 'Unable to process transfer.' });
    }
  });

  // File Persistence Inspector (sanitized to current authenticated account only)
  app.get('/api/storage/ledger', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const snapshot = await withLedgerLock(async () => {
        const ledger = await ensureLedgerFile();
        const stats = await fs.stat(LEDGER_FILE);
        const account = ledger.accounts[req.authAccountNumber!];
        if (!account) return null;

        const accountTxs = ledger.transactions
          .filter((tx) => tx.accountNumber === account.accountNumber)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return {
          fileName: 'data/bank_ledger.json',
          fileSizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          recordCount: accountTxs.length,
          sanitizedRecord: {
            accountNumber: account.accountNumber,
            fullName: account.fullName,
            accountType: account.accountType,
            balanceCents: account.balanceCents,
            balanceFormatted: formatCents(account.balanceCents),
            createdAt: account.createdAt,
            pinProtection: 'scrypt-salted-hash (redacted)',
            transactions: accountTxs,
          },
        };
      });

      if (!snapshot) {
        res.status(404).json({ error: 'Account record not found.' });
        return;
      }
      res.json(snapshot);
    } catch {
      res.status(500).json({ error: 'Unable to read ledger storage snapshot.' });
    }
  });

  // Export CSV Statement
  app.get('/api/export/csv', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await withLedgerLock(() => ensureLedgerFile());
      const account = ledger.accounts[req.authAccountNumber!];
      if (!account) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const rows = ledger.transactions
        .filter((tx) => tx.accountNumber === account.accountNumber)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const header = ['Reference', 'Timestamp', 'Type', 'Memo', 'Counterparty', 'Amount', 'Balance After'].join(',');
      const lines = rows.map((tx) => {
        const signedAmount =
          tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN'
            ? (tx.amountCents / 100).toFixed(2)
            : `-${(tx.amountCents / 100).toFixed(2)}`;
        return [
          sanitizeCsvCell(tx.id),
          sanitizeCsvCell(tx.timestamp),
          sanitizeCsvCell(tx.type),
          sanitizeCsvCell(tx.description),
          sanitizeCsvCell(tx.counterpartyAccount ?? ''),
          sanitizeCsvCell(signedAmount),
          sanitizeCsvCell((tx.balanceAfterCents / 100).toFixed(2)),
        ].join(',');
      });

      const csv = [header, ...lines].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="alder_statement_${account.accountNumber}.csv"`);
      res.send(csv);
    } catch {
      res.status(500).json({ error: 'Unable to export CSV statement.' });
    }
  });

  // Export Plain-Text Statement
  app.get('/api/export/txt', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ledger = await withLedgerLock(() => ensureLedgerFile());
      const account = ledger.accounts[req.authAccountNumber!];
      if (!account) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const rows = ledger.transactions
        .filter((tx) => tx.accountNumber === account.accountNumber)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const lines: string[] = [
        '========================================================================',
        'ALDER BANK — ACCOUNT STATEMENT',
        '========================================================================',
        `Account Holder : ${account.fullName}`,
        `Account Number : ${account.accountNumber} (${account.accountType})`,
        `Current Balance: ${formatCents(account.balanceCents)}`,
        `Generated At   : ${new Date().toISOString()}`,
        '------------------------------------------------------------------------',
        'REF       | DATE (UTC)          | TYPE         | AMOUNT       | BALANCE',
        '------------------------------------------------------------------------',
      ];

      if (rows.length === 0) {
        lines.push('No transactions recorded for this account.');
      } else {
        for (const tx of rows) {
          const isCredit = tx.type === 'DEPOSIT' || tx.type === 'TRANSFER_IN';
          const amt = `${isCredit ? '+' : '-'}${formatCents(tx.amountCents)}`;
          const bal = formatCents(tx.balanceAfterCents);
          const dateStr = tx.timestamp.replace('T', ' ').slice(0, 19);
          lines.push(
            `${tx.id.padEnd(9)} | ${dateStr} | ${tx.type.padEnd(12)} | ${amt.padStart(12)} | ${bal.padStart(12)}`
          );
          lines.push(`          Memo: ${tx.description}${tx.counterpartyAccount ? ` (${tx.counterpartyAccount})` : ''}`);
        }
      }

      lines.push('========================================================================');

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="alder_statement_${account.accountNumber}.txt"`);
      res.send(lines.join('\n'));
    } catch {
      res.status(500).json({ error: 'Unable to export text statement.' });
    }
  });

  // Return JSON 404 for unknown API paths
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alder Bank server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Alder Bank server:', err);
  process.exit(1);
});
