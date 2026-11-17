'use client';

import { Capacitor } from '@capacitor/core';
import { NEAR_EXPIRY_DAYS, REMINDER_DAYS, daysUntilExpiry, reminderDates } from './expiry';

const CHANNEL_ID = 'expiry-alerts';
// Remembered per batch so an app-open sweep does not repeat the "already inside
// the window" alert every few minutes.
const NOTIFIED_KEY = 'notifiedBatchIds';
const NOTIFIED_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~once a day

export type BatchNotif = { id: string; productName: string; expiryDate: string };
export type DisplayPermission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

export type NotificationDiagnostics = {
  display: DisplayPermission;
  exactAlarm: 'granted' | 'denied' | 'unknown';
  pending: number;
};

let permissionGranted = false;
let channelReady = false;

// ---------------------------------------------------------------- permissions

export async function requestNotificationPermission(): Promise<boolean> {
  if (permissionGranted) return true;

  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      permissionGranted = result.display === 'granted';
      return permissionGranted;
    } catch (e) {
      console.warn('[Notifications] capacitor permission failed', e);
      return false;
    }
  }

  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  permissionGranted = perm === 'granted';
  return permissionGranted;
}

export async function getNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      let exactAlarm: NotificationDiagnostics['exactAlarm'] = 'unknown';
      try {
        const setting = await LocalNotifications.checkExactNotificationSetting();
        exactAlarm = setting.exact_alarm === 'granted' ? 'granted' : 'denied';
      } catch {
        /* older Android / web */
      }
      let pending = 0;
      try {
        pending = (await LocalNotifications.getPending()).notifications.length;
      } catch {
        /* ignore */
      }
      return {
        display: (perm.display ?? 'unknown') as DisplayPermission,
        exactAlarm,
        pending,
      };
    } catch {
      return { display: 'unknown', exactAlarm: 'unknown', pending: 0 };
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    return {
      display: Notification.permission === 'default' ? 'prompt' : (Notification.permission as DisplayPermission),
      exactAlarm: 'unknown',
      pending: 0,
    };
  }
  return { display: 'unknown', exactAlarm: 'unknown', pending: 0 };
}

// Opens the Android "Alarms & reminders" screen so the OS can deliver exact
// alarms even while the app is closed. Without it the plugin still schedules the
// alarm, but Android may delay it (inexact alarm).
export async function openExactAlarmSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.changeExactNotificationSetting();
  } catch (e) {
    console.warn('[Notifications] exact alarm settings unavailable', e);
  }
}

// ------------------------------------------------------- local bookkeeping

function readNotified(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

function writeNotified(map: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
  } catch {
    /* storage blocked */
  }
}

function recentlyNotified(id: string): boolean {
  const at = readNotified()[id];
  return typeof at === 'number' && Date.now() - at < NOTIFIED_COOLDOWN_MS;
}

function markNotified(id: string): void {
  writeNotified({ ...readNotified(), [id]: Date.now() });
}

function clearNotified(id: string): void {
  const map = readNotified();
  delete map[id];
  writeNotified(map);
}

function clearAllNotified(): void {
  writeNotified({});
}

// ------------------------------------------------------------- notification ids

// Stable 32-bit positive id derived from a string, so re-scheduling the same
// reminder replaces its pending notification instead of duplicating it.
function hashNotificationId(key: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 2_147_483_000) + 1;
}

function reminderId(batchId: string, days: number): number {
  return hashNotificationId(`${batchId}:d${days}`);
}

function immediateId(batchId: string): number {
  return hashNotificationId(`${batchId}:now`);
}

function allIdsForBatch(batchId: string): number[] {
  return REMINDER_DAYS.map((days) => reminderId(batchId, days)).concat(immediateId(batchId));
}

// ------------------------------------------------------------------ scheduling

async function ensureNativeChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelReady) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'تنبيهات الصلاحية',
      description: 'تنبيهات قبل انتهاء صلاحية المنتجات',
      importance: 4,
      visibility: 1,
      vibration: true,
    } as never);
    channelReady = true;
  } catch {
    /* channel already exists / plugin unavailable */
  }
}

async function getPendingIds(): Promise<Set<number>> {
  if (!Capacitor.isNativePlatform()) return new Set();
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    return new Set(pending.notifications.map((n) => n.id));
  } catch {
    return new Set();
  }
}

function titleFor(batch: BatchNotif, daysLeft: number): string {
  return daysLeft < 0 ? `⛔ انتهت صلاحية: ${batch.productName}` : `⚠️ اقترب انتهاء: ${batch.productName}`;
}

function bodyFor(batch: BatchNotif, daysLeft: number): string {
  if (daysLeft < 0) return `انتهت صلاحية ${batch.productName} (${batch.expiryDate}). راجع مخزونك.`;
  if (daysLeft === 0) return `ينتهي ${batch.productName} اليوم (${batch.expiryDate}).`;
  if (daysLeft === 1) return `ينتهي ${batch.productName} غداً (${batch.expiryDate}).`;
  return `ينتهي ${batch.productName} خلال ${daysLeft} يوماً (${batch.expiryDate}).`;
}

/**
 * Hand one notification to the OS scheduler.
 *
 * `whenFactory` is evaluated *after* permission/channel setup. This matters on
 * Android: the plugin silently ignores an `at` that is already in the past, so
 * an "immediate" alert must compute its time at the last moment.
 */
