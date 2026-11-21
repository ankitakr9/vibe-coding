import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { formatTimestamp, inventoryApi } from '../lib/api';
import {
  DEFAULT_CATEGORIES,
  ITEM_CONDITIONS,
  type InventoryItem,
  type InventoryMovement,
  type ItemFormPayload,
  type LocationSummary,
} from '../types/inventory';

interface ItemDrawerProps {
  open: boolean;
  editingItem: InventoryItem | null;
  locations: LocationSummary[];
  onClose: () => void;
  onSave: (payload: ItemFormPayload, itemId?: number) => Promise<void>;
}

export function ItemDrawer({
  open,
  editingItem,
  locations,
  onClose,
  onSave,
}: ItemDrawerProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [brand, setBrand] = useState('');
  const [locationId, setLocationId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [minThreshold, setMinThreshold] = useState('1');
  const [unitPriceDollars, setUnitPriceDollars] = useState('0.00');
  const [condition, setCondition] = useState<string>('Good');
  const [isLentOut, setIsLentOut] = useState(false);
  const [lentTo, setLentTo] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [movementNote, setMovementNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemHistory, setItemHistory] = useState<InventoryMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab('details');
    setError(null);
    setMovementNote('');

    if (editingItem) {
      setName(editingItem.name);
      setSku(editingItem.sku);
      setCategory(editingItem.category);
      setBrand(editingItem.brand ?? '');
      setLocationId(editingItem.locationId != null ? String(editingItem.locationId) : '');
      setQuantity(String(editingItem.quantity));
      setMinThreshold(String(editingItem.minThreshold));
      setUnitPriceDollars((editingItem.unitValueCents / 100).toFixed(2));
      setCondition(editingItem.condition || 'Good');
      setIsLentOut(editingItem.status === 'lent_out');
      setLentTo(editingItem.lentTo ?? '');
      setSerialNumber(editingItem.serialNumber ?? '');
      setPurchaseDate(editingItem.purchaseDate ?? '');
      setWarrantyUntil(editingItem.warrantyUntil ?? '');
      setNotes(editingItem.notes ?? '');
    } else {
      setName('');
      setSku('');
      setCategory(DEFAULT_CATEGORIES[0]);
      setBrand('');
      setLocationId(locations[0] ? String(locations[0].id) : '');
      setQuantity('1');
      setMinThreshold('1');
      setUnitPriceDollars('0.00');
      setCondition('Good');
      setIsLentOut(false);
      setLentTo('');
      setSerialNumber('');
      setPurchaseDate('');
      setWarrantyUntil('');
      setNotes('');
    }
  }, [open, editingItem, locations]);

  useEffect(() => {
    if (!open || !editingItem || activeTab !== 'history') return;
    let cancelled = false;
    setHistoryLoading(true);
    inventoryApi
      .listMovements(editingItem.id, 30)
      .then((rows) => {
        if (!cancelled) setItemHistory(rows);
      })
      .catch(() => {
        if (!cancelled) setItemHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, editingItem, activeTab]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedQty = Math.max(0, Math.floor(Number(quantity) || 0));
    const parsedMin = Math.max(0, Math.floor(Number(minThreshold) || 0));
    const parsedPrice = Math.max(0, Math.round((Number(unitPriceDollars) || 0) * 100));

    if (!name.trim()) {
      setError('Item name is required.');
      return;
    }

    const payload: ItemFormPayload = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      category: category.trim() || 'Other',
      brand: brand.trim(),
      locationId: locationId ? Number(locationId) : null,
      quantity: parsedQty,
      minThreshold: parsedMin,
      unitValueCents: parsedPrice,
      condition,
      status: isLentOut ? 'lent_out' : 'in_stock',
      lentTo: isLentOut ? lentTo.trim() : '',
      serialNumber: serialNumber.trim(),
      purchaseDate: purchaseDate.trim(),
      warrantyUntil: warrantyUntil.trim(),
      notes: notes.trim(),
      movementNote: movementNote.trim() || undefined,
    };

    setSubmitting(true);
    try {
      await onSave(payload, editingItem?.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={editingItem ? 'Edit inventory item' : 'Add inventory item'}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl bg-white h-full border-l border-slate-200 flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 truncate">
              {editingItem ? editingItem.name : 'Add Inventory Item'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {editingItem
                ? `SKU ${editingItem.sku} · Updated ${formatTimestamp(editingItem.updatedAt)}`
                : 'Record item details, storage location, and stock threshold.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {editingItem && (
          <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-6 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'details'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Movement History
            </button>
          </div>
        )}

        {activeTab === 'history' && editingItem ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : itemHistory.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No movement history recorded for this item yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                {itemHistory.map((m) => (
                  <div key={m.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-slate-900 capitalize">
                        {m.action}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {m.note || 'Inventory record updated'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                        {formatTimestamp(m.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-mono tabular-nums">
                      <div
                        className={`text-sm font-medium ${
                          m.delta > 0
                            ? 'text-green-700'
                            : m.delta < 0
                            ? 'text-red-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {m.previousQuantity} &rarr; {m.newQuantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="item-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Item Name
                </label>
                <input
                  id="item-name"
                  type="text"
                  required
                  maxLength={140}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sony A7 IV Mirrorless Body"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-category"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="item-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="item-location"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Storage Location
                  </label>
                  <select
                    id="item-location"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    <option value="">Unassigned</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.room} — {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-brand"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Brand / Maker
                  </label>
                  <input
                    id="item-brand"
                    type="text"
                    maxLength={80}
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., Sony, Wera, Anker"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-sku"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    SKU / Asset Tag
                  </label>
                  <input
                    id="item-sku"
                    type="text"
                    maxLength={48}
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-100">
                <div>
                  <label
                    htmlFor="item-qty"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Quantity
                  </label>
                  <input
                    id="item-qty"
                    type="number"
                    min={0}
                    max={1000000}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-threshold"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Low Alert At
                  </label>
                  <input
                    id="item-threshold"
                    type="number"
                    min={0}
                    max={1000000}
                    required
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-value"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Unit Value ($)
                  </label>
                  <input
                    id="item-value"
                    type="number"
                    step="0.01"
                    min={0}
                    value={unitPriceDollars}
                    onChange={(e) => setUnitPriceDollars(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-condition"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Condition
                  </label>
                  <select
                    id="item-condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    {ITEM_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="item-serial"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Serial Number
                  </label>
                  <input
                    id="item-serial"
                    type="text"
                    maxLength={100}
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={isLentOut}
                    onChange={(e) => setIsLentOut(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                  />
                  <span>Currently lent out to someone</span>
                </label>

                {isLentOut && (
                  <div className="mt-3">
                    <label
                      htmlFor="item-lent-to"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Borrower Name
                    </label>
                    <input
                      id="item-lent-to"
                      type="text"
                      maxLength={100}
                      value={lentTo}
                      onChange={(e) => setLentTo(e.target.value)}
                      placeholder="Who currently has this item?"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="item-purchase-date"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Purchase Date
                  </label>
                  <input
                    id="item-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>

                <div>
                  <label
                    htmlFor="item-warranty"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Warranty Until
                  </label>
                  <input
                    id="item-warranty"
                    type="date"
                    value={warrantyUntil}
                    onChange={(e) => setWarrantyUntil(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="item-notes"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Notes
                </label>
                <textarea
                  id="item-notes"
                  rows={3}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Accessories included, receipt reference, or maintenance notes..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 resize-y"
                />
              </div>

              {editingItem && (
                <div>
                  <label
                    htmlFor="item-movement-note"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Activity Log Note (Optional)
                  </label>
                  <input
                    id="item-movement-note"
                    type="text"
                    maxLength={200}
                    value={movementNote}
                    onChange={(e) => setMovementNote(e.target.value)}
                    placeholder="Reason for edit or stock change"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[40px] text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 min-h-[40px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                {submitting
                  ? 'Saving...'
                  : editingItem
                  ? 'Save Changes'
                  : 'Add Item'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
