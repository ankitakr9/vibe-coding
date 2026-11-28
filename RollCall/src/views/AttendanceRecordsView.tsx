import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Lock,
  Search,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Course,
  UserAccount,
} from '../models/types';
import {
  deleteAttendanceRecord,
  exportAttendanceToCsv,
  updateAttendanceRecord,
} from '../controllers/attendanceController';
import { AttendanceStatusLabel } from '../components/StatusIndicator';

interface AttendanceRecordsViewProps {
  account: UserAccount;
  courses: Course[];
  attendance: AttendanceRecord[];
}

const STATUS_FILTERS: { id: 'all' | AttendanceStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'present', label: 'Present' },
  { id: 'late', label: 'Late' },
  { id: 'excused', label: 'Excused' },
  { id: 'absent', label: 'Absent' },
];

export function AttendanceRecordsView({
  account,
  courses,
  attendance,
}: AttendanceRecordsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Edit modal state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editRemarks, setEditRemarks] = useState('');
  const [editLocked, setEditLocked] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation state
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = account.role === 'admin';
  const isFaculty = account.role === 'faculty';

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attendance.filter((r) => {
      if (courseFilter !== 'all' && r.courseId !== courseFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
      if (q) {
        const hay = `${r.studentName} ${r.studentCode} ${r.courseCode} ${r.courseTitle} ${r.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [attendance, courseFilter, statusFilter, fromDate, toDate, searchQuery]);

  const summary = useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter((r) => r.status === 'present').length;
    const late = filteredRecords.filter((r) => r.status === 'late').length;
    const excused = filteredRecords.filter((r) => r.status === 'excused').length;
    const absent = filteredRecords.filter((r) => r.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late + excused) / total) * 1000) / 10 : 0;
    return { total, present, late, excused, absent, rate };
  }, [filteredRecords]);

  const openEditModal = (rec: AttendanceRecord) => {
    setActionError(null);
    setEditingRecord(rec);
    setEditStatus(rec.status);
    setEditRemarks(rec.remarks);
    setEditLocked(rec.locked);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await updateAttendanceRecord(
        editingRecord.id,
        {
          status: editStatus,
          remarks: editRemarks,
          locked: isAdmin ? editLocked : undefined,
        },
        isAdmin
      );
      setEditingRecord(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update record.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickToggleLock = async (rec: AttendanceRecord) => {
    if (!isAdmin) return;
    setActionError(null);
    try {
      await updateAttendanceRecord(
        rec.id,
        { status: rec.status, remarks: rec.remarks, locked: !rec.locked },
        true
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to toggle lock.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteAttendanceRecord(deletingRecord.id);
      setDeletingRecord(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete record.');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCourseFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    courseFilter !== 'all' ||
    statusFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  return (
    <div className="space-y-6">
      {/* Filter & Export Bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label htmlFor="rec-search" className="block text-xs font-medium text-slate-600 mb-1.5">
              Search Records
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rec-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Student, ID, course, or remark..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="rec-course" className="block text-xs font-medium text-slate-600 mb-1.5">
              Course
            </label>
            <select
              id="rec-course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="rec-from" className="block text-xs font-medium text-slate-600 mb-1.5">
              From Date
            </label>
            <input
              id="rec-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-10 px-3 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="rec-to" className="block text-xs font-medium text-slate-600 mb-1.5">
              To Date
            </label>
            <input
              id="rec-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-10 px-3 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={() => exportAttendanceToCsv(filteredRecords)}
              disabled={filteredRecords.length === 0}
              title="Export filtered records to CSV"
              className="h-10 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200">
          <div
            role="tablist"
            aria-label="Filter by attendance status"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md"
          >
            {STATUS_FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-mono tabular-nums">
            <span>
              Showing <strong className="text-slate-900">{summary.total}</strong> records
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Rate: <strong className="text-slate-900">{summary.rate.toFixed(1)}%</strong>
            </span>
            {hasActiveFilters && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-sans font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="px-4 py-3 text-xs font-medium text-[#B91C1C] bg-red-50 border border-red-200 rounded-md"
          >
            {actionError}
          </div>
        )}
      </section>

      {/* Attendance Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-4">Recorded By</th>
                {(isAdmin || isFaculty) && (
                  <th className="py-3 px-6 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin || isFaculty ? 7 : 6}
                    className="py-10 px-6 text-center text-slate-500"
                  >
                    {attendance.length === 0
                      ? 'No attendance records have been logged yet.'
                      : 'No attendance records match the current filters.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const canEdit = isAdmin || (isFaculty && !rec.locked);
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{rec.studentName}</p>
                        <p className="text-xs font-mono text-slate-400">{rec.studentCode}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-semibold text-slate-700 mr-1.5">
                          {rec.courseCode}
                        </span>
                        <span className="text-slate-700">{rec.courseTitle}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <AttendanceStatusLabel status={rec.status} />
                          {rec.locked && (
                            <span
                              title="Finalized attendance record"
                              className="inline-flex items-center gap-1 text-xs text-slate-400"
                            >
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[220px] truncate">
                        {rec.remarks || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {rec.markedByName}
                      </td>
                      {(isAdmin || isFaculty) && (
                        <td className="py-3 px-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleQuickToggleLock(rec)}
                                title={rec.locked ? 'Unlock record' : 'Finalize & lock record'}
                                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              >
                                {rec.locked ? (
                                  <Unlock className="w-4 h-4" />
                                ) : (
                                  <Lock className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => openEditModal(rec)}
                              title={canEdit ? 'Edit record' : 'Locked by Admin'}
                              className="p-2 text-slate-500 hover:text-[#1D4ED8] hover:bg-slate-100 rounded transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setDeletingRecord(rec);
                                }}
                                title="Delete record"
                                className="p-2 text-slate-500 hover:text-[#B91C1C] hover:bg-red-50 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Attendance Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Update Attendance Record
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  {editingRecord.studentName} · {editingRecord.courseCode} · {editingRecord.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="excused">Excused</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Remarks
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Optional justification or session note..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              {isAdmin && (
                <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={editLocked}
                    onChange={(e) => setEditLocked(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0F172A]"
                  />
                  <span>Finalize &amp; lock record (prevents faculty edits)</span>
                </label>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Delete Attendance Record?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              This will permanently remove the attendance entry for{' '}
              <strong className="text-slate-900">{deletingRecord.studentName}</strong> in{' '}
              <strong className="text-slate-900">{deletingRecord.courseCode}</strong> on{' '}
              <span className="font-mono">{deletingRecord.date}</span>.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
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
                {deleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
