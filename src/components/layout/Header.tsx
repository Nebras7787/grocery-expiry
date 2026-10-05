'use client';
import { Package, Wifi, WifiOff, RefreshCw, LogOut, User } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { UI } from '@/lib/i18n';
import { useState } from 'react';

export function Header() {
  const { isOnline, pending, manualSync } = useOfflineSync();
  const { user, signOut, isOfflineMode } = useAuth();
  const [showUser, setShowUser] = useState(false);

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold leading-none truncate">{UI.appName}</h1>
            <p className="text-xs text-slate-500 hidden sm:block truncate">{UI.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? UI.online : UI.offline}
            {pending > 0 && (
              <span className="ms-1 bg-white rounded-full px-1.5 py-0.5 border text-[10px] whitespace-nowrap">
                {pending} {UI.queued}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={manualSync} title={UI.syncNow}>
            <RefreshCw className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">{UI.sync}</span>
          </Button>

          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUser(!showUser)}
                className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-200 transition-colors"
                title={user.email ?? 'User'}
              >
                <User className="w-4 h-4" />
              </button>
              {showUser && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white border rounded-xl shadow-lg p-3 space-y-2 z-50">
                  <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  <div className="text-[10px] text-slate-400">
                    {isOfflineMode ? UI.offlineMode : `ID: ${user.id.slice(0, 8)}...`}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
                    <LogOut className="w-4 h-4 ms-2" /> {UI.signOut}
                  </Button>
                </div>
              )}
            </div>
          )}
          {isOfflineMode && !user && (
            <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600">
              <WifiOff className="w-3.5 h-3.5" /> {UI.offlineMode}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
