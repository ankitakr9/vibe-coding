import { useMemo, useState } from 'react';
import {
  Edit3,
  FileText,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AccountStatus,
  AttendanceRecord,
  RosterMember,
  RosterRole,
  UserAccount,
  UserRole,
} from '../models/types';
import {
  createRosterMember,
  deleteRosterMember,
  deleteUserAccountByAdmin,
  getRosterPrivateContact,
  updateRosterMember,
  updateUserAccountByAdmin,
} from '../controllers/attendanceController';
import { formatRoleLabel } from '../components/StatusIndicator';

interface DirectoryViewProps {
  account: UserAccount;
  roster: RosterMember[];
  userAccounts: UserAccount[];
  attendance: AttendanceRecord[];
  onSelectStudentTranscript: (member: RosterMember) => void;
}

interface RosterFormState {
  fullName: string;
  memberCode: string;
  role: RosterRole;
  department: string;
  batchOrTitle: string;
  status: AccountStatus;
  linkedUid: string;
  email: string;
  phone: string;
}

const EMPTY_ROSTER_FORM: RosterFormState = {
  fullName: '',
  memberCode: '',
  role: 'student',
  department: 'Computer Science',
  batchOrTitle: 'Batch 2026 · Sem 5',
  status: 'active',
  linkedUid: '',
  email: '',
  phone: '',
};

