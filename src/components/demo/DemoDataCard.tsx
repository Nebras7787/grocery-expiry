'use client';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Loader2, Trash2, Sparkles } from 'lucide-react';
import { seedDemoData, clearLocalData } from '@/lib/seed';
import { useAuth } from '@/lib/auth-context';

type Props = {
  /** Inline variant for the dashboard empty state, boxed variant for the login page. */
  variant?: 'empty' | 'box';
};

export function DemoDataCard({ variant = 'empty' }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSeed = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await seedDemoData(user?.id);
      setMsg(`تمت إضافة ${r.products} منتجاً و${r.batches} دفعة`);
    } catch (e) {
      console.error(e);
      setMsg('تعذّر تحميل البيانات التجريبية');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setMsg('');
    try {
      await clearLocalData(user?.id);
      setMsg('تم حذف البيانات المحلية');
    } catch (e) {
      console.error(e);
      setMsg('تعذّر حذف البيانات');
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'empty') {
    return (
      <Card className="border-dashed border-emerald-300 bg-emerald-50/40">
        <CardContent className="p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="font-semibold text-emerald-900">لا توجد بيانات بعد</div>
          <p className="text-sm text-slate-600">
            ابدأ بإضافة دفعة من النموذج المجاور، أو حمّل بيانات تجريبية جاهزة (٥٧ منتجاً و٤١ دفعة) لتجربة التطبيق.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button onClick={handleSeed} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 ms-2 animate-spin" /> : <Database className="w-4 h-4 ms-2" />}
              تحميل البيانات التجريبية
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={busy} title="حذف كل البيانات المحلية">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {msg && <p className="text-xs text-emerald-700">{msg}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Database className="w-4 h-4" /> بيانات تجريبية
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleSeed} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 ms-1 animate-spin" /> : <Database className="w-4 h-4 ms-1" />}
            تحميل عيّنة
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={busy} title="حذف البيانات المحلية">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        {msg && <p className="text-xs text-center text-emerald-700">{msg}</p>}
      </CardContent>
    </Card>
  );
}
