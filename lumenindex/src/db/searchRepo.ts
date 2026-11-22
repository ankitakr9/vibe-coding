import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  documents,
  documentTerms,
  searchHistory,
  type DocumentRecord,
  type SearchHistoryRecord,
} from './schema.ts';
import {
  analyzeDocumentFields,
  buildHighlightedSnippet,
  parseSearchQuery,
  type SnippetSegment,
} from '../search/analyzer.ts';
import { INITIAL_CORPUS } from '../search/seed.ts';

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const TITLE_BOOST = 3.0;
const KEYWORD_BOOST = 2.0;
const BODY_BOOST = 1.0;

let seedCheckPromise: Promise<void> | null = null;

/**
 * Lazily seeds the initial search corpus once if the documents table is empty.
 * Never invoked at module boot (respects lazy pool connection lifecycle).
 */
export async function ensureSeededIfEmpty(): Promise<void> {
  if (!seedCheckPromise) {
    seedCheckPromise = (async () => {
      try {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(documents);

        if (count > 0) return;

        for (const item of INITIAL_CORPUS) {
          const analyzed = analyzeDocumentFields({
            title: item.title,
            keywords: item.keywords,
            summary: item.summary,
            content: item.content,
          });

          const inserted = await db
            .insert(documents)
            .values({
              title: item.title,
              url: item.url,
              domain: item.domain,
              sourceType: item.sourceType,
              category: item.category,
              summary: item.summary,
              content: item.content,
              keywords: item.keywords,
              wordCount: analyzed.wordCount,
              termCount: analyzed.terms.length,
              status: 'active',
            })
            .onConflictDoNothing({ target: documents.url })
            .returning();

          const doc = inserted[0];
          if (doc && analyzed.terms.length > 0) {
            await db.insert(documentTerms).values(
              analyzed.terms.map((t) => ({
                documentId: doc.id,
                term: t.term,
                titleFreq: t.titleFreq,
                keywordFreq: t.keywordFreq,
                bodyFreq: t.bodyFreq,
                totalFreq: t.totalFreq,
              }))
            );
          }
        }
      } catch (error) {
        seedCheckPromise = null;
        console.error('Database error during lazy corpus seed:', error);
        throw new Error('Failed to initialize search corpus.', { cause: error });
      }
    })();
  }
  return seedCheckPromise;
}

export async function indexDocumentRecord(doc: {
  id: number;
  title: string;
  keywords: string;
  summary: string;
  content: string;
}): Promise<{ wordCount: number; termCount: number }> {
  const analyzed = analyzeDocumentFields({
    title: doc.title,
    keywords: doc.keywords,
    summary: doc.summary,
    content: doc.content,
  });

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(documentTerms)
        .where(eq(documentTerms.documentId, doc.id));

      if (analyzed.terms.length > 0) {
        const chunkSize = 250;
        for (let i = 0; i < analyzed.terms.length; i += chunkSize) {
          const chunk = analyzed.terms.slice(i, i + chunkSize);
          await tx.insert(documentTerms).values(
            chunk.map((t) => ({
              documentId: doc.id,
              term: t.term,
              titleFreq: t.titleFreq,
              keywordFreq: t.keywordFreq,
              bodyFreq: t.bodyFreq,
              totalFreq: t.totalFreq,
            }))
          );
        }
      }

      await tx
        .update(documents)
        .set({
          wordCount: analyzed.wordCount,
          termCount: analyzed.terms.length,
          indexedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));
    });

    return { wordCount: analyzed.wordCount, termCount: analyzed.terms.length };
  } catch (error) {
    console.error('Database error in indexDocumentRecord:', error);
    throw new Error('Failed to update inverted index for document.', {
      cause: error,
    });
  }
}

export interface TermScoreBreakdown {
  term: string;
  weightedTf: number;
  titleFreq: number;
  keywordFreq: number;
  bodyFreq: number;
  docFreq: number;
  idf: number;
  bm25Contribution: number;
}

