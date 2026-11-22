import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  clearUserHistory,
  createAndIndexDocument,
  deleteDocumentById,
  deleteUserHistoryEntry,
  getAdminOverview,
  getCorpusSummary,
  getDocumentById,
  getInvertedIndexTerms,
  getUserSearchHistory,
  indexDocumentRecord,
  listAdminDocuments,
  rebuildEntireInvertedIndex,
  recordSearchHistory,
  searchDocuments,
  updateAndReindexDocument,
} from './src/db/searchRepo.ts';
import { crawlWebPage } from './src/search/crawler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createDocumentSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default(''),
  sourceType: z.enum(['webpage', 'document']).default('document'),
  category: z.string().trim().min(1).max(60).default('General'),
  summary: z.string().trim().max(500).optional().default(''),
  keywords: z.string().trim().max(300).optional().default(''),
  content: z.string().trim().min(20, 'Content must be at least 20 characters').max(40000),
});

const updateDocumentSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  url: z.string().trim().min(3).max(500).optional(),
  sourceType: z.enum(['webpage', 'document']).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  summary: z.string().trim().max(500).optional(),
  keywords: z.string().trim().max(300).optional(),
  content: z.string().trim().min(20).max(40000).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

const crawlRequestSchema = z.object({
  url: z.string().trim().url('Please enter a valid web page URL'),
  category: z.string().trim().min(1).max(60).default('Web Reference'),
});

