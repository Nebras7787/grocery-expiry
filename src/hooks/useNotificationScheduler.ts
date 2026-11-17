'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/lib/auth-context';
import { requestNotificationPermission, scheduleAllBatchNotifications } from '@/lib/notifications';

// Keeps the OS alarm queue in sync with the local database for the signed-in
// user. Runs on login, when the app returns to the foreground, and when the tab
// becomes visible again. This is what arms the 90/30/7/1/0-day reminders for
// batches that were added before those milestones existed.
export function useNotificationScheduler() {
  const { user, loading } = useAuth();
  const running = useRef(false);
  const lastRun = useRef(0);

  useEffect(() => {
    if (loading || !user?.id) return;
    let disposed = false;

    const run = async () => {
      if (disposed || running.current) return;
      const now = Date.now();
      // Focus/visibility can fire several times in a row; don't churn the OS.
      if (now - lastRun.current < 10_000) return;
      lastRun.current = now;
      running.current = true;
      try {
        // The OS prompt is only meaningful on native. Browsers require a user
        // gesture, so the notifications page handles the web case.
        if (Capacitor.isNativePlatform()) await requestNotificationPermission();
        await scheduleAllBatchNotifications();
      } catch (e) {
        console.warn('[Notifications] sweep failed', e);
      } finally {
        running.current = false;
      }
    };

    void run();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onFocus = () => void run();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    let removeAppState: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app')
        .then(({ App }) =>
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) void run();
          })
        )
        .then((handle) => {
          removeAppState = () => {
            void handle.remove();
          };
        })
        .catch(() => {});
    }

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      removeAppState?.();
    };
  }, [loading, user?.id]);
}