export interface RankedSearchResult {
  id: number;
  title: string;
  url: string;
  domain: string;
  sourceType: string;
  category: string;
  summary: string;
  keywords: string;
  wordCount: number;
  termCount: number;
  indexedAt: Date;
  score: number;
  snippet: SnippetSegment[];
  matchedTerms: string[];
  breakdown: TermScoreBreakdown[];
}

export interface SearchResponsePayload {
  query: string;
  parsedTerms: string[];
  phrases: string[];
  totalResults: number;
  executionMs: number;
  corpusSize: number;
  avgDocLength: number;
  results: RankedSearchResult[];
}

export async function searchDocuments(params: {
  query: string;
  sourceType?: 'all' | 'webpage' | 'document';
  category?: string;
  sort?: 'relevance' | 'newest' | 'words';
  limit?: number;
}): Promise<SearchResponsePayload> {
  await ensureSeededIfEmpty();
  const startedAt = performance.now();

  const parsed = parseSearchQuery(params.query);
  const limit = Math.min(Math.max(params.limit ?? 30, 1), 60);

  try {
    const [{ totalActive, avgLength }] = await db
      .select({
        totalActive: sql<number>`count(*)::int`,
        avgLength: sql<number>`coalesce(avg(${documents.wordCount}), 100)::float`,
      })
      .from(documents)
      .where(eq(documents.status, 'active'));

    const corpusSize = Math.max(totalActive, 1);
    const avgDocLength = Math.max(avgLength, 1);

    const conditions = [eq(documents.status, 'active')];

    if (params.sourceType && params.sourceType !== 'all') {
      conditions.push(eq(documents.sourceType, params.sourceType));
    }
    if (params.category && params.category !== 'All') {
      conditions.push(eq(documents.category, params.category));
    }
    if (parsed.categoryFilter) {
      conditions.push(ilike(documents.category, `%${parsed.categoryFilter}%`));
    }
    if (parsed.domainFilter) {
      conditions.push(ilike(documents.domain, `%${parsed.domainFilter}%`));
    }

    // If no search terms or phrases, return browsable active corpus ordered by recency
    if (parsed.terms.length === 0 && parsed.phrases.length === 0) {
      const browseDocs = await db
        .select()
        .from(documents)
        .where(and(...conditions))
        .orderBy(
          params.sort === 'words'
            ? desc(documents.wordCount)
            : desc(documents.indexedAt)
        )
        .limit(limit);

      const executionMs = Math.max(1, Math.round(performance.now() - startedAt));
      return {
        query: parsed.raw,
        parsedTerms: [],
        phrases: [],
        totalResults: browseDocs.length,
        executionMs,
        corpusSize: totalActive,
        avgDocLength: Math.round(avgDocLength),
        results: browseDocs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          url: doc.url,
          domain: doc.domain,
          sourceType: doc.sourceType,
          category: doc.category,
          summary: doc.summary,
          keywords: doc.keywords,
          wordCount: doc.wordCount,
          termCount: doc.termCount,
          indexedAt: doc.indexedAt,
          score: 0,
          snippet: [{ text: doc.summary, highlighted: false }],
          matchedTerms: [],
          breakdown: [],
        })),
      };
    }

    const queryLookupTerms = Array.from(
      new Set([...parsed.terms, ...parsed.excludedTerms])
    );

    const postings =
      queryLookupTerms.length > 0
        ? await db
            .select({
              documentId: documentTerms.documentId,
              term: documentTerms.term,
              titleFreq: documentTerms.titleFreq,
              keywordFreq: documentTerms.keywordFreq,
              bodyFreq: documentTerms.bodyFreq,
              totalFreq: documentTerms.totalFreq,
            })
            .from(documentTerms)
            .innerJoin(documents, eq(documentTerms.documentId, documents.id))
            .where(
              and(
                inArray(documentTerms.term, queryLookupTerms),
                ...conditions
              )
            )
        : [];

    // Compute document frequency (DF) per term across active corpus
    const dfRows =
      parsed.terms.length > 0
        ? await db
            .select({
              term: documentTerms.term,
              docFreq: sql<number>`count(distinct ${documentTerms.documentId})::int`,
            })
            .from(documentTerms)
            .innerJoin(documents, eq(documentTerms.documentId, documents.id))
            .where(
              and(
                inArray(documentTerms.term, parsed.terms),
                eq(documents.status, 'active')
              )
            )
            .groupBy(documentTerms.term)
        : [];

    const dfMap = new Map<string, number>();
    for (const row of dfRows) {
      dfMap.set(row.term, row.docFreq);
    }

    // Group postings by documentId
    const postingsByDoc = new Map<
      number,
      Map<
        string,
        { titleFreq: number; keywordFreq: number; bodyFreq: number; totalFreq: number }
      >
    >();

    for (const p of postings) {
      let termMap = postingsByDoc.get(p.documentId);
      if (!termMap) {
        termMap = new Map();
        postingsByDoc.set(p.documentId, termMap);
      }
      termMap.set(p.term, {
        titleFreq: p.titleFreq,
        keywordFreq: p.keywordFreq,
        bodyFreq: p.bodyFreq,
        totalFreq: p.totalFreq,
      });
    }

    const candidateDocIds = Array.from(postingsByDoc.keys()).filter((docId) => {
      const termMap = postingsByDoc.get(docId)!;

      // Exclude documents containing any -excluded term
      for (const excluded of parsed.excludedTerms) {
        if (termMap.has(excluded)) return false;
      }

      // Require every +required term
      for (const reqTerm of parsed.requiredTerms) {
        if (!termMap.has(reqTerm)) return false;
      }

      // Require title: terms to match inside title
      for (const titleTerm of parsed.titleTerms) {
        const hit = termMap.get(titleTerm);
        if (!hit || hit.titleFreq === 0) return false;
      }

      // Must match at least one positive query term
      return parsed.terms.some((t) => termMap.has(t));
    });

    if (candidateDocIds.length === 0) {
      const executionMs = Math.max(1, Math.round(performance.now() - startedAt));
      return {
        query: parsed.raw,
        parsedTerms: parsed.terms,
        phrases: parsed.phrases,
        totalResults: 0,
        executionMs,
        corpusSize: totalActive,
        avgDocLength: Math.round(avgDocLength),
        results: [],
      };
    }

    const candidateDocs = await db
      .select()
      .from(documents)
      .where(inArray(documents.id, candidateDocIds));

    const ranked: RankedSearchResult[] = [];

    for (const doc of candidateDocs) {
      const fullTextLower = `${doc.title} ${doc.keywords} ${doc.summary} ${doc.content}`.toLowerCase();

      // Verify quoted exact phrases if provided
      if (parsed.phrases.length > 0) {
        const allPhrasesMatch = parsed.phrases.every((phrase) =>
          fullTextLower.includes(phrase)
        );
        if (!allPhrasesMatch) continue;
      }

      const termMap = postingsByDoc.get(doc.id)!;
      const docLen = Math.max(doc.wordCount, 1);
      let totalScore = 0;
      const breakdown: TermScoreBreakdown[] = [];
      const matchedTerms: string[] = [];

      for (const term of parsed.terms) {
        const hit = termMap.get(term);
        if (!hit) continue;

        matchedTerms.push(term);
        const df = dfMap.get(term) ?? 1;
        // Lucene Okapi BM25 IDF: ln(1 + (N - df + 0.5) / (df + 0.5))
        const idf = Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
        const weightedTf =
          hit.titleFreq * TITLE_BOOST +
          hit.keywordFreq * KEYWORD_BOOST +
          hit.bodyFreq * BODY_BOOST;

        const numerator = weightedTf * (BM25_K1 + 1);
        const denominator =
          weightedTf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgDocLength));
        const contribution = idf * (numerator / denominator);

        totalScore += contribution;
        breakdown.push({
          term,
          weightedTf: Number(weightedTf.toFixed(2)),
          titleFreq: hit.titleFreq,
          keywordFreq: hit.keywordFreq,
          bodyFreq: hit.bodyFreq,
          docFreq: df,
          idf: Number(idf.toFixed(3)),
          bm25Contribution: Number(contribution.toFixed(3)),
        });
      }

      // Bonus for matching exact phrase or all query terms together
      if (parsed.phrases.length > 0) {
        totalScore += 1.25 * parsed.phrases.length;
      }
      if (parsed.terms.length > 1 && matchedTerms.length === parsed.terms.length) {
        totalScore *= 1.15;
      }

      ranked.push({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        domain: doc.domain,
        sourceType: doc.sourceType,
        category: doc.category,
        summary: doc.summary,
        keywords: doc.keywords,
        wordCount: doc.wordCount,
        termCount: doc.termCount,
        indexedAt: doc.indexedAt,
        score: Number(totalScore.toFixed(3)),
        snippet: buildHighlightedSnippet(doc.content, doc.summary, parsed),
        matchedTerms,
        breakdown: breakdown.sort((a, b) => b.bm25Contribution - a.bm25Contribution),
      });
    }

    if (params.sort === 'newest') {
      ranked.sort(
        (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
      );
    } else if (params.sort === 'words') {
      ranked.sort((a, b) => b.wordCount - a.wordCount);
    } else {
      ranked.sort((a, b) => b.score - a.score);
    }

    const executionMs = Math.max(1, Math.round(performance.now() - startedAt));

    return {
      query: parsed.raw,
      parsedTerms: parsed.terms,
      phrases: parsed.phrases,
      totalResults: ranked.length,
      executionMs,
      corpusSize: totalActive,
      avgDocLength: Math.round(avgDocLength),
      results: ranked.slice(0, limit),
    };
  } catch (error) {
    console.error('Database error in searchDocuments:', error);
    throw new Error('Search query failed. Please try again shortly.', {
      cause: error,
    });
  }
}

