import React, { useState } from 'react';
import { calculateGunaMilan, RASHIS } from '../utils/astrology';
import { BirthDetails, KundliMatchingResult, Gender } from '../types';
import { Heart, Sparkles, Scale, Info, ChevronRight, User, AlertCircle, RefreshCw } from 'lucide-react';

interface KundliMatchingProps {
  currentUserDetails: BirthDetails | null;
  savedProfiles?: BirthDetails[];
}

export default function KundliMatching({ currentUserDetails, savedProfiles = [] }: KundliMatchingProps) {
  const [boyName, setBoyName] = useState('');
  const [boyDob, setBoyDob] = useState('1994-08-12');
  const [boyTob, setBoyTob] = useState('09:15');
  const [boyPob, setBoyPob] = useState('Varanasi, Uttar Pradesh, India');

  const [girlName, setGirlName] = useState('');
  const [girlDob, setGirlDob] = useState('1996-05-24');
  const [girlTob, setGirlTob] = useState('14:40');
  const [girlPob, setGirlPob] = useState('New Delhi, India');

  const [result, setResult] = useState<KundliMatchingResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleSavedProfileSelect = (gender: 'boy' | 'girl', profile: BirthDetails) => {
    if (gender === 'boy') {
      setBoyName(profile.fullName);
      setBoyDob(profile.dateOfBirth);
      setBoyTob(profile.timeOfBirth);
      setBoyPob(profile.placeOfBirth);
    } else {
      setGirlName(profile.fullName);
      setGirlDob(profile.dateOfBirth);
      setGirlTob(profile.timeOfBirth);
      setGirlPob(profile.placeOfBirth);
    }
  };

  const handleMatch = (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    
    setTimeout(() => {
      const boyDetails: BirthDetails = {
        fullName: boyName || 'Groom',
        gender: 'male',
        dateOfBirth: boyDob,
        timeOfBirth: boyTob,
        placeOfBirth: boyPob,
        language: 'en'
      };

      const girlDetails: BirthDetails = {
        fullName: girlName || 'Bride',
        gender: 'female',
        dateOfBirth: girlDob,
        timeOfBirth: girlTob,
        placeOfBirth: girlPob,
        language: 'en'
      };

      const matchRes = calculateGunaMilan(boyDetails, girlDetails);
      setResult(matchRes);
      setCalculating(false);
    }, 1000);
  };

  // Helper colors for compatibility
  const getCompColor = (comp: string) => {
    switch (comp) {
      case 'excellent': return { border: 'border-gold-500', text: 'text-gold-300', bg: 'bg-gold-500/10' };
      case 'good': return { border: 'border-emerald-600', text: 'text-emerald-400', bg: 'bg-emerald-600/10' };
      case 'average': return { border: 'border-amber-600', text: 'text-amber-400', bg: 'bg-amber-600/10' };
      case 'poor': return { border: 'border-red-800', text: 'text-red-400', bg: 'bg-red-800/10' };
      default: return { border: 'border-neutral-800', text: 'text-neutral-400', bg: 'bg-neutral-800/10' };
    }
  };

  return (
    <div id="kundli-matching-component" className="space-y-8">
      {/* Input Form Card */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8">
        <div className="border-b border-neutral-800 pb-5 mb-6">
          <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
            <Heart className="text-saffron-500 w-5.5 h-5.5" />
            Ashtakoota Guna Milan (Kundli Matching)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Analyze compatibility based on the 36 Gunas (physiological, mental, and karmic traits) of bride and groom.
          </p>
        </div>

        {/* Quick select saved profiles */}
        {savedProfiles.length > 0 && (
          <div className="mb-6 p-4 bg-[#191922] rounded-2xl border border-neutral-800/60">
            <span className="text-[10px] font-mono text-neutral-400 block uppercase mb-2">Quick Select Saved Profiles</span>
            <div className="flex flex-wrap gap-2">
              {savedProfiles.map((prof) => (
                <div key={prof.fullName} className="flex gap-1">
                  <button
                    id={`btn-load-groom-${prof.fullName.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleSavedProfileSelect('boy', prof)}
                    className="text-[11px] bg-[#1e1e27] hover:bg-[#252533] text-neutral-300 font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-800 transition"
                  >
                    Groom: {prof.fullName}
                  </button>
                  <button
                    id={`btn-load-bride-${prof.fullName.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => handleSavedProfileSelect('girl', prof)}
                    className="text-[11px] bg-[#1e1e27] hover:bg-[#252533] text-neutral-300 font-semibold px-2.5 py-1.5 rounded-lg border border-neutral-800 transition"
                  >
                    Bride: {prof.fullName}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleMatch} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Groom Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-saffron-400 font-mono tracking-widest uppercase">GROOM (Var)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gold-300 mb-1">Groom Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    id="match-groom-name"
                    type="text"
                    required
                    placeholder="Aditya Verma"
                    value={boyName}
                    onChange={(e) => setBoyName(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gold-300 mb-1">Date of Birth</label>
                  <input
                    id="match-groom-dob"
                    type="date"
                    required
                    value={boyDob}
                    onChange={(e) => setBoyDob(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gold-300 mb-1">Time of Birth</label>
                  <input
                    id="match-groom-tob"
                    type="time"
                    required
                    value={boyTob}
                    onChange={(e) => setBoyTob(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gold-300 mb-1">Place of Birth</label>
                <input
                  id="match-groom-pob"
                  type="text"
                  required
                  placeholder="Varanasi, India"
                  value={boyPob}
                  onChange={(e) => setBoyPob(e.target.value)}
                  className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                />
              </div>
            </div>

            {/* Bride Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <span className="text-xs font-bold text-saffron-400 font-mono tracking-widest uppercase">BRIDE (Kanya)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gold-300 mb-1">Bride Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    id="match-bride-name"
                    type="text"
                    required
                    placeholder="Pooja Sharma"
                    value={girlName}
                    onChange={(e) => setGirlName(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gold-300 mb-1">Date of Birth</label>
                  <input
                    id="match-bride-dob"
                    type="date"
                    required
                    value={girlDob}
                    onChange={(e) => setGirlDob(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gold-300 mb-1">Time of Birth</label>
                  <input
                    id="match-bride-tob"
                    type="time"
                    required
                    value={girlTob}
                    onChange={(e) => setGirlTob(e.target.value)}
                    className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gold-300 mb-1">Place of Birth</label>
                <input
                  id="match-bride-pob"
                  type="text"
                  required
                  placeholder="New Delhi, India"
                  value={girlPob}
                  onChange={(e) => setGirlPob(e.target.value)}
                  className="w-full bg-[#1b1b24] border border-neutral-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-gold-500 transition"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-center">
            <button
              id="btn-calculate-matching"
              type="submit"
              disabled={calculating}
              className="w-full md:w-auto md:min-w-[240px] bg-gradient-to-r from-saffron-600 to-gold-500 hover:from-saffron-500 hover:to-gold-400 text-neutral-950 font-bold py-3 px-6 rounded-xl text-xs transition shadow-lg shadow-saffron-900/20 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {calculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Aligning Astro Paths...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 text-neutral-950" />
                  Calculate Guna Match Score
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Card */}
      {result && (
        <div id="matching-results-card" className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between border-b border-neutral-800 pb-5 gap-4">
            <div>
              <h4 className="text-lg font-display font-semibold text-gold-100 flex items-center gap-1.5">
                <Scale className="text-saffron-500 w-5 h-5" />
                Milan Result: {result.boyName} & {result.girlName}
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">Ashtakoota score matches psychological and physical chemistry details.</p>
            </div>
            
            {/* Guna Match Score Circular Dial */}
            <div className={`flex items-center gap-3 border rounded-2xl px-5 py-3 ${getCompColor(result.overallCompatibility).bg} ${getCompColor(result.overallCompatibility).border}`}>
              <div className="text-center">
                <span className="text-xs text-neutral-400 font-mono block">COMPATIBILITY</span>
                <span className={`text-sm font-bold uppercase tracking-wider ${getCompColor(result.overallCompatibility).text}`}>
                  {result.overallCompatibility}
                </span>
              </div>
              <div className="w-[1px] bg-neutral-800 self-stretch" />
              <div className="text-center">
                <span className="text-[10px] text-neutral-400 font-mono block">GUNA SCORE</span>
                <span className="text-xl font-black text-gold-100 font-mono">{result.gunaScore}/36</span>
              </div>
            </div>
          </div>

          {/* Descriptive Summary */}
          <p className="text-sm text-neutral-200 leading-relaxed bg-[#1b1b24] p-4 rounded-2xl border border-neutral-800/80">
            {result.summary}
          </p>

          {/* Manglik Match card */}
          <div className="bg-[#191922] p-5 rounded-2xl border border-neutral-800/60 space-y-3">
            <h5 className="text-xs font-bold text-saffron-400 uppercase tracking-widest font-mono">Manglik Match (Kuja Samya)</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400">Groom Status</span>
                <span className={`text-xs font-bold ${result.manglikMatch.boyManglik ? 'text-red-400' : 'text-emerald-400'}`}>
                  {result.manglikMatch.boyManglik ? '● Manglik (Dosha Present)' : '✓ Non-Manglik'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400">Bride Status</span>
                <span className={`text-xs font-bold ${result.manglikMatch.girlManglik ? 'text-red-400' : 'text-emerald-400'}`}>
                  {result.manglikMatch.girlManglik ? '● Manglik (Dosha Present)' : '✓ Non-Manglik'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-400">Marital Compatibility</span>
                <span className={`text-xs font-bold ${result.manglikMatch.compatible ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {result.manglikMatch.compatible ? '✓ Highly Compatible' : '⚠️ Remedial Measures Advised'}
                </span>
              </div>
            </div>
            <div className="bg-[#13131a] p-3 rounded-xl border border-neutral-800/40 text-[11px] text-neutral-400 leading-relaxed">
              {result.manglikMatch.description}
            </div>
          </div>

          {/* Guna breakdown list */}
          <div>
            <h5 className="text-xs font-bold text-gold-300 uppercase tracking-widest font-mono mb-3">Detailed 8 Koota Parameters</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="py-2.5 font-semibold">Koota Category</th>
                    <th className="py-2.5 font-semibold">Groom Value</th>
                    <th className="py-2.5 font-semibold">Bride Value</th>
                    <th className="py-2.5 font-semibold text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {result.gunaBreakdown.map((guna) => (
                    <tr key={guna.name} className="hover:bg-neutral-800/20">
                      <td className="py-3">
                        <div className="font-semibold text-neutral-200">{guna.name}</div>
                        <div className="text-[10px] text-neutral-400 max-w-xs">{guna.description}</div>
                      </td>
                      <td className="py-3 text-neutral-300 font-mono">{guna.boyValue}</td>
                      <td className="py-3 text-neutral-300 font-mono">{guna.girlValue}</td>
                      <td className="py-3 text-center font-bold font-mono text-gold-400">
                        {guna.obtainedPoints} / {guna.maxPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
