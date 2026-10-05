'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Package, Bell, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI } from '@/lib/i18n';

const tabs = [
  { href: '/', label: UI.dashboard, icon: LayoutDashboard },
  { href: '/batches', label: UI.batches, icon: Package },
  { href: '/add', label: UI.quickAdd, icon: PlusCircle },
  { href: '/categories', label: UI.categories, icon: Layers },
  { href: '/notifications', label: UI.alerts, icon: Bell },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-fit overflow-x-auto max-w-full scrollbar-hide">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0',
              active ? 'bg-white shadow-sm border border-slate-200 text-slate-900' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
