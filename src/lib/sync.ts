'use client';

import { getDB, OFFLINE_SCOPE, enqueueSync, ownedRows, scopeFor } from './dexie';
import { getSupabase } from './supabase';
import { readLocalSession } from './session';
import type { Product, ProductBatch, SyncQueueItem, SyncTable } from './database.types';

export type SyncResult = { synced: number; failed: number; pending: number; skipped: number };

// A queued row that the server keeps rejecting (bad payload, RLS, deleted parent)
// must not be retried forever every 30s.
const MAX_RETRIES = 5;

// Columns that exist only in the local Dexie store. PostgREST rejects unknown
// columns, so they must be stripped before anything is sent to Supabase.
const LOCAL_ONLY_FIELDS = ['owner'] as const;

export function toRemotePayload<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const field of LOCAL_ONLY_FIELDS) delete out[field];
  return out;
}

export async function getSessionUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) return data.session.user.id;
    } catch {
      /* offline — fall through to the persisted local session */
    }
  }
  // Offline-first: the session snapshot saved at login keeps sync/scope working
  // without a network round-trip.
  return readLocalSession()?.id ?? null;
}

export async function doSync(): Promise<SyncResult> {
  const supabase = getSupabase();
  const db = getDB();
  if (!supabase) return { synced: 0, failed: 0, pending: await db.syncQueue.count(), skipped: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0, pending: await db.syncQueue.count(), skipped: 0 };

  // Rows created in "Continue Offline" mode carry no account. Pushing them would
  // claim someone else's inventory, so they stay queued until their owner signs in.
  const sessionUserId = await getSessionUserId();
  const owner = scopeFor(sessionUserId);

  const queue: SyncQueueItem[] = await db.syncQueue.orderBy('createdAt').toArray();
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of queue) {
    if ((item.owner ?? OFFLINE_SCOPE) !== owner) {
      skipped++;
      continue;
    }
    if ((item.retries ?? 0) >= MAX_RETRIES) {
      skipped++;
      continue;
    }

    try {
      const payload = toRemotePayload(item.payload);
      let error: unknown = null;
      if (item.table === 'products') {
        if (item.operation === 'insert') {
          // Upsert makes a retried insert idempotent (e.g. the direct write
          // succeeded but the response was lost).
          const { error: e } = await supabase.from('products').upsert(payload);
          error = e;
        } else if (item.operation === 'update' && item.recordId) {
          const { error: e } = await supabase.from('products').update(payload).eq('id', item.recordId);
          error = e;
        } else if (item.operation === 'delete' && item.recordId) {
          const { error: e } = await supabase.from('products').delete().eq('id', item.recordId);
          error = e;
        }
      } else if (item.table === 'product_batches') {
        if (item.operation === 'insert') {
          const { error: e } = await supabase.from('product_batches').upsert(payload);
          error = e;
        } else if (item.operation === 'update' && item.recordId) {
          const { error: e } = await supabase.from('product_batches').update(payload).eq('id', item.recordId);
          error = e;
        } else if (item.operation === 'delete' && item.recordId) {
          const { error: e } = await supabase.from('product_batches').delete().eq('id', item.recordId);
          error = e;
        }
      }

      if (error) throw error;
      if (item.id) await db.syncQueue.delete(item.id);
      synced++;
    } catch (err) {
      console.warn('[Sync] failed item', item, err);
      failed++;
      if (item.id) {
        const retries = (item.retries ?? 0) + 1;
        if (retries >= MAX_RETRIES) {
          console.error(`[Sync] dropping item ${item.id} (${item.table}/${item.operation}) after ${retries} attempts`);
        }
        await db.syncQueue.update(item.id, { retries });
      }
    }
  }

  // After pushing local changes, pull latest
  await pullFromSupabase();

  return { synced, failed, skipped, pending: await db.syncQueue.count() };
}

