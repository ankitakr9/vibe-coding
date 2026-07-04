import { useState } from 'react';
import { Shield, Users, EyeOff, Bell, ToggleLeft, ToggleRight, Trash2, Key, Info, CheckCircle } from 'lucide-react';
import { BirthDetails } from '../types';

interface AdminPanelProps {
  savedProfiles: BirthDetails[];
  onDeleteProfile?: (index: number) => void;
}

export default function AdminPanel({ savedProfiles, onDeleteProfile }: AdminPanelProps) {
  // Privacy Settings
  const [allowLocation, setAllowLocation] = useState(true);
  const [anonymousMetrics, setAnonymousMetrics] = useState(false);
  const [pushAuspicious, setPushAuspicious] = useState(true);
  const [keyConfigured, setKeyConfigured] = useState(!!process.env.GEMINI_API_KEY);

  // Mock Seekers on the Platform for Admin stats
  const [mockSeekers, setMockSeekers] = useState([
    { name: 'Rajesh Kumar', email: 'rajesh@kumar.org', sign: 'Leo (Simha)', status: 'Active' },
    { name: 'Kiran Patel', email: 'kiran@patel.co.in', sign: 'Aries (Mesha)', status: 'Inactive' },
    { name: 'Meera Deshmukh', email: 'meera@deshmukh.io', sign: 'Pisces (Meena)', status: 'Active' }
  ]);

  return (
    <div id="admin-panel-component" className="space-y-8">
      {/* Privacy Settings Section */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8">
        <div className="border-b border-neutral-800 pb-5 mb-6">
          <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
            <Shield className="text-saffron-500 w-5.5 h-5.5" />
            Security & Privacy Controls
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Control how your birth coordinates and astrology metrics are processed and synced to Firestore.
          </p>
        </div>

        <div className="space-y-4">
          {/* Toggle 1: Location Coordinates */}
          <div className="flex items-center justify-between p-4 bg-[#1b1b24] rounded-2xl border border-neutral-800/60">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-neutral-200">Precise Location Coordinates</h4>
              <p className="text-xs text-neutral-400">Calculate exact latitude and longitude for birth houses rather than approximate country/city.</p>
            </div>
            <button
              id="btn-toggle-location"
              onClick={() => setAllowLocation(!allowLocation)}
              className="text-gold-400 hover:text-gold-300 transition"
            >
              {allowLocation ? (
                <ToggleRight className="w-10 h-10 stroke-[1.5]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
              )}
            </button>
          </div>

          {/* Toggle 2: Anonymous Metrics */}
          <div className="flex items-center justify-between p-4 bg-[#1b1b24] rounded-2xl border border-neutral-800/60">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-neutral-200">Anonymous Seeker Diagnostics</h4>
              <p className="text-xs text-neutral-400">Allow cloud telemetry tools to monitor chart compilation errors to improve model accuracy.</p>
            </div>
            <button
              id="btn-toggle-anonymous"
              onClick={() => setAnonymousMetrics(!anonymousMetrics)}
              className="text-gold-400 hover:text-gold-300 transition"
            >
              {anonymousMetrics ? (
                <ToggleRight className="w-10 h-10 stroke-[1.5]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
              )}
            </button>
          </div>

          {/* Toggle 3: Push Notifications */}
          <div className="flex items-center justify-between p-4 bg-[#1b1b24] rounded-2xl border border-neutral-800/60">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold text-neutral-200">Auspicious Timings Alerts</h4>
              <p className="text-xs text-neutral-400">Send silent browser alarms when Abhijit Muhurta or high-dignity Nakshatra transitions occur.</p>
            </div>
            <button
              id="btn-toggle-push"
              onClick={() => setPushAuspicious(!pushAuspicious)}
              className="text-gold-400 hover:text-gold-300 transition"
            >
              {pushAuspicious ? (
                <ToggleRight className="w-10 h-10 stroke-[1.5]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Administrator Dashboard */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8">
        <div className="border-b border-neutral-800 pb-5 mb-6">
          <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
            <Users className="text-saffron-500 w-5.5 h-5.5" />
            Vedic Admin Control Dashboard
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            System logs, API parameters, and active astrological profiles on this workspace server.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Server status metric */}
          <div className="bg-[#1b1b24] p-5 rounded-2xl border border-neutral-800/60 space-y-3">
            <h4 className="text-xs font-bold text-gold-300 uppercase tracking-widest font-mono">System API Credentials</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Node Environment</span>
                <span className="font-mono font-bold text-neutral-200">Development</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Gemini SDK Link</span>
                <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Host Address</span>
                <span className="font-mono text-neutral-500">0.0.0.0:3000</span>
              </div>
            </div>
          </div>

          {/* User management list */}
          <div className="bg-[#1b1b24] p-5 rounded-2xl border border-neutral-800/60 lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-gold-300 uppercase tracking-widest font-mono">Active Seeker Database</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="py-2 font-semibold">Seeker Name</th>
                    <th className="py-2 font-semibold">Email</th>
                    <th className="py-2 font-semibold">Rashi</th>
                    <th className="py-2 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/30">
                  {mockSeekers.map((seeker, idx) => (
                    <tr key={idx} className="hover:bg-neutral-800/15 text-neutral-300">
                      <td className="py-2.5 font-semibold">{seeker.name}</td>
                      <td className="py-2.5 text-neutral-400 font-mono">{seeker.email}</td>
                      <td className="py-2.5 text-gold-400 font-mono">{seeker.sign}</td>
                      <td className="py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          seeker.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {seeker.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Saved Profiles admin delete */}
        {savedProfiles.length > 0 && (
          <div className="mt-8 pt-6 border-t border-neutral-800/60 space-y-4">
            <h4 className="text-xs font-bold text-gold-300 uppercase tracking-widest font-mono">Saved Kundli Directory</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {savedProfiles.map((prof, pIdx) => (
                <div key={prof.fullName} className="bg-[#1a1a23] p-4 rounded-xl border border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-neutral-200">{prof.fullName}</p>
                    <p className="text-[10px] text-neutral-400 font-mono">{prof.dateOfBirth} • {prof.timeOfBirth}</p>
                  </div>
                  {onDeleteProfile && (
                    <button
                      id={`btn-admin-delete-profile-${prof.fullName.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => onDeleteProfile(pIdx)}
                      className="p-1.5 hover:bg-neutral-800 rounded-lg text-red-400 hover:text-red-300 transition"
                      title="Delete profile record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
