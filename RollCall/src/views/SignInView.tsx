import { useState } from 'react';
import { ArrowRight, Building2, ShieldCheck, Users, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CAMPUS_IMAGE_PATH = '/src/assets/images/campus_hall_architecture_1795844742296.jpg';

export function SignInView() {
  const { loginWithGoogle, signingIn, authError } = useAuth();
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:grid lg:grid-cols-12 items-stretch">
      {/* Left column: Institutional Sign-In */}
      <div className="lg:col-span-7 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-20 lg:py-14 bg-white border-r border-slate-200">
        <header className="flex items-center justify-between gap-8">
          <span className="text-xl font-bold tracking-tight text-[#0F172A] font-[var(--font-display)] whitespace-nowrap shrink-0">
            RollCall
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Attendance Management System
          </span>
        </header>

        <main className="my-12 max-w-xl">
          <p className="text-xs font-medium text-slate-500 mb-3">
            Academic &amp; Institutional Attendance Ledger
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A] leading-[1.15] mb-5"
            style={{ textWrap: 'balance' }}
          >
            Role-based attendance tracking built for accuracy and clarity.
          </h1>
          <p className="text-base text-slate-600 leading-relaxed mb-8">
            Sign in with your institutional Google account to manage student and faculty
            rosters, record daily roll calls, or review your verified attendance transcript.
          </p>

          {authError && (
            <div
              role="alert"
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-[#B91C1C]"
            >
              {authError}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-12">
            <button
              type="button"
              onClick={loginWithGoogle}
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-3 px-6 py-3 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{signingIn ? 'Signing in...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>

          <div className="border-t border-slate-200 pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>Administrator</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manage user roles, student &amp; faculty records, courses, and finalized sheets.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1.5">
                <ClipboardCheck className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>Faculty</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Record daily class roll calls, update unlocked entries, and export CSV reports.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1.5">
                <Users className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <span>Student</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track personal attendance standing, course averages, and dated history logs.
              </p>
            </div>
          </div>
        </main>

        <footer className="text-xs text-slate-500 flex items-center gap-2">
          <span>RollCall Institutional Suite</span>
          <span aria-hidden="true">·</span>
          <span>Role-based access enforced per account</span>
        </footer>
      </div>

      {/* Right column: Full-bleed architectural photograph with resilient fallback */}
      <div className="lg:col-span-5 relative min-h-[280px] lg:min-h-screen bg-[#0F172A] overflow-hidden">
        {!imgFailed ? (
          <img
            src={CAMPUS_IMAGE_PATH}
            alt="Sunlit modern university architectural hall with travertine columns"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full lg:h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-slate-900 text-slate-200">
            <Building2 className="w-10 h-10 mb-3 text-slate-400" />
            <p className="text-sm font-medium">RollCall Academic Registry</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex items-end p-8 lg:p-12">
          <div className="text-white max-w-sm">
            <p className="text-xs text-slate-300 mb-2">
              Centralized Recordkeeping · Audit Ready
            </p>
            <p className="text-base font-medium leading-relaxed text-white">
              Every session logged once, verified by role, and immediately available to faculty and students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