// Coalesce concurrent sync requests (auto-sync interval, manual button, delete)
// so a queued row is never pushed twice. A request that arrives mid-flight
// schedules one follow-up run so newly queued work is not missed.
let syncInFlight: Promise<SyncResult> | null = null;
let syncQueued = false;

export function syncWithSupabase(): Promise<SyncResult> {
  if (syncInFlight) {
    syncQueued = true;
    return syncInFlight;
  }
  syncInFlight = doSync().finally(() => {
    syncInFlight = null;
    if (syncQueued) {
      syncQueued = false;
      void syncWithSupabase();
    }
  });
  return syncInFlight;
}

/**
 * Queue a delete and push it immediately when possible.
 *
 * A direct `.delete().eq('id', ...)` can "succeed" with zero affected rows
 * (missing RLS policy, stale id, wrong user) and then the row is gone locally
 * but alive on every other device. Enqueuing first guarantees the delete is
 * retried until Supabase actually acknowledges it.
 */
export async function queueDelete(table: SyncTable, recordId: string, owner: string): Promise<void> {
  const db = getDB();
  const pending = await db.syncQueue.where('owner').equals(owner).toArray();
  for (const item of pending) {
    if (item.table !== table) continue;
    const payloadId = typeof item.payload?.id === 'string' ? item.payload.id : undefined;
    const sameRecord = item.recordId === recordId || payloadId === recordId;
    if (!sameRecord) continue;
    if (item.operation === 'delete') return; // already queued
    // A queued insert/update for the same row would resurrect it after the
    // delete, so drop it before enqueuing the delete.
    if (item.id) await db.syncQueue.delete(item.id);
  }

  await enqueueSync({ table, operation: 'delete', payload: {}, recordId }, owner);
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await syncWithSupabase();
  }
}

const PULL_LIMIT = 1000;

