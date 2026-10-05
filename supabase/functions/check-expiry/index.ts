// Supabase Edge Function: check-expiry
// Deploy: supabase functions deploy check-expiry --no-verify-jwt
// Schedule: supabase functions schedule check-expiry --cron "0 8 * * *"  (daily 08:00)
// Or via pg_cron calling public.refresh_batch_statuses()

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, serviceKey);

  // 1. Refresh statuses
  const { data: refreshed, error: refreshErr } = await supabase.rpc('refresh_batch_statuses');
  if (refreshErr) console.warn('refresh error', refreshErr);

  // 2. Fetch batches expiring within 3/14/30 days and not yet notified
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);

  const { data: expiringSoon, error } = await supabase
    .from('product_batches')
    .select('id, product_id, expiry_date, quantity, is_notified, products(name)')
    .gte('expiry_date', today)
    .lte('expiry_date', in14)
    .eq('is_notified', false)
    .order('expiry_date');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // 3. Mark as notified (to avoid spam; reset logic can be added)
  if (expiringSoon && expiringSoon.length > 0) {
    const ids = expiringSoon.map((r: { id: string }) => r.id);
    await supabase.from('product_batches').update({ is_notified: true }).in('id', ids);
  }

  // 4. (Optional) Send push via FCM / OneSignal / Supabase Realtime
  // Example: integrate with Firebase Admin or Resend email here
  // For now we just return the list so cron logs are visible

  return new Response(
    JSON.stringify({
      refreshed,
      expiring_count: expiringSoon?.length ?? 0,
      expiring: expiringSoon,
      window: { today, in3, in14 },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
