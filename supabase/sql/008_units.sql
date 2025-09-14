-- Units for per-device management
create table if not exists public.equipment_units (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipments(id) on delete cascade,
  serial text,
  status text not null default '正常', -- 正常/故障/点検中/予備/廃棄
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_units_equipment on public.equipment_units(equipment_id);

alter table public.equipment_units enable row level security;

drop policy if exists "units read" on public.equipment_units;
drop policy if exists "units write" on public.equipment_units;
create policy "units read" on public.equipment_units for select using (true);
create policy "units write" on public.equipment_units for all using (true) with check (true);

create or replace function public.units_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_units_updated_at on public.equipment_units;
create trigger trg_units_updated_at
before update on public.equipment_units
for each row execute procedure public.units_set_updated_at();

