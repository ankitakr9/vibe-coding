import { relations } from 'drizzle-orm';
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    displayName: text('display_name').default(''),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('users_email_idx').on(table.email)]
);

export const locations = pgTable(
  'locations',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    room: text('room').notNull().default('General'),
    description: text('description').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('locations_user_idx').on(table.userId)]
);

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    locationId: integer('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    sku: text('sku').notNull(),
    category: text('category').notNull(),
    brand: text('brand').default(''),
    quantity: integer('quantity').notNull().default(1),
    minThreshold: integer('min_threshold').notNull().default(1),
    unitValueCents: integer('unit_value_cents').notNull().default(0),
    condition: text('condition').notNull().default('Good'),
    status: text('status').notNull().default('in_stock'),
    lentTo: text('lent_to').default(''),
    serialNumber: text('serial_number').default(''),
    purchaseDate: text('purchase_date').default(''),
    warrantyUntil: text('warranty_until').default(''),
    notes: text('notes').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('inventory_items_user_updated_idx').on(table.userId, table.updatedAt),
    index('inventory_items_user_category_idx').on(table.userId, table.category),
    index('inventory_items_user_status_idx').on(table.userId, table.status),
    index('inventory_items_user_location_idx').on(table.userId, table.locationId),
  ]
);

export const inventoryMovements = pgTable('inventory_movements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  itemId: integer('item_id').references(() => inventoryItems.id, {
    onDelete: 'set null',
  }),
  itemName: text('item_name').notNull(),
  action: text('action').notNull(),
  delta: integer('delta').notNull().default(0),
  previousQuantity: integer('previous_quantity').notNull().default(0),
  newQuantity: integer('new_quantity').notNull().default(0),
  note: text('note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  locations: many(locations),
  items: many(inventoryItems),
  movements: many(inventoryMovements),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  owner: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  items: many(inventoryItems),
}));

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [inventoryItems.userId],
      references: [users.id],
    }),
    location: one(locations, {
      fields: [inventoryItems.locationId],
      references: [locations.id],
    }),
    movements: many(inventoryMovements),
  })
);

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    owner: one(users, {
      fields: [inventoryMovements.userId],
      references: [users.id],
    }),
    item: one(inventoryItems, {
      fields: [inventoryMovements.itemId],
      references: [inventoryItems.id],
    }),
  })
);

export type UserRecord = typeof users.$inferSelect;
export type LocationRecord = typeof locations.$inferSelect;
export type InventoryItemRecord = typeof inventoryItems.$inferSelect;
export type InventoryMovementRecord = typeof inventoryMovements.$inferSelect;
