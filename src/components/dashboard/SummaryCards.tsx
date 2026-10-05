'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, Package, TrendingUp } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useLiveData';

export function SummaryCards() {
  const s = useDashboardStats();
  const cards = [
    {
      title: 'تنتهي خلال أسبوع',
      value: s.expiring_this_week,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      hint: 'خلال ٧ أيام',
    },
    {
      title: 'منتهية الصلاحية',
      value: s.expired_count,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50 border-red-200',
      hint: 'تحتاج إلى تدخل',
    },
    {
      title: 'دفعات سارية',
      value: s.active_batches,
      icon: Package,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      hint: `${s.total_active_quantity} وحدة إجمالاً`,
    },
    {
      title: 'منتجات متابَعة',
      value: s.distinct_products,
      icon: TrendingUp,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
      hint: `${s.near_expiry_count} قارب على الانتهاء`,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.title} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <span className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="leading-tight">{c.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-slate-500 leading-tight">{c.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
