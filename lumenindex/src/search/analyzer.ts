export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
  'could', 'do', 'does', 'did', 'for', 'from', 'had', 'has', 'have', 'he',
  'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'may', 'me', 'more', 'most', 'my', 'no', 'nor', 'not',
  'now', 'of', 'on', 'only', 'or', 'other', 'our', 'ours', 'out', 'over',
  'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
  'their', 'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'would', 'you', 'your', 'yours',
]);

/**
 * Lightweight Porter-inspired English suffix normalizer for consistent
 * Lucene-style inverted index tokenization.
 */
export function stemTerm(raw: string): string {
  let word = raw.toLowerCase();
  if (word.length <= 3) return word;

  if (word.endsWith('ies') && word.length > 4) {
    word = word.slice(0, -3) + 'y';
  } else if (word.endsWith('sses') && word.length > 5) {
    word = word.slice(0, -2);
  } else if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && word.length > 3) {
    word = word.slice(0, -1);
  }

  if (word.endsWith('ational') && word.length > 8) {
    word = word.slice(0, -5) + 'e';
  } else if (word.endsWith('ization') && word.length > 8) {
    word = word.slice(0, -5) + 'e';
  } else if (word.endsWith('fulness') && word.length > 8) {
    word = word.slice(0, -4);
  } else if (word.endsWith('iveness') && word.length > 8) {
    word = word.slice(0, -4);
  } else if (word.endsWith('ing') && word.length > 5) {
    word = word.slice(0, -3);
    if (/(bb|dd|gg|ll|mm|nn|pp|rr|tt)$/.test(word)) {
      word = word.slice(0, -1);
    }
  } else if (word.endsWith('ed') && word.length > 4) {
    word = word.slice(0, -2);
    if (/(bb|dd|gg|ll|mm|nn|pp|rr|tt)$/.test(word)) {
      word = word.slice(0, -1);
    }
  } else if (word.endsWith('ment') && word.length > 6) {
    word = word.slice(0, -4);
  } else if (word.endsWith('ness') && word.length > 6) {
    word = word.slice(0, -4);
  }

  return word;
}

export function extractRawWords(text: string): string[] {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9._-]{0,48}/g);
  if (!matches) return [];
  return matches
    .map((token) => token.replace(/^[._-]+|[._-]+$/g, ''))
    .filter((token) => token.length >= 2);
}

export function tokenizeAndStem(text: string): string[] {
  const words = extractRawWords(text);
  const tokens: string[] = [];
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    const stemmed = stemTerm(w);
    if (stemmed.length >= 2 && !STOP_WORDS.has(stemmed)) {
      tokens.push(stemmed);
    }
  }
  return tokens;
}

export interface TermFrequencyMapEntry {
  term: string;
  titleFreq: number;
  keywordFreq: number;
  bodyFreq: number;
  totalFreq: number;
}

export function analyzeDocumentFields(input: {
  title: string;
  keywords: string;
  summary: string;
  content: string;
}): {
  wordCount: number;
  terms: TermFrequencyMapEntry[];
} {
  const titleTokens = tokenizeAndStem(input.title);
  const keywordTokens = tokenizeAndStem(input.keywords);
  const bodyTokens = tokenizeAndStem(`${input.summary} ${input.content}`);
  const rawWords = extractRawWords(`${input.title} ${input.summary} ${input.content}`);

  const map = new Map<string, TermFrequencyMapEntry>();

  const increment = (term: string, field: 'titleFreq' | 'keywordFreq' | 'bodyFreq') => {
    let entry = map.get(term);
    if (!entry) {
      entry = { term, titleFreq: 0, keywordFreq: 0, bodyFreq: 0, totalFreq: 0 };
      map.set(term, entry);
    }
    entry[field] += 1;
    entry.totalFreq += 1;
  };

  for (const t of titleTokens) increment(t, 'titleFreq');
  for (const t of keywordTokens) increment(t, 'keywordFreq');
  for (const t of bodyTokens) increment(t, 'bodyFreq');

  return {
    wordCount: rawWords.length,
    terms: Array.from(map.values()),
  };
}

export interface ParsedSearchQuery {
  raw: string;
  terms: string[];
  requiredTerms: string[];
  excludedTerms: string[];
  phrases: string[];
  titleTerms: string[];
  domainFilter: string | null;
  categoryFilter: string | null;
  highlightRawWords: string[];
}