export async function getCorpusSummary() {
  await ensureSeededIfEmpty();
  try {
    const [{ activeDocuments, totalWords }] = await db
      .select({
        activeDocuments: sql<number>`count(*)::int`,
        totalWords: sql<number>`coalesce(sum(${documents.wordCount}), 0)::int`,
      })
      .from(documents)
      .where(eq(documents.status, 'active'));

    const [{ uniqueTerms }] = await db
      .select({
        uniqueTerms: sql<number>`count(distinct ${documentTerms.term})::int`,
      })
      .from(documentTerms);

    const categoryRows = await db
      .select({
        category: documents.category,
        count: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(eq(documents.status, 'active'))
      .groupBy(documents.category)
      .orderBy(desc(sql`count(*)`));

    return {
      activeDocuments,
      totalWords,
      uniqueTerms,
      categories: categoryRows,
    };
  } catch (error) {
    console.error('Database error in getCorpusSummary:', error);
    throw new Error('Unable to load corpus summary.', { cause: error });
  }
}

export async function getDocumentById(id: number): Promise<DocumentRecord | null> {
  try {
    const rows = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database error in getDocumentById:', error);
    throw new Error('Unable to load document details.', { cause: error });
  }
}

export async function createAndIndexDocument(input: {
  title: string;
  url: string;
  domain: string;
  sourceType: 'webpage' | 'document';
  category: string;
  summary: string;
  content: string;
  keywords: string;
  createdByUserId: number | null;
}): Promise<DocumentRecord> {
  try {
    const inserted = await db
      .insert(documents)
      .values({
        title: input.title,
        url: input.url,
        domain: input.domain,
        sourceType: input.sourceType,
        category: input.category,
        summary: input.summary,
        content: input.content,
        keywords: input.keywords,
        status: 'active',
        createdByUserId: input.createdByUserId,
      })
      .returning();

    const doc = inserted[0];
    const stats = await indexDocumentRecord(doc);

    return {
      ...doc,
      wordCount: stats.wordCount,
      termCount: stats.termCount,
    };
  } catch (error: unknown) {
    const pgCode =
      (error as { code?: string; cause?: { code?: string } })?.code ||
      (error as { cause?: { code?: string } })?.cause?.code;
    if (pgCode === '23505') {
      throw new Error('A document or web page with this URL is already indexed.');
    }
    console.error('Database error in createAndIndexDocument:', error);
    throw new Error('Failed to save and index the document.', { cause: error });
  }
}

export async function updateAndReindexDocument(
  id: number,
  input: {
    title?: string;
    url?: string;
    domain?: string;
    sourceType?: 'webpage' | 'document';
    category?: string;
    summary?: string;
    content?: string;
    keywords?: string;
    status?: 'active' | 'archived';
  }
): Promise<DocumentRecord | null> {
  try {
    const existing = await getDocumentById(id);
    if (!existing) return null;

    const updatedRows = await db
      .update(documents)
      .set({
        title: input.title ?? existing.title,
        url: input.url ?? existing.url,
        domain: input.domain ?? existing.domain,
        sourceType: input.sourceType ?? existing.sourceType,
        category: input.category ?? existing.category,
        summary: input.summary ?? existing.summary,
        content: input.content ?? existing.content,
        keywords: input.keywords ?? existing.keywords,
        status: input.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    const updated = updatedRows[0];
    if (!updated) return null;

    const stats = await indexDocumentRecord(updated);
    return {
      ...updated,
      wordCount: stats.wordCount,
      termCount: stats.termCount,
    };
  } catch (error: unknown) {
    const pgCode =
      (error as { code?: string; cause?: { code?: string } })?.code ||
      (error as { cause?: { code?: string } })?.cause?.code;
    if (pgCode === '23505') {
      throw new Error('Another indexed item already uses that URL.');
    }
    console.error('Database error in updateAndReindexDocument:', error);
    throw new Error('Failed to update document.', { cause: error });
  }
}

export async function deleteDocumentById(id: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database error in deleteDocumentById:', error);
    throw new Error('Failed to delete document.', { cause: error });
  }
}

export async function listAdminDocuments(params: {
  filter?: string;
  sourceType?: 'all' | 'webpage' | 'document';
  status?: 'all' | 'active' | 'archived';
}): Promise<DocumentRecord[]> {
  await ensureSeededIfEmpty();
  try {
    const conditions = [];
    if (params.sourceType && params.sourceType !== 'all') {
      conditions.push(eq(documents.sourceType, params.sourceType));
    }
    if (params.status && params.status !== 'all') {
      conditions.push(eq(documents.status, params.status));
    }
    if (params.filter && params.filter.trim()) {
      const q = `%${params.filter.trim()}%`;
      conditions.push(
        or(
          ilike(documents.title, q),
          ilike(documents.url, q),
          ilike(documents.domain, q),
          ilike(documents.category, q)
        )!
      );
    }

    return await db
      .select()
      .from(documents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(documents.updatedAt));
  } catch (error) {
    console.error('Database error in listAdminDocuments:', error);
    throw new Error('Unable to load indexed documents.', { cause: error });
  }
}

export async function rebuildEntireInvertedIndex(): Promise<{
  documentsIndexed: number;
  totalPostings: number;
}> {
  try {
    const allDocs = await db.select().from(documents);
    let totalPostings = 0;

    for (const doc of allDocs) {
      const stats = await indexDocumentRecord(doc);
      totalPostings += stats.termCount;
    }

    return {
      documentsIndexed: allDocs.length,
      totalPostings,
    };
  } catch (error) {
    console.error('Database error in rebuildEntireInvertedIndex:', error);
    throw new Error('Failed to rebuild inverted index.', { cause: error });
  }
}

export async function getAdminOverview() {
  await ensureSeededIfEmpty();
  try {
    const [{ totalDocs, activeDocs, archivedDocs, totalWords }] = await db
      .select({
        totalDocs: sql<number>`count(*)::int`,
        activeDocs: sql<number>`count(*) filter (where ${documents.status} = 'active')::int`,
        archivedDocs: sql<number>`count(*) filter (where ${documents.status} = 'archived')::int`,
        totalWords: sql<number>`coalesce(sum(${documents.wordCount}), 0)::int`,
      })
      .from(documents);

    const [{ uniqueTerms, totalPostings }] = await db
      .select({
        uniqueTerms: sql<number>`count(distinct ${documentTerms.term})::int`,
        totalPostings: sql<number>`count(*)::int`,
      })
      .from(documentTerms);

    const [{ totalSearches }] = await db
      .select({
        totalSearches: sql<number>`count(*)::int`,
      })
      .from(searchHistory);

    const popularQueries = await db
      .select({
        query: searchHistory.query,
        count: sql<number>`count(*)::int`,
        avgResults: sql<number>`round(avg(${searchHistory.resultCount}))::int`,
        lastSearchedAt: sql<string>`max(${searchHistory.createdAt})`,
      })
      .from(searchHistory)
      .groupBy(searchHistory.query)
      .orderBy(desc(sql`count(*)`))
      .limit(8);

    return {
      totalDocs,
      activeDocs,
      archivedDocs,
      totalWords,
      uniqueTerms,
      totalPostings,
      totalSearches,
      popularQueries,
    };
  } catch (error) {
    console.error('Database error in getAdminOverview:', error);
    throw new Error('Unable to load admin metrics.', { cause: error });
  }
}

export async function getInvertedIndexTerms(filter?: string, limit = 60) {
  await ensureSeededIfEmpty();
  try {
    const [{ totalActive }] = await db
      .select({ totalActive: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.status, 'active'));

    const corpusSize = Math.max(totalActive, 1);

    const rows = await db
      .select({
        term: documentTerms.term,
        docFreq: sql<number>`count(distinct ${documentTerms.documentId})::int`,
        totalOccurrences: sql<number>`sum(${documentTerms.totalFreq})::int`,
        titleHits: sql<number>`sum(${documentTerms.titleFreq})::int`,
      })
      .from(documentTerms)
      .innerJoin(documents, eq(documentTerms.documentId, documents.id))
      .where(
        filter && filter.trim()
          ? and(
              eq(documents.status, 'active'),
              ilike(documentTerms.term, `%${filter.trim().toLowerCase()}%`)
            )
          : eq(documents.status, 'active')
      )
      .groupBy(documentTerms.term)
      .orderBy(desc(sql`count(distinct ${documentTerms.documentId})`), desc(sql`sum(${documentTerms.totalFreq})`))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      idf: Number(
        Math.log(1 + (corpusSize - r.docFreq + 0.5) / (r.docFreq + 0.5)).toFixed(3)
      ),
    }));
  } catch (error) {
    console.error('Database error in getInvertedIndexTerms:', error);
    throw new Error('Unable to inspect inverted index terms.', { cause: error });
  }
}

