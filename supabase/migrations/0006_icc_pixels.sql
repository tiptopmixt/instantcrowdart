-- ============================================================================
-- Pixel Art experiment: one shared canvas, everyone adds pixels together.
-- Run once in the SQL Editor.
-- ============================================================================

create table if not exists public.icc_pixels (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.icc_chats(id) on delete cascade,
  user_id    uuid not null,
  x          int not null,
  y          int not null,
  color      text not null,
  created_at timestamptz not null default now(),
  unique (chat_id, x, y)          -- one pixel per cell; nobody can overwrite another's
);
create index if not exists icc_pixels_chat_idx on public.icc_pixels(chat_id);

-- So realtime DELETE events carry the x,y (not just the id).
alter table public.icc_pixels replica identity full;

alter table public.icc_pixels enable row level security;

drop policy if exists icc_pixels_select on public.icc_pixels;
create policy icc_pixels_select on public.icc_pixels
  for select to authenticated using (true);

drop policy if exists icc_pixels_insert on public.icc_pixels;
create policy icc_pixels_insert on public.icc_pixels
  for insert to authenticated with check (user_id = auth.uid());

-- Anyone can MOVE any pixel (update its x,y) — that's the fun. Insert stays own-only,
-- delete stays own-only (you can only remove your own pixels, freeing your budget).
drop policy if exists icc_pixels_update on public.icc_pixels;
create policy icc_pixels_update on public.icc_pixels
  for update to authenticated using (true) with check (true);

drop policy if exists icc_pixels_delete on public.icc_pixels;
create policy icc_pixels_delete on public.icc_pixels
  for delete to authenticated using (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.icc_pixels;
exception when duplicate_object then null; end $$;

-- Name the founding experiment.
update public.icc_chats set title = 'Pixel Art' where short_code = 'FOUND1';
