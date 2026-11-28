import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudentTranscriptModal } from './components/StudentTranscriptModal';
import { formatRoleLabel } from './components/StatusIndicator';
import {
  seedAcademicDemoData,
  subscribeAttendance,
  subscribeCourses,
  subscribeRoster,
  subscribeUserAccounts,
} from './controllers/attendanceController';
import type {
  AttendanceRecord,
  Course,
  RosterMember,
  UserAccount,
} from './models/types';
import { SignInView } from './views/SignInView';
import { OverviewView } from './views/OverviewView';
import { RollCallView } from './views/RollCallView';
import { AttendanceRecordsView } from './views/AttendanceRecordsView';
import { DirectoryView } from './views/DirectoryView';
import { CoursesView } from './views/CoursesView';
import { ProfileView } from './views/ProfileView';

type TabId = 'overview' | 'rollcall' | 'records' | 'directory' | 'courses' | 'profile';

interface NavItem {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Array<'admin' | 'faculty' | 'student'>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'faculty', 'student'] },
  { id: 'rollcall', label: 'Take Attendance', icon: ClipboardCheck, roles: ['admin', 'faculty'] },
  { id: 'records', label: 'Attendance History', icon: History, roles: ['admin', 'faculty', 'student'] },
  { id: 'directory', label: 'Users & Roster', icon: Users, roles: ['admin', 'faculty'] },
  { id: 'courses', label: 'Courses', icon: BookOpen, roles: ['admin', 'faculty', 'student'] },
  { id: 'profile', label: 'Profile', icon: UserCircle, roles: ['admin', 'faculty', 'student'] },
];

function WorkspaceShell() {
  const { account, isBootstrapAdmin, authReady, firebaseUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [courses, setCourses] = useState<Course[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [transcriptStudent, setTranscriptStudent] = useState<RosterMember | null>(null);

  const visibleNavItems = useMemo(() => {
    if (!account) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(account.role));
  }, [account]);

  // Reset active tab if role changes and tab is no longer permitted
  useEffect(() => {
    if (account && !visibleNavItems.some((item) => item.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [account, visibleNavItems, activeTab]);

  // Subscribe to role-scoped Firestore streams strictly after auth is ready
  useEffect(() => {
    if (!authReady || !firebaseUser || !account) {
      setCourses([]);
      setRoster([]);
      setAttendance([]);
      setUserAccounts([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setSyncError(null);

    let settled = 0;
    const markSettled = () => {
      settled += 1;
      if (settled >= 3) setDataLoading(false);
    };

    const handleErr = (err: Error) => {
      setSyncError(err.message);
      setDataLoading(false);
    };

    const unsubCourses = subscribeCourses(
      account,
      isBootstrapAdmin,
      (list) => {
        setCourses(list);
        markSettled();
      },
      handleErr
    );

    const unsubRoster = subscribeRoster(
      account,
      isBootstrapAdmin,
      (list) => {
        setRoster(list);
        markSettled();
      },
      handleErr
    );

    const unsubAttendance = subscribeAttendance(
      account,
      isBootstrapAdmin,
      (list) => {
        setAttendance(list);
        markSettled();
      },
      handleErr
    );

    const unsubUsers =
      account.role === 'admin'
        ? subscribeUserAccounts(account, isBootstrapAdmin, setUserAccounts, handleErr)
        : () => undefined;

    return () => {
      unsubCourses();
      unsubRoster();
      unsubAttendance();
      unsubUsers();
    };
  }, [authReady, firebaseUser, account, isBootstrapAdmin]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="space-y-2 text-center">
          <p className="text-lg font-bold tracking-tight text-slate-900 font-[var(--font-display)]">
            RollCall
          </p>
          <p className="text-xs text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser || !account) {
    return <SignInView />;
  }

  const currentNav = visibleNavItems.find((n) => n.id === activeTab) ?? visibleNavItems[0];

  const handleSeedDemo = async () => {
    await seedAcademicDemoData(account);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Left Sidebar (248px) */}
      <aside className="hidden lg:flex lg:flex-col w-[248px] shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-lg font-bold tracking-tight text-[#0F172A] font-[var(--font-display)] whitespace-nowrap shrink-0">
            RollCall
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0F172A] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-slate-900 truncate">
              {account.displayName}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {formatRoleLabel(account.role)}
              {account.department ? ` · ${account.department}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col h-full">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-[#0F172A] font-[var(--font-display)]">
                RollCall
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0F172A] text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-900 truncate px-2">
                {account.displayName}
              </p>
              <p className="text-xs text-slate-500 px-2 mb-3">
                {formatRoleLabel(account.role)}
              </p>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">
                {formatRoleLabel(account.role)}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {currentNav?.label ?? 'Overview'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {(account.role === 'admin' || account.role === 'faculty') &&
              activeTab !== 'rollcall' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('rollcall')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Take Attendance</span>
                </button>
              )}
            {account.role === 'student' && activeTab !== 'records' && (
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>My Attendance</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1280px] w-full mx-auto">
          {syncError && (
            <div
              role="alert"
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-[#B91C1C]"
            >
              Unable to synchronize records: {syncError}
            </div>
          )}

          {dataLoading ? (
            <div className="space-y-6" aria-busy="true">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 bg-white border border-slate-200 rounded-lg p-6"
                  >
                    <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
                    <div className="h-7 w-16 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-64 bg-white border border-slate-200 rounded-lg p-6">
                <div className="h-4 w-48 bg-slate-200 rounded mb-6" />
                <div className="space-y-3">
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                  <div className="h-8 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewView
                  account={account}
                  courses={courses}
                  roster={roster}
                  attendance={attendance}
                  onNavigate={(tab) => setActiveTab(tab as TabId)}
                  onSeedDemoData={handleSeedDemo}
                  onSelectStudentTranscript={(m) => setTranscriptStudent(m)}
                />
              )}
              {activeTab === 'rollcall' && (
                <RollCallView
                  account={account}
                  courses={courses}
                  roster={roster}
                  attendance={attendance}
                />
              )}
              {activeTab === 'records' && (
                <AttendanceRecordsView
                  account={account}
                  courses={courses}
                  attendance={attendance}
                />
              )}
              {activeTab === 'directory' && (
                <DirectoryView
                  account={account}
                  roster={roster}
                  userAccounts={userAccounts}
                  attendance={attendance}
                  onSelectStudentTranscript={(m) => setTranscriptStudent(m)}
                />
              )}
              {activeTab === 'courses' && (
                <CoursesView
                  account={account}
                  courses={courses}
                  roster={roster}
                  attendance={attendance}
                />
              )}
              {activeTab === 'profile' && <ProfileView />}
            </>
          )}
        </main>
      </div>

      {/* Student Transcript Modal */}
      <StudentTranscriptModal
        student={transcriptStudent}
        attendance={attendance}
        onClose={() => setTranscriptStudent(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
