import { formatTimestamp } from '../lib/api';
import type { InventoryMovement } from '../types/inventory';

interface ActivityLogViewProps {
  movements: InventoryMovement[];
  loading: boolean;
}

function formatActionLabel(action: string): string {
  switch (action) {
    case 'created':
      return 'Added';
    case 'adjusted':
      return 'Adjusted';
    case 'updated':
      return 'Updated';
    case 'moved':
      return 'Relocated';
    case 'lent':
      return 'Lent Out';
    case 'returned':
      return 'Returned';
    case 'deleted':
      return 'Removed';
    default:
      return action;
  }
}

export function ActivityLogView({ movements, loading }: ActivityLogViewProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Activity Log
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Chronological record of stock adjustments, additions, relocations, and loans.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="px-4 py-3.5 flex items-center justify-between gap-4">
                <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : movements.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-base font-semibold text-slate-900">
              No activity recorded yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Changes to quantities, locations, or items will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-4 pr-3 font-medium">Event</th>
                  <th className="py-2.5 px-3 font-medium">Item</th>
                  <th className="py-2.5 px-3 font-medium">Details</th>
                  <th className="py-2.5 px-3 font-medium text-right">Change</th>
                  <th className="py-2.5 px-3 font-medium text-right">Stock Level</th>
                  <th className="py-2.5 pl-3 pr-4 font-medium text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 pl-4 pr-3 font-medium text-slate-800 whitespace-nowrap">
                      {formatActionLabel(m.action)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {m.itemName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {m.note || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                      <span
                        className={
                          m.delta > 0
                            ? 'text-green-700 font-medium'
                            : m.delta < 0
                            ? 'text-red-700 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta === 0 ? '0' : m.delta}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {m.previousQuantity} &rarr; {m.newQuantity}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatTimestamp(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
