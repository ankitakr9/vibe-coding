import { resolveBearerToken } from './authStore';
import type {
  InventoryItem,
  InventoryListResponse,
  InventoryMovement,
  InventoryQueryParams,
  ItemFormPayload,
  LocationSummary,
} from '../types/inventory';

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await resolveBearerToken();
  if (!token) {
    throw new Error('Please sign in to continue.');
  }
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // Ignore invalid JSON error bodies
  }
  return fallback;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Request failed. Please try again.'));
  }

  return (await response.json()) as T;
}

export interface AuthApiResponse {
  token: string;
  expiresAt: number;
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
  };
}

export const authApi = {
  async register(payload: {
    displayName: string;
    email: string;
    password: string;
  }): Promise<AuthApiResponse> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Unable to create account.'));
    }
    return (await response.json()) as AuthApiResponse;
  },

  async login(payload: { email: string; password: string }): Promise<AuthApiResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Invalid email or password.'));
    }
    return (await response.json()) as AuthApiResponse;
  },

  async logout(): Promise<void> {
    const token = await resolveBearerToken();
    if (!token) return;
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => {
      // Clear local session even if network call fails
    });
  },
};

export const inventoryApi = {
  async listItems(params: InventoryQueryParams = {}): Promise<InventoryListResponse> {
    const search = new URLSearchParams();
    if (params.q && params.q.trim()) search.set('q', params.q.trim());
    if (params.category && params.category !== 'all') search.set('category', params.category);
    if (params.condition && params.condition !== 'all') search.set('condition', params.condition);
    if (params.locationId === 'unassigned') {
      search.set('locationId', 'unassigned');
    } else if (typeof params.locationId === 'number') {
      search.set('locationId', String(params.locationId));
    }
    if (params.status && params.status !== 'all') search.set('status', params.status);
    if (typeof params.minValueCents === 'number') {
      search.set('minValueCents', String(params.minValueCents));
    }
    if (typeof params.maxValueCents === 'number') {
      search.set('maxValueCents', String(params.maxValueCents));
    }
    if (params.sortBy) search.set('sortBy', params.sortBy);
    if (params.sortDir) search.set('sortDir', params.sortDir);

    const qs = search.toString();
    return apiRequest<InventoryListResponse>(qs ? `/api/items?${qs}` : '/api/items');
  },

  async createItem(payload: ItemFormPayload): Promise<InventoryItem> {
    const data = await apiRequest<{ item: InventoryItem }>('/api/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.item;
  },

  async updateItem(id: number, payload: Partial<ItemFormPayload>): Promise<InventoryItem> {
    const data = await apiRequest<{ item: InventoryItem }>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.item;
  },

  async adjustQuantity(id: number, delta: number, note?: string): Promise<InventoryItem> {
    const data = await apiRequest<{ item: InventoryItem }>(`/api/items/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta, note }),
    });
    return data.item;
  },

  async deleteItem(id: number): Promise<void> {
    await apiRequest<{ deleted: boolean }>(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },

  async listLocations(): Promise<LocationSummary[]> {
    const data = await apiRequest<{ locations: LocationSummary[] }>('/api/locations');
    return data.locations;
  },

  async createLocation(payload: {
    name: string;
    room: string;
    description?: string;
  }): Promise<void> {
    await apiRequest('/api/locations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateLocation(
    id: number,
    payload: { name?: string; room?: string; description?: string }
  ): Promise<void> {
    await apiRequest(`/api/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteLocation(id: number): Promise<void> {
    await apiRequest(`/api/locations/${id}`, {
      method: 'DELETE',
    });
  },

  async listMovements(itemId?: number, limit = 80): Promise<InventoryMovement[]> {
    const params = new URLSearchParams();
    if (itemId != null) params.set('itemId', String(itemId));
    params.set('limit', String(limit));
    const data = await apiRequest<{ movements: InventoryMovement[] }>(
      `/api/movements?${params.toString()}`
    );
    return data.movements;
  },

  async seedSample(): Promise<{ locationsCreated: number; itemsCreated: number }> {
    return apiRequest('/api/seed-sample', { method: 'POST' });
  },
};

export function subscribeToRealtimeUpdates(
  onUpdate: (eventType: string) => void
): () => void {
  const controller = new AbortController();
  let stopped = false;

  const connect = async () => {
    while (!stopped) {
      try {
        const token = await resolveBearerToken();
        if (!token) return;
        const response = await fetch('/api/stream', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Stream unavailable');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const jsonText = line.slice(5).trim();
            if (!jsonText) continue;
            try {
              const event = JSON.parse(jsonText) as { type?: string };
              if (event.type && event.type !== 'connected') {
                onUpdate(event.type);
              }
            } catch {
              // Ignore malformed heartbeat chunk
            }
          }
        }
      } catch (err) {
        if (stopped || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    }
  };

  void connect();

  return () => {
    stopped = true;
    controller.abort();
  };
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function escapeCsvCell(raw: string | number | null | undefined): string {
  const text = raw == null ? '' : String(raw);
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function exportInventoryToCsv(items: InventoryItem[]): void {
  const headers = [
    'Name',
    'SKU',
    'Category',
    'Brand',
    'Location',
    'Room',
    'Quantity',
    'Min Threshold',
    'Unit Value (USD)',
    'Total Value (USD)',
    'Condition',
    'Status',
    'Lent To',
    'Serial Number',
    'Purchase Date',
    'Warranty Until',
    'Notes',
  ];

  const rows = items.map((item) => [
    item.name,
    item.sku,
    item.category,
    item.brand ?? '',
    item.locationName ?? 'Unassigned',
    item.locationRoom ?? '',
    item.quantity,
    item.minThreshold,
    (item.unitValueCents / 100).toFixed(2),
    ((item.quantity * item.unitValueCents) / 100).toFixed(2),
    item.condition,
    item.status,
    item.lentTo ?? '',
    item.serialNumber ?? '',
    item.purchaseDate ?? '',
    item.warrantyUntil ?? '',
    item.notes ?? '',
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stowbase-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
