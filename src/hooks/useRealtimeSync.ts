'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { startRealtime } from '@/lib/realtime';
import { scheduleAllBatchNotifications } from '@/lib/notifications';

// Subscribe to Supabase Realtime while signed in and online. A change made on
// another device is pulled into Dexie almost immediately, and any new batch gets
// its reminders scheduled (including an immediate alert when it is near expiry).
export function useRealtimeSync() {
  const { user, loading } = useAuth();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (loading || !user?.id || !online) return;
    return startRealtime(user.id, () => {
      void scheduleAllBatchNotifications();
    });
  }, [loading, user?.id, online]);
}
