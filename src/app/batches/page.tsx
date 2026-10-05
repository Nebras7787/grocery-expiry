'use client';
import { useState } from 'react';
import { useBatches } from '@/hooks/useLiveData';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { expiryBorderColor } from '@/lib/expiry';
import { categoryLabel, describeDaysLeft, formatDate } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { getDB, enqueueSync, scopeFor } from '@/lib/dexie';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { daysUntilExpiry } from '@/lib/expiry';
import { DemoDataCard } from '@/components/demo/DemoDataCard';

export default function BatchesPage() {
  const { batches } = useBatches();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'valid' | 'near_expiry' | 'expired'>('all');

  const filtered = batches.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (q && !b.product_name.toLowerCase().includes(q.toLowerCase()) && !b.category.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    const db = getDB();
    await db.batches.delete(id);
    const supabase = getSupabase();
    const owner = scopeFor(user?.id);
    if (supabase && navigator.onLine && user) {
      const { error } = await supabase.from('product_batches').delete().eq('id', id);
      if (error) await enqueueSync({ table: 'product_batches', operation: 'delete', payload: {}, recordId: id }, owner);
    } else {
      await enqueueSync({ table: 'product_batches', operation: 'delete', payload: {}, recordId: id }, owner);
    }
  };

  return (
    <main className="space-y-4">
      <h2 className="text-lg font-semibold">كل الدفعات ({filtered.length})</h2>

      {batches.length === 0 ? (
        <DemoDataCard />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="ابحث باسم المنتج أو القسم..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1"
              />
              <Select value={filter} onChange={(e) => setFilter(e.target.value as never)}>
                <option value="all">كل الحالات</option>
                <option value="valid">صالح</option>
                <option value="near_expiry">قارب على الانتهاء (≤ ٣٠ يوماً)</option>
                <option value="expired">منتهي</option>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-3">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-slate-500">لا توجد دفعات مطابقة لعوامل التصفية.</CardContent>
              </Card>
            ) : (
              filtered.map((b) => (
                <Card key={b.id} className={`border-r-4 ${expiryBorderColor(b.status)}`}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {b.product_name} <span className="text-slate-500 font-normal">×{b.quantity}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {categoryLabel(b.category)} • ينتهي {formatDate(b.expiry_date)} • {describeDaysLeft(daysUntilExpiry(b.expiry_date))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={b.status as never} />
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} title="حذف الدفعة">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