export async function doPullFromSupabase(): Promise<{ applied: boolean; removedBatches: string[] }> {
  const empty = { applied: false, removedBatches: [] as string[] };
  const supabase = getSupabase();
  const db = getDB();
  if (!supabase || !navigator.onLine) return empty;

  // Reconcile only against a confirmed remote session. The local snapshot keeps
  // the UI usable offline, but it must never authorise a pull that could delete
  // local rows based on a stale/expired identity.
  let remoteUserId: string | null = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return empty;
    remoteUserId = data?.session?.user?.id ?? null;
  } catch {
    return empty;
  }
  if (!remoteUserId) return empty;

  try {
    const [prodRes, batchRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }).limit(PULL_LIMIT),
      supabase.from('product_batches').select('*').order('expiry_date', { ascending: true }).limit(PULL_LIMIT),
    ]);
    // Never reconcile on a partial/failed pull: an empty error response would
    // otherwise look like "everything was deleted remotely".
    if (prodRes.error || batchRes.error) return empty;

    const remoteProducts = (prodRes.data ?? []) as unknown as Product[];
    const remoteBatches = (batchRes.data ?? []) as unknown as ProductBatch[];

    const [localProducts, localBatches] = await Promise.all([
      ownedRows(db.products, remoteUserId),
      ownedRows(db.batches, remoteUserId),
    ]);
    const localBatchIdsBefore = new Set(localBatches.map((b) => b.id));

    // Rows still waiting to reach the server win over remote data: a pending
    // insert/update is newer, and a pending delete must stay gone even if the
    // server has not processed it yet.
    const pending = await db.syncQueue.where('owner').equals(remoteUserId).toArray();
    const protectedProductIds = new Set<string>();
    const protectedBatchIds = new Set<string>();
    const deletedProductIds = new Set<string>();
    const deletedBatchIds = new Set<string>();
    for (const item of pending) {
      const id = item.recordId ?? (typeof item.payload?.id === 'string' ? item.payload.id : undefined);
      if (!id) continue;
      if (item.table === 'products') {
        (item.operation === 'delete' ? deletedProductIds : protectedProductIds).add(id);
      } else {
        (item.operation === 'delete' ? deletedBatchIds : protectedBatchIds).add(id);
      }
    }

    const productsToPut = remoteProducts
      .filter((r) => !protectedProductIds.has(r.id) && !deletedProductIds.has(r.id))
      .map((r) => ({ ...r, owner: remoteUserId }));
    const batchesToPut = remoteBatches
      .filter((r) => !protectedBatchIds.has(r.id) && !deletedBatchIds.has(r.id))
      .map((r) => ({ ...r, owner: remoteUserId }));

    if (productsToPut.length) await db.products.bulkPut(productsToPut as never[]);
    if (batchesToPut.length) await db.batches.bulkPut(batchesToPut as never[]);

    // A response that hit the page limit may hide rows; never treat those as
    // deletions.
    const removedBatches: string[] = [];
    const canReconcile = remoteProducts.length < PULL_LIMIT && remoteBatches.length < PULL_LIMIT;
    if (canReconcile) {
      const remoteProductIds = new Set(remoteProducts.map((r) => r.id));
      const remoteBatchIds = new Set(remoteBatches.map((r) => r.id));

      const productsToDelete = localProducts
        .filter((p) => {
          if (deletedProductIds.has(p.id)) return true;
          if (protectedProductIds.has(p.id)) return false;
          return !remoteProductIds.has(p.id);
        })
        .map((p) => p.id);
      const batchesToDelete = localBatches
        .filter((b) => {
          if (deletedBatchIds.has(b.id)) return true;
          if (protectedBatchIds.has(b.id)) return false;
          return !remoteBatchIds.has(b.id);
        })
        .map((b) => b.id);

      if (batchesToDelete.length) {
        await db.batches.bulkDelete(batchesToDelete);
        removedBatches.push(...batchesToDelete);
      }
      if (productsToDelete.length) await db.products.bulkDelete(productsToDelete);
    }

    // Cancel OS reminders for batches deleted on another device.
    if (removedBatches.length) {
      const { cancelBatchNotification } = await import('./notifications');
      for (const id of removedBatches) await cancelBatchNotification(id);
    }

    // A batch added on another device should also alert here while the app is
    // running, and its future reminders must be armed for the closed-app case.
    const newBatches = remoteBatches.filter((r) => !localBatchIdsBefore.has(r.id) && !deletedBatchIds.has(r.id));
    if (newBatches.length) {
      const { scheduleBatchNotifications } = await import('./notifications');
      const productMap = new Map(remoteProducts.map((p) => [p.id, p.name]));
      for (const b of newBatches) {
        await scheduleBatchNotifications({
          id: b.id,
          productName: productMap.get(b.product_id) ?? 'منتج',
          expiryDate: b.expiry_date,
        });
      }
    }

    return { applied: true, removedBatches };
  } catch (e) {
    console.warn('[Sync] pull failed', e);
    return empty;
  }
}

type PullResult = { applied: boolean; removedBatches: string[] };

// Same coalescing as sync: Realtime events and the 30s auto-sync can ask for a
// pull at the same moment. One follow-up run picks up anything that changed
// while the first pull was in flight.
let pullInFlight: Promise<PullResult> | null = null;
let pullQueued = false;

export function pullFromSupabase(): Promise<PullResult> {
  if (pullInFlight) {
    pullQueued = true;
    return pullInFlight;
  }
  pullInFlight = doPullFromSupabase().finally(() => {
    pullInFlight = null;
    if (pullQueued) {
      pullQueued = false;
      void pullFromSupabase();
    }
  });
  return pullInFlight;
}

// Listen for online event and auto-sync
export function initAutoSync(onSync?: (r: SyncResult) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = async () => {
    const res = await syncWithSupabase();
    onSync?.(res);
  };
  window.addEventListener('online', handler);
  const interval = setInterval(() => {
    if (navigator.onLine) handler();
  }, 30_000);
  return () => {
    window.removeEventListener('online', handler);
    clearInterval(interval);
  };
}
