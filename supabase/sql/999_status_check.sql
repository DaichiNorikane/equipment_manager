-- Quick status checker: run this in Supabase SQL editor.
-- It lists whether required tables/columns/functions exist.

with checks as (
  select 'table: categories' as item, (to_regclass('public.categories') is not null) as ok, null::text as detail
  union all select 'table: equipments', (to_regclass('public.equipments') is not null), null
  union all select 'table: events', (to_regclass('public.events') is not null), null
  union all select 'table: event_usages', (to_regclass('public.event_usages') is not null), null
  union all select 'table: rentals', (to_regclass('public.rentals') is not null), null

  union all select 'equipments.column: manufacturer', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='manufacturer'), null
  union all select 'equipments.column: model', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='model'), null
  union all select 'equipments.column: stock_count', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='stock_count'), null
  union all select 'equipments.column: url', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='url'), null
  union all select 'equipments.column: power_consumption', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='power_consumption'), null
  union all select 'equipments.column: weight', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='weight'), null
  union all select 'equipments.column: dimensions', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='dimensions'), null
  union all select 'equipments.column: unit_price', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='unit_price'), null
  union all select 'equipments.column: origin_country', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='origin_country'), null
  union all select 'equipments.column: is_rental_only', exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipments' and column_name='is_rental_only'), 'from 006_add_is_rental_only.sql'

  union all select 'rentals.column: arranged', exists (select 1 from information_schema.columns where table_schema='public' and table_name='rentals' and column_name='arranged'), 'from 007_rentals_arranged.sql'

  union all select 'function: available_units', exists (select 1 from pg_proc where proname='available_units'), null
  union all select 'function: shortage_units', exists (select 1 from pg_proc where proname='shortage_units'), null
)
select * from checks order by item;

-- Optional: reload REST schema cache after running migrations
-- select pg_notify('pgrst','reload schema');

