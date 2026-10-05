'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

const PUBLIC_PATHS = ['/login', '/register'];

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, isOfflineMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isOfflineMode && !isPublic) {
      router.replace('/login');
    }
  }, [loading, user, isOfflineMode, isPublic, router]);

  if (loading) {
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
