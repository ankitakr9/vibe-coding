import { useState } from 'react';
import { generatePanchangData, FESTIVALS_2026 } from '../utils/astrology';
import { Calendar, Search, Sparkles, Sunrise, Sunset, Moon, ShieldAlert, BookOpen, Clock } from 'lucide-react';

export default function PanchangFestivals() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const panchang = generatePanchangData(selectedDate);

  // Filter festivals based on search query and selected month
  const filteredFestivals = FESTIVALS_2026.filter((fest) => {
    const matchesSearch = fest.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          fest.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedMonth === 'all') return matchesSearch;
    const festMonth = new Date(fest.date).getMonth().toString(); // '0' for Jan, '1' for Feb, etc.
    return matchesSearch && festMonth === selectedMonth;
  });

  return (
    <div id="panchang-festivals-component" className="space-y-8">
      {/* Panchang Section */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-5 mb-6 gap-4">
          <div>
            <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
              <Sunrise className="text-saffron-500 w-5.5 h-5.5" />
              Daily Vedic Panchang (Auspicious Timings)
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Select any date to synchronize solar and lunar positions for daily tasks (Muhurtas).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400 font-medium">Date:</label>
            <input
              id="panchang-date-selector"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#1b1b24] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold-500 transition"
            />
          </div>
        </div>

        {/* Panchang Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1b1b24] p-4 rounded-2xl border border-neutral-800/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-saffron-400 font-bold uppercase tracking-wider block mb-1">TITHI (Lunar Day)</span>
              <p className="text-sm font-semibold text-neutral-100">{panchang.tithi}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Ruler: {panchang.tithiLord}</p>
          </div>

          <div className="bg-[#1b1b24] p-4 rounded-2xl border border-neutral-800/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-saffron-400 font-bold uppercase tracking-wider block mb-1">VARA (Weekday)</span>
              <p className="text-sm font-semibold text-neutral-100">{panchang.vara}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Day Energy: Positive</p>
          </div>

          <div className="bg-[#1b1b24] p-4 rounded-2xl border border-neutral-800/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-saffron-400 font-bold uppercase tracking-wider block mb-1">NAKSHATRA (Star)</span>
              <p className="text-sm font-semibold text-neutral-100">{panchang.nakshatra}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Lord: {panchang.nakshatraLord}</p>
          </div>

          <div className="bg-[#1b1b24] p-4 rounded-2xl border border-neutral-800/60 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono text-saffron-400 font-bold uppercase tracking-wider block mb-1">YOGA & KARANA</span>
              <p className="text-sm font-semibold text-neutral-100">{panchang.yoga}</p>
            </div>
            <p className="text-xs text-neutral-400 mt-2">Karana: {panchang.karana}</p>
          </div>
        </div>

        {/* Solar, Lunar and Rahu/Gulika Timings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Sunrise / Sunset */}
          <div className="bg-gradient-to-br from-[#1d1d26] to-[#15151c] p-5 rounded-2xl border border-gold-900/10 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-saffron-600/15 flex items-center justify-center text-saffron-400">
                <Sunrise className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-mono">SUNRISE</span>
                <span className="text-xs font-bold text-neutral-200">{panchang.sunRise}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold-500/15 flex items-center justify-center text-gold-400">
                <Sunset className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-mono">SUNSET</span>
                <span className="text-xs font-bold text-neutral-200">{panchang.sunSet}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-mono">MOONRISE</span>
                <span className="text-xs font-bold text-neutral-200">{panchang.moonRise}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block font-mono">ABHIJIT MUHURTA</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">{panchang.abhijitMuhurta}</span>
              </div>
            </div>
          </div>

          {/* Sensitive/Challenging hours */}
          <div className="bg-gradient-to-br from-[#1d1d26] to-[#15151c] p-5 rounded-2xl border border-gold-900/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-red-400 font-display uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Inauspicious Rahu / Gulika Durations
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-2.5 bg-red-950/20 border border-red-900/20 rounded-xl">
                <span className="text-[10px] text-neutral-400 block font-mono">RAHU KALAM</span>
                <span className="font-semibold text-red-300 font-mono">{panchang.rahuKalam}</span>
              </div>
              <div className="p-2.5 bg-neutral-800/30 rounded-xl">
                <span className="text-[10px] text-neutral-400 block font-mono">GULIKA KALAM</span>
                <span className="font-semibold text-neutral-300 font-mono">{panchang.gulikaKalam}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Festival Section */}
      <div className="bg-[#13131a] rounded-3xl border border-gold-900/40 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-neutral-800 pb-5 mb-6 gap-4">
          <div>
            <h3 className="text-xl font-display font-bold text-gold-100 flex items-center gap-2">
              <Calendar className="text-saffron-500 w-5.5 h-5.5" />
              Vedic Festival Calendar (2026)
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Keep track of auspicious celebrations, fasts (Vrats), and specific Vedic ritual directions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                id="festival-search-input"
                type="text"
                placeholder="Search Festival..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1b1b24] border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500 transition w-44"
              />
            </div>

            {/* Month Filter */}
            <select
              id="festival-month-filter"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#1b1b24] border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500 transition appearance-none"
            >
              <option value="all">All Months</option>
              <option value="0">January</option>
              <option value="1">February</option>
              <option value="2">March</option>
              <option value="3">April</option>
              <option value="4">May</option>
              <option value="5">June</option>
              <option value="6">July</option>
              <option value="7">August</option>
              <option value="8">September</option>
              <option value="9">October</option>
              <option value="10">November</option>
              <option value="11">December</option>
            </select>
          </div>
        </div>

        {/* Festival List */}
        {filteredFestivals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredFestivals.map((fest) => {
              const fDate = new Date(fest.date);
              const formattedDate = fDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              
              return (
                <div
                  key={fest.name}
                  id={`festival-card-${fest.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="bg-[#1b1b24] p-5 rounded-2xl border border-neutral-800/80 hover:border-gold-500/30 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-saffron-400 font-mono">{formattedDate}</span>
                      <span className="text-[10px] bg-gold-500/10 text-gold-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">FESTIVAL</span>
                    </div>
                    <h4 className="text-base font-display font-semibold text-gold-100">{fest.name}</h4>
                    <p className="text-xs text-neutral-300 mt-2 line-clamp-2">{fest.description}</p>
                    <div className="mt-3 text-xs bg-[#13131a] p-3 rounded-xl border border-neutral-800/30">
                      <span className="font-semibold text-gold-400 flex items-center gap-1 mb-1">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        Significance
                      </span>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">{fest.significance}</p>
                    </div>
                  </div>

                  {/* Ritual List */}
                  <div className="mt-4 border-t border-neutral-800/60 pt-3">
                    <span className="text-[10px] font-mono text-neutral-500 block uppercase mb-1.5">Karmic Rituals</span>
                    <div className="flex flex-wrap gap-1.5">
                      {fest.rituals.map((r) => (
                        <span key={r} className="text-[10px] bg-neutral-900 text-neutral-300 rounded px-2 py-1 font-mono border border-neutral-800/40">
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#1b1b24]/40 rounded-2xl border border-dashed border-neutral-800">
            <BookOpen className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <p className="text-sm text-neutral-400 font-semibold">No festivals found matching your query</p>
            <p className="text-xs text-neutral-500 mt-1">Try broadening your search term or selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}
