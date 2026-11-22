import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    url: text('url').notNull().unique(),
    domain: text('domain').notNull(),
    sourceType: text('source_type').notNull().default('document'), // 'webpage' | 'document'
    category: text('category').notNull().default('General'),
    summary: text('summary').notNull(),
    content: text('content').notNull(),
    keywords: text('keywords').notNull().default(''),
    wordCount: integer('word_count').notNull().default(0),
    termCount: integer('term_count').notNull().default(0),
    status: text('status').notNull().default('active'), // 'active' | 'archived'
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    indexedAt: timestamp('indexed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_status').on(table.status),
    index('idx_documents_source_type').on(table.sourceType),
    index('idx_documents_category').on(table.category),
  ]
);

export const documentTerms = pgTable(
  'document_terms',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .references(() => documents.id, { onDelete: 'cascade' })
      .notNull(),
    term: text('term').notNull(),
    titleFreq: integer('title_freq').notNull().default(0),
    keywordFreq: integer('keyword_freq').notNull().default(0),
    bodyFreq: integer('body_freq').notNull().default(0),
    totalFreq: integer('total_freq').notNull().default(0),
  },
  (table) => [
    index('idx_document_terms_term').on(table.term),
    index('idx_document_terms_document_id').on(table.documentId),
    uniqueIndex('idx_document_terms_doc_term').on(table.documentId, table.term),
  ]
);

export const searchHistory = pgTable(
  'search_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    query: text('query').notNull(),
    sourceFilter: text('source_filter').notNull().default('all'),
    resultCount: integer('result_count').notNull().default(0),
    executionMs: integer('execution_ms').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_search_history_user_id').on(table.userId),
    index('idx_search_history_created_at').on(table.createdAt),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  searchHistory: many(searchHistory),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [documents.createdByUserId],
    references: [users.id],
  }),
  terms: many(documentTerms),
}));

export const documentTermsRelations = relations(documentTerms, ({ one }) => ({
  document: one(documents, {
    fields: [documentTerms.documentId],
    references: [documents.id],
  }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
export type DocumentTermRecord = typeof documentTerms.$inferSelect;
export type SearchHistoryRecord = typeof searchHistory.$inferSelect;
