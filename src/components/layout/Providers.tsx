'use client';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Header } from '@/components/layout/Header';
import { NavTabs } from '@/components/layout/NavTabs';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { isPublicPath } from '@/lib/routes';
import { UI } from '@/lib/i18n';

// App chrome (header, tabs, footer) belongs to the signed-in experience only.
// On /login the page fills the screen so it reads as a real gateway.
function AppShell({ children }: { children: React.ReactNode }) {
  // Global, signed-in behaviour: arm OS reminders and listen for changes made
  // on other devices. Both hooks no-op until a user is present.
  useNotificationScheduler();
  useRealtimeSync();

  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;
  return (
    <>
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        <NavTabs />
        {children}
      </div>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        {UI.offlineFooter}
      </footer>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  return (
    <AuthProvider>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </AuthProvider>
  );
}
