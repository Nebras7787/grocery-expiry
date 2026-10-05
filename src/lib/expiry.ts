import { addDays, format } from 'date-fns';
import type { BatchStatus } from './database.types';
import { daysUntil } from './i18n';

export function computeStatus(expiryDate: string | Date): BatchStatus {
  const diff =
    typeof expiryDate === 'string'
      ? daysUntil(expiryDate)
      : daysUntil(format(expiryDate, 'yyyy-MM-dd'));
  if (diff < 0) return 'expired';
  if (diff <= 30) return 'near_expiry';
  return 'valid';
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
