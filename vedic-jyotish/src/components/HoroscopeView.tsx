import { useState } from 'react';
import { getHoroscopePredictions, RASHIS } from '../utils/astrology';
import { Sparkles, CalendarDays, Bookmark, Briefcase, GraduationCap, Heart, Activity, DollarSign, Building2, Plane, Compass, HelpCircle } from 'lucide-react';

interface HoroscopeViewProps {
  userRashi?: string;
  onBookmarkPrediction?: (prediction: any) => void;
  bookmarkedPredictions?: any[];
}

export default function HoroscopeView({ userRashi = 'Mesha', onBookmarkPrediction, bookmarkedPredictions = [] }: HoroscopeViewProps) {
  const [selectedRashi, setSelectedRashi] = useState(userRashi);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');

  const forecast = getHoroscopePredictions(selectedRashi, period);

  const handleBookmarkToggle = () => {
    if (onBookmarkPrediction) {
      onBookmarkPrediction({
        id: `${selectedRashi}-${period}`,
        rashi: selectedRashi,
        period: period,
        date: forecast.date,
        summary: `Forecast for ${selectedRashi} (${period})`
      });
    }
  };

  const isBookmarked = bookmarkedPredictions.some(b => b.id === `${selectedRashi}-${period}`);

  const forecastCategories = [
    { key: 'career', label: 'Career & Status', icon: Briefcase, color: 'text-amber-400 bg-amber-400/10' },
    { key: 'education', label: 'Education & Intellect', icon: GraduationCap, color: 'text-blue-400 bg-blue-400/10' },
    { key: 'marriage', label: 'Marriage & Relations', icon: Heart, color: 'text-red-400 bg-red-400/10' },
    { key: 'health', label: 'Vitality & Health', icon: Activity, color: 'text-emerald-400 bg-emerald-400/10' },
    { key: 'finance', label: 'Wealth & Finance', icon: DollarSign, color: 'text-gold-400 bg-gold-400/10' },
    { key: 'business', label: 'Business & Ventures', icon: Building2, color: 'text-cyan-400 bg-cyan-400/10' },
    { key: 'travel', label: 'Commutes & Travel', icon: Plane, color: 'text-indigo-400 bg-indigo-400/10' },
  ];

  return (
    <div id="horoscope-view-component" className="space-y-6">
      {/* Rashi Selector Horizontal scroll or Grid */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-5">
        <span className="text-[10px] font-mono text-saffron-400 font-bold uppercase tracking-widest block mb-3 ml-1">Select Moon Rashi (Zodiac Sign)</span>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {RASHIS.map((r) => (
            <button
              key={r.name}
              id={`btn-rashi-${r.name.toLowerCase()}`}
              onClick={() => setSelectedRashi(r.name)}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition ${
                selectedRashi === r.name
                  ? 'bg-gradient-to-tr from-saffron-600/20 to-gold-400/20 border-gold-500 text-gold-200'
                  : 'bg-[#1b1b24] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              <span className="font-display tracking-wide">{r.name}</span>
              <span className="text-[9px] text-neutral-500 font-normal mt-0.5">{r.english}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main predictions Card */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-neutral-800 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-saffron-600/10 to-gold-400/10 flex items-center justify-center text-xl border border-gold-500/20">
              🔮
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-gold-100 flex items-center gap-2">
                Forecast for {selectedRashi} Rashi
                <span className="text-xs font-normal text-neutral-400 font-sans">({period} prediction)</span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Calculated based on current planetary transits over lunar placements.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Period selector buttons */}
            <div className="flex bg-[#1d1d26] p-1 rounded-xl border border-neutral-800 gap-1 text-xs font-medium">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
                <button
                  key={p}
                  id={`btn-period-${p}`}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition ${
                    period === p
                      ? 'bg-gold-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Bookmark button */}
            <button
              id="btn-horoscope-bookmark"
              onClick={handleBookmarkToggle}
              className={`p-2.5 rounded-xl border transition ${
                isBookmarked 
                  ? 'bg-gold-500/10 border-gold-500 text-gold-300' 
                  : 'bg-neutral-800/40 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
              title="Bookmark forecast details"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-gold-300' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bento Grid predictions layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {forecastCategories.map((cat) => {
            const textContent = forecast[cat.key as keyof typeof forecast] as string;
            const Icon = cat.icon;

            return (
              <div
                key={cat.key}
                id={`prediction-card-${cat.key}`}
                className="bg-[#1b1b24] p-5 rounded-2xl border border-neutral-800/80 hover:border-gold-500/10 transition space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${cat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-semibold text-neutral-200">{cat.label}</h4>
                  </div>
                  <span className="text-[9px] font-mono text-neutral-500 uppercase">Transit active</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed min-h-[64px]">
                  {textContent}
                </p>
              </div>
            );
          })}
          
          {/* Spiritual recommendation static card in same style */}
          <div className="bg-gradient-to-br from-gold-900/10 to-[#1b1b24] p-5 rounded-2xl border border-gold-900/20 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg text-gold-400 bg-gold-400/10">
                  <Compass className="w-4 h-4 animate-spin" />
                </div>
                <h4 className="text-xs font-semibold text-gold-300">Auspicious Remedy</h4>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                For {selectedRashi} Rashi during this {period} cycle, donating food to birds at sunrise or chanting Gayatri Mantra 11 times stabilizes emotional swings.
              </p>
            </div>
            <div className="text-[10px] text-neutral-500 font-mono mt-4">
              GUIDED BY VEDAS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
