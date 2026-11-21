import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  AuthConflictError,
  authenticateLocalUser,
  registerLocalUser,
  toSafeUserProfile,
} from './src/db/users.ts';
import { revokeJwt, signJwt } from './src/lib/jwt.ts';
import {
  adjustInventoryQuantity,
  createInventoryItem,
  createLocation,
  deleteInventoryItem,
  deleteLocation,
  getInventoryOverview,
  listInventoryItems,
  listLocationsWithStats,
  listMovements,
  seedSamplePersonalInventory,
  updateInventoryItem,
  updateLocation,
  type InventoryQueryOptions,
} from './src/db/inventory.ts';
import { broadcastToUser, subscribeUserStream } from './src/lib/realtime.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const itemStatusSchema = z.enum(['in_stock', 'low_stock', 'out_of_stock', 'lent_out']);
const queryStatusSchema = z.enum([
  'in_stock',
  'low_stock',
  'out_of_stock',
  'lent_out',
  'needs_restock',
]);
const sortBySchema = z.enum([
  'updatedAt',
  'name',
  'quantity',
  'unitValue',
  'totalValue',
  'category',
]);
const sortDirSchema = z.enum(['asc', 'desc']);

const registerSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().email('Enter a valid email address').max(160),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(160),
  password: z.string().min(1, 'Password is required').max(128),
});

const createLocationSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required').max(80),
  room: z.string().trim().min(1, 'Room or zone is required').max(60),
  description: z.string().trim().max(240).optional().default(''),
});

const updateLocationSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  room: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(240).optional(),
});

const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(140),
  sku: z.string().trim().max(48).optional().default(''),
  category: z.string().trim().min(1, 'Category is required').max(60),
  brand: z.string().trim().max(80).optional().default(''),
  locationId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().min(0).max(1000000),
  minThreshold: z.number().int().min(0).max(1000000).default(1),
  unitValueCents: z.number().int().min(0).max(1000000000).default(0),
  condition: z.string().trim().min(1).max(40).default('Good'),
  status: itemStatusSchema.optional(),
  lentTo: z.string().trim().max(100).optional().default(''),
  serialNumber: z.string().trim().max(100).optional().default(''),
  purchaseDate: z.string().trim().max(20).optional().default(''),
  warrantyUntil: z.string().trim().max(20).optional().default(''),
  notes: z.string().trim().max(1000).optional().default(''),
});

const updateItemSchema = createItemSchema.partial().extend({
  movementNote: z.string().trim().max(200).optional(),
});

const adjustQuantitySchema = z.object({
  delta: z.number().int().min(-100000).max(100000).refine((v) => v !== 0, {
    message: 'Adjustment delta must be non-zero.',
  }),
  note: z.string().trim().max(200).optional(),
});

function parsePositiveInt(raw: string): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

function parseNonNegativeInt(raw: string): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
}

