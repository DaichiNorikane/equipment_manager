-- Availability: stock_count minus reserved units over an overlapping interval
create or replace function public.available_units(
  p_equipment_id uuid,
  p_start timestamptz,
  p_end timestamptz
) returns integer language sql stable as $$
  with base as (
    select stock_count from public.equipments where id = p_equipment_id
  ),
  reserved as (
    select coalesce(sum(u.quantity), 0) as qty
    from public.event_usages u
    join public.events e on e.id = u.event_id
    where u.equipment_id = p_equipment_id
      and not (e.end_at <= p_start or e.start_at >= p_end)
  )
  select greatest(0, (select stock_count from base) - (select qty from reserved));
$$;

-- Helper: shortage (negative means shortage amount)
create or replace function public.shortage_units(
  p_equipment_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_wanted integer
) returns integer language sql stable as $$
  select (select public.available_units(p_equipment_id, p_start, p_end)) - p_wanted;
$$;
