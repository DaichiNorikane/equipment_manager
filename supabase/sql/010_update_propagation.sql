-- Propagate updates to parents and add updated_at to child tables

-- 1) Ensure child tables have updated_at and triggers
alter table public.event_usages
  add column if not exists updated_at timestamptz not null default now();

alter table public.rentals
  add column if not exists updated_at timestamptz not null default now();

-- Reuse global set_updated_at()
drop trigger if exists trg_event_usages_updated_at on public.event_usages;
create trigger trg_event_usages_updated_at
before update on public.event_usages
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_rentals_updated_at on public.rentals;
create trigger trg_rentals_updated_at
before update on public.rentals
for each row execute procedure public.set_updated_at();

-- 2) Touch parent updated_at when child rows change
create or replace function public.touch_events_updated_at()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.events set updated_at = now() where id = old.event_id;
  else
    update public.events set updated_at = now() where id = new.event_id;
  end if;
  return null;
end;
$$ language plpgsql;

create or replace function public.touch_equipments_updated_at()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    update public.equipments set updated_at = now() where id = coalesce(old.equipment_id, null);
  else
    update public.equipments set updated_at = now() where id = coalesce(new.equipment_id, null);
  end if;
  return null;
end;
$$ language plpgsql;

-- From event_usages -> touch events and equipments
drop trigger if exists trg_event_usages_touch_event on public.event_usages;
create trigger trg_event_usages_touch_event
after insert or update or delete on public.event_usages
for each row execute procedure public.touch_events_updated_at();

drop trigger if exists trg_event_usages_touch_equipment on public.event_usages;
create trigger trg_event_usages_touch_equipment
after insert or update or delete on public.event_usages
for each row execute procedure public.touch_equipments_updated_at();

-- From equipment_units -> touch equipments
drop trigger if exists trg_units_touch_equipment on public.equipment_units;
create trigger trg_units_touch_equipment
after insert or update or delete on public.equipment_units
for each row execute procedure public.touch_equipments_updated_at();

-- From rentals -> touch equipments
drop trigger if exists trg_rentals_touch_equipment on public.rentals;
create trigger trg_rentals_touch_equipment
after insert or update or delete on public.rentals
for each row execute procedure public.touch_equipments_updated_at();

