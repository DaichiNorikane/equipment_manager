-- Clean migration to remove `name` and add detail fields.
-- Assumes you have no critical data yet (or have backed it up).

alter table public.equipments
  drop column if exists name;

-- Ensure required fields
alter table public.equipments
  alter column manufacturer set not null,
  alter column model set not null,
  alter column stock_count set not null;

-- Add detail fields (optional except stock_count/manufacturer/model)
alter table public.equipments
  add column if not exists url text,
  add column if not exists power_consumption text,
  add column if not exists weight text,
  add column if not exists dimensions text,
  add column if not exists unit_price numeric,
  add column if not exists origin_country text;