/**
 * Parses Lucene-style search syntax:
 *   "exact phrase", +required, -excluded, title:keyword, domain:host, category:name
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const raw = rawQuery.trim();
  const phrases: string[] = [];
  const terms: string[] = [];
  const requiredTerms: string[] = [];
  const excludedTerms: string[] = [];
  const titleTerms: string[] = [];
  const highlightRawWords: string[] = [];
  let domainFilter: string | null = null;
  let categoryFilter: string | null = null;

  // Extract quoted exact phrases first
  const withoutPhrases = raw.replace(/"([^"]+)"/g, (_match, phraseText: string) => {
    const cleaned = phraseText.trim().toLowerCase();
    if (cleaned.length >= 2) {
      phrases.push(cleaned);
      for (const w of extractRawWords(cleaned)) {
        highlightRawWords.push(w);
        if (!STOP_WORDS.has(w)) {
          const stemmed = stemTerm(w);
          if (stemmed.length >= 2) {
            terms.push(stemmed);
            requiredTerms.push(stemmed);
          }
        }
      }
    }
    return ' ';
  });

  const parts = withoutPhrases.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('domain:')) {
      const val = lower.slice('domain:'.length).trim();
      if (val) domainFilter = val;
      continue;
    }
    if (lower.startsWith('category:')) {
      const val = lower.slice('category:'.length).trim();
      if (val) categoryFilter = val;
      continue;
    }
    if (lower.startsWith('title:')) {
      const val = lower.slice('title:'.length).trim();
      for (const w of extractRawWords(val)) {
        highlightRawWords.push(w);
        const stemmed = stemTerm(w);
        if (stemmed.length >= 2) {
          titleTerms.push(stemmed);
          terms.push(stemmed);
        }
      }
      continue;
    }
    if (lower.startsWith('+') && lower.length > 2) {
      const val = lower.slice(1);
      for (const w of extractRawWords(val)) {
        highlightRawWords.push(w);
        const stemmed = stemTerm(w);
        if (stemmed.length >= 2) {
          requiredTerms.push(stemmed);
          terms.push(stemmed);
        }
      }
      continue;
    }
    if (lower.startsWith('-') && lower.length > 2) {
      const val = lower.slice(1);
      for (const w of extractRawWords(val)) {
        const stemmed = stemTerm(w);
        if (stemmed.length >= 2) {
          excludedTerms.push(stemmed);
        }
      }
      continue;
    }

    for (const w of extractRawWords(lower)) {
      if (STOP_WORDS.has(w)) continue;
      highlightRawWords.push(w);
      const stemmed = stemTerm(w);
      if (stemmed.length >= 2 && !STOP_WORDS.has(stemmed)) {
        terms.push(stemmed);
      }
    }
  }

  return {
    raw,
    terms: Array.from(new Set(terms)),
    requiredTerms: Array.from(new Set(requiredTerms)),
    excludedTerms: Array.from(new Set(excludedTerms)),
    phrases,
    titleTerms: Array.from(new Set(titleTerms)),
    domainFilter,
    categoryFilter,
    highlightRawWords: Array.from(new Set(highlightRawWords)),
  };
}

export interface SnippetSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Generates a relevant excerpt around matched terms and returns safe
 * structured highlight segments (no HTML strings).
 */
export function buildHighlightedSnippet(
  content: string,
  summary: string,
  parsed: ParsedSearchQuery,
  maxLength = 240
): SnippetSegment[] {
  const source = content.trim().length > 0 ? content.trim() : summary.trim();
  if (!source) return [{ text: '', highlighted: false }];

  const lowerSource = source.toLowerCase();
  const matchTargets = [
    ...parsed.phrases,
    ...parsed.highlightRawWords,
    ...parsed.terms,
  ].filter((t) => t.length >= 2);

  let bestIndex = -1;
  for (const target of matchTargets) {
    const idx = lowerSource.indexOf(target);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  let excerpt: string;
  if (bestIndex === -1) {
    const base = summary.trim() || source;
    excerpt = base.length > maxLength ? base.slice(0, maxLength).trimEnd() + '…' : base;
  } else {
    const start = Math.max(0, bestIndex - 65);
    const end = Math.min(source.length, start + maxLength);
    let slice = source.slice(start, end);
    if (start > 0) {
      const firstSpace = slice.indexOf(' ');
      if (firstSpace > 0 && firstSpace < 20) {
        slice = slice.slice(firstSpace + 1);
      }
      slice = '…' + slice;
    }
    if (end < source.length) {
      const lastSpace = slice.lastIndexOf(' ');
      if (lastSpace > slice.length - 25) {
        slice = slice.slice(0, lastSpace);
      }
      slice = slice + '…';
    }
    excerpt = slice;
  }

  if (matchTargets.length === 0) {
    return [{ text: excerpt, highlighted: false }];
  }

  const escaped = matchTargets
    .sort((a, b) => b.length - a.length)
    .slice(0, 12)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escaped.length === 0) {
    return [{ text: excerpt, highlighted: false }];
  }

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = excerpt.split(regex);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const partLower = part.toLowerCase();
      const isMatch = matchTargets.some(
        (t) => partLower === t || (t.length >= 3 && partLower.startsWith(t))
      );
      return { text: part, highlighted: isMatch };
    });
}
