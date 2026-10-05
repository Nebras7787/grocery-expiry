'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requestNotificationPermission, scheduleExpiryNotifications } from '@/lib/notifications';
import { useBatches } from '@/hooks/useLiveData';
import { daysUntilExpiry } from '@/lib/expiry';
import { describeDaysLeft, formatDate } from '@/lib/i18n';

const PERM_LABELS: Record<string, string> = {
  granted: 'مسموح',
  denied: 'مرفوض',
  default: 'غير محدد',
  unknown: 'غير معروف',
};

export default function NotificationsPage() {
  const { batches } = useBatches();
  const [perm, setPerm] = useState<string>('unknown');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setPerm(Notification.permission);
  }, []);

  const expiring = batches
    .map((b) => ({ id: b.id, productName: b.product_name, expiryDate: b.expiry_date, daysLeft: daysUntilExpiry(b.expiry_date) }))
    .filter((x) => x.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <main className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold">التنبيهات</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">إشعارات الجهاز</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            على الجوال (Capacitor) تُجدوَل الإشعارات محلياً. على الويب تُستخدم إشعارات المتصفح.
            كما توجد دالة Supabase_edge تعمل يومياً لتحديد المنتجات قريبة الانتهاء وإرسال التنبيهات.
          </p>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-slate-500">الإذن:</span>
            <span className="font-medium">{PERM_LABELS[perm] ?? perm}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ok = await requestNotificationPermission();
                setPerm(ok ? 'granted' : 'denied');
              }}
            >
              طلب الإذن
            </Button>
          </div>
          <Button onClick={() => scheduleExpiryNotifications(expiring)} disabled={expiring.length === 0}>
            تجربة الآن ({expiring.length} تنتهي خلال ١٤ يوماً)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تنتهي خلال ١٤ يوماً</CardTitle>
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
          <CardTitle className="text-base">المجدولة اليومية على الخادم</CardTitle>
        </CardHeader>
        <CardContent className="text-xs bg-slate-50 p-3 rounded-lg overflow-auto">
          <pre className="whitespace-pre-wrap font-mono text-slate-700" dir="ltr">
{`-- pg_cron (if enabled)
SELECT cron.schedule('refresh-batch-status-daily', '0 2 * * *', $$
  SELECT public.refresh_batch_statuses();
$$);

-- Edge Function deploy:
supabase functions deploy check-expiry --no-verify-jwt
supabase functions schedule check-expiry --cron "0 8 * * *"
`}
          </pre>
          <p className="mt-2 text-slate-600">ملف الدالة: <code dir="ltr">supabase/functions/check-expiry/index.ts</code></p>
        </CardContent>
      </Card>
    </main>
  );
}
