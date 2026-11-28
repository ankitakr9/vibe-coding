import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type {
  AccountStatus,
  AttendanceRecord,
  AttendanceStatus,
  Course,
  CourseStatus,
  RosterMember,
  RosterPrivateContact,
  RosterRole,
  UserAccount,
  UserPrivateInfo,
  UserRole,
} from '../models/types';
import {
  buildAttendanceRecordId,
  escapeCsvCell,
  FIELD_LIMITS,
  getTodayIsoDate,
  PATTERNS,
  sanitizeCode,
  sanitizeCourseCode,
  sanitizeIdSegment,
  sanitizeText,
} from '../models/validation';

// ============================================================================
// User Account & Authentication Profile Sync
// ============================================================================

export async function syncUserAccountOnSignIn(
  firebaseUser: User
): Promise<{ account: UserAccount; privateInfo: UserPrivateInfo }> {
  const uid = firebaseUser.uid;
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  const isBootstrap =
    firebaseUser.emailVerified &&
    firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  let account: UserAccount;

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const initialRole: UserRole = isBootstrap ? 'admin' : 'student';
      const displayName = sanitizeText(
        firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member',
        FIELD_LIMITS.displayName.max
      );
      const newDoc = {
        uid,
        displayName,
        role: initialRole,
        department: isBootstrap ? 'Administration' : 'General Studies',
        memberCode: isBootstrap ? 'ADM-001' : '',
        status: 'active' as AccountStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newDoc);
      account = {
        uid,
        displayName,
        role: initialRole,
        department: newDoc.department,
        memberCode: newDoc.memberCode,
        status: 'active',
      };
    } else {
      account = snap.data() as UserAccount;
      // Ensure bootstrap admin always holds admin role
      if (isBootstrap && account.role !== 'admin') {
        await updateDoc(userRef, {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
        account = { ...account, role: 'admin' };
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  let privateInfo: UserPrivateInfo;
  try {
    const privSnap = await getDoc(privateRef);
    const email = sanitizeText(firebaseUser.email || '', FIELD_LIMITS.email.max);
    if (!privSnap.exists()) {
      await setDoc(privateRef, {
        uid,
        email,
        phone: '',
        updatedAt: serverTimestamp(),
      });
      privateInfo = { uid, email, phone: '' };
    } else {
      privateInfo = privSnap.data() as UserPrivateInfo;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  return { account, privateInfo };
}

export async function updateOwnUserProfile(
  uid: string,
  input: { displayName: string; department: string; phone: string; email: string }
): Promise<void> {
  const displayName = sanitizeText(input.displayName, FIELD_LIMITS.displayName.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const phone = sanitizeText(input.phone, FIELD_LIMITS.phone.max);
  const email = sanitizeText(input.email, FIELD_LIMITS.email.max);

  if (displayName.length < FIELD_LIMITS.displayName.min) {
    throw new Error('Display name is required.');
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName,
      department,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'private', 'info'),
      {
        uid,
        email,
        phone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/info`);
  }
}

export async function updateUserAccountByAdmin(
  targetUid: string,
  input: {
    displayName: string;
    role: UserRole;
    department: string;
    memberCode: string;
    status: AccountStatus;
  }
): Promise<void> {
  const displayName = sanitizeText(input.displayName, FIELD_LIMITS.displayName.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const memberCode = input.memberCode.trim()
    ? sanitizeCode(input.memberCode, FIELD_LIMITS.memberCode.max)
    : '';

  if (displayName.length < 1) {
    throw new Error('Display name cannot be empty.');
  }

  try {
    await updateDoc(doc(db, 'users', targetUid), {
      displayName,
      role: input.role,
      department,
      memberCode,
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function deleteUserAccountByAdmin(targetUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${targetUid}`);
  }
}

// ============================================================================
// Real-time Subscriptions (strictly scoped to match Firestore Rules)
// ============================================================================

export function subscribeUserAccounts(
  account: UserAccount,
  isBootstrap: boolean,
  onData: (users: UserAccount[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'users');
  const q = isBootstrap
    ? query(colRef)
    : query(colRef, where('uid', '==', account.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as UserAccount);
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeRoster(
  account: UserAccount,
  isBootstrap: boolean,
  onData: (members: RosterMember[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'roster');
  let q;
  if (isBootstrap) {
    q = query(colRef);
  } else if (account.role === 'admin') {
    q = query(colRef, where('createdBy', '==', account.uid));
  } else if (account.role === 'faculty') {
    q = query(colRef, where('assignedFacultyUids', 'array-contains', account.uid));
  } else {
    q = query(colRef, where('linkedUid', '==', account.uid));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as RosterMember);
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'roster');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeCourses(
  account: UserAccount,
  isBootstrap: boolean,
  onData: (courses: Course[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'courses');
  let q;
  if (isBootstrap) {
    q = query(colRef);
  } else if (account.role === 'faculty') {
    q = query(colRef, where('facultyUid', '==', account.uid));
  } else {
    q = query(colRef, where('status', '==', 'active'));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as Course);
      list.sort((a, b) => a.code.localeCompare(b.code));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'courses');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeAttendance(
  account: UserAccount,
  isBootstrap: boolean,
  onData: (records: AttendanceRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'attendance');
  let q;
  if (isBootstrap) {
    q = query(colRef);
  } else if (account.role === 'faculty') {
    q = query(colRef, where('facultyUid', '==', account.uid));
  } else if (account.role === 'admin') {
    q = query(colRef, where('markedByUid', '==', account.uid));
  } else {
    q = query(colRef, where('studentUid', '==', account.uid));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data() as AttendanceRecord);
      list.sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return a.studentName.localeCompare(b.studentName);
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

// ============================================================================
// Roster Member CRUD (Admin Module)
// ============================================================================

export async function createRosterMember(
  actorUid: string,
  input: {
    fullName: string;
    memberCode: string;
    role: RosterRole;
    department: string;
    batchOrTitle: string;
    status: AccountStatus;
    linkedUid: string;
    assignedFacultyUids: string[];
    email: string;
    phone: string;
  }
): Promise<string> {
  const fullName = sanitizeText(input.fullName, FIELD_LIMITS.fullName.max);
  const memberCode = sanitizeCode(input.memberCode, FIELD_LIMITS.memberCode.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const batchOrTitle = sanitizeText(input.batchOrTitle, FIELD_LIMITS.batchOrTitle.max);
  const linkedUid = input.linkedUid.trim().slice(0, FIELD_LIMITS.id.max);
  const assignedFacultyUids = input.assignedFacultyUids
    .map((u) => u.trim())
    .filter((u) => PATTERNS.id.test(u))
    .slice(0, FIELD_LIMITS.assignedFacultyUidsMax);

  if (!fullName || !memberCode || !department) {
    throw new Error('Full name, ID code, and department are required.');
  }
  if (!PATTERNS.memberCode.test(memberCode)) {
    throw new Error('ID code may only contain letters, numbers, hyphens, and underscores.');
  }
  if (linkedUid && !PATTERNS.optionalId.test(linkedUid)) {
    throw new Error('Linked account UID contains invalid characters.');
  }

  const id = `${input.role === 'student' ? 'stu' : 'fac'}_${sanitizeIdSegment(memberCode, 28)}_${Date.now().toString(36)}`;
  const path = `roster/${id}`;

  try {
    await setDoc(doc(db, 'roster', id), {
      id,
      fullName,
      memberCode,
      role: input.role,
      department,
      batchOrTitle,
      status: input.status,
      linkedUid,
      assignedFacultyUids,
      createdBy: actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  const email = sanitizeText(input.email, FIELD_LIMITS.email.max);
  const phone = sanitizeText(input.phone, FIELD_LIMITS.phone.max);
  if (email || phone) {
    try {
      await setDoc(doc(db, 'roster', id, 'private', 'contact'), {
        memberId: id,
        email,
        phone,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `roster/${id}/private/contact`);
    }
  }

  return id;
}

export async function updateRosterMember(
  memberId: string,
  input: {
    fullName: string;
    memberCode: string;
    role: RosterRole;
    department: string;
    batchOrTitle: string;
    status: AccountStatus;
    linkedUid: string;
    assignedFacultyUids: string[];
    email: string;
    phone: string;
  }
): Promise<void> {
  const fullName = sanitizeText(input.fullName, FIELD_LIMITS.fullName.max);
  const memberCode = sanitizeCode(input.memberCode, FIELD_LIMITS.memberCode.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const batchOrTitle = sanitizeText(input.batchOrTitle, FIELD_LIMITS.batchOrTitle.max);
  const linkedUid = input.linkedUid.trim().slice(0, FIELD_LIMITS.id.max);
  const assignedFacultyUids = input.assignedFacultyUids
    .map((u) => u.trim())
    .filter((u) => PATTERNS.id.test(u))
    .slice(0, FIELD_LIMITS.assignedFacultyUidsMax);

  if (!fullName || !memberCode || !department) {
    throw new Error('Full name, ID code, and department are required.');
  }

  try {
    await updateDoc(doc(db, 'roster', memberId), {
      fullName,
      memberCode,
      role: input.role,
      department,
      batchOrTitle,
      status: input.status,
      linkedUid,
      assignedFacultyUids,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `roster/${memberId}`);
  }

  const email = sanitizeText(input.email, FIELD_LIMITS.email.max);
  const phone = sanitizeText(input.phone, FIELD_LIMITS.phone.max);
  try {
    await setDoc(
      doc(db, 'roster', memberId, 'private', 'contact'),
      {
        memberId,
        email,
        phone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `roster/${memberId}/private/contact`);
  }
}

export async function getRosterPrivateContact(
  memberId: string
): Promise<RosterPrivateContact | null> {
  const path = `roster/${memberId}/private/contact`;
  try {
    const snap = await getDoc(doc(db, 'roster', memberId, 'private', 'contact'));
    return snap.exists() ? (snap.data() as RosterPrivateContact) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteRosterMember(memberId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'roster', memberId, 'private', 'contact')).catch(() => undefined);
    await deleteDoc(doc(db, 'roster', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `roster/${memberId}`);
  }
}

// ============================================================================
// Courses CRUD
// ============================================================================

export async function createCourse(
  actorUid: string,
  input: {
    code: string;
    title: string;
    department: string;
    semester: string;
    schedule: string;
    facultyMemberId: string;
    facultyName: string;
    facultyUid: string;
    status: CourseStatus;
  }
): Promise<string> {
  const code = sanitizeCourseCode(input.code);
  const title = sanitizeText(input.title, FIELD_LIMITS.courseTitle.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const semester = sanitizeText(input.semester, FIELD_LIMITS.semester.max);
  const schedule = sanitizeText(input.schedule, FIELD_LIMITS.schedule.max);
  const facultyMemberId = input.facultyMemberId.trim().slice(0, FIELD_LIMITS.id.max);
  const facultyName = sanitizeText(input.facultyName, FIELD_LIMITS.fullName.max);
  const facultyUid = input.facultyUid.trim().slice(0, FIELD_LIMITS.id.max);

  if (code.length < 2 || title.length < 2 || !department || !semester) {
    throw new Error('Course code, title, department, and semester are required.');
  }

  const id = `crs_${sanitizeIdSegment(code, 24)}_${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, 'courses', id), {
      id,
      code,
      title,
      department,
      semester,
      schedule,
      facultyMemberId,
      facultyName,
      facultyUid,
      status: input.status,
      createdBy: actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `courses/${id}`);
  }
  return id;
}

export async function updateCourse(
  courseId: string,
  input: {
    code: string;
    title: string;
    department: string;
    semester: string;
    schedule: string;
    facultyMemberId: string;
    facultyName: string;
    facultyUid: string;
    status: CourseStatus;
  }
): Promise<void> {
  const code = sanitizeCourseCode(input.code);
  const title = sanitizeText(input.title, FIELD_LIMITS.courseTitle.max);
  const department = sanitizeText(input.department, FIELD_LIMITS.department.max);
  const semester = sanitizeText(input.semester, FIELD_LIMITS.semester.max);
  const schedule = sanitizeText(input.schedule, FIELD_LIMITS.schedule.max);

  if (code.length < 2 || title.length < 2) {
    throw new Error('Valid course code and title are required.');
  }

  try {
    await updateDoc(doc(db, 'courses', courseId), {
      code,
      title,
      department,
      semester,
      schedule,
      facultyMemberId: input.facultyMemberId.trim().slice(0, FIELD_LIMITS.id.max),
      facultyName: sanitizeText(input.facultyName, FIELD_LIMITS.fullName.max),
      facultyUid: input.facultyUid.trim().slice(0, FIELD_LIMITS.id.max),
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
  }
}

export async function updateCourseScheduleByFaculty(
  courseId: string,
  schedule: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'courses', courseId), {
      schedule: sanitizeText(schedule, FIELD_LIMITS.schedule.max),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `courses/${courseId}`);
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `courses/${courseId}`);
  }
}

// ============================================================================
// Attendance Records CRUD
// ============================================================================

export interface RollCallEntryDraft {
  student: RosterMember;
  status: AttendanceStatus;
  remarks: string;
  existingRecord?: AttendanceRecord;
}

export async function saveAttendanceSheet(
  actor: UserAccount,
  course: Course,
  date: string,
  entries: RollCallEntryDraft[]
): Promise<{ created: number; updated: number; skippedLocked: number }> {
  if (!PATTERNS.isoDate.test(date)) {
    throw new Error('Date must follow YYYY-MM-DD format.');
  }

  let created = 0;
  let updated = 0;
  let skippedLocked = 0;

  // Execute in chunks of 400 to respect Firestore 500-op batch ceiling
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    let opsInBatch = 0;

    for (const entry of chunk) {
      const recordId = buildAttendanceRecordId(course.id, entry.student.id, date);
      const ref = doc(db, 'attendance', recordId);
      const remarks = sanitizeText(entry.remarks, FIELD_LIMITS.remarks.max);

      if (entry.existingRecord) {
        if (entry.existingRecord.locked && actor.role !== 'admin') {
          skippedLocked += 1;
          continue;
        }
        batch.update(ref, {
          status: entry.status,
          remarks,
          updatedAt: serverTimestamp(),
        });
        updated += 1;
        opsInBatch += 1;
      } else {
        batch.set(ref, {
          id: recordId,
          courseId: course.id,
          courseCode: sanitizeText(course.code, 24),
          courseTitle: sanitizeText(course.title, 120),
          studentMemberId: entry.student.id,
          studentName: sanitizeText(entry.student.fullName, 100),
          studentCode: sanitizeText(entry.student.memberCode, 32),
          studentUid: entry.student.linkedUid || '',
          facultyUid: course.facultyUid || actor.uid,
          date,
          status: entry.status,
          remarks,
          markedByUid: actor.uid,
          markedByName: sanitizeText(actor.displayName, 100),
          locked: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created += 1;
        opsInBatch += 1;
      }
    }

    if (opsInBatch > 0) {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'attendance');
      }
    }
  }

  return { created, updated, skippedLocked };
}

export async function updateAttendanceRecord(
  recordId: string,
  input: { status: AttendanceStatus; remarks: string; locked?: boolean },
  isAdminActor: boolean
): Promise<void> {
  const payload: Record<string, unknown> = {
    status: input.status,
    remarks: sanitizeText(input.remarks, FIELD_LIMITS.remarks.max),
    updatedAt: serverTimestamp(),
  };
  if (isAdminActor && typeof input.locked === 'boolean') {
    payload.locked = input.locked;
  }

  try {
    await updateDoc(doc(db, 'attendance', recordId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `attendance/${recordId}`);
  }
}

export async function deleteAttendanceRecord(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'attendance', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `attendance/${recordId}`);
  }
}

// ============================================================================
// Seed Realistic Institutional Dataset (Admin Action)
// ============================================================================

export async function seedAcademicDemoData(actor: UserAccount): Promise<void> {
  const batch = writeBatch(db);

  const facultyList = [
    {
      id: 'fac_201_lin',
      fullName: 'Dr. Maya Lin',
      memberCode: 'FAC-201',
      role: 'faculty' as RosterRole,
      department: 'Computer Science',
      batchOrTitle: 'Associate Professor',
      email: 'm.lin@rollcall.edu',
      phone: '+1 555-0142',
    },
    {
      id: 'fac_204_patel',
      fullName: 'Prof. Vikram Patel',
      memberCode: 'FAC-204',
      role: 'faculty' as RosterRole,
      department: 'Software Engineering',
      batchOrTitle: 'Senior Lecturer',
      email: 'v.patel@rollcall.edu',
      phone: '+1 555-0198',
    },
  ];

  const students = [
    { id: 'stu_101_sharma', fullName: 'Aarav Sharma', memberCode: 'CS-2026-101', department: 'Computer Science', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: actor.uid },
    { id: 'stu_102_chen', fullName: 'Elena Chen', memberCode: 'CS-2026-102', department: 'Computer Science', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_103_okafor', fullName: 'Chidi Okafor', memberCode: 'CS-2026-103', department: 'Computer Science', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_104_martinez', fullName: 'Sofia Martinez', memberCode: 'CS-2026-104', department: 'Software Engineering', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_105_kulkarni', fullName: 'Rohan Kulkarni', memberCode: 'CS-2026-105', department: 'Computer Science', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_106_brooks', fullName: 'Hannah Brooks', memberCode: 'SE-2026-106', department: 'Software Engineering', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_107_tanaka', fullName: 'Kenji Tanaka', memberCode: 'CS-2026-107', department: 'Computer Science', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
    { id: 'stu_108_novak', fullName: 'Nadia Novak', memberCode: 'SE-2026-108', department: 'Software Engineering', batchOrTitle: 'Batch 2026 · Sem 5', linkedUid: '' },
  ];

  const courses = [
    {
      id: 'crs_cs301',
      code: 'CS-301',
      title: 'Data Structures & Algorithms',
      department: 'Computer Science',
      semester: 'Fall 2026',
      schedule: 'Mon / Wed / Fri · 09:00 AM',
      facultyMemberId: 'fac_201_lin',
      facultyName: 'Dr. Maya Lin',
      facultyUid: actor.uid,
    },
    {
      id: 'crs_cs304',
      code: 'CS-304',
      title: 'Relational Database Systems',
      department: 'Computer Science',
      semester: 'Fall 2026',
      schedule: 'Tue / Thu · 11:00 AM',
      facultyMemberId: 'fac_201_lin',
      facultyName: 'Dr. Maya Lin',
      facultyUid: actor.uid,
    },
    {
      id: 'crs_se202',
      code: 'SE-202',
      title: 'Enterprise MVC Architecture',
      department: 'Software Engineering',
      semester: 'Fall 2026',
      schedule: 'Mon / Wed · 02:00 PM',
      facultyMemberId: 'fac_204_patel',
      facultyName: 'Prof. Vikram Patel',
      facultyUid: actor.uid,
    },
  ];

  // Commit parent roster & courses first so Firestore exists() checks pass on attendance create
  for (const fac of facultyList) {
    batch.set(doc(db, 'roster', fac.id), {
      id: fac.id,
      fullName: fac.fullName,
      memberCode: fac.memberCode,
      role: fac.role,
      department: fac.department,
      batchOrTitle: fac.batchOrTitle,
      status: 'active',
      linkedUid: '',
      assignedFacultyUids: [actor.uid],
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const stu of students) {
    batch.set(doc(db, 'roster', stu.id), {
      id: stu.id,
      fullName: stu.fullName,
      memberCode: stu.memberCode,
      role: 'student',
      department: stu.department,
      batchOrTitle: stu.batchOrTitle,
      status: 'active',
      linkedUid: stu.linkedUid,
      assignedFacultyUids: [actor.uid],
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const crs of courses) {
    batch.set(doc(db, 'courses', crs.id), {
      id: crs.id,
      code: crs.code,
      title: crs.title,
      department: crs.department,
      semester: crs.semester,
      schedule: crs.schedule,
      facultyMemberId: crs.facultyMemberId,
      facultyName: crs.facultyName,
      facultyUid: crs.facultyUid,
      status: 'active',
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'roster_and_courses');
  }

  // Second batch: create isolated faculty contact docs & 5 days of realistic attendance records
  const batch2 = writeBatch(db);
  for (const fac of facultyList) {
    batch2.set(doc(db, 'roster', fac.id, 'private', 'contact'), {
      memberId: fac.id,
      email: fac.email,
      phone: fac.phone,
      updatedAt: serverTimestamp(),
    });
  }

  const today = new Date(`${getTodayIsoDate()}T12:00:00`);
  const dates: string[] = [];
  for (let offset = 4; offset >= 0; offset--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - offset);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }

  const statusPatterns: AttendanceStatus[][] = [
    ['present', 'present', 'present', 'late', 'present'],
    ['present', 'present', 'present', 'present', 'present'],
    ['present', 'absent', 'present', 'absent', 'late'],
    ['present', 'present', 'excused', 'present', 'present'],
    ['late', 'present', 'present', 'present', 'present'],
    ['absent', 'absent', 'present', 'absent', 'present'],
    ['present', 'present', 'present', 'present', 'late'],
    ['present', 'excused', 'present', 'present', 'present'],
  ];

  const remarkByStatus: Record<AttendanceStatus, string> = {
    present: '',
    late: 'Arrived 10 minutes after lecture start',
    excused: 'Approved medical documentation on file',
    absent: 'Unexcused absence',
  };

  courses.forEach((crs, cIdx) => {
    dates.forEach((dateStr, dIdx) => {
      // Vary which courses met on which day for realistic cadence
      if ((cIdx + dIdx) % 3 === 2) return;
      students.forEach((stu, sIdx) => {
        const st = statusPatterns[sIdx][(dIdx + cIdx) % statusPatterns[sIdx].length];
        const recId = buildAttendanceRecordId(crs.id, stu.id, dateStr);
        batch2.set(doc(db, 'attendance', recId), {
          id: recId,
          courseId: crs.id,
          courseCode: crs.code,
          courseTitle: crs.title,
          studentMemberId: stu.id,
          studentName: stu.fullName,
          studentCode: stu.memberCode,
          studentUid: stu.linkedUid,
          facultyUid: crs.facultyUid,
          date: dateStr,
          status: st,
          remarks: remarkByStatus[st],
          markedByUid: actor.uid,
          markedByName: sanitizeText(actor.displayName, 100),
          locked: dIdx === 0, // Lock oldest seeded session to demonstrate terminal state locking
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    });
  });

  try {
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'attendance');
  }
}

// ============================================================================
// CSV Export Utility
// ============================================================================

export function exportAttendanceToCsv(records: AttendanceRecord[], filenamePrefix = 'rollcall_attendance'): void {
  const headers = [
    'Date',
    'Course Code',
    'Course Title',
    'Student ID',
    'Student Name',
    'Status',
    'Remarks',
    'Marked By',
    'Finalized',
  ];

  const rows = records.map((r) => [
    escapeCsvCell(r.date),
    escapeCsvCell(r.courseCode),
    escapeCsvCell(r.courseTitle),
    escapeCsvCell(r.studentCode),
    escapeCsvCell(r.studentName),
    escapeCsvCell(r.status.toUpperCase()),
    escapeCsvCell(r.remarks),
    escapeCsvCell(r.markedByName),
    escapeCsvCell(r.locked ? 'Yes' : 'No'),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${getTodayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
