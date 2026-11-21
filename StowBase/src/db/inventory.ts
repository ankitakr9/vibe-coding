import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from './index.ts';
import {
  inventoryItems,
  inventoryMovements,
  locations,
  type InventoryItemRecord,
  type InventoryMovementRecord,
  type LocationRecord,
} from './schema.ts';

export type ItemStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'lent_out';
export type ItemSortBy =
  | 'updatedAt'
  | 'name'
  | 'quantity'
  | 'unitValue'
  | 'totalValue'
  | 'category';
export type SortDirection = 'asc' | 'desc';

export interface InventoryQueryOptions {
  q?: string;
  category?: string;
  locationId?: number | 'unassigned';
  status?: ItemStatus | 'needs_restock';
  condition?: string;
  minValueCents?: number;
  maxValueCents?: number;
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

export interface ItemWithLocation extends InventoryItemRecord {
  locationName: string | null;
  locationRoom: string | null;
}

export interface LocationSummary extends LocationRecord {
  itemCount: number;
  totalUnits: number;
  totalValueCents: number;
}

export interface CreateItemInput {
  name: string;
  sku?: string;
  category: string;
  brand?: string;
  locationId?: number | null;
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
}

export interface UpdateItemInput {
  name?: string;
  sku?: string;
  category?: string;
  brand?: string;
  locationId?: number | null;
  quantity?: number;
  minThreshold?: number;
  unitValueCents?: number;
  condition?: string;
  status?: ItemStatus;
  lentTo?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  movementNote?: string;
}

export function deriveItemStatus(
  quantity: number,
  minThreshold: number,
  requestedStatus?: ItemStatus
): ItemStatus {
  if (requestedStatus === 'lent_out') {
    return 'lent_out';
  }
  if (quantity <= 0) {
    return 'out_of_stock';
  }
  if (quantity <= minThreshold) {
    return 'low_stock';
  }
  return 'in_stock';
}

function generateSku(category: string, name: string): string {
  const catCode = category.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'INV';
  const nameCode = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${catCode}-${nameCode}-${suffix}`;
}

function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function listLocationsWithStats(userId: number): Promise<LocationSummary[]> {
  try {
    const [userLocations, userItems] = await Promise.all([
      db
        .select()
        .from(locations)
        .where(eq(locations.userId, userId))
        .orderBy(locations.room, locations.name),
      db
        .select({
          locationId: inventoryItems.locationId,
          quantity: inventoryItems.quantity,
          unitValueCents: inventoryItems.unitValueCents,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.userId, userId)),
    ]);

    const statsMap = new Map<
      number,
      { itemCount: number; totalUnits: number; totalValueCents: number }
    >();

    for (const item of userItems) {
      if (item.locationId == null) continue;
      const current = statsMap.get(item.locationId) ?? {
        itemCount: 0,
        totalUnits: 0,
        totalValueCents: 0,
      };
      current.itemCount += 1;
      current.totalUnits += item.quantity;
      current.totalValueCents += item.quantity * item.unitValueCents;
      statsMap.set(item.locationId, current);
    }

    return userLocations.map((loc) => {
      const stats = statsMap.get(loc.id) ?? {
        itemCount: 0,
        totalUnits: 0,
        totalValueCents: 0,
      };
      return {
        ...loc,
        ...stats,
      };
    });
  } catch (error) {
    console.error('Database query failed in listLocationsWithStats:', error);
    throw new Error('Failed to load storage locations.', { cause: error });
  }
}

export async function createLocation(
  userId: number,
  input: { name: string; room: string; description?: string }
): Promise<LocationRecord> {
  try {
    const [created] = await db
      .insert(locations)
      .values({
        userId,
        name: input.name.trim(),
        room: input.room.trim() || 'General',
        description: input.description?.trim() ?? '',
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Database query failed in createLocation:', error);
    throw new Error('Failed to create storage location.', { cause: error });
  }
}

export async function updateLocation(
  userId: number,
  locationId: number,
  input: { name?: string; room?: string; description?: string }
): Promise<LocationRecord | null> {
  try {
    const updatePayload: Partial<typeof locations.$inferInsert> = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.room !== undefined) updatePayload.room = input.room.trim() || 'General';
    if (input.description !== undefined) updatePayload.description = input.description.trim();

    const [updated] = await db
      .update(locations)
      .set(updatePayload)
      .where(and(eq(locations.id, locationId), eq(locations.userId, userId)))
      .returning();

    return updated ?? null;
  } catch (error) {
    console.error('Database query failed in updateLocation:', error);
    throw new Error('Failed to update storage location.', { cause: error });
  }
}

export async function deleteLocation(userId: number, locationId: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(locations)
      .where(and(eq(locations.id, locationId), eq(locations.userId, userId)))
      .returning({ id: locations.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteLocation:', error);
    throw new Error('Failed to delete storage location.', { cause: error });
  }
}

export async function getInventoryOverview(userId: number): Promise<{
  summary: InventorySummaryMetrics;
  categories: string[];
}> {
  try {
    const [summaryRows, categoryRows] = await Promise.all([
      db
        .select({
          totalItems: sql<number>`count(*)::int`,
          totalUnits: sql<number>`coalesce(sum(${inventoryItems.quantity}), 0)::int`,
          totalValueCents: sql<number>`coalesce(sum(${inventoryItems.quantity}::bigint * ${inventoryItems.unitValueCents}::bigint), 0)::bigint`,
          attentionCount: sql<number>`count(*) filter (where ${inventoryItems.status} in ('low_stock', 'out_of_stock'))::int`,
          lentCount: sql<number>`count(*) filter (where ${inventoryItems.status} = 'lent_out')::int`,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.userId, userId)),
      db
        .selectDistinct({ category: inventoryItems.category })
        .from(inventoryItems)
        .where(eq(inventoryItems.userId, userId))
        .orderBy(asc(inventoryItems.category)),
    ]);

    const agg = summaryRows[0];
    return {
      summary: {
        totalItems: Number(agg?.totalItems ?? 0),
        totalUnits: Number(agg?.totalUnits ?? 0),
        totalValueCents: Number(agg?.totalValueCents ?? 0),
        attentionCount: Number(agg?.attentionCount ?? 0),
        lentCount: Number(agg?.lentCount ?? 0),
      },
      categories: categoryRows.map((r) => r.category).filter(Boolean),
    };
  } catch (error) {
    console.error('Database query failed in getInventoryOverview:', error);
    throw new Error('Failed to calculate inventory metrics.', { cause: error });
  }
}

export async function listInventoryItems(
  userId: number,
  options: InventoryQueryOptions = {}
): Promise<ItemWithLocation[]> {
  try {
    const conditions: SQL[] = [eq(inventoryItems.userId, userId)];

    if (options.q && options.q.trim().length > 0) {
      const pattern = `%${escapeLikePattern(options.q.trim())}%`;
      const searchCond = or(
        ilike(inventoryItems.name, pattern),
        ilike(inventoryItems.sku, pattern),
        ilike(inventoryItems.brand, pattern),
        ilike(inventoryItems.category, pattern),
        ilike(inventoryItems.serialNumber, pattern),
        ilike(inventoryItems.lentTo, pattern),
        ilike(inventoryItems.notes, pattern),
        ilike(locations.name, pattern),
        ilike(locations.room, pattern)
      );
      if (searchCond) conditions.push(searchCond);
    }

    if (options.category && options.category !== 'all') {
      conditions.push(eq(inventoryItems.category, options.category));
    }

    if (options.locationId === 'unassigned') {
      conditions.push(isNull(inventoryItems.locationId));
    } else if (typeof options.locationId === 'number') {
      conditions.push(eq(inventoryItems.locationId, options.locationId));
    }

    if (options.status === 'needs_restock') {
      conditions.push(inArray(inventoryItems.status, ['low_stock', 'out_of_stock']));
    } else if (options.status) {
      conditions.push(eq(inventoryItems.status, options.status));
    }

    if (options.condition && options.condition !== 'all') {
      conditions.push(eq(inventoryItems.condition, options.condition));
    }

    if (typeof options.minValueCents === 'number') {
      conditions.push(gte(inventoryItems.unitValueCents, options.minValueCents));
    }

    if (typeof options.maxValueCents === 'number') {
      conditions.push(lte(inventoryItems.unitValueCents, options.maxValueCents));
    }

    const dir = options.sortDir === 'asc' ? asc : desc;
    let primaryOrder: SQL;
    switch (options.sortBy) {
      case 'name':
        primaryOrder = dir(sql`lower(${inventoryItems.name})`);
        break;
      case 'quantity':
        primaryOrder = dir(inventoryItems.quantity);
        break;
      case 'unitValue':
        primaryOrder = dir(inventoryItems.unitValueCents);
        break;
      case 'totalValue':
        primaryOrder = dir(
          sql`(${inventoryItems.quantity}::bigint * ${inventoryItems.unitValueCents}::bigint)`
        );
        break;
      case 'category':
        primaryOrder = dir(sql`lower(${inventoryItems.category})`);
        break;
      case 'updatedAt':
      default:
        primaryOrder = dir(inventoryItems.updatedAt);
        break;
    }

    const rows = await db
      .select({
        item: inventoryItems,
        locationName: locations.name,
        locationRoom: locations.room,
      })
      .from(inventoryItems)
      .leftJoin(locations, eq(inventoryItems.locationId, locations.id))
      .where(and(...conditions))
      .orderBy(primaryOrder, desc(inventoryItems.id));

    return rows.map((row) => ({
      ...row.item,
      locationName: row.locationName ?? null,
      locationRoom: row.locationRoom ?? null,
    }));
  } catch (error) {
    console.error('Database query failed in listInventoryItems:', error);
    throw new Error('Failed to load inventory items.', { cause: error });
  }
}

export async function createInventoryItem(
  userId: number,
  input: CreateItemInput
): Promise<InventoryItemRecord> {
  try {
    return await db.transaction(async (tx) => {
      let validLocationId: number | null = null;
      if (input.locationId != null) {
        const [ownedLoc] = await tx
          .select({ id: locations.id })
          .from(locations)
          .where(and(eq(locations.id, input.locationId), eq(locations.userId, userId)));
        if (ownedLoc) {
          validLocationId = ownedLoc.id;
        }
      }

      const computedStatus = deriveItemStatus(
        input.quantity,
        input.minThreshold,
        input.status
      );
      const sku = input.sku?.trim() || generateSku(input.category, input.name);

      const [created] = await tx
        .insert(inventoryItems)
        .values({
          userId,
          locationId: validLocationId,
          name: input.name.trim(),
          sku,
          category: input.category.trim(),
          brand: input.brand?.trim() ?? '',
          quantity: input.quantity,
          minThreshold: input.minThreshold,
          unitValueCents: input.unitValueCents,
          condition: input.condition.trim() || 'Good',
          status: computedStatus,
          lentTo: computedStatus === 'lent_out' ? (input.lentTo?.trim() ?? '') : '',
          serialNumber: input.serialNumber?.trim() ?? '',
          purchaseDate: input.purchaseDate?.trim() ?? '',
          warrantyUntil: input.warrantyUntil?.trim() ?? '',
          notes: input.notes?.trim() ?? '',
        })
        .returning();

      await tx.insert(inventoryMovements).values({
        userId,
        itemId: created.id,
        itemName: created.name,
        action: 'created',
        delta: created.quantity,
        previousQuantity: 0,
        newQuantity: created.quantity,
        note: `Added to ${created.category}`,
      });

      return created;
    });
  } catch (error) {
    console.error('Database query failed in createInventoryItem:', error);
    throw new Error('Failed to create inventory item.', { cause: error });
  }
}

export async function updateInventoryItem(
  userId: number,
  itemId: number,
  input: UpdateItemInput
): Promise<InventoryItemRecord | null> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)));

      if (!existing) {
        return null;
      }

      let validLocationId = existing.locationId;
      if (input.locationId !== undefined) {
        if (input.locationId === null) {
          validLocationId = null;
        } else {
          const [ownedLoc] = await tx
            .select({ id: locations.id })
            .from(locations)
            .where(and(eq(locations.id, input.locationId), eq(locations.userId, userId)));
          validLocationId = ownedLoc ? ownedLoc.id : existing.locationId;
        }
      }

      const nextQty = input.quantity !== undefined ? input.quantity : existing.quantity;
      const nextThreshold =
        input.minThreshold !== undefined ? input.minThreshold : existing.minThreshold;
      const requestedStatus =
        input.status !== undefined ? input.status : (existing.status as ItemStatus);
      const nextStatus = deriveItemStatus(nextQty, nextThreshold, requestedStatus);

      const nextLentTo =
        nextStatus === 'lent_out'
          ? (input.lentTo !== undefined ? input.lentTo.trim() : existing.lentTo ?? '')
          : '';

      const [updated] = await tx
        .update(inventoryItems)
        .set({
          locationId: validLocationId,
          name: input.name !== undefined ? input.name.trim() : existing.name,
          sku: input.sku !== undefined ? input.sku.trim() : existing.sku,
          category: input.category !== undefined ? input.category.trim() : existing.category,
          brand: input.brand !== undefined ? input.brand.trim() : existing.brand,
          quantity: nextQty,
          minThreshold: nextThreshold,
          unitValueCents:
            input.unitValueCents !== undefined
              ? input.unitValueCents
              : existing.unitValueCents,
          condition: input.condition !== undefined ? input.condition.trim() : existing.condition,
          status: nextStatus,
          lentTo: nextLentTo,
          serialNumber:
            input.serialNumber !== undefined
              ? input.serialNumber.trim()
              : existing.serialNumber,
          purchaseDate:
            input.purchaseDate !== undefined
              ? input.purchaseDate.trim()
              : existing.purchaseDate,
          warrantyUntil:
            input.warrantyUntil !== undefined
              ? input.warrantyUntil.trim()
              : existing.warrantyUntil,
          notes: input.notes !== undefined ? input.notes.trim() : existing.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)))
        .returning();

      const delta = nextQty - existing.quantity;
      let action = 'updated';
      let note = input.movementNote?.trim() || 'Updated item details';

      if (existing.status !== 'lent_out' && nextStatus === 'lent_out') {
        action = 'lent';
        note = nextLentTo ? `Lent to ${nextLentTo}` : 'Marked as lent out';
      } else if (existing.status === 'lent_out' && nextStatus !== 'lent_out') {
        action = 'returned';
        note = existing.lentTo ? `Returned from ${existing.lentTo}` : 'Returned to inventory';
      } else if (existing.locationId !== validLocationId) {
        action = 'moved';
        note = input.movementNote?.trim() || 'Relocated storage location';
      } else if (delta !== 0) {
        action = 'adjusted';
        note = input.movementNote?.trim() || `Quantity updated (${delta > 0 ? '+' : ''}${delta})`;
      }

      await tx.insert(inventoryMovements).values({
        userId,
        itemId: updated.id,
        itemName: updated.name,
        action,
        delta,
        previousQuantity: existing.quantity,
        newQuantity: nextQty,
        note,
      });

      return updated;
    });
  } catch (error) {
    console.error('Database query failed in updateInventoryItem:', error);
    throw new Error('Failed to update inventory item.', { cause: error });
  }
}

export async function adjustInventoryQuantity(
  userId: number,
  itemId: number,
  delta: number,
  note?: string
): Promise<InventoryItemRecord | null> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)));

      if (!existing) {
        return null;
      }

      const nextQty = Math.max(0, existing.quantity + delta);
      const actualDelta = nextQty - existing.quantity;
      const nextStatus = deriveItemStatus(
        nextQty,
        existing.minThreshold,
        existing.status === 'lent_out' ? 'lent_out' : undefined
      );

      const [updated] = await tx
        .update(inventoryItems)
        .set({
          quantity: nextQty,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)))
        .returning();

      if (actualDelta !== 0) {
        await tx.insert(inventoryMovements).values({
          userId,
          itemId: updated.id,
          itemName: updated.name,
          action: 'adjusted',
          delta: actualDelta,
          previousQuantity: existing.quantity,
          newQuantity: nextQty,
          note:
            note?.trim() ||
            (actualDelta > 0
              ? `Restocked ${actualDelta} unit${actualDelta === 1 ? '' : 's'}`
              : `Removed ${Math.abs(actualDelta)} unit${Math.abs(actualDelta) === 1 ? '' : 's'}`),
        });
      }

      return updated;
    });
  } catch (error) {
    console.error('Database query failed in adjustInventoryQuantity:', error);
    throw new Error('Failed to adjust item quantity.', { cause: error });
  }
}

export async function deleteInventoryItem(userId: number, itemId: number): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)));

      if (!existing) {
        return false;
      }

      await tx.insert(inventoryMovements).values({
        userId,
        itemId: null,
        itemName: existing.name,
        action: 'deleted',
        delta: -existing.quantity,
        previousQuantity: existing.quantity,
        newQuantity: 0,
        note: `Removed SKU ${existing.sku} from inventory`,
      });

      await tx
        .delete(inventoryItems)
        .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.userId, userId)));

      return true;
    });
  } catch (error) {
    console.error('Database query failed in deleteInventoryItem:', error);
    throw new Error('Failed to delete inventory item.', { cause: error });
  }
}

export async function listMovements(
  userId: number,
  itemId?: number,
  limit = 60
): Promise<InventoryMovementRecord[]> {
  try {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const whereClause =
      itemId != null
        ? and(
            eq(inventoryMovements.userId, userId),
            eq(inventoryMovements.itemId, itemId)
          )
        : eq(inventoryMovements.userId, userId);

    return await db
      .select()
      .from(inventoryMovements)
      .where(whereClause)
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(safeLimit);
  } catch (error) {
    console.error('Database query failed in listMovements:', error);
    throw new Error('Failed to load activity history.', { cause: error });
  }
}

export async function seedSamplePersonalInventory(userId: number): Promise<{
  locationsCreated: number;
  itemsCreated: number;
}> {
  try {
    return await db.transaction(async (tx) => {
      const existingItems = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.userId, userId))
        .limit(1);

      if (existingItems.length > 0) {
        return { locationsCreated: 0, itemsCreated: 0 };
      }

      const sampleLocs = await tx
        .insert(locations)
        .values([
          {
            userId,
            name: 'Desk & Media Cabinet',
            room: 'Home Office',
            description: 'Workstation hardware, cables, drives, and audio gear',
          },
          {
            userId,
            name: 'Dry Cabinet & Birch Shelf',
            room: 'Studio',
            description: 'Humidity-controlled camera bodies, lenses, and film stocks',
          },
          {
            userId,
            name: 'Steel Tool Chest',
            room: 'Garage',
            description: 'Precision hand tools, drivers, and cordless power tools',
          },
          {
            userId,
            name: 'Gear Bin #02',
            room: 'Hall Closet',
            description: 'Backpacking essentials, headlamps, and seasonal outerwear',
          },
        ])
        .returning();

      const [office, studio, garage, closet] = sampleLocs;

      const sampleItemsData = [
        {
          locationId: studio.id,
          name: 'Fujifilm X100VI Digital Camera',
          sku: 'CAM-FUJ-1006',
          category: 'Photography',
          brand: 'Fujifilm',
          quantity: 1,
          minThreshold: 1,
          unitValueCents: 159900,
          condition: 'New',
          status: 'in_stock',
          lentTo: '',
          serialNumber: 'FJ-4402819A',
          purchaseDate: '2026-03-14',
          warrantyUntil: '2028-03-14',
          notes: 'Includes weather-sealing adapter ring and UV filter.',
        },
        {
          locationId: studio.id,
          name: 'SanDisk Extreme PRO 128GB SDXC',
          sku: 'STO-SND-1280',
          category: 'Photography',
          brand: 'SanDisk',
          quantity: 4,
          minThreshold: 2,
          unitValueCents: 3200,
          condition: 'Excellent',
          status: 'in_stock',
          lentTo: '',
          serialNumber: '',
          purchaseDate: '2025-11-02',
          warrantyUntil: '',
          notes: 'Stored inside waterproof SD wallet.',
        },
        {
          locationId: office.id,
          name: 'Sony WH-1000XM5 Headphones',
          sku: 'AUD-SNY-5001',
          category: 'Electronics',
          brand: 'Sony',
          quantity: 1,
          minThreshold: 0,
          unitValueCents: 34800,
          condition: 'Excellent',
          status: 'in_stock',
          lentTo: '',
          serialNumber: 'SN-88392014',
          purchaseDate: '2025-07-19',
          warrantyUntil: '2027-07-19',
          notes: 'Matte silver finish with hard travel case.',
        },
        {
          locationId: office.id,
          name: 'Anker 240W Braided USB-C Cables',
          sku: 'ACC-ANK-2400',
          category: 'Electronics',
          brand: 'Anker',
          quantity: 2,
          minThreshold: 3,
          unitValueCents: 1800,
          condition: 'Good',
          status: 'low_stock',
          lentTo: '',
          serialNumber: '',
          purchaseDate: '2026-01-08',
          warrantyUntil: '',
          notes: 'Keep at least 3 spares for travel pouch and desk dock.',
        },
        {
          locationId: office.id,
          name: 'Samsung T9 Portable SSD 2TB',
          sku: 'STO-SAM-2009',
          category: 'Electronics',
          brand: 'Samsung',
          quantity: 2,
          minThreshold: 1,
          unitValueCents: 21900,
          condition: 'Excellent',
          status: 'in_stock',
          lentTo: '',
          serialNumber: 'SM-T9-004182',
          purchaseDate: '2026-02-20',
          warrantyUntil: '2031-02-20',
          notes: 'Drive A: Photo archive, Drive B: Offsite mirror.',
        },
        {
          locationId: garage.id,
          name: 'Wera Kraftform Micro Screwdriver Set',
          sku: 'TLS-WER-2050',
          category: 'Tools',
          brand: 'Wera',
          quantity: 1,
          minThreshold: 0,
          unitValueCents: 6800,
          condition: 'Good',
          status: 'lent_out',
          lentTo: 'Marcus Lin',
          serialNumber: '',
          purchaseDate: '2024-09-11',
          warrantyUntil: '',
          notes: '12-piece precision kit in fabric roll.',
        },
        {
          locationId: garage.id,
          name: 'AA Rechargeable Eneloop Batteries (4-Pack)',
          sku: 'SUP-PAN-4401',
          category: 'Household',
          brand: 'Panasonic',
          quantity: 0,
          minThreshold: 2,
          unitValueCents: 1650,
          condition: 'New',
          status: 'out_of_stock',
          lentTo: '',
          serialNumber: '',
          purchaseDate: '2025-05-03',
          warrantyUntil: '',
          notes: 'Need to reorder packs for flash units and wall clocks.',
        },
        {
          locationId: closet.id,
          name: 'Nitecore NU25 UL Rechargeable Headlamp',
          sku: 'OUT-NIT-0250',
          category: 'Outdoor Gear',
          brand: 'Nitecore',
          quantity: 2,
          minThreshold: 1,
          unitValueCents: 3695,
          condition: 'Excellent',
          status: 'in_stock',
          lentTo: '',
          serialNumber: '',
          purchaseDate: '2025-08-22',
          warrantyUntil: '2027-08-22',
          notes: '400 lumens ultralight USB-C.',
        },
      ];

      const insertedItems = await tx
        .insert(inventoryItems)
        .values(
          sampleItemsData.map((item) => ({
            userId,
            ...item,
          }))
        )
        .returning();

      await tx.insert(inventoryMovements).values(
        insertedItems.map((item) => ({
          userId,
          itemId: item.id,
          itemName: item.name,
          action: 'created',
          delta: item.quantity,
          previousQuantity: 0,
          newQuantity: item.quantity,
          note: `Cataloged in ${item.category}`,
        }))
      );

      return {
        locationsCreated: sampleLocs.length,
        itemsCreated: insertedItems.length,
      };
    });
  } catch (error) {
    console.error('Database query failed in seedSamplePersonalInventory:', error);
    throw new Error('Failed to load sample inventory.', { cause: error });
  }
}
