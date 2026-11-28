import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'faculty' | 'student';
export type RosterRole = 'student' | 'faculty';
export type AccountStatus = 'active' | 'inactive';
export type CourseStatus = 'active' | 'archived';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface UserAccount {
  uid: string;
  displayName: string;
  role: UserRole;
  department: string;
  memberCode: string;
  status: AccountStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  phone: string;
  updatedAt?: Timestamp | null;
}

export interface RosterMember {
  id: string;
  fullName: string;
  memberCode: string;
  role: RosterRole;
  department: string;
  batchOrTitle: string;
  status: AccountStatus;
  linkedUid: string;
  assignedFacultyUids: string[];
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface RosterPrivateContact {
  memberId: string;
  email: string;
  phone: string;
  updatedAt?: Timestamp | null;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  semester: string;
  schedule: string;
  facultyMemberId: string;
  facultyName: string;
  facultyUid: string;
  status: CourseStatus;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  studentMemberId: string;
  studentName: string;
  studentCode: string;
  studentUid: string;
  facultyUid: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks: string;
  markedByUid: string;
  markedByName: string;
  locked: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