function normalizeUrlAndDomain(
  rawUrl: string,
  title: string,
  sourceType: 'webpage' | 'document'
): { url: string; domain: string } {
  const trimmed = rawUrl.trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('URL must start with http:// or https://');
      }
      return {
        url: parsed.toString(),
        domain: parsed.hostname.replace(/^www\./, ''),
      };
    } catch {
      if (sourceType === 'webpage') {
        throw new Error('Web pages require a valid http:// or https:// URL.');
      }
    }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    url: `https://docs.lumenindex.local/${slug || 'document'}-${suffix}`,
    domain: 'docs.lumenindex.local',
  };
}

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const num = Number.parseInt(raw, 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  // Current authenticated user profile & role
  app.get('/api/me', requireAuth, (req: AuthRequest, res) => {
    const user = req.dbUser!;
    res.json({
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      role: user.role,
    });
  });

  // Public corpus summary for search filters
  app.get('/api/corpus/summary', async (_req, res) => {
    try {
      const summary = await getCorpusSummary();
      res.json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load summary.';
      res.status(500).json({ error: message });
    }
  });

  // Full-text BM25 search endpoint (public; records history when authenticated)
  app.get('/api/search', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 240) : '';
      const rawType = typeof req.query.type === 'string' ? req.query.type : 'all';
      const sourceType =
        rawType === 'webpage' || rawType === 'document' ? rawType : 'all';
      const category =
        typeof req.query.category === 'string' && req.query.category.trim()
          ? req.query.category.trim().slice(0, 60)
          : 'All';
      const rawSort = typeof req.query.sort === 'string' ? req.query.sort : 'relevance';
      const sort =
        rawSort === 'newest' || rawSort === 'words' ? rawSort : 'relevance';
      const shouldRecord = req.query.record !== 'false';

      const payload = await searchDocuments({
        query: q,
        sourceType,
        category,
        sort,
      });

      if (shouldRecord && req.dbUser && q.trim().length > 0) {
        await recordSearchHistory({
          userId: req.dbUser.id,
          query: q.trim(),
          sourceFilter: sourceType,
          resultCount: payload.totalResults,
          executionMs: payload.executionMs,
        });
      }

      res.json(payload);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Search failed.';
      res.status(500).json({ error: message });
    }
  });

  // Retrieve full document content for reading view
  app.get('/api/documents/:id', optionalAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    try {
      const doc = await getDocumentById(id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      if (doc.status !== 'active' && req.dbUser?.role !== 'admin') {
        return res.status(404).json({ error: 'Document not found.' });
      }
      return res.json(doc);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to fetch document.';
      return res.status(500).json({ error: message });
    }
  });

  // Index a manual document or web page entry (authenticated users)
  app.post('/api/documents', requireAuth, async (req: AuthRequest, res) => {
    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid document input.',
      });
    }

    try {
      const data = parsed.data;
      const { url, domain } = normalizeUrlAndDomain(
        data.url,
        data.title,
        data.sourceType
      );
      const summary =
        data.summary.trim() ||
        data.content.replace(/\s+/g, ' ').trim().slice(0, 260);

      const created = await createAndIndexDocument({
        title: data.title,
        url,
        domain,
        sourceType: data.sourceType,
        category: data.category,
        summary,
        content: data.content,
        keywords: data.keywords,
        createdByUserId: req.dbUser!.id,
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to index document.';
      const status = message.includes('already indexed') || message.includes('http://') ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  // Crawl and index a live public web page URL (authenticated users, SSRF-protected)
  app.post('/api/documents/crawl', requireAuth, async (req: AuthRequest, res) => {
    const parsed = crawlRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Please enter a valid URL.',
      });
    }

    try {
      const crawled = await crawlWebPage(parsed.data.url);
      const created = await createAndIndexDocument({
        title: crawled.title,
        url: crawled.url,
        domain: crawled.domain,
        sourceType: 'webpage',
        category: parsed.data.category,
        summary: crawled.summary,
        content: crawled.content,
        keywords: crawled.keywords,
        createdByUserId: req.dbUser!.id,
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to crawl and index URL.';
      const isClientError =
        message.includes('valid URL') ||
        message.includes('http://') ||
        message.includes('Private') ||
        message.includes('restricted') ||
        message.includes('already indexed') ||
        message.includes('Could not resolve') ||
        message.includes('responded with HTTP') ||
        message.includes('Only HTML') ||
        message.includes('enough readable text');
      return res.status(isClientError ? 400 : 502).json({ error: message });
    }
  });

  // User search history endpoints (strictly scoped to authenticated user)
  app.get('/api/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const filter = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
      const items = await getUserSearchHistory(req.dbUser!.id, filter);
      res.json({ items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load history.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/history/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid history entry ID.' });
    }
    try {
      const deleted = await deleteUserHistoryEntry(req.dbUser!.id, id);
      if (!deleted) {
        return res.status(404).json({ error: 'History entry not found.' });
      }
      return res.json({ deleted: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to delete entry.';
      return res.status(500).json({ error: message });
    }
  });

  app.delete('/api/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const removedCount = await clearUserHistory(req.dbUser!.id);
      res.json({ cleared: true, removedCount });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to clear history.';
      res.status(500).json({ error: message });
    }
  });

  // Admin module routes (strictly requireAdmin)
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const overview = await getAdminOverview();
      res.json(overview);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load admin overview.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/admin/documents', requireAdmin, async (req, res) => {
    try {
      const filter = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
      const rawType = typeof req.query.type === 'string' ? req.query.type : 'all';
      const sourceType =
        rawType === 'webpage' || rawType === 'document' ? rawType : 'all';
      const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'all';
      const status =
        rawStatus === 'active' || rawStatus === 'archived' ? rawStatus : 'all';

      const items = await listAdminDocuments({ filter, sourceType, status });
      res.json({ items });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load documents.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/documents/:id', requireAdmin, async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const parsed = updateDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid update payload.',
      });
    }

    try {
      const data = parsed.data;
      let domain: string | undefined;
      let normalizedUrl = data.url;
      if (data.url) {
        const parsedUrl = new URL(data.url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return res.status(400).json({ error: 'URL must start with http:// or https://' });
        }
        normalizedUrl = parsedUrl.toString();
        domain = parsedUrl.hostname.replace(/^www\./, '');
      }

      const updated = await updateAndReindexDocument(id, {
        ...data,
        url: normalizedUrl,
        domain,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      return res.json(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update document.';
      const status =
        message.includes('already uses') || message.includes('Invalid URL') ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.post('/api/admin/documents/:id/reindex', requireAdmin, async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    try {
      const doc = await getDocumentById(id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      const stats = await indexDocumentRecord(doc);
      return res.json({ reindexed: true, id, ...stats });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to re-index document.';
      return res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/documents/:id', requireAdmin, async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }
    try {
      const deleted = await deleteDocumentById(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      return res.json({ deleted: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete document.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/admin/reindex-all', requireAdmin, async (_req, res) => {
    try {
      const result = await rebuildEntireInvertedIndex();
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to rebuild index.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/admin/terms', requireAdmin, async (req, res) => {
    try {
      const filter = typeof req.query.q === 'string' ? req.query.q.slice(0, 64) : '';
      const terms = await getInvertedIndexTerms(filter);
      res.json({ terms });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load inverted index terms.';
      res.status(500).json({ error: message });
    }
  });

  // Unknown API route guard
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Frontend middleware (Vite in dev, dist in production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LumenIndex server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LumenIndex server:', err);
  process.exit(1);
});
