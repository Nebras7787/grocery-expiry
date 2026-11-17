'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from './supabase';
import { readLocalSession, writeLocalSession, snapshotToUser } from './session';
import type { Session, User } from '@supabase/supabase-js';

interface AuthResult {
  error?: string;
  notice?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Offline fallback restored from localStorage. It is only cleared by an
  // explicit sign-out, so a failed token refresh while offline never kicks the
  // user out of the app.
  const [localUser, setLocalUser] = useState<User | null>(() => {
    const snap = readLocalSession();
    return snap ? snapshotToUser(snap) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // No backend configured: there is nothing to authenticate against.
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (s?.user) {
          writeLocalSession(s.user);
          setLocalUser(s.user);
        }
        setSession(s);
        setLoading(false);
      })
      .catch((err) => {
        // Offline / blocked storage / corrupted token. Keep the persisted local
        // session so the dashboard stays reachable without a network.
        console.warn('[Auth] getSession failed, using local session:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (s?.user) {
        writeLocalSession(s.user);
        setLocalUser(s.user);
      } else if (event === 'SIGNED_OUT' && typeof navigator !== 'undefined' && navigator.onLine) {
        // A confirmed server-side sign-out while online: drop the local fallback
        // too. Offline we keep it so the app stays usable without a network.
        writeLocalSession(null);
        setLocalUser(null);
      }
      setSession(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Supabase غير مُهيّأ — تحقّق من إعدادات الاتصال' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      writeLocalSession(data.user);
      setLocalUser(data.user);
    }
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Supabase غير مُهيّأ — تحقّق من إعدادات الاتصال' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.session?.user) {
      writeLocalSession(data.session.user);
      setLocalUser(data.session.user);
      return {};
    }
    // Email confirmation is enabled on this project, so no session yet.
    return { notice: 'تم إنشاء الحساب — أكّد بريدك الإلكتروني ثم سجّل الدخول.' };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    try {
      // Offline, scope 'local' still clears the stored token so reopening the
      // app does not silently sign the user back in.
      if (supabase) await supabase.auth.signOut(offline ? { scope: 'local' } : undefined);
    } catch (e) {
      console.warn('[Auth] signOut failed, clearing locally:', e);
    }
    writeLocalSession(null);
    setSession(null);
    setLocalUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? localUser,
        session,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
