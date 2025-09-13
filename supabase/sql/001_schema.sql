-- Enable extensions commonly available on Supabase
create extension if not exists pgcrypto;

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Equipments
create table if not exists public.equipments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  model text,
  manufacturer text,
  stock_count integer not null default 0 check (stock_count >= 0),
  properties jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Events (usage periods)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_event_time check (end_at > start_at)
);

-- Event usages (how many units used in an event)
create table if not exists public.event_usages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  equipment_id uuid not null references public.equipments(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_equipments_category on public.equipments(category_id);
create index if not exists idx_events_time on public.events(start_at, end_at);
create index if not exists idx_event_usages_equipment on public.event_usages(equipment_id);
create index if not exists idx_event_usages_event on public.event_usages(event_id);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_equipments_updated_at on public.equipments;
create trigger trg_equipments_updated_at
before update on public.equipments
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute procedure public.set_updated_at();
