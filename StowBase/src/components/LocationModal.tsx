import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { LocationSummary } from '../types/inventory';

interface LocationModalProps {
  open: boolean;
  editingLocation: LocationSummary | null;
  onClose: () => void;
  onSave: (
    payload: { name: string; room: string; description: string },
    locationId?: number
  ) => Promise<void>;
}

export function LocationModal({
  open,
  editingLocation,
  onClose,
  onSave,
}: LocationModalProps) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingLocation) {
      setName(editingLocation.name);
      setRoom(editingLocation.room);
      setDescription(editingLocation.description ?? '');
    } else {
      setName('');
      setRoom('');
      setDescription('');
    }
  }, [open, editingLocation]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !room.trim()) {
      setError('Both location name and room are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(
        {
          name: name.trim(),
          room: room.trim(),
          description: description.trim(),
        },
        editingLocation?.id
      );
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save location.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/35"
      role="dialog"
      aria-modal="true"
      aria-label={editingLocation ? 'Edit storage location' : 'Add storage location'}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {editingLocation ? 'Edit Storage Location' : 'New Storage Location'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {error && (
              <p
                role="alert"
                className="px-3 py-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg"
              >
                {error}
              </p>
            )}

            <div>
              <label
                htmlFor="loc-room"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Room / Zone
              </label>
              <input
                id="loc-room"
                type="text"
                required
                maxLength={60}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g., Home Office, Garage, Studio"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="loc-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Shelf, Cabinet, or Container Name
              </label>
              <input
                id="loc-name"
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Upper Birch Shelf, Bin #04"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700"
              />
            </div>

            <div>
              <label
                htmlFor="loc-desc"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Description (Optional)
              </label>
              <textarea
                id="loc-desc"
                rows={2}
                maxLength={240}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What types of items are kept here?"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-700 resize-none"
              />
            </div>
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
              className="px-4 py-2 min-h-[40px] text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {submitting ? 'Saving...' : editingLocation ? 'Save Location' : 'Create Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
