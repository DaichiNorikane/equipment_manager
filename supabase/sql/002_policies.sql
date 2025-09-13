-- Enable RLS
alter table public.categories enable row level security;
alter table public.equipments enable row level security;
alter table public.events enable row level security;
alter table public.event_usages enable row level security;

-- Basic policy: any authenticated user can manage data
drop policy if exists "anyone can read categories" on public.categories;
drop policy if exists "anyone can write categories" on public.categories;
create policy "anyone can read categories" on public.categories
  for select using (true);
create policy "anyone can write categories" on public.categories
  for all using (true) with check (true);

drop policy if exists "anyone can read equipments" on public.equipments;
drop policy if exists "anyone can write equipments" on public.equipments;
create policy "anyone can read equipments" on public.equipments
  for select using (true);
create policy "anyone can write equipments" on public.equipments
  for all using (true) with check (true);

drop policy if exists "anyone can read events" on public.events;
drop policy if exists "anyone can write events" on public.events;
create policy "anyone can read events" on public.events
  for select using (true);
create policy "anyone can write events" on public.events
  for all using (true) with check (true);

drop policy if exists "anyone can read usages" on public.event_usages;
drop policy if exists "anyone can write usages" on public.event_usages;
create policy "anyone can read usages" on public.event_usages
  for select using (true);
create policy "anyone can write usages" on public.event_usages
  for all using (true) with check (true);

-- NOTE: 本設定は公開デモ向けに全ロール（anon含む）へ読書き許可します。運用時は適切な制限に戻してください。
