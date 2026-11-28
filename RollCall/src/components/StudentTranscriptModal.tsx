import { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import type { AttendanceRecord, RosterMember } from '../models/types';
import { exportAttendanceToCsv } from '../controllers/attendanceController';
import { AttendanceStatusLabel } from './StatusIndicator';

interface StudentTranscriptModalProps {
  student: RosterMember | null;
  attendance: AttendanceRecord[];
  onClose: () => void;
}

export function StudentTranscriptModal({
  student,
  attendance,
  onClose,
}: StudentTranscriptModalProps) {
  const studentRecords = useMemo(() => {
    if (!student) return [];
    return attendance
      .filter((r) => r.studentMemberId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [student, attendance]);

  const stats = useMemo(() => {
    const total = studentRecords.length;
    const present = studentRecords.filter((r) => r.status === 'present').length;
    const late = studentRecords.filter((r) => r.status === 'late').length;
    const excused = studentRecords.filter((r) => r.status === 'excused').length;
    const absent = studentRecords.filter((r) => r.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late + excused) / total) * 1000) / 10 : 0;
    return { total, present, late, excused, absent, rate };
  }, [studentRecords]);

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {student.fullName} — Attendance Transcript
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {student.memberCode} · {student.department} · {student.batchOrTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={studentRecords.length === 0}
              onClick={() =>
                exportAttendanceToCsv(
                  studentRecords,
                  `transcript_${student.memberCode.toLowerCase()}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              aria-label="Close transcript"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
          <div className="p-4">
            <p className="text-xs text-slate-500">Rate</p>
            <p
              className={`text-lg font-bold font-mono tabular-nums ${
                stats.total === 0
                  ? 'text-slate-400'
                  : stats.rate >= 75
                    ? 'text-[#15803D]'
                    : 'text-[#B91C1C]'
              }`}
            >
              {stats.total > 0 ? `${stats.rate.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Present</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {stats.present}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Late</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {stats.late}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Excused</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {stats.excused}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500">Absent</p>
            <p className="text-lg font-bold font-mono tabular-nums text-[#B91C1C]">
              {stats.absent}
            </p>
          </div>
        </div>

        {/* History table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b border-slate-200">
              <tr className="text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {studentRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 px-6 text-center text-slate-500">
                    No attendance sessions recorded for this student.
                  </td>
                </tr>
              ) : (
                studentRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-6 font-mono text-xs tabular-nums text-slate-600">
                      {rec.date}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      <span className="font-mono text-xs font-semibold mr-1.5">
                        {rec.courseCode}
                      </span>
                      <span>{rec.courseTitle}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <AttendanceStatusLabel status={rec.status} />
                    </td>
                    <td className="py-2.5 px-6 text-xs text-slate-500">
                      {rec.remarks || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
