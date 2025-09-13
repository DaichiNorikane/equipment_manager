alter table public.equipments
  add column if not exists is_rental_only boolean not null default false;

