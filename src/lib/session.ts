import type { User } from '@supabase/supabase-js';

// Persisted locally after a successful login. It lets the app keep the user
// signed in when the device is offline and Supabase cannot refresh the session.
// Cleared only on an explicit sign-out.
export const LOCAL_SESSION_KEY = 'authSessionSnapshot';

export type LocalSnapshot = { id: string; email: string | null };

export function readLocalSession(): LocalSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSnapshot> | null;
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) return null;
    return { id: parsed.id, email: typeof parsed.email === 'string' ? parsed.email : null };
  } catch {
    return null;
  }
}

export function writeLocalSession(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(
        LOCAL_SESSION_KEY,
        JSON.stringify({ id: user.id, email: user.email ?? null })
      );
    } else {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    }
  } catch {
    /* storage blocked — the in-memory session still works for this mount */
  }
}

// Minimal User-shaped object so components that read `user.id` / `user.email`
// keep working while running on the local (offline) session.
export function snapshotToUser(snap: LocalSnapshot): User {
  return { id: snap.id, email: snap.email ?? undefined } as unknown as User;
}
