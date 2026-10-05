'use client';
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDB, ownedRows, scopeFor } from '@/lib/dexie';
import { useAuth } from '@/lib/auth-context';
import { computeStatus } from '@/lib/expiry';
import { pullFromSupabase } from '@/lib/sync';

export function useProducts(search?: string) {
  const { user } = useAuth();
  const owner = scopeFor(user?.id);
  const db = getDB();
  const products = useLiveQuery(async () => {
    const scoped = await ownedRows(db.products, owner);
    if (!search) return scoped.sort((a, b) => a.name.localeCompare(b.name));
    // Simple prefix / contains search offline
    const lower = search.toLowerCase();
    return scoped.filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 20);
  }, [owner, search]);

  const refresh = useCallback(async () => {
    await pullFromSupabase();
  }, []);

  return { products: products ?? [], refresh };
}

export function useBatches() {
  const { user } = useAuth();
  const owner = scopeFor(user?.id);
  const batches = useLiveQuery(
    () => ownedRows(getDB().batches, owner).then((rows) => rows.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))),
    [owner]
  );
  const products = useLiveQuery(() => ownedRows(getDB().products, owner), [owner]);

  const enriched = (() => {
    if (!batches || !products) return [];
    const map = new Map(products.map((p) => [p.id, p]));
    return batches
      .map((b) => ({
        ...b,
        // Derive from expiry_date instead of trusting the stored value: rows stay
        // local for days at a time, so a stored status goes stale.
        status: computeStatus(b.expiry_date),
        products: map.get(b.product_id),
        product_name: map.get(b.product_id)?.name ?? 'Unknown',
        category: map.get(b.product_id)?.category ?? 'General',
      }))
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  })();

  return { batches: enriched, rawBatches: batches ?? [] };
}

export function useDashboardStats() {
  const { batches } = useBatches();
  const stats = (() => {
    let expired = 0;
    let near = 0;
    let week = 0;
    let active = 0;
    let qty = 0;
    const productSet = new Set<string>();
    for (const b of batches) {
      productSet.add(b.product_id);
      if (b.status === 'expired') expired++;
      if (b.status === 'near_expiry') near++;
      if (b.status !== 'expired') {
        active++;
        qty += b.quantity;
      }
      // Compare calendar days, not instants: expiry_date is a plain YYYY-MM-DD,
      // so parsing it as UTC midnight dropped batches expiring today.
      const days = Math.round(
        (new Date(`${b.expiry_date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000
      );
      if (days >= 0 && days <= 7) week++;
    }
    return {
      expired_count: expired,
      near_expiry_count: near,
      expiring_this_week: week,
      active_batches: active,
      total_active_quantity: qty,
      distinct_products: productSet.size,
    };
  })();
  return stats;
}
