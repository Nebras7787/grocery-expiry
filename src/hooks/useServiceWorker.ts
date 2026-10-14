'use client';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // In development, stale-while-revalidate caching breaks HMR and serves
    // outdated webpack chunks, so skip registration entirely.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      return;
    }

    // On native (Capacitor) the web assets are already bundled on-device and
    // served from https://localhost, so the SW is redundant — and registering
    // it fails inside the WebView ("unknown error occurred when fetching the
    // script"), which just spams the log. Skip it there.
    if (Capacitor.isNativePlatform()) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered:', reg.scope);
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] New version activated');
    });
  }, []);
}