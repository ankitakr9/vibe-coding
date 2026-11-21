import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '../lib/api';
import type {
  InventoryItem,
  ItemSortBy,
  ItemStatus,
  SortDirection,
} from '../types/inventory';

interface InventoryTableProps {
  items: InventoryItem[];
  totalUnfilteredCount: number;
  loading: boolean;
  refreshing: boolean;
  adjustingIds: Record<number, boolean>;
  seeding: boolean;
  sortBy: ItemSortBy;
  sortDir: SortDirection;
  onSortColumn: (column: ItemSortBy) => void;
  onAdjustQuantity: (item: InventoryItem, delta: number) => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteRequest: (item: InventoryItem) => void;
  onAddItem: () => void;
  onLoadSample: () => void;
  onClearFilters: () => void;
}

function getStatusMeta(status: ItemStatus, lentTo?: string | null): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'in_stock':
      return { label: 'In Stock', className: 'text-green-700' };
    case 'low_stock':
      return { label: 'Low Stock', className: 'text-amber-700' };
    case 'out_of_stock':
      return { label: 'Out of Stock', className: 'text-red-700' };
    case 'lent_out':
      return {
        label: lentTo ? `Lent · ${lentTo}` : 'Lent Out',
        className: 'text-blue-700',
      };
    default:
      return { label: 'In Stock', className: 'text-green-700' };
  }
}

function SortIcon({
  column,
  activeColumn,
  direction,
}: {
  column: ItemSortBy;
  activeColumn: ItemSortBy;
  direction: SortDirection;
}) {
  if (column !== activeColumn) {
    return <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-blue-700 shrink-0" />
  ) : (
    <ArrowDown className="w-3 h-3 text-blue-700 shrink-0" />
  );
}

export function InventoryTable({
  items,
  totalUnfilteredCount,
  loading,
  refreshing,
  adjustingIds,
  seeding,
  sortBy,
  sortDir,
  onSortColumn,
  onAdjustQuantity,
  onEditItem,
  onDeleteRequest,
  onAddItem,
  onLoadSample,
  onClearFilters,
}: InventoryTableProps) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-2.5 pl-4 pr-3">Item &amp; SKU</th>
                <th className="py-2.5 px-3">Category &amp; Location</th>
                <th className="py-2.5 px-3">Condition</th>
                <th className="py-2.5 px-3 text-right">Quantity</th>
                <th className="py-2.5 px-3 text-right">Total Value</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="h-[52px]">
                  <td className="py-2.5 pl-4 pr-3">
                    <div className="h-3.5 w-44 bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-28 bg-slate-100 rounded mt-1.5 animate-pulse" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="h-3.5 w-36 bg-slate-100 rounded animate-pulse" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="h-3.5 w-16 bg-slate-100 rounded animate-pulse" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="h-6 w-20 bg-slate-100 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="h-3.5 w-20 bg-slate-100 rounded ml-auto animate-pulse" />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" />
                  </td>
                  <td className="py-2.5 pl-3 pr-4">
                    <div className="h-6 w-14 bg-slate-100 rounded ml-auto animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (totalUnfilteredCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-16 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Your personal inventory is empty
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Start cataloging your electronics, tools, photography gear, or household
            essentials. Track quantities, minimum thresholds, and storage locations in real time.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <PackagePlus className="w-4 h-4 shrink-0" />
              <span>Add First Item</span>
            </button>
            <button
              type="button"
              onClick={onLoadSample}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 shrink-0 text-slate-500" />
              <span>{seeding ? 'Loading Sample...' : 'Load Sample Inventory'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
        <p className="font-display text-base font-semibold text-slate-900">
          No items match your active filters
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Try broadening your search query or resetting category, location, price, and status filters.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 min-h-[40px] text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden transition-opacity ${
        refreshing ? 'opacity-75' : 'opacity-100'
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
              <th className="py-2.5 pl-4 pr-3 font-medium">
                <button
                  type="button"
                  onClick={() => onSortColumn('name')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <span>Item &amp; SKU</span>
                  <SortIcon column="name" activeColumn={sortBy} direction={sortDir} />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">
                <button
                  type="button"
                  onClick={() => onSortColumn('category')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <span>Category &amp; Location</span>
                  <SortIcon column="category" activeColumn={sortBy} direction={sortDir} />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium hidden md:table-cell">Condition</th>
              <th className="py-2.5 px-3 font-medium text-right">
                <button
                  type="button"
                  onClick={() => onSortColumn('quantity')}
                  className="inline-flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <span>Quantity</span>
                  <SortIcon column="quantity" activeColumn={sortBy} direction={sortDir} />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium text-right hidden sm:table-cell">
                <button
                  type="button"
                  onClick={() => onSortColumn('totalValue')}
                  className="inline-flex items-center justify-end gap-1.5 ml-auto hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  <span>Value</span>
                  <SortIcon column="totalValue" activeColumn={sortBy} direction={sortDir} />
                </button>
              </th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 pl-3 pr-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {items.map((item) => {
              const statusMeta = getStatusMeta(item.status, item.lentTo);
              const isBusy = Boolean(adjustingIds[item.id]);
              const totalValueCents = item.quantity * item.unitValueCents;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/90 transition-colors group"
                >
                  <td className="py-2.5 pl-4 pr-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className="text-left focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
                    >
                      <div className="font-medium text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                        {item.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono tabular-nums">{item.sku}</span>
                        {item.brand && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.brand}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </td>

                  <td className="py-2.5 px-3 align-middle">
                    <div className="text-slate-800 leading-snug">{item.category}</div>
                    <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                      <span>{item.locationName ?? 'Unassigned'}</span>
                      {item.locationRoom && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.locationRoom}</span>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 align-middle text-slate-600 hidden md:table-cell">
                    {item.condition}
                  </td>

                  <td className="py-2.5 px-3 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label={`Decrease quantity for ${item.name}`}
                        disabled={isBusy || item.quantity <= 0}
                        onClick={() => onAdjustQuantity(item, -1)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[2.25rem] text-center font-mono text-sm font-medium text-slate-900 tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity for ${item.name}`}
                        disabled={isBusy}
                        onClick={() => onAdjustQuantity(item, 1)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                      Min {item.minThreshold}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 align-middle text-right hidden sm:table-cell">
                    <div className="font-mono text-sm font-medium text-slate-900 tabular-nums">
                      {formatCurrency(totalValueCents)}
                    </div>
                    {item.quantity !== 1 && item.unitValueCents > 0 && (
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {formatCurrency(item.unitValueCents)} ea
                      </div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 align-middle">
                    <span className={`text-xs font-medium whitespace-nowrap ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </td>

                  <td className="py-2.5 pl-3 pr-4 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => onEditItem(item)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => onDeleteRequest(item)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
