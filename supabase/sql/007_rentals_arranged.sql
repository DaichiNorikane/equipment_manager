alter table public.rentals
  add column if not exists arranged boolean not null default false;

