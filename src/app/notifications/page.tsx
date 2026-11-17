'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getNotificationDiagnostics,
  openExactAlarmSettings,
  requestNotificationPermission,
  scheduleAllBatchNotifications,
  scheduleExpiryNotifications,
  type NotificationDiagnostics,
} from '@/lib/notifications';
import { useBatches } from '@/hooks/useLiveData';
import { daysUntilExpiry, NEAR_EXPIRY_DAYS } from '@/lib/expiry';
import { describeDaysLeft, formatDate } from '@/lib/i18n';

const PERM_LABELS: Record<string, string> = {
  granted: 'مسموح',
  denied: 'مرفوض',
  prompt: 'غير محدد',
  'prompt-with-rationale': 'غير محدد',
  default: 'غير محدد',
  unknown: 'غير معروف',
};

export default function NotificationsPage() {
  const { batches } = useBatches();
  const [diag, setDiag] = useState<NotificationDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshDiag = useCallback(async () => {
    setDiag(await getNotificationDiagnostics());
  }, []);

  useEffect(() => {
    void refreshDiag();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshDiag();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshDiag]);

  const expiring = batches
    .map((b) => ({ id: b.id, productName: b.product_name, expiryDate: b.expiry_date, daysLeft: daysUntilExpiry(b.expiry_date) }))
    .filter((x) => x.daysLeft <= NEAR_EXPIRY_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const handleGrant = async () => {
    setBusy(true);
    try {
      const ok = await requestNotificationPermission();
      setMessage(ok ? 'تم منح إذن الإشعارات.' : 'لم يُمنح الإذن — فعّله من إعدادات التطبيق.');
      await refreshDiag();
    } finally {
      setBusy(false);
    }
  };

  const handleExactAlarm = async () => {
    await openExactAlarmSettings();
    setMessage('افتح «المنبّهات والتذكيرات» واسمح للتطبيق، ثم عُد إلى هنا.');
  };

  const handleReschedule = async () => {
    setBusy(true);
    try {
      const { batches: count, pending } = await scheduleAllBatchNotifications();
      setMessage(`أُعيد تجهيز تنبيهات ${count} دفعة — ${pending} إشعار مجدول على الجهاز.`);
      await refreshDiag();
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    try {
      await scheduleExpiryNotifications(expiring);
      setMessage('سيظهر تنبيه تجريبي خلال ثوانٍ. يمكنك إغلاق التطبيق للتأكد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold">التنبيهات</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">حالة إشعارات الجهاز</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            على الجوال تُجدوَل التذكيرات على مستوى نظام أندرويد في <b>٩٠ و٣٠ و٧ و١ و٠ يوم</b> قبل الانتهاء الساعة ٩:٠٠
            صباحاً، وتعمل حتى لو كان التطبيق مغلقاً. تُضاف أيضاً <b>دفعة فورية</b> عند تسجيل منتج قارب على الانتهاء.
          </p>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50">
              <span className="text-slate-600">إذن الإشعارات</span>
              <span className="font-medium">
                {diag ? PERM_LABELS[diag.display] ?? diag.display : '…'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50">
              <span className="text-slate-600">المنبّهات الدقيقة (Alarms &amp; reminders)</span>
              <span className={`font-medium ${diag?.exactAlarm === 'denied' ? 'text-amber-600' : ''}`}>
                {diag?.exactAlarm === 'granted' ? 'مسموحة' : diag?.exactAlarm === 'denied' ? 'غير مسموحة' : 'غير معروف'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50">
              <span className="text-slate-600">إشعارات مجدولة حالياً</span>
              <span className="font-medium">{diag?.pending ?? 0}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleGrant} disabled={busy}>
              طلب إذن الإشعارات
            </Button>
            <Button size="sm" variant="outline" onClick={handleExactAlarm} disabled={busy}>
              السماح بالمنبّهات الدقيقة
            </Button>
            <Button size="sm" variant="outline" onClick={handleReschedule} disabled={busy}>
              إعادة جدولة كل التنبيهات
            </Button>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={busy || expiring.length === 0}>
              تنبيه تجريبي الآن
            </Button>
          </div>

          {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">{message}</p>}

          <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="font-medium text-amber-800">لضمان وصول الإشعارات والتطبيق مغلق:</p>
            <p>• اسمح بـ«المنبّهات والتذكيرات» من الزر أعلاه (Android 12+).</p>
            <p>• من إعدادات النظام للتطبيق، اضبط البطارية على <b>غير مقيّد (Unrestricted)</b>.</p>
            <p>• لا تستخدم «إيقاف قسري» من إعدادات التطبيق؛ فهو يلغي كل التنبيهات المجدولة.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تنتهي خلال ٩٠ يوماً</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {expiring.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد دفعات تنتهي قريباً — كل شيء على ما يرام.</p>
          ) : (
            expiring.map((e) => (
              <div key={e.id} className="flex justify-between items-center gap-3 p-2 border rounded-lg text-sm">
                <span className="truncate">{e.productName}</span>
                <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">{formatDate(e.expiryDate)}</span>
                <span
                  className={`shrink-0 ${
                    e.daysLeft < 0 ? 'text-red-600 font-medium' : e.daysLeft <= 3 ? 'text-amber-600 font-medium' : ''
                  }`}
                >
                  {describeDaysLeft(e.daysLeft)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مزامنة لحظية بين الأجهزة</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>
            أثناء فتح التطبيق، تُسحب التغييرات من الأجهزة الأخرى لحظياً عبر Supabase Realtime، ويُصدر تنبيه لأي دفعة جديدة
            قاربت على الانتهاء. الحذف ينتقل للجهاز الآخر بعد لحظات.
          </p>
          <p className="text-xs text-slate-500">
            ملاحظة: وصول إشعار فوري على جهاز <b>مغلق تماماً</b> عند الإضافة من جهاز آخر يحتاج إشعارات FCM من الخادم
            (غير مفعّلة حالياً). التذكيرات المجدولة على الجهاز نفسه تعمل وهو مغلق.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
