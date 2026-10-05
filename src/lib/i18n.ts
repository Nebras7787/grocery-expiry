import type { BatchStatus } from './database.types';

// Latin digits with Arabic month names: unambiguous for expiry dates, which
// people read as numbers. 'ar-EG' alone renders Arabic-Indic digits (٠١٢٣).
const LOCALE = 'ar-u-nu-latn';

export const STATUS_LABELS: Record<BatchStatus, string> = {
  expired: 'منتهي',
  near_expiry: 'قارب على الانتهاء',
  valid: 'صالح',
};

// Categories are stored as stable English keys (they match seed.sql and the DB)
// and translated only for display.
export const CATEGORY_LABELS: Record<string, string> = {
  Dairy: 'ألبان',
  Bakery: 'مخبوزات',
  'Canned Goods': 'معلبات',
  Beverages: 'مشروبات',
  Frozen: 'مجمدات',
  Produce: 'خضار وفواكه',
  Meat: 'لحوم',
  Snacks: 'وجبات خفيفة',
  General: 'عام',
  Other: 'أخرى',
};

export function categoryLabel(category?: string | null): string {
  if (!category) return CATEGORY_LABELS.General;
  return CATEGORY_LABELS[category] ?? category;
}

export function statusLabel(status: BatchStatus): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.valid;
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? parseDateOnly(iso) : iso;
  return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

// expiry_date is a plain YYYY-MM-DD. Parsing it with new Date() would treat it
// as UTC midnight and shift the day for negative UTC offsets.
export function parseDateOnly(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function daysUntil(iso: string): number {
  const target = parseDateOnly(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "اليوم" / "غداً" / "بعد ٣ أيام" / "منذ يومين" — never bare digits. */
export function describeDaysLeft(days: number): string {
  if (days < 0) {
    const n = Math.abs(days);
    if (n === 1) return 'منذ يوم';
    if (n === 2) return 'منذ يومين';
    if (n <= 10) return `منذ ${n} أيام`;
    return `منذ ${n} يوماً`;
  }
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === 2) return 'بعد يومين';
  if (days <= 10) return `بعد ${days} أيام`;
  return `بعد ${days} يوماً`;
}

export const UI = {
  appName: 'مدير انتهاء الصلاحية',
  tagline: 'تابع تواريخ الصلاحية حتى بدون إنترنت',
  online: 'متصل',
  offline: 'غير متصل',
  offlineMode: 'وضع عدم الاتصال',
  queued: 'في الانتظار',
  sync: 'مزامنة',
  syncNow: 'مزامنة الآن',
  signOut: 'تسجيل الخروج',
  dashboard: 'الرئيسية',
  batches: 'الدفعات',
  quickAdd: 'إضافة سريعة',
  categories: 'الأقسام',
  alerts: 'التنبيهات',
  priority: 'الأقرب انتهاءً',
  offlineFooter: 'يعمل بدون إنترنت • تخزين محلي (IndexedDB) • مزامنة مع Supabase',
} as const;
