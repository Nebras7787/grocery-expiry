'use client';

import { useAuth } from '@/lib/auth-context';
import { isPublicPath } from '@/lib/routes';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);
  const [timedOut, setTimedOut] = useState(false);

  // Safety net: if auth never settles, stop spinning instead of showing a blank
  // page forever.
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
    // Signed in while sitting on the login page → go straight to the dashboard.
    if (user && isPublic) {
      router.replace('/');
      return;
    }
    // No confirmed session (Supabase or local) → login is mandatory.
    if (!user && !isPublic) {
      router.replace('/login');
    }
  }, [loading, user, isPublic, router]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
