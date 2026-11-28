import { CheckCircle2, Clock, FileCheck2, XCircle } from 'lucide-react';
import type { AttendanceStatus } from '../models/types';

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; textClass: string; barClass: string }
> = {
  present: {
    label: 'Present',
    textClass: 'text-[#15803D]',
    barClass: 'bg-[#16A34A]',
  },
  late: {
    label: 'Late',
    textClass: 'text-[#B45309]',
    barClass: 'bg-[#D97706]',
  },
  excused: {
    label: 'Excused',
    textClass: 'text-[#1D4ED8]',
    barClass: 'bg-[#2563EB]',
  },
  absent: {
    label: 'Absent',
    textClass: 'text-[#B91C1C]',
    barClass: 'bg-[#DC2626]',
  },
};

export function AttendanceStatusLabel({ status }: { status: AttendanceStatus }) {
  const meta = STATUS_META[status];
  const Icon =
    status === 'present'
      ? CheckCircle2
      : status === 'late'
        ? Clock
        : status === 'excused'
          ? FileCheck2
          : XCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.textClass} whitespace-nowrap`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function formatRoleLabel(role: string): string {
  if (role === 'admin') return 'Administrator';
  if (role === 'faculty') return 'Faculty';
  return 'Student';
}
