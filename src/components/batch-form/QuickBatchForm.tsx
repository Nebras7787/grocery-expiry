'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/database.types';
import { QUICK_DATE_CHIPS, quickDateFromNow, computeStatus } from '@/lib/expiry';
import { categoryLabel } from '@/lib/i18n';
import { useProducts } from '@/hooks/useLiveData';
import { getDB, enqueueSync, scopeFor } from '@/lib/dexie';
import { getSupabase } from '@/lib/supabase';
import { toRemotePayload } from '@/lib/sync';
import { uuid } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { Search, Plus, Calendar, Package, CheckCircle } from 'lucide-react';

export function QuickBatchForm({ onSuccess }: { onSuccess?: () => void }) {
  const [search, setSearch] = useState('');
  const { products } = useProducts(search);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [newProductName, setNewProductName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [quantity, setQuantity] = useState<number>(1);
  const [expiryDate, setExpiryDate] = useState<string>(() => quickDateFromNow(90));
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [lastSaved, setLastSaved] = useState(false);
  const { user } = useAuth();

  const selectedProduct = useMemo(() => products.find((p) => p.id === selectedProductId), [products, selectedProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || !expiryDate) return;
    setSaving(true);
    setLastSaved(false);
    try {
      const db = getDB();
      const supabase = getSupabase();
      const userId = user?.id ?? null;
      const owner = scopeFor(userId);

      let productId = selectedProductId;

      // Create new product if needed
      if (mode === 'new') {
        if (!newProductName.trim()) {
          alert('اكتب اسم المنتج');
          setSaving(false);
          return;
        }
        const newProd = {
          id: uuid(),
          name: newProductName.trim(),
          category: newCategory,
          created_at: new Date().toISOString(),
          user_id: userId,
          owner,
        };
        await db.products.put(newProd as never);
        productId = newProd.id;
        if (supabase && navigator.onLine && userId) {
          const { error } = await supabase.from('products').insert(toRemotePayload(newProd));
          if (error) await enqueueSync({ table: 'products', operation: 'insert', payload: newProd }, owner);
        } else {
          await enqueueSync({ table: 'products', operation: 'insert', payload: newProd }, owner);
        }
      } else if (!productId) {
        alert('اختر منتجاً');
        setSaving(false);
        return;
      }

      const batch = {
        id: uuid(),
        product_id: productId,
        quantity,
        expiry_date: expiryDate,
        status: computeStatus(expiryDate),
        is_notified: false,
        created_at: new Date().toISOString(),
        user_id: userId,
        owner,
      };

      await db.batches.put(batch as never);

      if (supabase && navigator.onLine && userId) {
        const { error } = await supabase.from('product_batches').insert(toRemotePayload(batch));
        if (error) await enqueueSync({ table: 'product_batches', operation: 'insert', payload: batch }, owner);
      } else {
        await enqueueSync({ table: 'product_batches', operation: 'insert', payload: batch }, owner);
      }

      setQuantity(1);
      setSearch('');
      setSelectedProductId('');
      setNewProductName('');
      setLastSaved(true);
      setTimeout(() => setLastSaved(false), 3000);
      onSuccess?.();
    } catch (err) {
      console.error(err);
      alert('تعذّر حفظ الدفعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="w-5 h-5 text-emerald-600" /> إضافة دفعة
        </CardTitle>
        <p className="text-xs text-slate-500">سجّل منتجاً وكميته وتاريخ انتهاءه — يعمل بدون إنترنت.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === 'existing' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('existing')}
            >
              <Search className="w-4 h-4 ms-1" /> منتج موجود
            </Button>
            <Button
              type="button"
              variant={mode === 'new' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setMode('new')}
            >
              <Plus className="w-4 h-4 ms-1" /> منتج جديد
            </Button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Search className="w-4 h-4" /> ابحث عن منتج
              </label>
              <Input placeholder="مثال: حليب، خبز..." value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <div className="border rounded-lg max-h-40 overflow-auto divide-y bg-white">
                  {products.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">لا نتائج — بدّل إلى «منتج جديد» لإنشائه.</div>
                  ) : (
                    products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className={`w-full text-right p-2.5 text-sm hover:bg-slate-50 flex items-center justify-between gap-2 ${
                          selectedProductId === p.id ? 'bg-emerald-50 font-medium' : ''
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs text-slate-500 shrink-0">{categoryLabel(p.category as string)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedProduct && (
                <div className="text-sm p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  تم اختيار: <b>{selectedProduct.name}</b> ({categoryLabel(selectedProduct.category as string)})
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">اسم المنتج</label>
                <Input placeholder="مثال: لبن يوناني ٥٠٠غ" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">القسم</label>
                <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">الكمية</label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" /> تاريخ الانتهاء
              </label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_DATE_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setExpiryDate(quickDateFromNow(chip.days))}
                className="px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 text-sm font-medium"
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setExpiryDate(quickDateFromNow(0))}
              className="px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 text-sm"
            >
              اليوم
            </button>
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الدفعة'}
          </Button>
          {lastSaved && (
            <div className="flex items-center justify-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircle className="w-4 h-4" /> حُفظت محلياً
            </div>
          )}
          <p className="text-[11px] text-slate-500 text-center">تُحفظ في التخزين المحلي وتُزامَن تلقائياً عند الاتصال.</p>
        </form>
      </CardContent>
    </Card>
  );
}
