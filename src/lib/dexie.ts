'use client';

import Dexie, { type Table } from 'dexie';
import type { Product, ProductBatch, SyncQueueItem } from './database.types';

// Local-only ownership scope. Never sent to Supabase.
export const OFFLINE_SCOPE = '__offline__';

export function scopeFor(userId?: string | null): string {
  return userId ?? OFFLINE_SCOPE;
}

export class GroceryDB extends Dexie {
  products!: Table<Product, string>;
  batches!: Table<ProductBatch, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('GroceryExpiryDB');
    this.version(1).stores({
      products: 'id, name, category, created_at',
      batches: 'id, product_id, expiry_date, status, created_at',
      syncQueue: '++id, table, operation, createdAt',
    });
    this.version(2).stores({
      products: 'id, name, category, created_at, user_id',
      batches: 'id, product_id, expiry_date, status, created_at, user_id',
      syncQueue: '++id, table, operation, createdAt',
    });
    this.version(3).stores({
      products: 'id, name, category, created_at, user_id',
      batches: 'id, product_id, expiry_date, status, created_at, user_id, [user_id+status]',
      syncQueue: '++id, table, operation, createdAt, [table+operation]',
    });
    this.version(4)
      .stores({
        products: 'id, name, category, created_at, user_id, owner',
        batches: 'id, product_id, expiry_date, status, created_at, user_id, owner, [owner+status]',
        syncQueue: '++id, table, operation, createdAt, [table+operation], owner',
      })
      .upgrade(async (tx) => {
        // Rows written before per-account scoping existed belong to the offline scope.
        await tx.table('products').toCollection().modify({ owner: OFFLINE_SCOPE });
        await tx.table('batches').toCollection().modify({ owner: OFFLINE_SCOPE });
      });
  }
}

let dbInstance: GroceryDB | null = null;

export function getDB(): GroceryDB {
  if (!dbInstance) dbInstance = new GroceryDB();
  return dbInstance;
}

export function ownedRows<T extends { owner?: string }>(
  table: Table<T, string>,
  owner: string
): Promise<T[]> {
  return table.where('owner').equals(owner).toArray();
}

// Enqueue offline mutation. `owner` decides which account may later push it.
export async function enqueueSync(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'owner'>, owner: string) {
  const db = getDB();
  await db.syncQueue.add({
    ...item,
    owner,
    createdAt: Date.now(),
    retries: 0,
  } as SyncQueueItem);
}
