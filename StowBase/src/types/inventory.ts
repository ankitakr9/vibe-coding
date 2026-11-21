export type ItemStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'lent_out';
export type QueryStatus = ItemStatus | 'needs_restock' | 'all';
export type ItemSortBy =
  | 'updatedAt'
  | 'name'
  | 'quantity'
  | 'unitValue'
  | 'totalValue'
  | 'category';
export type SortDirection = 'asc' | 'desc';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  authMethod: 'jwt' | 'firebase';
}

export interface InventoryQueryParams {
  q?: string;
  category?: string;
  locationId?: number | 'unassigned' | null;
  status?: QueryStatus;
  condition?: string;
  minValueCents?: number | null;
  maxValueCents?: number | null;
  sortBy?: ItemSortBy;
  sortDir?: SortDirection;
}

export interface InventorySummaryMetrics {
  totalItems: number;
  totalUnits: number;
  totalValueCents: number;
  attentionCount: number;
  lentCount: number;
}

export interface LocationSummary {
  id: number;
  userId: number;
  name: string;
  room: string;
  description: string | null;
  createdAt: string;
  itemCount: number;
  totalUnits: number;
  totalValueCents: number;
}

export interface InventoryItem {
  id: number;
  userId: number;
  locationId: number | null;
  locationName: string | null;
  locationRoom: string | null;
  name: string;
  sku: string;
  category: string;
  brand: string | null;
  quantity: number;
  minThreshold: number;
  unitValueCents: number;
  condition: string;
  status: ItemStatus;
  lentTo: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  filteredCount: number;
  summary: InventorySummaryMetrics;
  categories: string[];
}

export interface InventoryMovement {
  id: number;
  userId: number;
  itemId: number | null;
  itemName: string;
  action: 'created' | 'adjusted' | 'updated' | 'moved' | 'lent' | 'returned' | 'deleted' | string;
  delta: number;
  previousQuantity: number;
  newQuantity: number;
  note: string | null;
  createdAt: string;
}

export interface ItemFormPayload {
  name: string;
  sku?: string;
  category: string;
  brand?: string;
  locationId: number | null;
  quantity: number;
  minThreshold: number;
  unitValueCents: number;
  condition: string;
  status?: ItemStatus;
  lentTo?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  movementNote?: string;
}

export const DEFAULT_CATEGORIES = [
  'Electronics',
  'Photography',
  'Tools',
  'Home Office',
  'Outdoor Gear',
  'Kitchen',
  'Household',
  'Documents & Media',
  'Collectibles',
  'Other',
] as const;

export const ITEM_CONDITIONS = [
  'New',
  'Excellent',
  'Good',
  'Fair',
  'Needs Repair',
] as const;