async function scheduleAt(
  batch: BatchNotif,
  id: number,
  daysLeft: number,
  whenFactory: () => Date,
  immediate = false
): Promise<boolean> {
  const title = titleFor(batch, daysLeft);
  const body = bodyFor(batch, daysLeft);

  if (Capacitor.isNativePlatform()) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
    await ensureNativeChannel();

    let when = whenFactory();
    if (when.getTime() <= Date.now() + 1500) {
      if (!immediate) return false; // a stale milestone — skip instead of silently dropping
      when = new Date(Date.now() + 5000);
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      try {
        await LocalNotifications.cancel({ notifications: [{ id }] });
      } catch {
        /* nothing scheduled yet */
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#16a34a',
            schedule: { at: when, allowWhileIdle: true },
          },
        ],
      } as never);
      return true;
    } catch (e) {
      console.warn('[Notifications] native schedule failed', e);
      return false;
    }
  }

  // Web cannot wake a closed tab, so only deliver alerts that are due now.
  const when = whenFactory();
  if (when.getTime() > Date.now() + 60_000) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: String(id) });
    return true;
  } catch (e) {
    console.warn('[Notifications] web notify failed', e);
    return false;
  }
}

/**
 * Schedule every reminder for a single batch.
 *
 * - Future milestones (90/30/7/1/0 days before expiry) are scheduled on the OS.
 * - A batch that is already inside the 90-day window (or expired) also gets an
 *   immediate alert, at most once per ~20h (unless `force` is set by add/edit).
 */
export async function scheduleBatchNotifications(
  batch: BatchNotif,
  opts: { force?: boolean; pendingIds?: Set<number> } = {}
): Promise<void> {
  const { force = false } = opts;
  const now = Date.now();
  const pendingIds = opts.pendingIds ?? (await getPendingIds());

  for (const reminder of reminderDates(batch.expiryDate)) {
    // Leave a small margin so a date that just passed is never sent to the OS.
    if (reminder.at.getTime() <= now + 60_000) continue;
    const id = reminderId(batch.id, reminder.days);
    if (pendingIds.has(id)) continue;
    await scheduleAt(batch, id, reminder.days, () => reminder.at);
  }

  const daysLeft = daysUntilExpiry(batch.expiryDate);
  if (daysLeft <= NEAR_EXPIRY_DAYS) {
    if (!force && recentlyNotified(batch.id)) return;
    const ok = await scheduleAt(
      batch,
      immediateId(batch.id),
      daysLeft,
      () => new Date(Date.now() + 5000),
      true
    );
    if (ok) markNotified(batch.id);
  }
}

// Kept as an alias for older callers.
export const scheduleBatchNotification = scheduleBatchNotifications;

export async function cancelBatchNotification(id: string): Promise<void> {
  clearNotified(id);
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const ids = allIdsForBatch(id).map((n) => ({ id: n }));
    await LocalNotifications.cancel({ notifications: ids });
    try {
      await LocalNotifications.removeDeliveredNotifications({ notifications: ids as never });
    } catch {
      /* nothing delivered */
    }
  } catch {
    /* nothing scheduled */
  }
}

export async function cancelAllExpiryNotifications(opts: { keepCooldown?: boolean } = {}): Promise<void> {
  // A schema migration clears stale alarms but must keep the immediate-alert
  // cooldown, otherwise every near-expiry batch re-alerts at once on upgrade.
  if (!opts.keepCooldown) clearAllNotified();
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
    try {
      await LocalNotifications.removeAllDeliveredNotifications();
    } catch {
      /* nothing delivered */
    }
  } catch {
    /* nothing scheduled */
  }
}

/** Immediate test notifications (used by the notifications page). */
export async function scheduleExpiryNotifications(items: BatchNotif[]): Promise<void> {
  const slice = items.slice(0, 5);
  for (let i = 0; i < slice.length; i++) {
    const daysLeft = daysUntilExpiry(slice[i].expiryDate);
    await scheduleAt(
      slice[i],
      immediateId(slice[i].id),
      daysLeft,
      () => new Date(Date.now() + 1500 * (i + 1)),
      true
    );
  }
}

// Bump when the notification id scheme changes so stale alarms are cleared.
const SCHEMA_KEY = 'notificationSchemaVersion';
const SCHEMA_VERSION = '2';

async function migrateNotificationIds(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;
    await cancelAllExpiryNotifications({ keepCooldown: true });
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  } catch {
    /* storage blocked — the sweep below still schedules with the new ids */
  }
}

/**
 * Sweep the current user's batches and make sure every reminder is scheduled.
 * Safe to call repeatedly (pending ids and the daily cooldown dedupe it).
 */
export async function scheduleAllBatchNotifications(): Promise<{ batches: number; pending: number }> {
  const { getDB, ownedRows, scopeFor } = await import('./dexie');
  const { getSessionUserId } = await import('./sync');

  // One-time cleanup after the reminder schema changed from a single 90-day
  // alert (and 1000+idx test ids) to the hashed per-milestone ids. Without it an
  // updated install would keep the old alarm and schedule a duplicate.
  await migrateNotificationIds();

  const db = getDB();
  const owner = scopeFor(await getSessionUserId());
  const [batches, products] = await Promise.all([ownedRows(db.batches, owner), ownedRows(db.products, owner)]);
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  // Fetch the OS pending list once; re-reading it per batch is slow when the
  // inventory grows and every batch has up to five reminders.
  const pendingIds = await getPendingIds();

  for (const b of batches) {
    await scheduleBatchNotifications(
      {
        id: b.id,
        productName: productMap.get(b.product_id) ?? 'منتج',
        expiryDate: b.expiry_date,
      },
      { pendingIds }
    );
  }

  const pending = await getPendingIds();
  return { batches: batches.length, pending: pending.size };
}

// Backwards-compatible name used by the dashboard/notifications pages.
export const checkAndNotifyExpiring = scheduleAllBatchNotifications;
