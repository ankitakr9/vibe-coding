import React, { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, RotateCcw } from 'lucide-react';
import { ApiError, bankingApi } from '../services/api';
import type {
  AccountSummary,
  OperationResult,
  RecipientOption,
  TransactionRecord,
} from '../types/banking';
import {
  formatCurrency,
  formatSignedCurrency,
  formatTimestamp,
  validateAmountInput,
} from '../utils/format';

interface ConsoleLine {
  id: number;
  kind: 'system' | 'input' | 'output' | 'success' | 'error';
  text: string;
}

type PromptStep =
  | { stage: 'menu' }
  | { stage: 'deposit_amount' }
  | { stage: 'deposit_memo'; amount: string }
  | { stage: 'withdraw_amount' }
  | { stage: 'withdraw_memo'; amount: string }
  | { stage: 'transfer_target' }
  | { stage: 'transfer_amount'; target: string }
  | { stage: 'transfer_memo'; target: string; amount: string };

interface ConsolePanelProps {
  token: string;
  account: AccountSummary;
  recipients: RecipientOption[];
  transactions: TransactionRecord[];
  onOperationSuccess: (result: OperationResult) => void;
}

const MENU_TEXT = [
  'Menu Options (enter 1-6 or type direct commands like "deposit 100 Payroll"):',
  '  1) Balance Inquiry          4) Transfer Funds',
  '  2) Deposit Funds            5) Recent History',
  '  3) Withdraw Funds           6) Account Summary',
  '  help — Show command syntax  |  clear — Reset console buffer',
].join('\n');

