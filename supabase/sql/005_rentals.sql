-- Rentals: temporary additional units from external companies
create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipments(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  company text not null,
  arrive_at timestamptz not null,
  return_at timestamptz not null,
  arrive_place text,
  return_place text,
  notes text,
  created_at timestamptz not null default now(),
  constraint chk_rental_time check (return_at > arrive_at)
);

alter table public.rentals enable row level security;

drop policy if exists "anyone can read rentals" on public.rentals;
drop policy if exists "anyone can write rentals" on public.rentals;
create policy "anyone can read rentals" on public.rentals for select using (true);
create policy "anyone can write rentals" on public.rentals for all using (true) with check (true);

create index if not exists idx_rentals_equipment on public.rentals(equipment_id);
create index if not exists idx_rentals_time on public.rentals(arrive_at, return_at);

