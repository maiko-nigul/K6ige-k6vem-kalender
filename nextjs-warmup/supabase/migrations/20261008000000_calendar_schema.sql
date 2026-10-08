-- Kalendrirakenduse skeem (profiles, categories, events) koos RLS-i, indeksite ja triggeritega.
-- Idempotentne: võib käivitada ka siis, kui osa tabeleid on juba olemas (nt events).
-- Käivita Supabase Dashboard -> SQL Editor (või `supabase db push`).

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 2. categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  color       text not null default '#3b82f6',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. events
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  title        text not null,
  description  text,
  location     text,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  is_all_day   boolean default false,
  color        text default '#3b82f6',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint check_dates_order check (end_time >= start_time)
);

-- Olemasoleval events tabelil puudub category_id - lisame selle.
alter table public.events
  add column if not exists category_id uuid references public.categories (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'check_dates_order' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events add constraint check_dates_order check (end_time >= start_time);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Indeksid
-- ---------------------------------------------------------------------
create index if not exists events_user_id_idx     on public.events (user_id);
create index if not exists events_start_time_idx  on public.events (start_time);
create index if not exists events_end_time_idx    on public.events (end_time);
create index if not exists events_category_id_idx on public.events (category_id);
create index if not exists categories_user_id_idx on public.categories (user_id);

-- ---------------------------------------------------------------------
-- 5. updated_at automaatne uuendamine
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Profiili automaatne loomine registreerumisel
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Juba olemasolevad kasutajad saavad ka profiili.
insert into public.profiles (id, full_name, avatar_url)
select id, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. RLS - kasutaja näeb ja muudab ainult enda kirjeid
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.events     enable row level security;

-- profiles (siin on omaniku veerg "id")
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- categories
drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_select_own" on public.categories for select using (auth.uid() = user_id);
create policy "categories_insert_own" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories for delete using (auth.uid() = user_id);

-- events: lisaks ei tohi sündmust siduda kellegi teise kategooriaga.
-- Eemaldame kõik varasemad events poliitikad, et vanad reeglid ei jääks kõrvale kehtima.
do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'events' loop
    execute format('drop policy %I on public.events', p.policyname);
  end loop;
end $$;

create policy "events_select_own" on public.events for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  )
);
create policy "events_update_own" on public.events for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (
    category_id is null
    or exists (select 1 from public.categories c where c.id = category_id and c.user_id = auth.uid())
  )
);
create policy "events_delete_own" on public.events for delete using (auth.uid() = user_id);

-- PostgREST peab uued tabelid/veerud üles leidma.
notify pgrst, 'reload schema';
