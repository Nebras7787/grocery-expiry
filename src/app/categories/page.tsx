'use client';
import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/useLiveData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CATEGORIES } from '@/lib/database.types';
import { categoryLabel } from '@/lib/i18n';
import { Layers, Search } from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  Dairy: 'bg-blue-50 border-blue-200 text-blue-700',
  Bakery: 'bg-amber-50 border-amber-200 text-amber-700',
  'Canned Goods': 'bg-orange-50 border-orange-200 text-orange-700',
  Beverages: 'bg-purple-50 border-purple-200 text-purple-700',
  Frozen: 'bg-cyan-50 border-cyan-200 text-cyan-700',
  Produce: 'bg-green-50 border-green-200 text-green-700',
  Meat: 'bg-red-50 border-red-200 text-red-700',
  Snacks: 'bg-pink-50 border-pink-200 text-pink-700',
  General: 'bg-slate-50 border-slate-200 text-slate-700',
  Other: 'bg-gray-50 border-gray-200 text-gray-700',
};

export default function CategoriesPage() {
  const { products } = useProducts();
  const [search, setSearch] = useState('');

  const categoryData = useMemo(() => {
    const filtered = search
      ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : products;

    const grouped: Record<string, typeof products> = {};
    for (const cat of CATEGORIES) {
      grouped[cat] = [];
    }

    for (const p of filtered) {
      const cat = (p.category as string) || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    return Object.entries(grouped)
      .filter(([, items]) => items.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
  }, [products, search]);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5" /> الأقسام
        </h2>
        <Badge>{products.length} منتج</Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="ابحث في المنتجات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {categoryData.map(([cat, items]) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border ${
                    CATEGORY_COLORS[cat] ?? 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {categoryLabel(cat)}
                </span>
                <Badge>{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {items.map((p) => (
                  <div key={p.id} className="text-sm p-2 rounded-lg bg-slate-50 border border-slate-100 truncate">
                    {p.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {categoryData.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              لا توجد منتجات. أضفها من صفحة الإضافة السريعة.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
