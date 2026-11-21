import { MapPinPlus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../lib/api';
import type { LocationSummary } from '../types/inventory';

interface LocationsViewProps {
  locations: LocationSummary[];
  loading: boolean;
  onAddLocation: () => void;
  onEditLocation: (loc: LocationSummary) => void;
  onDeleteLocation: (loc: LocationSummary) => void;
  onFilterByLocation: (locationId: number) => void;
}

export function LocationsView({
  locations,
  loading,
  onAddLocation,
  onEditLocation,
  onDeleteLocation,
  onFilterByLocation,
}: LocationsViewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white border border-slate-200 rounded-lg p-5 h-44 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Storage Locations
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize rooms, cabinets, shelves, and storage containers across your home or studio.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddLocation}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <MapPinPlus className="w-4 h-4 shrink-0" />
          <span>Add Location</span>
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-14 text-center">
          <h3 className="font-display text-base font-semibold text-slate-900">
            No storage locations defined yet
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
            Create rooms, shelves, or bins to assign your personal inventory items and see value by space.
          </p>
          <button
            type="button"
            onClick={onAddLocation}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <MapPinPlus className="w-4 h-4" />
            <span>Create First Location</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{loc.room}</p>
                    <h3 className="font-display text-base font-semibold text-slate-900 mt-0.5">
                      {loc.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Edit ${loc.name}`}
                      onClick={() => onEditLocation(loc)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${loc.name}`}
                      onClick={() => onDeleteLocation(loc)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {loc.description && (
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {loc.description}
                  </p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-end justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono tabular-nums">
                  <span>
                    <strong className="text-slate-900 font-semibold">{loc.itemCount}</strong> items
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong className="text-slate-900 font-semibold">{loc.totalUnits}</strong> units
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-900 font-semibold">
                    {formatCurrency(loc.totalValueCents)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onFilterByLocation(loc.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <span>View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