export function DirectoryView({
  account,
  roster,
  userAccounts,
  attendance,
  onSelectStudentTranscript,
}: DirectoryViewProps) {
  const isAdmin = account.role === 'admin';
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'accounts'>('roster');
  const [roleFilter, setRoleFilter] = useState<'all' | RosterRole>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Roster modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<RosterMember | null>(null);
  const [form, setForm] = useState<RosterFormState>(EMPTY_ROSTER_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // User RBAC edit modal
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [acctRole, setAcctRole] = useState<UserRole>('student');
  const [acctDept, setAcctDept] = useState('');
  const [acctCode, setAcctCode] = useState('');
  const [acctStatus, setAcctStatus] = useState<AccountStatus>('active');
  const [acctName, setAcctName] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'roster'; id: string; label: string } | { kind: 'account'; id: string; label: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  // Attendance stats per student
  const studentStats = useMemo(() => {
    const map = new Map<string, { total: number; attended: number }>();
    for (const r of attendance) {
      const cur = map.get(r.studentMemberId) ?? { total: 0, attended: 0 };
      cur.total += 1;
      if (r.status !== 'absent') cur.attended += 1;
      map.set(r.studentMemberId, cur);
    }
    return map;
  }, [attendance]);

  const facultyUids = useMemo(() => {
    const set = new Set<string>();
    set.add(account.uid);
    for (const u of userAccounts) {
      if (u.role === 'faculty' || u.role === 'admin') set.add(u.uid);
    }
    return Array.from(set).slice(0, 20);
  }, [account.uid, userAccounts]);

  const filteredRoster = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roster.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.batchOrTitle.toLowerCase().includes(q)
      );
    });
  }, [roster, roleFilter, searchQuery]);

  const openCreateModal = () => {
    setFormError(null);
    setEditingMember(null);
    setForm(EMPTY_ROSTER_FORM);
    setModalOpen(true);
  };

  const openEditMemberModal = async (member: RosterMember) => {
    setFormError(null);
    setEditingMember(member);
    setForm({
      fullName: member.fullName,
      memberCode: member.memberCode,
      role: member.role,
      department: member.department,
      batchOrTitle: member.batchOrTitle,
      status: member.status,
      linkedUid: member.linkedUid,
      email: '',
      phone: '',
    });
    setModalOpen(true);

    if (isAdmin) {
      try {
        const contact = await getRosterPrivateContact(member.id);
        if (contact) {
          setForm((prev) => ({
            ...prev,
            email: contact.email || '',
            phone: contact.phone || '',
          }));
        }
      } catch {
        // Optional contact record
      }
    }
  };

  const handleSaveRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingMember) {
        await updateRosterMember(editingMember.id, {
          ...form,
          assignedFacultyUids: editingMember.assignedFacultyUids.length
            ? editingMember.assignedFacultyUids
            : facultyUids,
        });
      } else {
        await createRosterMember(account.uid, {
          ...form,
          assignedFacultyUids: facultyUids,
        });
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save member record.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditAccountModal = (u: UserAccount) => {
    setFormError(null);
    setEditingAccount(u);
    setAcctName(u.displayName);
    setAcctRole(u.role);
    setAcctDept(u.department);
    setAcctCode(u.memberCode);
    setAcctStatus(u.status);
  };

  const handleSaveAccountRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await updateUserAccountByAdmin(editingAccount.uid, {
        displayName: acctName,
        role: acctRole,
        department: acctDept,
        memberCode: acctCode,
        status: acctStatus,
      });
      setEditingAccount(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to update user role.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'roster') {
        await deleteRosterMember(deleteTarget.id);
      } else {
        await deleteUserAccountByAdmin(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation & Search Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setActiveSubTab('roster')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSubTab === 'roster'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Institutional Roster ({roster.length})
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveSubTab('accounts')}
                className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSubTab === 'accounts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Signed-In Accounts &amp; Roles ({userAccounts.length})
              </button>
            )}
          </div>

          {activeSubTab === 'roster' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search roster..."
                  className="h-9 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none w-56"
                />
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                {(['all', 'student', 'faculty'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      roleFilter === r
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r === 'all' ? 'All' : r === 'student' ? 'Students' : 'Faculty'}
                  </button>
                ))}
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Roster Table */}
      {activeSubTab === 'roster' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Member</th>
                  <th className="py-3 px-4">ID Code</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Cohort / Title</th>
                  <th className="py-3 px-4 text-right">Attendance</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 px-6 text-center text-slate-500">
                      No roster members found.
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((member) => {
                    const stat = studentStats.get(member.id);
                    const pct =
                      stat && stat.total > 0
                        ? Math.round((stat.attended / stat.total) * 1000) / 10
                        : null;
                    return (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-6">
                          <p className="font-medium text-slate-900">{member.fullName}</p>
                          <p className="text-xs text-slate-400">
                            {member.status === 'active' ? 'Active' : 'Inactive'}
                            {member.linkedUid ? ' · Account Linked' : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                          {member.memberCode}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                          {formatRoleLabel(member.role)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{member.department}</td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {member.batchOrTitle || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          {member.role === 'faculty' ? (
                            <span className="text-slate-400">—</span>
                          ) : pct === null ? (
                            <span className="text-slate-400">No logs</span>
                          ) : (
                            <span
                              className={`font-semibold ${
                                pct >= 75 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                              }`}
                            >
                              {pct.toFixed(1)}% ({stat!.attended}/{stat!.total})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {member.role === 'student' && (
                              <button
                                type="button"
                                onClick={() => onSelectStudentTranscript(member)}
                                title="Inspect Attendance Transcript"
                                className="p-2 text-slate-500 hover:text-[#1D4ED8] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditMemberModal(member)}
                                  title="Edit Member"
                                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      kind: 'roster',
                                      id: member.id,
                                      label: `${member.fullName} (${member.memberCode})`,
                                    })
                                  }
                                  title="Delete Member"
                                  className="p-2 text-slate-500 hover:text-[#B91C1C] hover:bg-red-50 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Signed-In User Accounts & RBAC Table (Admin Only) */}
      {activeSubTab === 'accounts' && isAdmin && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1D4ED8]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Role-Based Access Control (Authenticated Accounts)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Assign Administrator, Faculty, or Student permissions. New Google sign-ins default to Student until promoted here.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {userAccounts.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6">
                      <p className="font-medium text-slate-900">
                        {u.displayName}
                        {u.uid === account.uid && (
                          <span className="text-xs text-slate-400 ml-2">(You)</span>
                        )}
                      </p>
                      <p className="text-xs font-mono text-slate-400 truncate max-w-[220px]">
                        UID: {u.uid}
                      </p>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {formatRoleLabel(u.role)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.department || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {u.memberCode || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 capitalize">{u.status}</td>
                    <td className="py-3 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditAccountModal(u)}
                          className="p-2 text-slate-500 hover:text-[#1D4ED8] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Edit Role & Account"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.uid !== account.uid && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'account',
                                id: u.uid,
                                label: `${u.displayName} (${formatRoleLabel(u.role)})`,
                              })
                            }
                            className="p-2 text-slate-500 hover:text-[#B91C1C] hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Remove User Account Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Add / Edit Roster Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingMember ? 'Edit Roster Member' : 'Add Roster Member'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 px-3 py-2.5 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveRoster} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g., Aarav Sharma"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Roll / Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={form.memberCode}
                    onChange={(e) => setForm((f) => ({ ...f, memberCode: e.target.value }))}
                    placeholder="e.g., CS-2026-109"
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Directory Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RosterRole }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as AccountStatus }))
                    }
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="e.g., Computer Science"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Cohort / Title
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={form.batchOrTitle}
                    onChange={(e) => setForm((f) => ({ ...f, batchOrTitle: e.target.value }))}
                    placeholder="e.g., Batch 2026 · Sem 5"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Link to Signed-In Account (Optional)
                </label>
                <select
                  value={form.linkedUid}
                  onChange={(e) => setForm((f) => ({ ...f, linkedUid: e.target.value }))}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option value="">Not linked to a Google account yet</option>
                  {userAccounts.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({formatRoleLabel(u.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-3">
                  Private Contact Details (Stored in Admin-Isolated Subcollection)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      maxLength={160}
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="name@institution.edu"
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      maxLength={30}
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+1 555-0100"
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingMember
                      ? 'Save Changes'
                      : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Signed-In Account Role Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                Manage Account Access &amp; Role
              </h3>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 px-3 py-2.5 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveAccountRole} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={acctName}
                  onChange={(e) => setAcctName(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={acctRole}
                    onChange={(e) => setAcctRole(e.target.value as UserRole)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Account Status
                  </label>
                  <select
                    value={acctStatus}
                    onChange={(e) => setAcctStatus(e.target.value as AccountStatus)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={acctDept}
                    onChange={(e) => setAcctDept(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Member Code
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={acctCode}
                    onChange={(e) => setAcctCode(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Update Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Are you sure you want to remove{' '}
              <strong className="text-slate-900">{deleteTarget.label}</strong>? Existing
              attendance history records will remain intact for audit purposes.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#B91C1C] rounded-md hover:bg-red-800 disabled:opacity-60 cursor-pointer"
              >
                {deleting ? 'Removing...' : 'Remove Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
