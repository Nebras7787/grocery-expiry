'use client';

import { Capacitor } from '@capacitor/core';

export async function requestNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (e) {
      console.warn('[Notifications] capacitor permission failed', e);
      return false;
    }
  } else {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
}

export async function scheduleExpiryNotifications(
  items: { id: string; productName: string; expiryDate: string; daysLeft: number }[]
) {
  if (!items.length) return;
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      // Cancel previous
      await LocalNotifications.cancel({ notifications: items.map((_, i) => ({ id: i + 1000 })) } as never);
      const notifications = items.slice(0, 10).map((it, idx) => ({
        id: 1000 + idx,
        title: it.daysLeft <= 0 ? `⛔ منتهي: ${it.productName}` : `⚠️ ينتهي خلال ${it.daysLeft} يوم: ${it.productName}`,
        body: `تاريخ الانتهاء: ${it.expiryDate} — راجع مخزونك`,
        schedule: { at: new Date(Date.now() + 1000 * (idx + 1)) },
      }));
      await LocalNotifications.schedule({ notifications } as never);
    } catch (e) {
      console.warn('[Notifications] schedule failed', e);
    }
  } else {
    if (Notification.permission !== 'granted') return;
    // Web: fire immediate notifications for demo (limit)
    items.slice(0, 3).forEach((it) => {
      new Notification(it.daysLeft <= 0 ? `منتهي: ${it.productName}` : `ينتهي قريباً: ${it.productName}`, {
        body: `تاريخ الانتهاء ${it.expiryDate} • متبقٍ ${it.daysLeft} يوم`,
        icon: '/icons/icon.svg',
      });
    });
  }
}

export async function checkAndNotifyExpiring() {
  const { getDB, ownedRows, scopeFor } = await import('./dexie');
  const { daysUntilExpiry } = await import('./expiry');
  const { getSessionUserId } = await import('./sync');
  const db = getDB();
  const owner = scopeFor(await getSessionUserId());
  const batches = await ownedRows(db.batches, owner);
  const products = await ownedRows(db.products, owner);
  const productMap = new Map(products.map((p) => [p.id, p.name]));
  const expiring = batches
    .map((b) => ({
      id: b.id,
      productName: productMap.get(b.product_id) ?? 'Unknown',
      expiryDate: b.expiry_date,
      daysLeft: daysUntilExpiry(b.expiry_date),
    }))
    .filter((x) => x.daysLeft <= 7) // near
    .sort((a, b) => a.daysLeft - b.daysLeft);
  if (expiring.length) await scheduleExpiryNotifications(expiring);
}
