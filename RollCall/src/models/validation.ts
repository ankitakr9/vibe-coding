/**
 * Defensive payload validation constants and sanitizers synchronized verbatim
 * with firebase-blueprint.json and firestore.rules.
 */

export const FIELD_LIMITS = {
  id: { min: 1, max: 128 },
  displayName: { min: 1, max: 100 },
  fullName: { min: 1, max: 100 },
  department: { min: 1, max: 80 },
  memberCode: { min: 1, max: 32 },
  batchOrTitle: { min: 0, max: 80 },
  email: { min: 0, max: 160 },
  phone: { min: 0, max: 30 },
  courseCode: { min: 2, max: 24 },
  courseTitle: { min: 2, max: 120 },
  semester: { min: 1, max: 40 },
  schedule: { min: 0, max: 80 },
  remarks: { min: 0, max: 300 },
  assignedFacultyUidsMax: 20,
} as const;

export const PATTERNS = {
  id: /^[a-zA-Z0-9_\-]+$/,
  optionalId: /^[a-zA-Z0-9_\-]*$/,
  memberCode: /^[a-zA-Z0-9_\-]+$/,
  optionalMemberCode: /^[a-zA-Z0-9_\-]*$/,
  courseCode: /^[a-zA-Z0-9_\- ]+$/,
  isoDate: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
} as const;

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeIdSegment(value: string, maxLength = 48): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (cleaned || 'item').slice(0, maxLength);
}

export function sanitizeCode(value: string, maxLength = 32): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength);
}

export function sanitizeCourseCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\- ]/g, '')
    .slice(0, FIELD_LIMITS.courseCode.max);
}

export function buildAttendanceRecordId(
  courseId: string,
  studentMemberId: string,
  date: string
): string {
  const raw = `${sanitizeIdSegment(courseId, 44)}_${sanitizeIdSegment(studentMemberId, 44)}_${date}`;
  return raw.slice(0, FIELD_LIMITS.id.max);
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIsoDateDisplay(isoDate: string): string {
  if (!PATTERNS.isoDate.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function escapeCsvCell(value: string | number | boolean): string {
  let str = String(value ?? '');
  // Neutralize spreadsheet formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
