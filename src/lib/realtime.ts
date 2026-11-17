'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { pullFromSupabase } from './sync';

// Live cross-device sync. Supabase Realtime emits a row change, we pull the
// authoritative rows into Dexie (which also schedules alerts for new batches).
// Requires the tables to be in the `supabase_realtime` publication — see
// supabase/migrations/enable_realtime.sql.

let channel: RealtimeChannel | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let startedFor: string | null = null;

function clearDebounce(): void {
  if (debounce) {
    clearTimeout(debounce);
    debounce = null;
  }
}

export function startRealtime(userId: string, onChange?: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  // One channel per signed-in user; re-subscribing would leak duplicates.
  if (channel && startedFor === userId) return stopRealtime;

  stopRealtime();
  startedFor = userId;

  const flush = () => {
    clearDebounce();
    // Coalesce bursts (e.g. product + batch inserted together) into one pull.
    debounce = setTimeout(() => {
      debounce = null;
      void pullFromSupabase()
        .then(() => onChange?.())
        .catch((e) => console.warn('[Realtime] pull failed', e));
    }, 350);
  };

  // Filter server-side to this user's rows. With `replica identity full`
  // (see the migration) the filter also applies to DELETE events.
  const filter = `user_id=eq.${userId}`;

  channel = supabase
    .channel(`grocery-sync:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter }, flush)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'product_batches', filter }, flush)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Usually means the migration was not applied or the session expired.
        console.warn('[Realtime] channel issue:', status);
      }
    });

  return stopRealtime;
}

export function stopRealtime(): void {
  clearDebounce();
  const supabase = getSupabase();
  if (channel && supabase) {
    void supabase.removeChannel(channel);
  }
  channel = null;
  startedFor = null;
}
