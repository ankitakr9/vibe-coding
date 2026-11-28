/**
 * Security Rules Verification Specification (Dirty Dozen Adversarial Suite)
 *
 * Documents the 12 adversarial payloads tested against firestore.rules.
 * Run against the Firebase Emulator Suite when available.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  actor: {
    uid: string;
    email: string;
    email_verified: boolean;
    role: 'admin' | 'faculty' | 'student' | 'anonymous';
  };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcingGate: string;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Self-Role Escalation on User Create',
    actor: { uid: 'stu_1', email: 'eve@example.edu', email_verified: true, role: 'student' },
    operation: 'create',
    path: '/users/stu_1',
    payload: {
      uid: 'stu_1',
      displayName: 'Eve',
      role: 'admin',
      department: 'CS',
      memberCode: 'STU-999',
      status: 'active',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'incoming().role == "student" for non-bootstrap users',
  },
  {
    id: 2,
    name: 'Self-Role Escalation on User Update',
    actor: { uid: 'stu_1', email: 'eve@example.edu', email_verified: true, role: 'student' },
    operation: 'update',
    path: '/users/stu_1',
    payload: { role: 'faculty' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'affectedKeys().hasOnly(["displayName", "department", "updatedAt"])',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Course Create',
    actor: { uid: 'admin_1', email: 'ak95349135@gmail.com', email_verified: true, role: 'admin' },
    operation: 'create',
    path: '/courses/cs101',
    payload: {
      id: 'cs101',
      code: 'CS-101',
      title: 'Algorithms',
      department: 'CS',
      semester: 'Fall 2026',
      schedule: 'Mon 10:00',
      facultyMemberId: '',
      facultyName: '',
      facultyUid: '',
      status: 'active',
      createdBy: 'admin_1',
      isVerified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'isValidCourse() hasOnly(...) strict key blueprint',
  },
  {
    id: 4,
    name: 'Unverified Email Admin Spoof',
    actor: { uid: 'spoof_1', email: 'ak95349135@gmail.com', email_verified: false, role: 'student' },
    operation: 'create',
    path: '/roster/mem_1',
    payload: { id: 'mem_1', fullName: 'Spoofed' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'isVerifiedUser() enforces request.auth.token.email_verified == true',
  },
  {
    id: 5,
    name: 'Cross-User PII Read',
    actor: { uid: 'fac_1', email: 'prof@example.edu', email_verified: true, role: 'faculty' },
    operation: 'get',
    path: '/users/stu_1/private/info',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'users/{userId}/private/{docId} restricts read to isOwner(userId) || isAdmin()',
  },
  {
    id: 6,
    name: 'Orphaned Attendance Record Creation',
    actor: { uid: 'fac_1', email: 'prof@example.edu', email_verified: true, role: 'faculty' },
    operation: 'create',
    path: '/attendance/nonexistent_stu1_2026-11-27',
    payload: { courseId: 'nonexistent', studentMemberId: 'stu1', date: '2026-11-27', status: 'present' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'exists(/databases/$(database)/documents/courses/$(incoming().courseId))',
  },
  {
    id: 7,
    name: 'Terminal State Locked Record Modification by Faculty',
    actor: { uid: 'fac_1', email: 'prof@example.edu', email_verified: true, role: 'faculty' },
    operation: 'update',
    path: '/attendance/cs101_stu1_2026-11-27',
    payload: { status: 'present', remarks: 'Changed after lock' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'existing().locked == false for non-admin updates',
  },
  {
    id: 8,
    name: 'Student Self-Marking Attendance',
    actor: { uid: 'stu_1', email: 'stu@example.edu', email_verified: true, role: 'student' },
    operation: 'create',
    path: '/attendance/cs101_stu1_2026-11-27',
    payload: { status: 'present' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'allow create requires isAdmin() || isFaculty()',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    actor: { uid: 'admin_1', email: 'ak95349135@gmail.com', email_verified: true, role: 'admin' },
    operation: 'create',
    path: '/courses/invalid$id!payload',
    payload: { id: 'invalid$id!payload' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'isValidId(courseId) matches ^[a-zA-Z0-9_\\-]+$',
  },
  {
    id: 10,
    name: 'Remarks Value Size Poisoning',
    actor: { uid: 'fac_1', email: 'prof@example.edu', email_verified: true, role: 'faculty' },
    operation: 'update',
    path: '/attendance/cs101_stu1_2026-11-27',
    payload: { remarks: 'x'.repeat(500) },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'isValidAttendanceRecord() enforces remarks.size() <= 300',
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery',
    actor: { uid: 'admin_1', email: 'ak95349135@gmail.com', email_verified: true, role: 'admin' },
    operation: 'create',
    path: '/courses/cs102',
    payload: { createdAt: '2020-01-01T00:00:00.000Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'incoming().createdAt == request.time',
  },
  {
    id: 12,
    name: 'Student Blanket Attendance List Scraping',
    actor: { uid: 'stu_1', email: 'stu@example.edu', email_verified: true, role: 'student' },
    operation: 'list',
    path: '/attendance',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcingGate: 'allow list requires resource.data.studentUid == request.auth.uid for students',
  },
];
