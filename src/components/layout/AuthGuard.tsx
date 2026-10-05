'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const PUBLIC_PATHS = ['/login', '/register'];

// next.config.mjs sets `trailingSlash: true`, so usePathname() returns
// '/login/' rather than '/login'. Normalize before comparing, otherwise public
// pages are treated as protected and AuthGuard renders null (blank page).
function isPublicPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.includes(normalized);
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, isOfflineMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if auth never settles, stop spinning and let the app render
  // instead of showing a blank page forever.
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isOfflineMode && !isPublic) {
      router.replace('/login');
    }
  }, [loading, user, isOfflineMode, isPublic, router]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user && !isOfflineMode && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