// Simple sliding-window auth rate limiter (25 requests / 10 min per client IP)
const authRateMap = new Map<string, number[]>();
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 25;

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (authRateMap.get(ip) ?? []).filter((t) => now - t < AUTH_WINDOW_MS);
  if (timestamps.length >= AUTH_MAX_ATTEMPTS) {
    authRateMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  authRateMap.set(ip, timestamps);
  return false;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Authentication endpoints (JWT session management)
  app.post('/api/auth/register', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (isAuthRateLimited(clientIp)) {
      res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data.' });
      return;
    }

    try {
      const user = await registerLocalUser(parsed.data);
      const { token, expiresAt } = signJwt(user);
      res.status(201).json({ token, expiresAt, user });
    } catch (error: unknown) {
      if (error instanceof AuthConflictError) {
        res.status(409).json({ error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to register account.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (isAuthRateLimited(clientIp)) {
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid credentials.' });
      return;
    }

    try {
      const user = await authenticateLocalUser(parsed.data);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      const { token, expiresAt } = signJwt(user);
      res.json({ token, expiresAt, user });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res) => {
    if (req.authSession?.method === 'jwt' && req.authSession.jti && req.authSession.exp) {
      revokeJwt(req.authSession.jti, req.authSession.exp);
    }
    res.json({ loggedOut: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: toSafeUserProfile(req.dbUser!) });
  });

  // Real-time Server-Sent Events stream (authenticated via Bearer JWT or Firebase token)
  app.get('/api/stream', requireAuth, (req: AuthRequest, res) => {
    const uid = req.authSession!.uid;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const unsubscribe = subscribeUserStream(uid, res);
    req.on('close', () => {
      unsubscribe();
    });
  });

  // Locations
  app.get('/api/locations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await listLocationsWithStats(req.dbUser!.id);
      res.json({ locations: data });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load locations.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/locations', requireAuth, async (req: AuthRequest, res) => {
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid location data.' });
      return;
    }

    try {
      const created = await createLocation(req.dbUser!.id, parsed.data);
      broadcastToUser(req.authSession!.uid, {
        type: 'locations_updated',
        entity: 'location',
        action: 'created',
      });
      res.status(201).json({ location: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create location.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/locations/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: 'Invalid location ID.' });
      return;
    }

    const parsed = updateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid location update.' });
      return;
    }

    try {
      const updated = await updateLocation(req.dbUser!.id, id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: 'Location not found.' });
        return;
      }
      broadcastToUser(req.authSession!.uid, {
        type: 'locations_updated',
        entity: 'location',
        action: 'updated',
      });
      res.json({ location: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update location.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/locations/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: 'Invalid location ID.' });
      return;
    }

    try {
      const deleted = await deleteLocation(req.dbUser!.id, id);
      if (!deleted) {
        res.status(404).json({ error: 'Location not found.' });
        return;
      }
      broadcastToUser(req.authSession!.uid, {
        type: 'locations_updated',
        entity: 'location',
        action: 'deleted',
      });
      res.json({ deleted: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete location.';
      res.status(500).json({ error: message });
    }
  });

  // Inventory Items with PostgreSQL-level search, filtering, and sorting
  app.get('/api/items', requireAuth, async (req: AuthRequest, res) => {
    const queryOptions: InventoryQueryOptions = {};

    if (typeof req.query.q === 'string' && req.query.q.trim().length > 0) {
      queryOptions.q = req.query.q.trim().slice(0, 120);
    }

    if (typeof req.query.category === 'string' && req.query.category !== 'all' && req.query.category.trim()) {
      queryOptions.category = req.query.category.trim().slice(0, 60);
    }

    if (typeof req.query.condition === 'string' && req.query.condition !== 'all' && req.query.condition.trim()) {
      queryOptions.condition = req.query.condition.trim().slice(0, 40);
    }

    if (typeof req.query.locationId === 'string' && req.query.locationId.trim().length > 0) {
      if (req.query.locationId === 'unassigned') {
        queryOptions.locationId = 'unassigned';
      } else {
        const locId = parsePositiveInt(req.query.locationId);
        if (!locId) {
          res.status(400).json({ error: 'Invalid locationId filter.' });
          return;
        }
        queryOptions.locationId = locId;
      }
    }

    if (typeof req.query.status === 'string' && req.query.status !== 'all' && req.query.status.trim()) {
      const parsedStatus = queryStatusSchema.safeParse(req.query.status);
      if (!parsedStatus.success) {
        res.status(400).json({ error: 'Invalid status filter.' });
        return;
      }
      queryOptions.status = parsedStatus.data;
    }

    if (typeof req.query.minValueCents === 'string' && req.query.minValueCents.trim().length > 0) {
      const minVal = parseNonNegativeInt(req.query.minValueCents);
      if (minVal === null) {
        res.status(400).json({ error: 'Invalid minimum value filter.' });
        return;
      }
      queryOptions.minValueCents = minVal;
    }

    if (typeof req.query.maxValueCents === 'string' && req.query.maxValueCents.trim().length > 0) {
      const maxVal = parseNonNegativeInt(req.query.maxValueCents);
      if (maxVal === null) {
        res.status(400).json({ error: 'Invalid maximum value filter.' });
        return;
      }
      queryOptions.maxValueCents = maxVal;
    }

    if (typeof req.query.sortBy === 'string' && req.query.sortBy.trim()) {
      const parsedSort = sortBySchema.safeParse(req.query.sortBy);
      if (!parsedSort.success) {
        res.status(400).json({ error: 'Invalid sortBy attribute.' });
        return;
      }
      queryOptions.sortBy = parsedSort.data;
    }

    if (typeof req.query.sortDir === 'string' && req.query.sortDir.trim()) {
      const parsedDir = sortDirSchema.safeParse(req.query.sortDir);
      if (!parsedDir.success) {
        res.status(400).json({ error: 'Invalid sortDir parameter.' });
        return;
      }
      queryOptions.sortDir = parsedDir.data;
    }

    try {
      const [items, overview] = await Promise.all([
        listInventoryItems(req.dbUser!.id, queryOptions),
        getInventoryOverview(req.dbUser!.id),
      ]);
      res.json({
        items,
        filteredCount: items.length,
        summary: overview.summary,
        categories: overview.categories,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load inventory.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/items', requireAuth, async (req: AuthRequest, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid item data.' });
      return;
    }

    try {
      const created = await createInventoryItem(req.dbUser!.id, parsed.data);
      broadcastToUser(req.authSession!.uid, {
        type: 'inventory_updated',
        entity: 'item',
        action: 'created',
      });
      res.status(201).json({ item: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create item.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/items/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: 'Invalid item ID.' });
      return;
    }

    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid update data.' });
      return;
    }

    try {
      const updated = await updateInventoryItem(req.dbUser!.id, id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: 'Item not found.' });
        return;
      }
      broadcastToUser(req.authSession!.uid, {
        type: 'inventory_updated',
        entity: 'item',
        action: 'updated',
      });
      res.json({ item: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update item.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/items/:id/adjust', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: 'Invalid item ID.' });
      return;
    }

    const parsed = adjustQuantitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid quantity change.' });
      return;
    }

    try {
      const updated = await adjustInventoryQuantity(
        req.dbUser!.id,
        id,
        parsed.data.delta,
        parsed.data.note
      );
      if (!updated) {
        res.status(404).json({ error: 'Item not found.' });
        return;
      }
      broadcastToUser(req.authSession!.uid, {
        type: 'inventory_updated',
        entity: 'item',
        action: 'adjusted',
      });
      res.json({ item: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to adjust quantity.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/items/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(String(req.params.id));
    if (!id) {
      res.status(400).json({ error: 'Invalid item ID.' });
      return;
    }

    try {
      const deleted = await deleteInventoryItem(req.dbUser!.id, id);
      if (!deleted) {
        res.status(404).json({ error: 'Item not found.' });
        return;
      }
      broadcastToUser(req.authSession!.uid, {
        type: 'inventory_updated',
        entity: 'item',
        action: 'deleted',
      });
      res.json({ deleted: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete item.';
      res.status(500).json({ error: message });
    }
  });

  // Movement History
  app.get('/api/movements', requireAuth, async (req: AuthRequest, res) => {
    const rawItemId = req.query.itemId;
    const itemId =
      typeof rawItemId === 'string' && rawItemId.length > 0
        ? parsePositiveInt(rawItemId)
        : undefined;
    if (typeof rawItemId === 'string' && rawItemId.length > 0 && itemId === null) {
      res.status(400).json({ error: 'Invalid itemId parameter.' });
      return;
    }

    const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 80;
    const limit = Number.isFinite(rawLimit) ? rawLimit : 80;

    try {
      const movements = await listMovements(req.dbUser!.id, itemId ?? undefined, limit);
      res.json({ movements });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load activity log.';
      res.status(500).json({ error: message });
    }
  });

  // Starter Sample Inventory (only for empty accounts)
  app.post('/api/seed-sample', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await seedSamplePersonalInventory(req.dbUser!.id);
      broadcastToUser(req.authSession!.uid, {
        type: 'inventory_updated',
        entity: 'seed',
        action: 'created',
      });
      res.status(201).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load sample inventory.';
      res.status(500).json({ error: message });
    }
  });

  // Frontend Vite middleware (dev) or static dist serving (production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
