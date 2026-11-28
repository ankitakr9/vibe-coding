# Security Specification — RollCall Attendance Management System

## 1. Data Invariants

1. **Identity & Privilege Escalation Prevention**: Non-bootstrap users registering at `/users/{userId}` may only initialize themselves with `role == 'student'` and `status == 'active'`, and may never modify their own `role` or `status` fields on update.
2. **PII Isolation**: Emails and phone numbers are never stored on `/users/{userId}` or `/roster/{memberId}`. They are isolated in `/users/{userId}/private/info` (readable/writable only by the owner or verified admin) and `/roster/{memberId}/private/contact` (readable/writable only by verified admin).
3. **Referential Integrity on Attendance**: An `/attendance/{recordId}` document cannot be created unless both `/courses/{courseId}` and `/roster/{studentMemberId}` exist in Firestore.
4. **Immutable Provenance & Temporal Integrity**: `createdAt`, `createdBy`, `uid`, `markedByUid`, `courseId`, `studentMemberId`, and `date` cannot be altered after creation. All `createdAt` and `updatedAt` timestamps must match `request.time`.
5. **Terminal State Locking**: Once an attendance record is marked `locked == true`, faculty can no longer edit its `status` or `remarks`; only a verified Admin can modify or unlock it.
6. **Student Isolation on Attendance**: Students can only read/list `/attendance` documents where `resource.data.studentUid == request.auth.uid`. Students can never create, update, or delete attendance records, courses, or roster entries.
7. **Zero-Trust Verified Email Gate**: Bootstrap admin recognition requires `request.auth.token.email == 'ak95349135@gmail.com' && request.auth.token.email_verified == true`. All write operations require `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Class | Target Path & Op | Malicious Payload / Context | Expected Result |
|---|--------------|------------------|-----------------------------|-----------------|
| 1 | Self-Role Escalation (Create) | `CREATE /users/stu_1` (as `stu_1`) | `{ uid: "stu_1", displayName: "Eve", role: "admin", ... }` | `PERMISSION_DENIED` |
| 2 | Self-Role Escalation (Update) | `UPDATE /users/stu_1` (as `stu_1`) | `{ role: "faculty", updatedAt: serverTimestamp() }` | `PERMISSION_DENIED` |
| 3 | Shadow Field Injection | `CREATE /courses/cs101` (as admin) | `{ ...validCourse, isVerified: true }` | `PERMISSION_DENIED` |
| 4 | Unverified Email Spoof | `CREATE /roster/m1` (email matches admin, `email_verified: false`) | `{ ...validMember }` | `PERMISSION_DENIED` |
| 5 | PII Cross-User Read | `GET /users/stu_1/private/info` (as `stu_2` or faculty) | Read request | `PERMISSION_DENIED` |
| 6 | Orphaned Attendance Write | `CREATE /attendance/rec_1` (as faculty) | `{ ...validAttendance, courseId: "nonexistent_course" }` | `PERMISSION_DENIED` |
| 7 | Locked Record Tampering | `UPDATE /attendance/rec_locked` (as faculty, `existing.locked == true`) | `{ status: "present", updatedAt: serverTimestamp() }` | `PERMISSION_DENIED` |
| 8 | Student Self-Attendance Write | `CREATE /attendance/rec_2` (as `student`) | `{ ...validAttendance, status: "present" }` | `PERMISSION_DENIED` |
| 9 | Path ID Poisoning | `CREATE /courses/bad$id..150chars` (as admin) | `{ ...validCourse }` | `PERMISSION_DENIED` |
| 10 | Value Type / Size Poisoning | `UPDATE /attendance/rec_1` (as faculty) | `{ remarks: "A".repeat(500), updatedAt: serverTimestamp() }` | `PERMISSION_DENIED` |
| 11 | Timestamp Forgery | `CREATE /courses/cs102` (as admin) | `{ ...validCourse, createdAt: "2020-01-01T00:00:00Z" }` | `PERMISSION_DENIED` |
| 12 | Blanket Attendance Scraping | `LIST /attendance` (as `student` without `studentUid == uid` filter) | Unfiltered collection query | `PERMISSION_DENIED` |
