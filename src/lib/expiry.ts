import { addDays, format, subDays } from 'date-fns';
import type { BatchStatus } from './database.types';
import { daysUntil, parseDateOnly } from './i18n';

// A batch counts as "near expiry" (and the early warning fires) starting
// three months before its expiry date.
export const NEAR_EXPIRY_DAYS = 90;

export function computeStatus(expiryDate: string | Date): BatchStatus {
  const diff =
    typeof expiryDate === 'string'
      ? daysUntil(expiryDate)
      : daysUntil(format(expiryDate, 'yyyy-MM-dd'));
  if (diff < 0) return 'expired';
  if (diff <= NEAR_EXPIRY_DAYS) return 'near_expiry';
  return 'valid';
}

// Every reminder the OS should fire for a batch, counted back from its expiry
// date. Multiple milestones mean the user still gets alerted even if the app is
// never opened after the batch is added.
export const REMINDER_DAYS = [90, 30, 7, 1, 0] as const;

// The moment the early warning should fire: 90 days before expiry, at 09:00
// local time. Returned as a Date so it can be handed straight to the OS
// scheduler (LocalNotifications) and still fire while the app is closed.
export function notificationDate(expiryDate: string | Date): Date {
  const base = typeof expiryDate === 'string' ? parseDateOnly(expiryDate) : new Date(expiryDate);
  const at = subDays(base, NEAR_EXPIRY_DAYS);
  at.setHours(9, 0, 0, 0);
  return at;
}

// All reminder instants for a batch (90/30/7/1/0 days before expiry, 09:00).
export function reminderDates(expiryDate: string | Date): { days: number; at: Date }[] {
  const base = typeof expiryDate === 'string' ? parseDateOnly(expiryDate) : new Date(expiryDate);
  return REMINDER_DAYS.map((days) => {
    const at = subDays(base, days);
    at.setHours(9, 0, 0, 0);
    return { days, at };
  });
}

export function daysUntilExpiry(expiryDate: string | Date): number {
  if (typeof expiryDate === 'string') return daysUntil(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiryDate.getTime() - today.getTime()) / 86_400_000);
}

export function expiryColor(status: BatchStatus): string {
  switch (status) {
    case 'expired':
      return 'bg-red-50 border-red-200 text-red-700';
    case 'near_expiry':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'valid':
    default:
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  }
}

export function expiryBorderColor(status: BatchStatus): string {
  switch (status) {
    case 'expired':
      return 'border-r-red-500';
    case 'near_expiry':
      return 'border-r-amber-500';
    case 'valid':
    default:
      return 'border-r-emerald-500';
  }
}

// Day offsets instead of month arithmetic, so "+3 months" stays stable and the
// stored yyyy-MM-dd stays a local calendar date.
export const QUICK_DATE_CHIPS = [
  { label: '+شهر', days: 30 },
  { label: '+٣ أشهر', days: 90 },
  { label: '+٦ أشهر', days: 180 },
  { label: '+سنة', days: 365 },
] as const;

export function quickDateFromNow(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd');
}
