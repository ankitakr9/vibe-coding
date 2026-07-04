import { useState } from 'react';
import { PlanetPosition } from '../types';
import { RASHIS } from '../utils/astrology';
import { Sparkles, Grid3X3, Layers } from 'lucide-react';

interface KundliChartProps {
  planetaryPositions: PlanetPosition[];
  lagnaRashi: string;
}

export default function KundliChart({ planetaryPositions, lagnaRashi }: KundliChartProps) {
  const [style, setStyle] = useState<'north' | 'south'>('north');

  // Find the Rashi index for Lagna (0 to 11)
  const lagnaRashiIndex = RASHIS.findIndex(r => r.name === lagnaRashi);

  // Helper to get planets in a specific house (1 to 12)
  const getPlanetsInHouse = (houseNumber: number): string[] => {
    return planetaryPositions
      .filter(p => p.house === houseNumber && p.name !== 'Lagna')
      .map(p => {
        // Return short code e.g. "Su", "Mo", "Ma"
        return p.name.substring(0, 2);
      });
  };

  // Helper to get Rashi number (1 to 12, where 1=Aries, 12=Pisces) inside a specific house (1 to 12)
  const getRashiInHouse = (houseNumber: number): number => {
    // House 1 gets Lagna Rashi, House 2 gets (Lagna Rashi + 1) % 12, etc.
    const rashiIdx = (lagnaRashiIndex + houseNumber - 1) % 12;
    return rashiIdx + 1; // 1-indexed Rashi
  };

  // North Indian Chart Coordinates (standard 400x400 canvas)
  // Diamonds and triangles layout.
  // We place house numbers (1 to 12) and Rashi numbers inside the respective cells,
  // and list the planets residing there.
  const renderNorthIndianChart = () => {
    // Positions of labels and planets for each house in 400x400 viewBox
    const housePositions = [
      { num: 1, textX: 200, textY: 170, pX: 200, pY: 140 }, // House 1 (Top Center Diamond)
      { num: 2, textX: 130, textY: 100, pX: 110, pY: 70 },  // House 2 (Top Left Triangle)
      { num: 3, textX: 70, textY: 130, pX: 50, pY: 110 },   // House 3 (Far Left Top Triangle)
      { num: 4, textX: 100, textY: 200, pX: 130, pY: 200 }, // House 4 (Left Center Diamond)
      { num: 5, textX: 70, textY: 270, pX: 50, pY: 290 },   // House 5 (Far Left Bottom Triangle)
      { num: 6, textX: 130, textY: 300, pX: 110, pY: 330 },  // House 6 (Bottom Left Triangle)
      { num: 7, textX: 200, textY: 235, pX: 200, pY: 265 }, // House 7 (Bottom Center Diamond)
      { num: 8, textX: 270, textY: 300, pX: 290, pY: 330 },  // House 8 (Bottom Right Triangle)
      { num: 9, textX: 330, textY: 270, pX: 350, pY: 290 },   // House 9 (Far Right Bottom Triangle)
      { num: 10, textX: 300, textY: 200, pX: 270, pY: 200 }, // House 10 (Right Center Diamond)
      { num: 11, textX: 330, textY: 130, pX: 350, pY: 110 },  // House 11 (Far Right Top Triangle)
      { num: 12, textX: 270, textY: 100, pX: 290, pY: 70 }   // House 12 (Top Right Triangle)
    ];

    return (
      <svg id="north-indian-kundli" viewBox="0 0 400 400" className="w-full h-full max-w-[400px] mx-auto drop-shadow-xl select-none">
        {/* Background */}
        <rect width="400" height="400" rx="16" fill="#111115" stroke="var(--color-gold-500)" strokeWidth="2" />
        
        {/* Mandala decorative background circles */}
        <circle cx="200" cy="200" r="180" fill="none" stroke="var(--color-gold-900)" strokeWidth="1" strokeDasharray="5,5" className="animate-mandala-spin" />
        <circle cx="200" cy="200" r="60" fill="none" stroke="var(--color-gold-900)" strokeWidth="1" />

        {/* Outer boundary lines */}
        <line x1="0" y1="0" x2="400" y2="400" stroke="var(--color-gold-400)" strokeWidth="2" />
        <line x1="400" y1="0" x2="0" y2="400" stroke="var(--color-gold-400)" strokeWidth="2" />
        
        {/* Inner square diamond lines */}
        <line x1="200" y1="0" x2="0" y2="200" stroke="var(--color-gold-400)" strokeWidth="2" />
        <line x1="0" y1="200" x2="200" y2="400" stroke="var(--color-gold-400)" strokeWidth="2" />
        <line x1="200" y1="400" x2="400" y2="200" stroke="var(--color-gold-400)" strokeWidth="2" />
        <line x1="400" y1="200" x2="200" y2="0" stroke="var(--color-gold-400)" strokeWidth="2" />

        {/* Draw House Numbers, Rashi Numbers, and Planets */}
        {housePositions.map((pos) => {
          const rashiNum = getRashiInHouse(pos.num);
          const planets = getPlanetsInHouse(pos.num);
          const isLagna = pos.num === 1;

          return (
            <g key={pos.num}>
              {/* House Number (small, muted gold) */}
              <text 
                x={pos.textX} 
                y={pos.textY - 14} 
                className="text-[10px] font-mono fill-gold-500 text-center" 
                textAnchor="middle"
              >
                H{pos.num}
              </text>

              {/* Rashi Number (larger, bright gold) */}
              <text 
                x={pos.textX} 
                y={pos.textY + 4} 
                className="text-sm font-semibold fill-saffron-300 font-display" 
                textAnchor="middle"
              >
                {rashiNum}
              </text>

              {/* Planets inside the cell */}
              <g transform={`translate(${pos.pX}, ${pos.pY})`}>
                {isLagna && (
                  <text x="0" y="-12" className="text-[10px] font-bold fill-gold-300 font-sans" textAnchor="middle">
                    ASC (Lagna)
                  </text>
                )}
                {planets.map((planet, pIdx) => {
                  const offset = (pIdx - (planets.length - 1) / 2) * 18;
                  return (
                    <text
                      key={planet}
                      x={offset}
                      y="14"
                      className="text-[11px] font-bold font-sans fill-amber-100 bg-black/60 rounded px-1"
                      textAnchor="middle"
                    >
                      {planet}
                    </text>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>
    );
  };

  // South Indian Chart Layout (12 perimeter grid boxes)
  // Starting from top-left corner as Pisces, top row Aries, Taurus, Gemini, etc.
  // Usually, fixed signs, we put the house number and resident planets inside the box
  const renderSouthIndianChart = () => {
    // 12 perimeter cells in a 4x4 layout.
    // Index map corresponding to Rashi 1 to 12:
    // Row 0: Pisces(12), Aries(1), Taurus(2), Gemini(3)
    // Row 1: Aquarius(11), [EMPTY], [EMPTY], Cancer(4)
    // Row 2: Capricorn(10), [EMPTY], [EMPTY], Leo(5)
    // Row 3: Sagittarius(9), Scorpio(8), Libra(7), Virgo(6)
    const gridPositions = [
      { rashiIdx: 11, x: 0, y: 0, name: 'Pisces (12)' },    // Row 0, Col 0
      { rashiIdx: 0, x: 100, y: 0, name: 'Aries (1)' },     // Row 0, Col 1
      { rashiIdx: 1, x: 200, y: 0, name: 'Taurus (2)' },    // Row 0, Col 2
      { rashiIdx: 2, x: 300, y: 0, name: 'Gemini (3)' },    // Row 0, Col 3
      { rashiIdx: 3, x: 300, y: 100, name: 'Cancer (4)' },  // Row 1, Col 3
      { rashiIdx: 4, x: 300, y: 200, name: 'Leo (5)' },     // Row 2, Col 3
      { rashiIdx: 5, x: 300, y: 300, name: 'Virgo (6)' },   // Row 3, Col 3
      { rashiIdx: 6, x: 200, y: 300, name: 'Libra (7)' },   // Row 3, Col 2
      { rashiIdx: 7, x: 100, y: 300, name: 'Scorpio (8)' }, // Row 3, Col 1
      { rashiIdx: 8, x: 0, y: 300, name: 'Sagittarius (9)' },// Row 3, Col 0
      { rashiIdx: 9, x: 0, y: 200, name: 'Capricorn (10)' },// Row 2, Col 0
      { rashiIdx: 10, x: 0, y: 100, name: 'Aquarius (11)' } // Row 1, Col 0
    ];

    return (
      <svg id="south-indian-kundli" viewBox="0 0 400 400" className="w-full h-full max-w-[400px] mx-auto drop-shadow-xl select-none">
        {/* Background */}
        <rect width="400" height="400" rx="16" fill="#111115" stroke="var(--color-gold-500)" strokeWidth="2" />

        {/* Inner center empty block */}
        <rect x="100" y="100" width="200" height="200" fill="#15151b" stroke="var(--color-gold-700)" strokeWidth="1" />
        
        {/* Core logo in empty center */}
        <circle cx="200" cy="200" r="40" fill="none" stroke="var(--color-gold-900)" strokeWidth="1" strokeDasharray="3,3" />
        <text x="200" y="205" className="text-xs font-display fill-gold-400 font-bold tracking-widest" textAnchor="middle">
          VY
        </text>

        {/* Perimeter Grid Lines */}
        {/* Verticals */}
        <line x1="100" y1="0" x2="100" y2="400" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="200" y1="0" x2="200" y2="100" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="200" y1="300" x2="200" y2="400" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="300" y1="0" x2="300" y2="400" stroke="var(--color-gold-500)" strokeWidth="1" />
        {/* Horizontals */}
        <line x1="0" y1="100" x2="400" y2="100" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="0" y1="200" x2="100" y2="200" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="300" y1="200" x2="400" y2="200" stroke="var(--color-gold-500)" strokeWidth="1" />
        <line x1="0" y1="300" x2="400" y2="300" stroke="var(--color-gold-500)" strokeWidth="1" />

        {/* Populate Grid Boxes */}
        {gridPositions.map((pos) => {
          const rashiName = RASHIS[pos.rashiIdx].name;
          
          // Calculate House Number for this rashi
          // House 1 is the Rashi of Lagna. House index = (rashiIndex - lagnaIndex + 12) % 12 + 1
          const houseNumber = (pos.rashiIdx - lagnaRashiIndex + 12) % 12 + 1;
          const isLagna = houseNumber === 1;

          // Planets in this rashi
          const planetsInRashi = planetaryPositions
            .filter(p => p.rashi === rashiName && p.name !== 'Lagna')
            .map(p => p.name.substring(0, 2));

          return (
            <g key={rashiName} transform={`translate(${pos.x}, ${pos.y})`}>
              {/* Rashi name abbreviation/ID in corner */}
              <text x="8" y="18" className="text-[10px] font-medium fill-gold-500 font-sans">
                {pos.rashiIdx + 1}
              </text>

              {/* House Tag */}
              <text x="92" y="18" className="text-[9px] font-mono fill-saffron-400 font-bold" textAnchor="end">
                H{houseNumber}
              </text>

              {/* Rashi Label */}
              <text x="50" y="32" className="text-[10px] font-medium fill-gold-200/50" textAnchor="middle">
                {rashiName}
              </text>

              {/* Lagna indicator */}
              {isLagna && (
                <text x="50" y="48" className="text-[11px] font-black fill-saffron-500 font-display animate-pulse" textAnchor="middle">
                  LAGNA
                </text>
              )}

              {/* Planets */}
              <g transform="translate(50, 68)">
                {planetsInRashi.map((planet, pIdx) => {
                  const offset = (pIdx - (planetsInRashi.length - 1) / 2) * 18;
                  return (
                    <text
                      key={planet}
                      x={offset}
                      y="0"
                      className="text-[11px] font-black font-sans fill-amber-100 bg-neutral-900/80 px-1 rounded"
                      textAnchor="middle"
                    >
                      {planet}
                    </text>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div id="astrological-chart-component" className="bg-[#15151c] rounded-2xl border border-gold-900 p-6 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Layers className="text-saffron-500 w-5 h-5" />
          <h3 className="text-lg font-display text-gold-100 font-semibold tracking-wide">Birth Chart (Patrika)</h3>
        </div>
        <div className="flex bg-[#1d1d26] p-1 rounded-lg border border-neutral-800 gap-1">
          <button
            id="btn-style-north"
            onClick={() => setStyle('north')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              style === 'north'
                ? 'bg-gold-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            North Indian
          </button>
          <button
            id="btn-style-south"
            onClick={() => setStyle('south')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              style === 'south'
                ? 'bg-gold-500 text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            South Indian
          </button>
        </div>
      </div>

      <div className="w-full relative min-h-[300px] flex items-center justify-center p-2 rounded-xl bg-[#0d0d12]">
        <div className="absolute inset-0 bg-radial from-saffron-500/5 to-transparent pointer-events-none" />
        {style === 'north' ? renderNorthIndianChart() : renderSouthIndianChart()}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {planetaryPositions.map((p) => (
          <div key={p.name} className="flex items-center gap-1 px-2 py-1 bg-[#1e1e27] border border-neutral-800 rounded-md text-xs">
            <span className="font-semibold text-gold-400">{p.name.substring(0, 2)}</span>
            <span className="text-neutral-400 font-mono text-[10px]">{p.rashi} {p.degree}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}
