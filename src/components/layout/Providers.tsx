'use client';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Header } from '@/components/layout/Header';
import { NavTabs } from '@/components/layout/NavTabs';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { UI } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  return (
    <AuthProvider>
      <AuthGuard>
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
          <NavTabs />
          {children}
        </div>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
          {UI.offlineFooter}
        </footer>
      </AuthGuard>
    </AuthProvider>
  );
}
