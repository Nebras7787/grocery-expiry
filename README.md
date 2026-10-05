# Grocery Expiry & Inventory Manager

Next.js **App Router** + **Tailwind CSS** + **TypeScript** + **Supabase** — packaged with **Capacitor** for iOS/Android. Offline-first via **IndexedDB (Dexie.js)** with auto-sync queue.

## Features

- **Dashboard**: Summary cards (Expiring This Week / Expired / Active Batches / Products Tracked), priority list sorted by `expiry_date` closest first, color coding (Red=Expired, Amber=Near Expiry ≤30d, Green=Valid).
- **Quick Batch Entry**: Autocomplete search for existing products OR create new product inline. Quick date chips `+1M +3M +6M +1Y` + custom date picker. Works offline (IndexedDB).
- **Offline-First Sync**: All writes go to Dexie first. A `syncQueue` table is flushed to Supabase when online, every 30s poll, or manual Sync button.
- **Supabase Auth**: Email/password sign-in + "Continue Offline" mode. Per-user data isolation via RLS.
- **Notifications**: Capacitor `LocalNotifications` on native + Web Notifications fallback. Edge Function + `pg_cron` for daily server-side checks.
- **PWA**: Service worker for offline caching, installable on mobile/desktop.
- **Categories**: Browse products grouped by category with color-coded badges.

## Quick Start

### 1. Install
```bash
npm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 2. Supabase Setup
1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor and paste `supabase/schema.sql` — run it
3. (Optional) Paste `supabase/seed.sql` to populate sample products
4. (Optional) Enable Realtime for `products` and `product_batches` tables
5. (Optional) Enable `pg_cron` extension for daily expiry checks

### 3. Develop
```bash
npm run dev        # http://localhost:3000
npm run build      # static export to out/
npm run lint       # ESLint
npm run typecheck  # TypeScript
```

### 4. Mobile (Capacitor)
```bash
npm run build                    # build + export
npx cap add android              # first time only
npx cap copy                     # copy out/ → native
npx cap open android             # open in Android Studio
npm run cap:run:android:live     # live reload during dev
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=...    # Edge Functions only
```

> If env vars are missing, the app runs in **offline-only mode** (Dexie only). Useful for Capacitor file:// without network.

## Project Structure

```
src/
  app/
    layout.tsx               # Root layout (Providers + viewport)
    page.tsx                 # Dashboard (SummaryCards + PriorityList + QuickBatchForm)
    login/page.tsx           # Auth login/register
    add/page.tsx             # Dedicated quick-add
    batches/page.tsx         # Search + filter all batches
    categories/page.tsx      # Products grouped by category
    notifications/page.tsx   # Notification settings + pg_cron spec
    globals.css              # Tailwind + CSS variables + safe-area
  components/
    ui/                      # Button, Card, Badge, Input, Select
    dashboard/               # SummaryCards, PriorityList
    batch-form/              # QuickBatchForm (offline enqueue + success feedback)
    layout/                  # Providers, AuthGuard, Header, NavTabs
  lib/
    auth-context.tsx         # Supabase Auth context (signIn/signUp/signOut/continueOffline)
    supabase.ts              # getSupabase() singleton (mock mode when env missing)
    database.types.ts        # Product, ProductBatch, SyncQueue types + CATEGORIES
    dexie.ts                 # GroceryDB v3 (indexed user_id) + enqueueSync()
    sync.ts                  # syncWithSupabase(), pullFromSupabase(), initAutoSync()
    expiry.ts                # computeStatus, daysUntilExpiry, QUICK_DATE_CHIPS
    notifications.ts         # Capacitor LocalNotifications + Web fallback
    capacitor-init.ts        # Auto-init Capacitor (app state, back button, deep links)
    utils.ts                 # cn(), uuid(), isOnline()
  hooks/
    useLiveData.ts           # useProducts (liveQuery), useBatches, useDashboardStats
    useOfflineSync.ts        # isOnline + pending count + manualSync
    useServiceWorker.ts      # PWA service worker registration
supabase/
  schema.sql                 # Tables, triggers, views, RLS
  seed.sql                   # 50+ common grocery products
  functions/check-expiry/    # Edge Function for daily expiry checks
public/
  sw.js                      # PWA service worker (stale-while-revalidate)
  manifest.json              # PWA manifest
  icons/                     # SVG icon
capacitor.config.ts          # App ID, splash screen, local notifications
next.config.mjs              # output: 'export', trailingSlash, unoptimized images
```

## Database Schema

- **`products`**: `id` (UUID PK), `name`, `category`, `created_at`, `user_id`
- **`product_batches`**: `id` (UUID PK), `product_id` (FK), `quantity`, `expiry_date`, `status` (enum: valid/near_expiry/expired), `is_notified`, `created_at`, `user_id`
- **Trigger**: `set_batch_status()` auto-computes status from `expiry_date`
- **Views**: `v_batches_priority`, `v_expiring_30d/14d/3d`, `v_expired`, `v_dashboard_stats`
- **RLS**: `authenticated` users see only their own rows (`auth.uid() = user_id`)

## Offline Sync Flow

1. **Write**: `db.products.put()` + `db.batches.put()` immediately → if online + Supabase configured → `supabase.from().insert()` → if fails → `enqueueSync()`
2. **Read**: `useLiveQuery` from Dexie only — instant, no network
3. **Sync**: On `window.online` + every 30s, drains `syncQueue` in-order, then `pullFromSupabase()` hydrates
4. **Header**: Shows Online/Offline status + queued count + manual Sync button

## Edge Function — Daily Cron

```bash
supabase functions deploy check-expiry --no-verify-jwt
supabase functions schedule check-expiry --cron "0 8 * * *"
```

Or via pg_cron:
```sql
SELECT cron.schedule('refresh-batch-status-daily', '0 2 * * *', $$
  SELECT public.refresh_batch_statuses();
$$);
```