export function ConsolePanel({
  token,
  account,
  recipients,
  transactions,
  onOperationSuccess,
}: ConsolePanelProps) {
  const [lines, setLines] = useState<ConsoleLine[]>(() => [
    {
      id: 1,
      kind: 'system',
      text: `Alder Bank Console Session — Signed in as ${account.fullName} (${account.accountNumber} · ${account.accountType})`,
    },
    { id: 2, kind: 'system', text: MENU_TEXT },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState<PromptStep>({ stage: 'menu' });
  const [busy, setBusy] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const lineIdRef = useRef(3);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const appendLines = (entries: Array<{ kind: ConsoleLine['kind']; text: string }>) => {
    setLines((prev) => [
      ...prev,
      ...entries.map((e) => ({ id: lineIdRef.current++, kind: e.kind, text: e.text })),
    ]);
  };

  const getPromptLabel = (): string => {
    switch (step.stage) {
      case 'menu':
        return `${account.accountNumber} >`;
      case 'deposit_amount':
        return 'Deposit amount ($) >';
      case 'deposit_memo':
        return 'Deposit memo (optional) >';
      case 'withdraw_amount':
        return 'Withdrawal amount ($) >';
      case 'withdraw_memo':
        return 'Withdrawal memo (optional) >';
      case 'transfer_target':
        return 'Recipient account (e.g. AB-1002) >';
      case 'transfer_amount':
        return `Transfer to ${step.target} amount ($) >`;
      case 'transfer_memo':
        return 'Transfer memo (optional) >';
    }
  };

  const executeDeposit = async (amount: string, memo: string) => {
    setBusy(true);
    try {
      const res = await bankingApi.deposit(token, { amount, description: memo });
      onOperationSuccess(res);
      appendLines([
        {
          kind: 'success',
          text: `[OK] Recorded ${res.transaction.id} | Deposit +${formatCurrency(res.transaction.amountCents)} | New Balance: ${formatCurrency(res.account.balanceCents)}`,
        },
      ]);
    } catch (err) {
      appendLines([
        {
          kind: 'error',
          text: `[ERROR] ${err instanceof ApiError ? err.message : 'Deposit failed.'}`,
        },
      ]);
    } finally {
      setBusy(false);
      setStep({ stage: 'menu' });
    }
  };

  const executeWithdraw = async (amount: string, memo: string) => {
    setBusy(true);
    try {
      const res = await bankingApi.withdraw(token, { amount, description: memo });
      onOperationSuccess(res);
      appendLines([
        {
          kind: 'success',
          text: `[OK] Recorded ${res.transaction.id} | Withdrawal -${formatCurrency(res.transaction.amountCents)} | New Balance: ${formatCurrency(res.account.balanceCents)}`,
        },
      ]);
    } catch (err) {
      appendLines([
        {
          kind: 'error',
          text: `[ERROR] ${err instanceof ApiError ? err.message : 'Withdrawal failed.'}`,
        },
      ]);
    } finally {
      setBusy(false);
      setStep({ stage: 'menu' });
    }
  };

  const executeTransfer = async (target: string, amount: string, memo: string) => {
    setBusy(true);
    try {
      const res = await bankingApi.transfer(token, {
        toAccountNumber: target.toUpperCase(),
        amount,
        description: memo,
      });
      onOperationSuccess(res);
      appendLines([
        {
          kind: 'success',
          text: `[OK] Recorded ${res.transaction.id} | Transferred ${formatCurrency(res.transaction.amountCents)} to ${target.toUpperCase()} | New Balance: ${formatCurrency(res.account.balanceCents)}`,
        },
      ]);
    } catch (err) {
      appendLines([
        {
          kind: 'error',
          text: `[ERROR] ${err instanceof ApiError ? err.message : 'Transfer failed.'}`,
        },
      ]);
    } finally {
      setBusy(false);
      setStep({ stage: 'menu' });
    }
  };

  const processCommand = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    const promptPrefix = getPromptLabel();
    appendLines([{ kind: 'input', text: `${promptPrefix} ${trimmed}` }]);

    if (trimmed) {
      setCmdHistory((prev) => [trimmed, ...prev.slice(0, 39)]);
      setHistoryIndex(-1);
    }

    if (trimmed.toLowerCase() === 'cancel' && step.stage !== 'menu') {
      setStep({ stage: 'menu' });
      appendLines([{ kind: 'output', text: 'Operation cancelled.' }]);
      return;
    }

    // Interactive Scanner-style multi-step prompts
    if (step.stage === 'deposit_amount') {
      const err = validateAmountInput(trimmed, false);
      if (err) {
        appendLines([{ kind: 'error', text: `[VALIDATION] ${err} (type "cancel" to abort)` }]);
        return;
      }
      setStep({ stage: 'deposit_memo', amount: trimmed });
      return;
    }

    if (step.stage === 'deposit_memo') {
      await executeDeposit(step.amount, trimmed);
      return;
    }

    if (step.stage === 'withdraw_amount') {
      const err = validateAmountInput(trimmed, false);
      if (err) {
        appendLines([{ kind: 'error', text: `[VALIDATION] ${err} (type "cancel" to abort)` }]);
        return;
      }
      setStep({ stage: 'withdraw_memo', amount: trimmed });
      return;
    }

    if (step.stage === 'withdraw_memo') {
      await executeWithdraw(step.amount, trimmed);
      return;
    }

    if (step.stage === 'transfer_target') {
      if (!trimmed) {
        appendLines([{ kind: 'error', text: '[VALIDATION] Enter a recipient account number (e.g., AB-1002).' }]);
        return;
      }
      setStep({ stage: 'transfer_amount', target: trimmed.toUpperCase() });
      return;
    }

    if (step.stage === 'transfer_amount') {
      const err = validateAmountInput(trimmed, false);
      if (err) {
        appendLines([{ kind: 'error', text: `[VALIDATION] ${err} (type "cancel" to abort)` }]);
        return;
      }
      setStep({ stage: 'transfer_memo', target: step.target, amount: trimmed });
      return;
    }

    if (step.stage === 'transfer_memo') {
      await executeTransfer(step.target, step.amount, trimmed);
      return;
    }

    // Top-level menu or direct commands
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'clear') {
      setLines([
        {
          id: lineIdRef.current++,
          kind: 'system',
          text: `Console cleared · Active account ${account.accountNumber}`,
        },
      ]);
      return;
    }

    if (cmd === 'help' || cmd === 'menu') {
      appendLines([
        {
          kind: 'system',
          text: [
            MENU_TEXT,
            '',
            'Direct one-line examples:',
            '  balance',
            '  deposit 150.00 Freelance invoice',
            '  withdraw 45.00 ATM cash',
            '  transfer AB-1002 50.00 Shared bill',
            '  history',
          ].join('\n'),
        },
      ]);
      return;
    }

    if (cmd === '1' || cmd === 'balance') {
      appendLines([
        {
          kind: 'output',
          text: `Available Balance (${account.accountNumber}): ${formatCurrency(account.balanceCents)}`,
        },
      ]);
      return;
    }

    if (cmd === '2' || cmd === 'deposit') {
      if (parts.length >= 2) {
        const amt = parts[1];
        const err = validateAmountInput(amt, false);
        if (err) {
          appendLines([{ kind: 'error', text: `[VALIDATION] ${err}` }]);
          return;
        }
        await executeDeposit(amt, parts.slice(2).join(' '));
      } else {
        setStep({ stage: 'deposit_amount' });
      }
      return;
    }

    if (cmd === '3' || cmd === 'withdraw') {
      if (parts.length >= 2) {
        const amt = parts[1];
        const err = validateAmountInput(amt, false);
        if (err) {
          appendLines([{ kind: 'error', text: `[VALIDATION] ${err}` }]);
          return;
        }
        await executeWithdraw(amt, parts.slice(2).join(' '));
      } else {
        setStep({ stage: 'withdraw_amount' });
      }
      return;
    }

    if (cmd === '4' || cmd === 'transfer') {
      if (parts.length >= 3) {
        const target = parts[1].toUpperCase();
        const amt = parts[2];
        const err = validateAmountInput(amt, false);
        if (err) {
          appendLines([{ kind: 'error', text: `[VALIDATION] ${err}` }]);
          return;
        }
        await executeTransfer(target, amt, parts.slice(3).join(' '));
      } else {
        if (recipients.length > 0) {
          appendLines([
            {
              kind: 'system',
              text: `Available recipients: ${recipients.map((r) => `${r.accountNumber} (${r.fullName})`).join(', ')}`,
            },
          ]);
        }
        setStep({ stage: 'transfer_target' });
      }
      return;
    }

    if (cmd === '5' || cmd === 'history') {
      const latest = transactions.slice(0, 8);
      if (latest.length === 0) {
        appendLines([{ kind: 'output', text: 'No transactions recorded yet.' }]);
        return;
      }
      const header = 'REF       | TYPE         | AMOUNT        | BALANCE       | MEMO';
      const divider = '----------+--------------+---------------+---------------+------------------------';
      const rows = latest.map((tx) => {
        const amt = formatSignedCurrency(tx.amountCents, tx.type).padStart(13);
        const bal = formatCurrency(tx.balanceAfterCents).padStart(13);
        return `${tx.id.padEnd(9)} | ${tx.type.padEnd(12)} | ${amt} | ${bal} | ${tx.description}`;
      });
      appendLines([{ kind: 'output', text: [header, divider, ...rows].join('\n') }]);
      return;
    }

    if (cmd === '6' || cmd === 'summary' || cmd === 'info') {
      appendLines([
        {
          kind: 'output',
          text: [
            `Account Holder : ${account.fullName}`,
            `Account Number : ${account.accountNumber} (${account.accountType})`,
            `Opened         : ${formatTimestamp(account.createdAt)}`,
            `Balance        : ${formatCurrency(account.balanceCents)}`,
            `Total Entries  : ${account.metrics.transactionCount}`,
          ].join('\n'),
        },
      ]);
      return;
    }

    appendLines([
      {
        kind: 'error',
        text: `Unknown command "${trimmed}". Enter 1-6 or type "help" for available commands.`,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = inputValue;
    setInputValue('');
    await processCommand(value);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
      e.preventDefault();
      const nextIdx = Math.min(historyIndex + 1, cmdHistory.length - 1);
      setHistoryIndex(nextIdx);
      setInputValue(cmdHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setInputValue('');
      } else {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputValue(cmdHistory[nextIdx]);
      }
    }
  };

  const runQuickCommand = async (cmd: string) => {
    if (busy) return;
    setStep({ stage: 'menu' });
    await processCommand(cmd);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Interactive Banking Console
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Menu-driven terminal mirroring Java Scanner input — every command executes live against your persistent account ledger.
          </p>
        </div>

        <button
          type="button"
          onClick={() => runQuickCommand('clear')}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Console</span>
        </button>
      </div>

      {/* Quick Command Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: '1 · Balance', cmd: '1' },
          { label: '2 · Deposit', cmd: '2' },
          { label: '3 · Withdraw', cmd: '3' },
          { label: '4 · Transfer', cmd: '4' },
          { label: '5 · History', cmd: '5' },
          { label: 'Help', cmd: 'help' },
        ].map((action) => (
          <button
            key={action.cmd}
            type="button"
            disabled={busy}
            onClick={() => runQuickCommand(action.cmd)}
            className="px-3.5 py-2 text-xs font-mono font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div
        className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>ConsoleBankingApp · {account.accountNumber}</span>
          <span className="tabular-nums">Balance: {formatCurrency(account.balanceCents)}</span>
        </div>

        <div
          ref={scrollRef}
          className="p-5 h-[420px] overflow-y-auto font-mono text-[13px] leading-relaxed space-y-2.5"
        >
          {lines.map((line) => (
            <pre
              key={line.id}
              className={`whitespace-pre-wrap break-words font-mono ${
                line.kind === 'system'
                  ? 'text-slate-400'
                  : line.kind === 'input'
                    ? 'text-white font-medium'
                    : line.kind === 'success'
                      ? 'text-emerald-400'
                      : line.kind === 'error'
                        ? 'text-red-400'
                        : 'text-slate-200'
              }`}
            >
              {line.text}
            </pre>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-4 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-3"
        >
          <span className="font-mono text-xs text-emerald-400 whitespace-nowrap shrink-0">
            {getPromptLabel()}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            disabled={busy}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              step.stage === 'menu'
                ? 'Type 1-6 or "deposit 100 Payroll"...'
                : 'Enter value or type "cancel"...'
            }
            aria-label="Console command input"
            className="flex-1 bg-transparent text-white font-mono text-sm placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-600 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
