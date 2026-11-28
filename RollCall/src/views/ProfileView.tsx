import { useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateOwnUserProfile } from '../controllers/attendanceController';
import { formatRoleLabel } from '../components/StatusIndicator';

export function ProfileView() {
  const { account, privateInfo, firebaseUser, refreshPrivateInfo } = useAuth();
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [department, setDepartment] = useState(account?.department ?? '');
  const [phone, setPhone] = useState(privateInfo?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  if (!account) return null;

  const email = privateInfo?.email || firebaseUser?.email || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateOwnUserProfile(account.uid, {
        displayName,
        department,
        phone,
        email,
      });
      refreshPrivateInfo({
        uid: account.uid,
        email,
        phone,
      });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Account Profile</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your display details and private contact number
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-900">
              {formatRoleLabel(account.role)}
            </p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {account.memberCode || 'Unassigned ID'}
            </p>
          </div>
        </div>

        {message && (
          <div
            role="status"
            className={`mb-5 px-4 py-3 text-xs font-medium rounded-md border ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-[#15803D]'
                : 'bg-red-50 border-red-200 text-[#B91C1C]'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Department
              </label>
              <input
                type="text"
                maxLength={80}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Private Phone (Owner &amp; Admin Only)
              </label>
              <input
                type="text"
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-md focus:border-[#1D4ED8] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Verified Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0F172A] rounded-md hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#1D4ED8]" />
          <h3 className="text-sm font-semibold text-slate-900">Role Permissions</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {account.role === 'admin'
            ? 'Administrator accounts have full create, update, lock, and delete authority across user roles, institutional roster records, courses, and attendance sheets.'
            : account.role === 'faculty'
              ? 'Faculty accounts can record daily attendance, update unlocked records for assigned courses, edit assigned course schedules, and export attendance reports.'
              : 'Student accounts have read-only access to their own attendance history, course averages, and personal standing.'}
        </p>
      </section>
    </div>
  );
}
