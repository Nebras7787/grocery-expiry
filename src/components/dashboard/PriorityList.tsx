'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBatches } from '@/hooks/useLiveData';
import { expiryColor } from '@/lib/expiry';
import { describeDaysLeft, formatDate } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';
import { getDB, scopeFor } from '@/lib/dexie';
import { queueDelete } from '@/lib/sync';
import { useAuth } from '@/lib/auth-context';
import { DemoDataCard } from '@/components/demo/DemoDataCard';
import { clearAllLocalData } from '@/lib/seed';
import { cancelBatchNotification } from '@/lib/notifications';

export function PriorityList() {
  const { batches } = useBatches();
  const { user } = useAuth();

  const handleClearAll = async () => {
    if (!confirm('سيتم حذف جميع المنتجات والدفعات المحلية نهائياً. هل أنت متأكد؟')) return;
    await clearAllLocalData();
  };

  const handleDelete = async (id: string) => {
    const db = getDB();
    await db.batches.delete(id);
    await cancelBatchNotification(id);
    // Queue first: a direct delete can silently affect zero rows and leave the
    // row alive on other devices.
    await queueDelete('product_batches', id, scopeFor(user?.id));
  };

  if (!batches.length) {
    return <DemoDataCard />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">الأقرب انتهاءً</CardTitle>
            <p className="text-xs text-slate-500">مرتّبة من الأقرب تاريخاً — الأحمر منتهي، الكهرماني قارب على الانتهاء، الأخضر صالح</p>
          </div>
          <Button variant="destructive" size="sm" onClick={handleClearAll} title="حذف جميع البيانات المحلية" className="shrink-0">
            <Trash2 className="w-4 h-4 ms-1" /> حذف الكل
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {batches.slice(0, 50).map((b) => {
          const status = b.status as 'valid' | 'near_expiry' | 'expired';
          return (
            <div
              key={b.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${expiryColor(status)}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  <span className="truncate">{b.product_name}</span>
                  <span className="text-xs font-normal opacity-70 hidden sm:inline shrink-0">• {b.category}</span>
                  <span className="text-xs font-normal shrink-0">×{b.quantity}</span>
                </div>
                <div className="text-xs opacity-80">
                  ينتهي: {formatDate(b.expiry_date)} • {describeDaysLeft(
                    Math.round(
                      (new Date(`${b.expiry_date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={status} />
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} title="حذف الدفعة">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
