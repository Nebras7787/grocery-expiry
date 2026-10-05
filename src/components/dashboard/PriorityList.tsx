'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBatches } from '@/hooks/useLiveData';
import { expiryColor } from '@/lib/expiry';
import { describeDaysLeft, formatDate } from '@/lib/i18n';
import { Trash2 } from 'lucide-react';
import { getDB, enqueueSync, scopeFor } from '@/lib/dexie';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { DemoDataCard } from '@/components/demo/DemoDataCard';

export function PriorityList() {
  const { batches } = useBatches();
  const { user } = useAuth();

  const handleDelete = async (id: string) => {
    const db = getDB();
    await db.batches.delete(id);
    const supabase = getSupabase();
    const owner = scopeFor(user?.id);
    if (supabase && navigator.onLine && user) {
      const { error } = await supabase.from('product_batches').delete().eq('id', id);
      if (error) {
        await enqueueSync({ table: 'product_batches', operation: 'delete', payload: {}, recordId: id }, owner);
      }
    } else {
      await enqueueSync({ table: 'product_batches', operation: 'delete', payload: {}, recordId: id }, owner);
    }
  };

  if (!batches.length) {
    return <DemoDataCard />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">الأقرب انتهاءً</CardTitle>
        <p className="text-xs text-slate-500">مرتّبة من الأقرب تاريخاً — الأحمر منتهي، الكهرماني قارب على الانتهاء، الأخضر صالح</p>
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
