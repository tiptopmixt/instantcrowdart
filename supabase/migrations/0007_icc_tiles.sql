-- ============================================================================
-- Tile mosaic: each user paints their OWN 8x8 tile (local coords 0..7).
-- Pixels are unique per (chat, user, cell) so everyone has their own space,
-- and you can only edit your own tile. Run once in the SQL Editor.
-- ============================================================================

-- Old model had one pixel per global cell; drop that and go per-user.
alter table public.icc_pixels drop constraint if exists icc_pixels_chat_id_x_y_key;
alter table public.icc_pixels drop constraint if exists icc_pixels_uniq;
alter table public.icc_pixels add constraint icc_pixels_user_cell_uniq unique (chat_id, user_id, x, y);

-- You can only change YOUR own tile now (no moving others').
drop policy if exists icc_pixels_update on public.icc_pixels;
create policy icc_pixels_update on public.icc_pixels
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Clear the old canvas (coordinates meant something different before).
delete from public.icc_pixels;

-- Likes: one heart per person per tile.
create table if not exists public.icc_tile_likes (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.icc_chats(id) on delete cascade,
  tile_user_id uuid not null,           -- whose tile is liked
  liker_id     uuid not null,           -- who liked it
  created_at   timestamptz not null default now(),
  unique (chat_id, tile_user_id, liker_id)
);
create index if not exists icc_tile_likes_idx on public.icc_tile_likes(chat_id, tile_user_id);

alter table public.icc_tile_likes enable row level security;
drop policy if exists icc_tile_likes_select on public.icc_tile_likes;
create policy icc_tile_likes_select on public.icc_tile_likes for select to authenticated using (true);
drop policy if exists icc_tile_likes_insert on public.icc_tile_likes;
create policy icc_tile_likes_insert on public.icc_tile_likes for insert to authenticated with check (liker_id = auth.uid());
drop policy if exists icc_tile_likes_delete on public.icc_tile_likes;
create policy icc_tile_likes_delete on public.icc_tile_likes for delete to authenticated using (liker_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.icc_tile_likes;
exception when duplicate_object then null; end $$;
