-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto ping query every 3 days at 12:00 PM to keep Supabase active
SELECT cron.schedule(
    'keep-supabase-alive',
    '0 12 */3 * *',
    $$ SELECT count(*) FROM products; $$
);
