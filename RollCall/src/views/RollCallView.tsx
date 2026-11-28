import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Lock, Save, Search } from 'lucide-react';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Course,
  RosterMember,
  UserAccount,
} from '../models/types';
import { getTodayIsoDate } from '../models/validation';
import {
  saveAttendanceSheet,
  type RollCallEntryDraft,
} from '../controllers/attendanceController';

interface RollCallViewProps {
  account: UserAccount;
  courses: Course[];
  roster: RosterMember[];
  attendance: AttendanceRecord[];
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: 'Present', activeClass: 'bg-[#15803D] text-white' },
  { value: 'late', label: 'Late', activeClass: 'bg-[#B45309] text-white' },
  { value: 'excused', label: 'Excused', activeClass: 'bg-[#1D4ED8] text-white' },
  { value: 'absent', label: 'Absent', activeClass: 'bg-[#B91C1C] text-white' },
];

export function RollCallView({
  account,
  courses,
  roster,
  attendance,
}: RollCallViewProps) {
  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses]
  );
  const activeStudents = useMemo(
    () => roster.filter((m) => m.role === 'student' && m.status === 'active'),
    [roster]
  );

  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [searchQuery, setSearchQuery] = useState('');
  const [drafts, setDrafts] = useState<
    Record<string, { status: AttendanceStatus; remarks: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Pick first active course automatically
  useEffect(() => {
    if (!selectedCourseId && activeCourses.length > 0) {
      setSelectedCourseId(activeCourses[0].id);
    }
  }, [activeCourses, selectedCourseId]);

  const selectedCourse = useMemo(
    () => activeCourses.find((c) => c.id === selectedCourseId) ?? null,
    [activeCourses, selectedCourseId]
  );

  // Existing records for selected course + date
  const existingByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of attendance) {
      if (r.courseId === selectedCourseId && r.date === selectedDate) {
        map.set(r.studentMemberId, r);
      }
    }
    return map;
  }, [attendance, selectedCourseId, selectedDate]);

  // Reset drafts whenever course, date, or underlying records change
  useEffect(() => {
    const next: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    for (const stu of activeStudents) {
      const existing = existingByStudent.get(stu.id);
      next[stu.id] = {
        status: existing ? existing.status : 'present',
        remarks: existing ? existing.remarks : '',
      };
    }
    setDrafts(next);
    setFeedback(null);
  }, [activeStudents, existingByStudent, selectedCourseId, selectedDate]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeStudents;
    return activeStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.memberCode.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [activeStudents, searchQuery]);

  const sheetStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let excused = 0;
    let absent = 0;
    for (const stu of activeStudents) {
      const st = drafts[stu.id]?.status ?? 'present';
      if (st === 'present') present += 1;
      else if (st === 'late') late += 1;
      else if (st === 'excused') excused += 1;
      else absent += 1;
    }
    return { present, late, excused, absent, total: activeStudents.length };
  }, [activeStudents, drafts]);

  const handleMarkAll = (status: AttendanceStatus) => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const stu of filteredStudents) {
        const existing = existingByStudent.get(stu.id);
        if (existing?.locked && account.role !== 'admin') continue;
        next[stu.id] = {
          status,
          remarks: prev[stu.id]?.remarks ?? '',
        };
      }
      return next;
    });
  };

  const handleSaveSheet = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    setFeedback(null);

    try {
      const entries: RollCallEntryDraft[] = activeStudents.map((stu) => ({
        student: stu,
        status: drafts[stu.id]?.status ?? 'present',
        remarks: drafts[stu.id]?.remarks ?? '',
        existingRecord: existingByStudent.get(stu.id),
      }));

      const res = await saveAttendanceSheet(account, selectedCourse, selectedDate, entries);
      const parts: string[] = [];
      if (res.created > 0) parts.push(`${res.created} recorded`);
      if (res.updated > 0) parts.push(`${res.updated} updated`);
      if (res.skippedLocked > 0) parts.push(`${res.skippedLocked} locked skipped`);

      setFeedback({
        type: 'success',
        text: `Attendance saved for ${selectedCourse.code} on ${selectedDate} (${parts.join(', ')}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save attendance sheet.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (activeCourses.length === 0 || activeStudents.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900 mb-2">
          Roll Call Requires Active Courses &amp; Students
        </h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Add at least one active course and one active student in the Directory before
          recording daily attendance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Toolbar */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label
              htmlFor="rollcall-course"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Course / Class
            </label>
            <select
              id="rollcall-course"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            >
              {activeCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="rollcall-date"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Session Date
            </label>
            <input
              id="rollcall-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <label
              htmlFor="rollcall-search"
              className="block text-xs font-medium text-slate-600 mb-1.5"
            >
              Filter Roster
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="rollcall-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student name or ID..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Summary Line & Bulk Actions */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono tabular-nums">
            <span>
              Roster: <strong className="text-slate-900">{sheetStats.total}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#15803D]">
              Present: <strong>{sheetStats.present}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#B45309]">
              Late: <strong>{sheetStats.late}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#1D4ED8]">
              Excused: <strong>{sheetStats.excused}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[#B91C1C]">
              Absent: <strong>{sheetStats.absent}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleMarkAll('present')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>
            <button
              type="button"
              onClick={handleSaveSheet}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Attendance Sheet'}</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 px-4 py-3 rounded-md text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-[#15803D]'
                : 'bg-red-50 border-red-200 text-[#B91C1C]'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </section>

      {/* High-Density Roll Call Grid */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Student</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Attendance Status</th>
                <th className="py-3 px-6">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.map((stu) => {
                const existing = existingByStudent.get(stu.id);
                const isLockedForActor = Boolean(existing?.locked && account.role !== 'admin');
                const draft = drafts[stu.id] ?? { status: 'present' as AttendanceStatus, remarks: '' };

                return (
                  <tr key={stu.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{stu.fullName}</span>
                        {existing?.locked && (
                          <span
                            title="Finalized by Admin"
                            className="inline-flex items-center gap-1 text-xs text-slate-500"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Finalized</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                        {stu.memberCode} · {stu.batchOrTitle || 'Enrolled'}
                      </p>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {stu.department}
                    </td>

                    <td className="py-3 px-4">
                      <div
                        role="group"
                        aria-label={`Attendance status for ${stu.fullName}`}
                        className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-md"
                      >
                        {STATUS_OPTIONS.map((opt) => {
                          const active = draft.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isLockedForActor}
                              onClick={() =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [stu.id]: {
                                    status: opt.value,
                                    remarks: prev[stu.id]?.remarks ?? '',
                                  },
                                }))
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                active
                                  ? opt.activeClass
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-6 min-w-[220px]">
                      <input
                        type="text"
                        maxLength={300}
                        disabled={isLockedForActor}
                        value={draft.remarks}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [stu.id]: {
                              status: prev[stu.id]?.status ?? 'present',
                              remarks: e.target.value,
                            },
                          }))
                        }
                        placeholder={isLockedForActor ? 'Locked by Admin' : 'Optional note...'}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
