export interface SeedDocumentInput {
  title: string;
  url: string;
  domain: string;
  sourceType: 'webpage' | 'document';
  category: string;
  summary: string;
  keywords: string;
  content: string;
}

export const INITIAL_CORPUS: SeedDocumentInput[] = [
  {
    title: 'Apache Lucene Core Architecture & Inverted Index Fundamentals',
    url: 'https://lucene.apache.org/core/architecture-inverted-index',
    domain: 'lucene.apache.org',
    sourceType: 'webpage',
    category: 'Search Algorithms',
    summary:
      'Comprehensive overview of how Apache Lucene builds immutable index segments, maps tokenized terms to posting lists, and executes fast boolean and phrase queries.',
    keywords: 'apache lucene, inverted index, posting list, analyzer, tokenization, segments, search engine',
    content:
      'Apache Lucene is a high-performance full-text search library built around an inverted index data structure. Instead of scanning every document linearly during a query, Lucene analyzes text through a pipeline of character filters, tokenizers, and token filters such as lowercasing, stop-word removal, and Porter stemming. Each unique normalized term points to a posting list recording every document identifier where the term appears, along with its term frequency and optional token positions for phrase queries. Indexes are organized into immutable segments that merge in the background, giving Lucene lock-free concurrent readers and predictable low-latency keyword search across millions of documents.',
  },
  {
    title: 'Okapi BM25 Relevance Ranking Formula Explained',
    url: 'https://ir-handbook.org/ranking/okapi-bm25-scoring',
    domain: 'ir-handbook.org',
    sourceType: 'document',
    category: 'Search Algorithms',
    summary:
      'How probabilistic Okapi BM25 improves on classic TF-IDF through term frequency saturation and document length normalization.',
    keywords: 'bm25, okapi, tf-idf, ranking, idf, term frequency, information retrieval, relevance scoring',
    content:
      'Okapi BM25 is the default similarity and relevance ranking function in modern Apache Lucene and Elasticsearch deployments. Unlike classic TF-IDF where term frequency grows linearly without bound, BM25 applies a saturation parameter k1 (typically 1.2 to 1.5) so repeating a keyword twenty times yields diminishing marginal relevance. BM25 also introduces length normalization controlled by parameter b (typically 0.75), comparing each document word count against the corpus average document length. Rare terms receive higher Inverse Document Frequency (IDF) weights, while common terms contribute less. Combining field boosts for titles, keywords, and body text produces crisp, accurate ranked search results.',
  },
  {
    title: 'Building RESTful Search APIs with Spring Boot & Layered Services',
    url: 'https://docs.spring.io/spring-boot/guides/restful-search-apis',
    domain: 'docs.spring.io',
    sourceType: 'webpage',
    category: 'Backend Engineering',
    summary:
      'Design patterns for RESTful search endpoints, pagination, query parameter validation, DTO serialization, and controller-service-repository separation.',
    keywords: 'spring boot, rest api, java, controller, pagination, search endpoint, backend',
    content:
      'Designing a clean RESTful API for a search engine begins with predictable resource routes and explicit query contracts. A search endpoint accepts keyword queries, source filters, category constraints, and sort modes via URL query parameters while returning structured JSON payloads containing ranked hits, total counts, execution latency, and highlighting metadata. Separating web controllers from indexing services and persistence repositories keeps ranking logic testable and decoupled from transport concerns. Input validation guards against malformed query strings and oversized page requests, ensuring consistent response envelopes and clear HTTP status codes across public search and authenticated admin routes.',
  },
  {
    title: 'Relational Indexing & Query Optimization in PostgreSQL and MySQL',
    url: 'https://www.postgresql.org/docs/current/indexes-and-fulltext',
    domain: 'postgresql.org',
    sourceType: 'webpage',
    category: 'Databases',
    summary:
      'How B-Tree, GIN, and composite indexes accelerate inverted term lookups, relational joins, and user search history queries.',
    keywords: 'postgresql, mysql, sql, b-tree, gin index, relational database, orm, drizzle, hibernate',
    content:
      'Relational databases such as PostgreSQL and MySQL pair seamlessly with full-text search engines when structured metadata, user accounts, and search history must remain ACID-compliant. Placing B-Tree indexes on normalized term columns and foreign keys turns posting list lookups into logarithmic index scans instead of sequential table scans. Composite unique indexes on document_id and term enforce data integrity during incremental re-indexing. Using an ORM like Hibernate or Drizzle ORM ensures parameterized SQL statements, type-safe schema migrations, and clean relational mappings between users, indexed documents, inverted term postings, and chronological search history records.',
  },
  {
    title: 'Spring Security & OAuth Token Verification for Admin Consoles',
    url: 'https://docs.spring.io/spring-security/reference/rbac-oauth-jwt',
    domain: 'docs.spring.io',
    sourceType: 'webpage',
    category: 'Security',
    summary:
      'Implementing role-based access control, bearer ID token verification, and least-privilege separation between public readers, authenticated users, and admins.',
    keywords: 'spring security, oauth, rbac, authentication, authorization, admin role, bearer token',
    content:
      'A production search engine separates three distinct trust tiers: anonymous readers who can execute public keyword queries, authenticated users whose personal search history is privately recorded and managed, and administrators authorized to edit, archive, delete, or rebuild indexed content. Role-Based Access Control (RBAC) verifies cryptographic bearer tokens on every protected API route and resolves the user role directly from the database rather than trusting client-supplied flags. Enforcing ownership checks on user history deletions prevents horizontal privilege escalation while keeping admin index mutations strictly isolated.',
  },
  {
    title: 'Web Crawling Ethics, Robots.txt, and SSRF Safeguards',
    url: 'https://webdev-standards.org/crawling/politeness-and-ssrf-defense',
    domain: 'webdev-standards.org',
    sourceType: 'document',
    category: 'Security',
    summary:
      'Engineering safe HTTP page fetchers that strip scripts, parse semantic HTML headings, respect timeouts, and block private network addresses.',
    keywords: 'web crawler, html parser, ssrf, security, robots.txt, cheerio, scraping, url indexing',
    content:
      'Indexing external web pages requires combining robust HTML extraction with strict network security controls. When a user submits a URL to crawl, the server must validate the scheme as HTTP or HTTPS, resolve DNS hostnames, and reject loopback, RFC 1918 private subnets, and cloud metadata IP addresses before opening a socket. Redirect chains must be re-validated at every hop with strict timeout and response byte caps. Once HTML is retrieved, parsers strip script, style, navigation, and boilerplate elements to extract clean titles, meta descriptions, headings, and body prose ready for inverted index tokenization.',
  },
  {
    title: 'Query Parsing: Boolean Operators, Exact Phrases, and Field Filters',
    url: 'https://ir-handbook.org/queries/boolean-phrase-field-syntax',
    domain: 'ir-handbook.org',
    sourceType: 'document',
    category: 'Search Algorithms',
    summary:
      'Practical guide to parsing Lucene-style query syntax including quoted exact phrases, +required terms, -excluded terms, and title: or domain: scopes.',
    keywords: 'query parser, lucene syntax, boolean search, exact phrase, field filter, search operators',
    content:
      'Power users expect more than bag-of-words matching from a search engine. A structured query parser splits user input into semantic clauses before consulting the inverted index. Quoted strings trigger exact phrase verification against the document text. Leading plus signs mark mandatory terms that every candidate document must contain, whereas minus signs filter out documents containing unwanted topics. Field-qualified expressions such as title:lucene, domain:postgresql.org, or category:security narrow search scope cleanly and boost precision on large technical corpora.',
  },
  {
    title: 'Snippet Generation & Safe Keyword Highlighting in Search UIs',
    url: 'https://ux-patterns.dev/search/snippet-highlighting-accessibility',
    domain: 'ux-patterns.dev',
    sourceType: 'document',
    category: 'Frontend Engineering',
    summary:
      'Selecting high-density context windows around matched query terms and rendering accessible highlights without raw HTML injection.',
    keywords: 'snippets, highlighting, search ux, xss prevention, react, thymeleaf, accessibility',
    content:
      'Search result snippets help users verify document relevance before clicking a link. Effective snippet generators locate the earliest or densest occurrence of matched query phrases and terms inside a document body, slice a readable window centered on the match, and trim cleanly on word boundaries. To eliminate cross-site scripting risks, modern web templates and React components render highlight spans from structured text segments rather than concatenating untrusted HTML strings. High-contrast highlight marks and clear metadata separators let users scan ranked lists effortlessly.',
  },
  {
    title: 'Stemming, Lemmatization, and Stop-Word Filtering Tradeoffs',
    url: 'https://nlp-foundations.edu/text-processing/stemming-vs-lemmatization',
    domain: 'nlp-foundations.edu',
    sourceType: 'webpage',
    category: 'Search Algorithms',
    summary:
      'Comparing Porter stemming algorithms against dictionary lemmatization and understanding how stop-word lists affect index size and recall.',
    keywords: 'stemming, porter stemmer, lemmatization, stop words, tokenization, recall, precision',
    content:
      'Text normalization bridges the lexical gap between how authors write and how users query. Stemming algorithms such as the Porter stemmer apply deterministic suffix-stripping rules so searching for "indexing" matches documents containing "indexed", "indexes", or "index". Lemmatization relies on morphological dictionaries for linguistic accuracy at a higher computational cost. Filtering high-frequency English stop words shrinks inverted index storage and accelerates posting list intersections while preserving meaningful content terms.',
  },
  {
    title: 'Hibernate ORM & Entity Lifecycle Management Best Practices',
    url: 'https://hibernate.org/orm/documentation/entity-lifecycle-guide',
    domain: 'hibernate.org',
    sourceType: 'webpage',
    category: 'Databases',
    summary:
      'Managing transactional sessions, cascade deletes, connection pooling, and avoiding N+1 query bottlenecks in relational applications.',
    keywords: 'hibernate, jpa, orm, transactions, connection pool, cascade delete, sql performance',
    content:
      'Object-Relational Mapping frameworks bridge application domain models and relational tables, but poor query patterns can create severe N+1 latency spikes. Batching inserts when writing hundreds of inverted index terms per document dramatically reduces round trips to the database. Foreign key cascades ensure deleting an indexed document automatically removes orphaned term postings. Connection pooling keeps database socket overhead bounded under concurrent traffic, while lazy pool initialization avoids startup contention in cloud-hosted environments.',
  },
  {
    title: 'Thymeleaf Server Templates vs Modern Reactive Search Interfaces',
    url: 'https://www.thymeleaf.org/doc/articles/modern-search-templates',
    domain: 'thymeleaf.org',
    sourceType: 'webpage',
    category: 'Frontend Engineering',
    summary:
      'Comparing server-rendered template workflows with client-side interactive search views, instant filter tabs, and transparent ranking drawers.',
    keywords: 'thymeleaf, react, frontend, templates, search interface, keyboard navigation, filters',
    content:
      'Classic Java web applications often pair Spring Boot with Thymeleaf to render HTML search forms and paginated result lists on the server. Modern interactive search interfaces extend that foundation with asynchronous REST APIs, instant filter switching between web pages and uploaded documents, live keyword highlighting, and expandable ranking breakdowns that let engineers inspect TF-IDF and BM25 math without leaving the results page. Supporting keyboard shortcuts and clean typographic hierarchy keeps search fast and calm.',
  },
  {
    title: 'TF-IDF Vector Space Model & Cosine Similarity Basics',
    url: 'https://ir-handbook.org/models/tf-idf-vector-space',
    domain: 'ir-handbook.org',
    sourceType: 'document',
    category: 'Search Algorithms',
    summary:
      'How Term Frequency and Inverse Document Frequency represent documents as weighted vectors in high-dimensional term space.',
    keywords: 'tf-idf, vector space model, cosine similarity, term weight, document frequency, search math',
    content:
      'Before probabilistic BM25 became dominant, the Vector Space Model established the mathematical foundation of ranked retrieval. Each document and query is represented as a sparse vector whose dimensions correspond to unique terms in the vocabulary. Each weight equals Term Frequency multiplied by Inverse Document Frequency (TF-IDF), rewarding words that appear frequently in one document yet rarely across the entire collection. Ranking documents by cosine similarity to the query vector naturally normalizes for document length and explains why specific terms dominate search scores.',
  },
  {
    title: 'Managing Search History Analytics & Query Suggestions',
    url: 'https://ux-patterns.dev/search/history-and-query-analytics',
    domain: 'ux-patterns.dev',
    sourceType: 'document',
    category: 'Frontend Engineering',
    summary:
      'Storing per-user query logs with execution latency and hit counts to surface instant re-run shortcuts and zero-result diagnostics.',
    keywords: 'search history, query log, analytics, latency, zero results, user experience',
    content:
      'Persisting user search history creates both personal utility and operational insight. Individual users benefit from one-click replay of previous queries, filter recall, and full privacy control to remove individual entries or clear their log. For administrators managing a curated search corpus, aggregate query telemetry reveals the most frequent topics searched and highlights zero-result queries where new web pages or technical documentation should be indexed next.',
  },
  {
    title: 'Distributed Search Architecture: Sharding, Replication, and Index Rebuilds',
    url: 'https://systems-architecture.io/search/sharding-and-reindexing',
    domain: 'systems-architecture.io',
    sourceType: 'webpage',
    category: 'Backend Engineering',
    summary:
      'Scaling inverted indexes beyond a single node with document partitioning, replica routing, and atomic full-corpus re-indexing workflows.',
    keywords: 'distributed search, sharding, replication, reindex, architecture, scalability, lucene',
    content:
      'When a document collection grows beyond a single machine, search engines partition the inverted index into horizontal shards by hashing each document identifier. Queries scatter across all shards in parallel and gather top-K BM25 results into a unified ranked list. Whenever tokenization rules, stop-word lists, or stemmers evolve, administrators execute a controlled re-index workflow that re-analyzes every stored source document and atomically refreshes term frequency tables without losing source metadata.',
  },
];
