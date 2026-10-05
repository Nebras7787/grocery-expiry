'use client';

import { getDB, OFFLINE_SCOPE, scopeFor } from './dexie';
import { getSupabase } from './supabase';
import type { SyncQueueItem } from './database.types';

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
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function syncWithSupabase(): Promise<SyncResult> {
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
          const { error: e } = await supabase.from('products').insert(payload);
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
          const { error: e } = await supabase.from('product_batches').insert(payload);
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

export async function pullFromSupabase() {
  const supabase = getSupabase();
  const db = getDB();
  if (!supabase || !navigator.onLine) return;

  try {
    // RLS on Supabase filters by user_id automatically when authenticated
    // When not authenticated (anon), returns empty (unless demo policy enabled)
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return;

    const [prodRes, batchRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('product_batches').select('*').order('expiry_date', { ascending: true }).limit(1000),
    ]);

    // Stamp the local ownership scope; server rows never carry it.
    if (prodRes.data) {
      const rows = prodRes.data.map((r) => ({ ...(r as object), owner: sessionUserId })) as never[];
      await db.products.bulkPut(rows);
    }
    if (batchRes.data) {
      const rows = batchRes.data.map((r) => ({ ...(r as object), owner: sessionUserId })) as never[];
      await db.batches.bulkPut(rows);
    }
  } catch (e) {
    console.warn('[Sync] pull failed', e);
  }
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
