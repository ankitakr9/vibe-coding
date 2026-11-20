import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react';
import type { AuditLogEntry, AuthUser, UserRole, UserStatus } from '../shared/types';

interface AdminUsersViewProps {
  token: string;
  currentUser: AuthUser;
}

const formatTimestamp = (iso: string | null) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export function AdminUsersView({ token, currentUser }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/audit-logs', { headers }),
      ]);
      if (!usersRes.ok || !logsRes.ok) {
        throw new Error('Administrator authorization required to inspect RBAC directory.');
      }
      const usersJson = (await usersRes.json()) as { users: AuthUser[] };
      const logsJson = (await logsRes.json()) as { logs: AuditLogEntry[] };
      setUsers(usersJson.users);
      setAuditLogs(logsJson.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load directory');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Unable to update user role');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusToggle = async (userId: string, nextStatus: UserStatus) => {
    setBusyId(userId);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Unable to update user status');
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0B1528]">
            Users, Roles and Security Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage registered identities, assign Role-Based Access Control (RBAC) tiers, suspend compromised operators, and inspect authentication audit trails.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-[#F7F9FC] transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#1D4ED8]" />
          Refresh Directory
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
        >
          {error}
        </div>
      )}

      {/* User Directory & RBAC Table */}
      <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E4E9F2] px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-[#1D4ED8]" />
            <h2 className="text-base font-semibold text-[#0B1528]">
              Registered Identities ({users.length})
            </h2>
          </div>
          <span className="text-xs font-medium text-[#1D4ED8]">Admin-only governance route</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E9F2] bg-[#F7F9FC] text-slate-600">
                <th className="py-3 pl-6 pr-3 font-semibold">User</th>
                <th className="px-3 py-3 font-semibold">Email</th>
                <th className="px-3 py-3 font-semibold">RBAC Role</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Last Sign-In</th>
                <th className="py-3 pl-3 pr-6 text-right font-semibold">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading user directory...
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="whitespace-nowrap py-3.5 pl-6 pr-3">
                        <div className="font-medium text-slate-900">
                          {u.fullName}
                          {isSelf && (
                            <span className="ml-2 font-normal text-slate-500">(You)</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{u.id}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-mono text-slate-700">
                        {u.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <select
                          aria-label={`Role for ${u.email}`}
                          disabled={isSelf || busyId === u.id}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 disabled:opacity-50 focus:border-blue-600 focus:outline-none"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="ANALYST">ANALYST</option>
                          <option value="CUSTOMER">CUSTOMER</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <span
                          className={`font-semibold ${
                            u.status === 'ACTIVE' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-mono tabular-nums text-slate-500">
                        {formatTimestamp(u.lastLoginAt)}
                      </td>
                      <td className="whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                        <button
                          type="button"
                          disabled={isSelf || busyId === u.id}
                          onClick={() =>
                            handleStatusToggle(u.id, u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
                          }
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap ${
                            u.status === 'ACTIVE'
                              ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Suspend User' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Immutable Security Audit Trail */}
      <section className="rounded-xl border border-[#DCE3EE] bg-white shadow-[0_1px_2px_rgba(11,21,40,0.04)] overflow-hidden">
        <div className="border-b border-[#E4E9F2] px-6 py-4">
          <h2 className="text-base font-semibold text-[#0B1528]">
            Security and Authorization Audit Log
          </h2>
          <p className="text-xs text-slate-500">
            Chronological record of logins, failed credentials, RBAC denials, role changes, policy updates, and account freezes.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E4E9F2] bg-[#F7F9FC] text-slate-600">
                <th className="py-3 pl-6 pr-3 font-semibold">Timestamp</th>
                <th className="px-3 py-3 font-semibold">Actor</th>
                <th className="px-3 py-3 font-semibold">Action</th>
                <th className="px-3 py-3 font-semibold">Outcome</th>
                <th className="py-3 pl-3 pr-6 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F7]">
              {auditLogs.slice(0, 25).map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap py-3 pl-6 pr-3 font-mono tabular-nums text-slate-500">
                    {formatTimestamp(entry.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="font-mono text-slate-800">{entry.actorEmail}</div>
                    <div className="text-[11px] text-slate-400">{entry.actorRole}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono font-medium text-slate-900">
                    {entry.action}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {entry.outcome === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Allowed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-red-700">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Denied
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-6 text-slate-600">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
