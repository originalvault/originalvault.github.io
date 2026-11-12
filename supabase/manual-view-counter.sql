-- Original Vault: manually controlled public view counter
-- Run this script once in Supabase SQL Editor.
create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  manual_view_count bigint not null default 0 check (manual_view_count >= 0),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, manual_view_count)
values (1, 0)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Public can read displayed view count" on public.site_settings;
create policy "Public can read displayed view count"
  on public.site_settings for select
  to anon, authenticated
  using (id = 1);

drop policy if exists "Authenticated admins can manage displayed view count" on public.site_settings;
create policy "Authenticated admins can manage displayed view count"
  on public.site_settings for all
  to authenticated
  using (id = 1)
  with check (id = 1 and manual_view_count >= 0);

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
