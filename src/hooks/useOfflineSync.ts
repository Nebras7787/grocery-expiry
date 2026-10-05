'use client';
import { useEffect, useState, useCallback } from 'react';
import { getDB, scopeFor } from '@/lib/dexie';
import { initAutoSync, syncWithSupabase, type SyncResult } from '@/lib/sync';
import { useAuth } from '@/lib/auth-context';

export function useOfflineSync() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);

  const owner = scopeFor(user?.id);

  const countPending = useCallback(async () => {
    const db = getDB();
    const items = await db.syncQueue.where('owner').equals(owner).count();
    setPending(items);
  }, [owner]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const cleanup = initAutoSync((r) => {
      setLastSync(r);
      countPending();
    });
    countPending();
    const interval = setInterval(countPending, 5000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      cleanup();
      clearInterval(interval);
    };
  }, [countPending]);

  const manualSync = async () => {
    const r = await syncWithSupabase();
    setLastSync(r);
    await countPending();
    return r;
  };

  return { isOnline, pending, lastSync, manualSync };
}
