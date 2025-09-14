alter table public.categories
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_categories_sort on public.categories(sort_order, name);

