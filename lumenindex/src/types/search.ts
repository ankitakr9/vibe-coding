export type AppTab = 'search' | 'index' | 'history' | 'admin';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: 'admin' | 'user';
}

export interface SnippetSegment {
  text: string;
  highlighted: boolean;
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
  sourceType: 'webpage' | 'document';
  category: string;
  summary: string;
  keywords: string;
  wordCount: number;
  termCount: number;
  indexedAt: string;
  score: number;
  snippet: SnippetSegment[];
  matchedTerms: string[];
  breakdown: TermScoreBreakdown[];
}

export interface SearchResponse {
  query: string;
  parsedTerms: string[];
  phrases: string[];
  totalResults: number;
  executionMs: number;
  corpusSize: number;
  avgDocLength: number;
  results: RankedSearchResult[];
}

export interface CorpusSummary {
  activeDocuments: number;
  totalWords: number;
  uniqueTerms: number;
  categories: Array<{ category: string; count: number }>;
}

export interface DocumentDetail {
  id: number;
  title: string;
  url: string;
  domain: string;
  sourceType: 'webpage' | 'document';
  category: string;
  summary: string;
  content: string;
  keywords: string;
  wordCount: number;
  termCount: number;
  status: 'active' | 'archived';
  indexedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryItem {
  id: number;
  userId: number;
  query: string;
  sourceFilter: string;
  resultCount: number;
  executionMs: number;
  createdAt: string;
}

export interface AdminOverview {
  totalDocs: number;
  activeDocs: number;
  archivedDocs: number;
  totalWords: number;
  uniqueTerms: number;
  totalPostings: number;
  totalSearches: number;
  popularQueries: Array<{
    query: string;
    count: number;
    avgResults: number;
    lastSearchedAt: string;
  }>;
}

export interface InvertedIndexTermRow {
  term: string;
  docFreq: number;
  totalOccurrences: number;
  titleHits: number;
  idf: number;
}
