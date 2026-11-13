-- Run once in Supabase SQL Editor to add gift photos, brands and prices.
-- Existing gifts, share links and reservations are preserved.
begin;

alter table public.wishlist_gifts
  add column if not exists image_url text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists price text not null default '';

create or replace function public.get_shared_wishlist(p_share_token uuid)
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
        'image_url', g.image_url,
        'brand', g.brand,
        'price', g.price,
        'reserved', g.reserved
      ) order by g.created_at, g.id)
      from public.wishlist_gifts g where g.wishlist_id = w.id
    ), '[]'::jsonb)
  )
  from public.wishlists w where w.share_token = p_share_token;
$$;

revoke all on function public.get_shared_wishlist(uuid) from public;
grant execute on function public.get_shared_wishlist(uuid) to anon, authenticated;

commit;
