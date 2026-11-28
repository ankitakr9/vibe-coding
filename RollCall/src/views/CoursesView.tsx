import { useMemo, useState } from 'react';
import { Calendar, Edit3, Plus, Trash2, X } from 'lucide-react';
import type {
  AttendanceRecord,
  Course,
  CourseStatus,
  RosterMember,
  UserAccount,
} from '../models/types';
import {
  createCourse,
  deleteCourse,
  updateCourse,
  updateCourseScheduleByFaculty,
} from '../controllers/attendanceController';

interface CoursesViewProps {
  account: UserAccount;
  courses: Course[];
  roster: RosterMember[];
  attendance: AttendanceRecord[];
}

interface CourseFormState {
  code: string;
  title: string;
  department: string;
  semester: string;
  schedule: string;
  facultyMemberId: string;
  status: CourseStatus;
}

const EMPTY_COURSE_FORM: CourseFormState = {
  code: '',
  title: '',
  department: 'Computer Science',
  semester: 'Fall 2026',
  schedule: 'Mon / Wed · 10:00 AM',
  facultyMemberId: '',
  status: 'active',
};

export function CoursesView({
  account,
  courses,
  roster,
  attendance,
}: CoursesViewProps) {
  const isAdmin = account.role === 'admin';
  const isFaculty = account.role === 'faculty';

  const facultyMembers = useMemo(
    () => roster.filter((m) => m.role === 'faculty' && m.status === 'active'),
    [roster]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>(EMPTY_COURSE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Faculty schedule edit modal
  const [scheduleCourse, setScheduleCourse] = useState<Course | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState('');

  // Delete confirmation
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const recordCountByCourse = useMemo(() => {
    const map = new Map<string, { total: number; attended: number }>();
    for (const r of attendance) {
      const cur = map.get(r.courseId) ?? { total: 0, attended: 0 };
      cur.total += 1;
      if (r.status !== 'absent') cur.attended += 1;
      map.set(r.courseId, cur);
    }
    return map;
  }, [attendance]);

  const openCreate = () => {
    setError(null);
    setEditingCourse(null);
    setForm(EMPTY_COURSE_FORM);
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setError(null);
    setEditingCourse(course);
    setForm({
      code: course.code,
      title: course.title,
      department: course.department,
      semester: course.semester,
      schedule: course.schedule,
      facultyMemberId: course.facultyMemberId,
      status: course.status,
    });
    setModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const selectedFaculty = facultyMembers.find((f) => f.id === form.facultyMemberId);
    const payload = {
      ...form,
      facultyName: selectedFaculty?.fullName ?? '',
      facultyUid: selectedFaculty?.linkedUid || account.uid,
    };

    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, payload);
      } else {
        await createCourse(account.uid, payload);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save course.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCourse) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateCourseScheduleByFaculty(scheduleCourse.id, scheduleDraft);
      setScheduleCourse(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;
    setSubmitting(true);
    try {
      await deleteCourse(deletingCourse.id);
      setDeletingCourse(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete course.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Course &amp; Cohort Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {courses.length} {courses.length === 1 ? 'course' : 'courses'} registered for attendance tracking
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course</span>
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-sm text-slate-500">
          No courses created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const stat = recordCountByCourse.get(course.id);
            const rate =
              stat && stat.total > 0
                ? Math.round((stat.attended / stat.total) * 1000) / 10
                : null;
            const facultyCanEditSchedule =
              isFaculty && course.facultyUid === account.uid && course.status === 'active';

            return (
              <article
                key={course.id}
                className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-xs text-slate-500 font-mono">
                      <span className="font-semibold text-slate-900">{course.code}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-sans capitalize">{course.status}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(course)}
                            title="Edit Course"
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCourse(course)}
                            title="Delete Course"
                            className="p-1.5 text-slate-400 hover:text-[#B91C1C] hover:bg-red-50 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {facultyCanEditSchedule && (
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleCourse(course);
                            setScheduleDraft(course.schedule);
                          }}
                          title="Update Schedule"
                          className="p-1.5 text-slate-400 hover:text-[#1D4ED8] hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 leading-snug mb-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {course.department} · {course.semester}
                  </p>

                  <dl className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Instructor</dt>
                      <dd className="font-medium text-slate-800 truncate">
                        {course.facultyName || 'Unassigned'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-slate-500">Schedule</dt>
                      <dd className="text-slate-700 truncate">
                        {course.schedule || 'Not scheduled'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-500">
                    {stat?.total ?? 0} logged entries
                  </span>
                  <span
                    className={`font-semibold ${
                      rate === null
                        ? 'text-slate-400'
                        : rate >= 75
                          ? 'text-[#15803D]'
                          : 'text-[#B91C1C]'
                    }`}
                  >
                    {rate === null ? '—' : `${rate.toFixed(1)}% avg`}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Admin Create / Edit Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingCourse ? 'Edit Course' : 'Add New Course'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2.5 text-xs text-[#B91C1C] bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={24}
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="CS-401"
                    className="w-full h-10 px-3 text-sm font-mono bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Course Title
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Operating Systems"
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Term / Semester
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={form.semester}
                    onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Assigned Faculty
                  </label>
                  <select
                    value={form.facultyMemberId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, facultyMemberId: e.target.value }))
                    }
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {facultyMembers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fullName} ({f.memberCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as CourseStatus }))
                    }
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Schedule
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={form.schedule}
                  onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))}
                  placeholder="Tue / Thu · 11:00 AM"
                  className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : editingCourse
                      ? 'Save Course'
                      : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faculty Schedule Modal */}
      {scheduleCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Update Class Schedule
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {scheduleCourse.code} · {scheduleCourse.title}
            </p>
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <input
                type="text"
                maxLength={80}
                value={scheduleDraft}
                onChange={(e) => setScheduleDraft(e.target.value)}
                placeholder="Mon / Wed · 09:00 AM"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleCourse(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation */}
      {deletingCourse && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Delete Course?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Remove <strong className="text-slate-900">{deletingCourse.code} — {deletingCourse.title}</strong> from the course registry?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCourse(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#B91C1C] rounded-md hover:bg-red-800 disabled:opacity-60 cursor-pointer"
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
