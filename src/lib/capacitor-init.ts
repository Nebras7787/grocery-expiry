'use client';

import { Capacitor } from '@capacitor/core';

let initialized = false;

export async function initCapacitor() {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    // App state listener for background/foreground
    const { App } = await import('@capacitor/app');
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Capacitor] App foregrounded');
        // Trigger sync when app comes to foreground
        import('./sync').then(({ syncWithSupabase }) => {
          if (navigator.onLine) syncWithSupabase();
        });
      } else {
        console.log('[Capacitor] App backgrounded');
      }
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    // Handle deep links
    App.addListener('appUrlOpen', (event) => {
      console.log('[Capacitor] Deep link:', event.url);
    });

    initialized = true;
    console.log('[Capacitor] Initialized');
  } catch (e) {
    console.warn('[Capacitor] Init error:', e);
  }
}

// Auto-init on import
if (typeof window !== 'undefined') {
  // Delay init until DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCapacitor);
  } else {
    initCapacitor();
  }
}
