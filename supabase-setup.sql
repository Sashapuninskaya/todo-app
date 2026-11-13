-- Run this file in the Supabase SQL Editor.
-- Only wishlists and gifts are stored here. Other task tabs stay local.

begin;

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  share_token uuid not null unique default gen_random_uuid(),
  title text not null default 'Wish list',
  created_at timestamptz not null default now()
);

create table public.wishlist_gifts (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  note text not null default '',
  shop_url text not null default '' check (shop_url = '' or shop_url ~ '^https?://'),
  reserved boolean not null default false,
  created_at timestamptz not null default now()
);

create index wishlist_gifts_wishlist_id_idx on public.wishlist_gifts(wishlist_id);

alter table public.wishlists enable row level security;
alter table public.wishlist_gifts enable row level security;

revoke all on public.wishlists, public.wishlist_gifts from anon, authenticated;
grant select, insert, update, delete on public.wishlists to authenticated;
grant select, insert, update, delete on public.wishlist_gifts to authenticated;

create policy "Owners manage their wishlists"
on public.wishlists for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners manage their gifts"
on public.wishlist_gifts for all to authenticated
using (exists (
  select 1 from public.wishlists w
  where w.id = wishlist_id and w.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.wishlists w
  where w.id = wishlist_id and w.owner_id = (select auth.uid())
));

-- Visitors can only read the wishlist matching the secret share link.
create function public.get_shared_wishlist(p_share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', w.title,
    'gifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'title', g.title,
        'note', g.note,
        'shop_url', g.shop_url,
        'reserved', g.reserved
      ) order by g.created_at, g.id)
      from public.wishlist_gifts g where g.wishlist_id = w.id
    ), '[]'::jsonb)
  )
  from public.wishlists w where w.share_token = p_share_token;
$$;

-- The update is atomic: only one visitor can reserve a gift successfully.
create function public.reserve_wishlist_gift(p_share_token uuid, p_gift_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  update public.wishlist_gifts g
  set reserved = true
  where g.id = p_gift_id
    and not g.reserved
    and exists (
      select 1 from public.wishlists w
      where w.id = g.wishlist_id and w.share_token = p_share_token
    );
  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.get_shared_wishlist(uuid) from public;
revoke all on function public.reserve_wishlist_gift(uuid, uuid) from public;
grant execute on function public.get_shared_wishlist(uuid) to anon, authenticated;
grant execute on function public.reserve_wishlist_gift(uuid, uuid) to anon, authenticated;

commit;
