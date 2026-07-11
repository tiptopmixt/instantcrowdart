-- ============================================================================
-- Hourly maintenance via pg_cron + pg_net.
-- Requires the "pg_cron" and "pg_net" extensions (enable them in
-- Dashboard → Database → Extensions before running this file).
--
-- BEFORE RUNNING: set the two settings below to your project values so the
-- cron job can invoke the icc-close-chat edge function with the service role.
--   * app.icc_functions_url  -> https://<project-ref>.functions.supabase.co
--   * app.icc_service_key    -> your service_role key (keep secret; server-side only)
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store config once (replace the placeholder values).
-- These are read by the cron function below.
do $$
begin
  perform set_config('app.icc_functions_url', 'https://vhwjygrokfvaydkufxqk.functions.supabase.co', false);
  -- TODO: paste your service_role key (Project Settings → API). Server-side only.
  perform set_config('app.icc_service_key', 'PASTE_SERVICE_ROLE_KEY_HERE', false);
end $$;

-- The tick: close expired chats, then purge orphaned anonymous users.
create or replace function public.icc_cron_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  fn_url text := current_setting('app.icc_functions_url', true);
  svc    text := current_setting('app.icc_service_key', true);
begin
  -- 1) Process expired chats. Phase 1 closes active/extended; Phase 2 finalizes
  --    'closed' chats once their rating window elapses. Never the founding chat.
  for r in
    select id from public.icc_chats
    where status in ('active','extended','closed')
      and expires_at is not null
      and expires_at <= now()
  loop
    perform net.http_post(
      url     := fn_url || '/icc-close-chat',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || coalesce(svc, '')),
      body    := jsonb_build_object('chat_id', r.id, 'source', 'cron')
    );
  end loop;

  -- 2) Delete orphaned anonymous auth users older than 24h that hold no
  --    membership in any live chat (keeps the DB clean; founding is preserved).
  delete from auth.users u
  where u.is_anonymous = true
    and u.created_at < now() - interval '24 hours'
    and not exists (
      select 1
      from public.icc_profiles p
      join public.icc_chats c on c.id = p.chat_id
      where p.user_id = u.id
        and c.status in ('active','extended','founding')
    );
end;
$$;

-- Schedule hourly.
select cron.schedule(
  'icc-hourly-maintenance',
  '0 * * * *',
  $$ select public.icc_cron_tick(); $$
);

-- To remove later: select cron.unschedule('icc-hourly-maintenance');
