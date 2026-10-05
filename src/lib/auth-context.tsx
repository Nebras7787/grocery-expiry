'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  continueOffline: () => void;
  isOfflineMode: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  continueOffline: () => {},
  isOfflineMode: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setIsOfflineMode(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        // Never leave `loading` stuck true: a rejected getSession (offline,
        // blocked storage, corrupted token) would blank the whole app behind
        // AuthGuard's spinner with nothing visible in the console.
        console.warn('[Auth] getSession failed, continuing offline:', err);
        setIsOfflineMode(true);
        setLoading(false);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setIsOfflineMode(false);
  }, []);

  const continueOffline = useCallback(() => {
    setIsOfflineMode(true);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        continueOffline,
        isOfflineMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