export async function recordSearchHistory(params: {
  userId: number;
  query: string;
  sourceFilter: string;
  resultCount: number;
  executionMs: number;
}): Promise<void> {
  const cleaned = params.query.trim();
  if (!cleaned) return;
  try {
    await db.insert(searchHistory).values({
      userId: params.userId,
      query: cleaned.slice(0, 240),
      sourceFilter: params.sourceFilter,
      resultCount: params.resultCount,
      executionMs: params.executionMs,
    });
  } catch (error) {
    console.error('Database error in recordSearchHistory:', error);
  }
}

export async function getUserSearchHistory(
  userId: number,
  filter?: string,
  limit = 50
): Promise<SearchHistoryRecord[]> {
  try {
    const conditions = [eq(searchHistory.userId, userId)];
    if (filter && filter.trim()) {
      conditions.push(ilike(searchHistory.query, `%${filter.trim()}%`));
    }

    return await db
      .select()
      .from(searchHistory)
      .where(and(...conditions))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database error in getUserSearchHistory:', error);
    throw new Error('Unable to load search history.', { cause: error });
  }
}

export async function deleteUserHistoryEntry(
  userId: number,
  historyId: number
): Promise<boolean> {
  try {
    const deleted = await db
      .delete(searchHistory)
      .where(
        and(eq(searchHistory.id, historyId), eq(searchHistory.userId, userId))
      )
      .returning({ id: searchHistory.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database error in deleteUserHistoryEntry:', error);
    throw new Error('Failed to delete history entry.', { cause: error });
  }
}

export async function clearUserHistory(userId: number): Promise<number> {
  try {
    const deleted = await db
      .delete(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .returning({ id: searchHistory.id });
    return deleted.length;
  } catch (error) {
    console.error('Database error in clearUserHistory:', error);
    throw new Error('Failed to clear search history.', { cause: error });
  }
}
