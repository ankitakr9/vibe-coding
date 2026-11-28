import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Database,
  Users,
} from 'lucide-react';
import type {
  AttendanceRecord,
  Course,
  RosterMember,
  UserAccount,
} from '../models/types';
import { formatIsoDateDisplay } from '../models/validation';
import { AttendanceStatusLabel } from '../components/StatusIndicator';

interface OverviewViewProps {
  account: UserAccount;
  courses: Course[];
  roster: RosterMember[];
  attendance: AttendanceRecord[];
  onNavigate: (tab: string) => void;
  onSeedDemoData: () => Promise<void>;
  onSelectStudentTranscript: (member: RosterMember) => void;
}

export function OverviewView({
  account,
  courses,
  roster,
  attendance,
  onNavigate,
  onSeedDemoData,
  onSelectStudentTranscript,
}: OverviewViewProps) {
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const students = useMemo(
    () => roster.filter((m) => m.role === 'student' && m.status === 'active'),
    [roster]
  );

  const activeCourses = useMemo(
    () => courses.filter((c) => c.status === 'active'),
    [courses]
  );

  const metrics = useMemo(() => {
    const total = attendance.length;
    const presentCount = attendance.filter((r) => r.status === 'present').length;
    const lateCount = attendance.filter((r) => r.status === 'late').length;
    const excusedCount = attendance.filter((r) => r.status === 'excused').length;
    const absentCount = attendance.filter((r) => r.status === 'absent').length;
    const attended = presentCount + lateCount + excusedCount;
    const rate = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

    return { total, presentCount, lateCount, excusedCount, absentCount, rate };
  }, [attendance]);

  // Course-by-course attendance breakdown
  const courseSummaries = useMemo(() => {
    const byCourse = new Map<
      string,
      { course: Course; total: number; attended: number; absent: number; latestDate: string }
    >();

    for (const c of activeCourses) {
      byCourse.set(c.id, { course: c, total: 0, attended: 0, absent: 0, latestDate: '' });
    }

    for (const r of attendance) {
      const entry = byCourse.get(r.courseId);
      if (!entry) continue;
      entry.total += 1;
      if (r.status === 'absent') {
        entry.absent += 1;
      } else {
        entry.attended += 1;
      }
      if (!entry.latestDate || r.date > entry.latestDate) {
        entry.latestDate = r.date;
      }
    }

    return Array.from(byCourse.values()).sort((a, b) =>
      a.course.code.localeCompare(b.course.code)
    );
  }, [activeCourses, attendance]);

  // Daily attendance rate series (most recent 7 distinct session dates)
  const dailySeries = useMemo(() => {
    const byDate = new Map<string, { present: number; late: number; excused: number; absent: number; total: number }>();
    for (const r of attendance) {
      const bucket = byDate.get(r.date) ?? { present: 0, late: 0, excused: 0, absent: 0, total: 0 };
      bucket[r.status] += 1;
      bucket.total += 1;
      byDate.set(r.date, bucket);
    }
    return Array.from(byDate.entries())
      .sort(([d1], [d2]) => d1.localeCompare(d2))
      .slice(-7)
      .map(([date, b]) => ({
        date,
        shortLabel: date.slice(5),
        rate: b.total > 0 ? Math.round(((b.present + b.late + b.excused) / b.total) * 100) : 0,
        ...b,
      }));
  }, [attendance]);

  // Students below 75% attendance threshold (for Admin & Faculty)
  const belowThresholdStudents = useMemo(() => {
    if (account.role === 'student') return [];
    const byStudent = new Map<string, { total: number; attended: number }>();
    for (const r of attendance) {
      const cur = byStudent.get(r.studentMemberId) ?? { total: 0, attended: 0 };
      cur.total += 1;
      if (r.status !== 'absent') cur.attended += 1;
      byStudent.set(r.studentMemberId, cur);
    }

    return students
      .map((member) => {
        const stat = byStudent.get(member.id) ?? { total: 0, attended: 0 };
        const rate = stat.total > 0 ? Math.round((stat.attended / stat.total) * 1000) / 10 : 100;
        return { member, ...stat, rate };
      })
      .filter((item) => item.total > 0 && item.rate < 75)
      .sort((a, b) => a.rate - b.rate);
  }, [account.role, attendance, students]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      await onSeedDemoData();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Unable to load sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const isEmptyWorkspace = courses.length === 0 && roster.length === 0 && attendance.length === 0;

  return (
    <div className="space-y-8">
      {/* Empty state for fresh workspace */}
      {isEmptyWorkspace && (
        <section className="bg-white border border-slate-200 rounded-lg p-8">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {account.role === 'admin'
                ? 'Initialize Your Attendance Workspace'
                : 'No Attendance Records Yet'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {account.role === 'admin'
                ? 'Start by adding students, faculty, and courses manually, or load a sample academic dataset with 3 courses, 8 students, 2 faculty members, and 5 days of attendance history.'
                : account.role === 'faculty'
                  ? 'Once an administrator assigns courses and students to your account, your classes and roll-call sheets will appear here.'
                  : 'Your attendance history will appear here as soon as an administrator links your account to a student roster entry and records your first session.'}
            </p>
            {seedError && (
              <p className="text-sm text-[#B91C1C] mb-4">{seedError}</p>
            )}
            {account.role === 'admin' && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>{seeding ? 'Loading Sample Data...' : 'Load Sample Academic Data'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('directory')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Add First Member</span>
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4-column Metric Strip (Flat single-elevation surface with hairline dividers) */}
      <section className="bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-6">
          <p className="text-xs font-medium text-slate-500 mb-2">
            {account.role === 'student' ? 'Personal Attendance Rate' : 'Overall Attendance Rate'}
          </p>
          <p className="text-3xl font-bold text-[#0F172A] font-mono tabular-nums tracking-tight">
            {metrics.total > 0 ? `${metrics.rate.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.presentCount} present · {metrics.lateCount} late · {metrics.excusedCount} excused
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500 mb-2">Total Entries Logged</p>
          <p className="text-3xl font-bold text-[#0F172A] font-mono tabular-nums tracking-tight">
            {metrics.total}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {metrics.absentCount} absences recorded
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500 mb-2">
            {account.role === 'student' ? 'Active Courses' : 'Active Courses & Roster'}
          </p>
          <p className="text-3xl font-bold text-[#0F172A] font-mono tabular-nums tracking-tight">
            {activeCourses.length}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {account.role === 'student'
              ? 'Enrolled term catalog'
              : `${students.length} active students tracked`}
          </p>
        </div>

        <div className="p-6">
          <p className="text-xs font-medium text-slate-500 mb-2">
            {account.role === 'student' ? 'Standing Status' : 'Below 75% Threshold'}
          </p>
          {account.role === 'student' ? (
            <>
              <p
                className={`text-2xl font-bold tracking-tight ${
                  metrics.total === 0
                    ? 'text-slate-400'
                    : metrics.rate >= 75
                      ? 'text-[#15803D]'
                      : 'text-[#B91C1C]'
                }`}
              >
                {metrics.total === 0
                  ? 'No Data'
                  : metrics.rate >= 75
                    ? 'Good Standing'
                    : 'Action Needed'}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Minimum institutional requirement: 75%
              </p>
            </>
          ) : (
            <>
              <p
                className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${
                  belowThresholdStudents.length > 0 ? 'text-[#B91C1C]' : 'text-[#0F172A]'
                }`}
              >
                {belowThresholdStudents.length}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {belowThresholdStudents.length === 0
                  ? 'All tracked students on pace'
                  : 'Students needing follow-up'}
              </p>
            </>
          )}
        </div>
      </section>

      {/* Main 2-column Analytical Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Daily Attendance Cadence Chart */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Session Attendance Rate
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily attendance ratio across the latest recorded sessions
              </p>
            </div>
            {(account.role === 'admin' || account.role === 'faculty') && (
              <button
                type="button"
                onClick={() => onNavigate('rollcall')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Take Roll Call</span>
              </button>
            )}
          </div>

          {dailySeries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No dated sessions logged yet.
            </div>
          ) : (
            <div className="space-y-4">
              {dailySeries.map((day) => (
                <div key={day.date} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-3 sm:col-span-2 text-xs font-mono tabular-nums text-slate-600">
                    {day.shortLabel}
                  </div>
                  <div className="col-span-6 sm:col-span-7">
                    <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          day.rate >= 85
                            ? 'bg-[#16A34A]'
                            : day.rate >= 75
                              ? 'bg-[#D97706]'
                              : 'bg-[#DC2626]'
                        }`}
                        style={{ width: `${day.rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-3 text-right text-xs font-mono tabular-nums text-slate-700">
                    <span className="font-semibold">{day.rate}%</span>
                    <span className="text-slate-400 ml-1.5">
                      ({day.present + day.late + day.excused}/{day.total})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Course Breakdown or Below-Threshold Watchlist */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {account.role === 'student' ? 'Course Standing' : 'Attendance Watchlist (< 75%)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {account.role === 'student'
                  ? 'Your attendance ratio by course'
                  : 'Students currently below the 75% attendance requirement'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(account.role === 'student' ? 'records' : 'directory')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {account.role === 'student' ? (
            courseSummaries.filter((c) => c.total > 0).length === 0 ? (
              <p className="py-8 text-sm text-slate-500 text-center">
                No course attendance logged for your account yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {courseSummaries
                  .filter((c) => c.total > 0)
                  .map(({ course, total, attended }) => {
                    const pct = Math.round((attended / total) * 1000) / 10;
                    return (
                      <li key={course.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {course.code} · {course.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {attended} of {total} sessions attended
                          </p>
                        </div>
                        <span
                          className={`text-sm font-mono font-semibold tabular-nums shrink-0 ${
                            pct >= 75 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                          }`}
                        >
                          {pct.toFixed(1)}%
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )
          ) : belowThresholdStudents.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-slate-700">No students flagged</p>
              <p className="text-xs text-slate-500 mt-1">
                Every student with recorded sessions is at or above 75%.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {belowThresholdStudents.slice(0, 6).map(({ member, total, attended, rate }) => (
                <li key={member.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectStudentTranscript(member)}
                      className="text-sm font-medium text-slate-900 hover:text-[#1D4ED8] hover:underline text-left truncate block cursor-pointer"
                    >
                      {member.fullName}
                    </button>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      {member.memberCode} · {attended}/{total} sessions
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums text-[#B91C1C] shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{rate.toFixed(1)}%</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Course Summary Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Course Attendance Summary
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('courses')}
            className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Manage Courses
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Course</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Instructor</th>
                <th className="py-3 px-4 text-right">Records</th>
                <th className="py-3 px-4 text-right">Attendance Rate</th>
                <th className="py-3 px-6 text-right">Last Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {courseSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-6 text-center text-slate-500">
                    No active courses configured.
                  </td>
                </tr>
              ) : (
                courseSummaries.map(({ course, total, attended, latestDate }) => {
                  const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : null;
                  return (
                    <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6">
                        <span className="font-mono text-xs font-semibold text-slate-700 mr-2">
                          {course.code}
                        </span>
                        <span className="font-medium text-slate-900">{course.title}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{course.department}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {course.facultyName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                        {pct === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={pct >= 75 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                            {pct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right text-xs font-mono tabular-nums text-slate-500">
                        {latestDate ? formatIsoDateDisplay(latestDate) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Latest Activity Ledger */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">Latest Attendance Entries</h2>
          <button
            type="button"
            onClick={() => onNavigate('records')}
            className="text-xs font-medium text-[#1D4ED8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Full History
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-6 text-center text-slate-500">
                    No attendance records available.
                  </td>
                </tr>
              ) : (
                attendance.slice(0, 8).map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-6 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-slate-900">{rec.studentName}</span>
                      <span className="text-xs font-mono text-slate-400 ml-2">
                        {rec.studentCode}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      <span className="font-mono text-xs text-slate-500 mr-1.5">
                        {rec.courseCode}
                      </span>
                      <span>{rec.courseTitle}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <AttendanceStatusLabel status={rec.status} />
                    </td>
                    <td className="py-2.5 px-6 text-xs text-slate-500 max-w-xs truncate">
                      {rec.remarks || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
