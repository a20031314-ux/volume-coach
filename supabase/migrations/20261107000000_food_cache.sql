-- 음식 공유 캐시: a menu looked up once (AI web search, Edge Function `food-lookup`) is stored here
-- and reused by everyone afterwards, so each menu costs one lookup in total.
-- Only the Edge Function (service role) writes. Rows from an official or public source are
-- shared; anything else stays visible to the person who looked it up only.

create table if not exists public.food_cache (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- normalized "brand|menu"
  name text not null,                       -- display name, e.g. "BBQ 황금올리브치킨"
  brand text,
  unit text not null,                       -- '개' | '조각' | 'g' | '인분' | '마리' ...
  base numeric not null check (base > 0),   -- k/p/c/f are for this many units
  g_per numeric,                            -- grams in one unit, when known
  k numeric not null check (k >= 0 and k < 5000),
  p numeric not null check (p >= 0),
  c numeric not null check (c >= 0),
  f numeric not null check (f >= 0),
  sugar numeric,
  sodium numeric,
  est_cf boolean not null default false,    -- carbs/fat estimated (label lists kcal/protein only)
  source_kind text not null check (source_kind in ('official', 'public', 'other', 'estimate')),
  source_url text,
  checked date not null default current_date,
  shared boolean not null default false,
  reports int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- other spellings that point at the same row ("황올" → "bbq|황금올리브치킨")
create table if not exists public.food_alias (
  alias text primary key,
  key text not null references public.food_cache (key) on delete cascade
);

-- one row per AI lookup, for the per-user daily limit and the monthly cost cap
create table if not exists public.food_lookup_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  hit boolean not null,            -- answered from the cache (no AI cost)
  searches int not null default 0, -- web searches used
  at timestamptz not null default now()
);
create index if not exists food_lookup_log_user_at on public.food_lookup_log (user_id, at);

-- "값이 이상해요": two reports take a row out of sharing until someone checks it
create table if not exists public.food_report (
  food_id uuid not null references public.food_cache (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (food_id, user_id)
);

create or replace function public.food_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.food_cache
     set reports = reports + 1,
         shared = case when reports + 1 >= 2 then false else shared end
   where id = new.food_id;
  return new;
end;
$$;

drop trigger if exists food_report_count on public.food_report;
create trigger food_report_count after insert on public.food_report
  for each row execute function public.food_report_count();

alter table public.food_cache enable row level security;
alter table public.food_alias enable row level security;
alter table public.food_lookup_log enable row level security;
alter table public.food_report enable row level security;

-- clients read shared rows only (an unshared result goes straight back to the person who asked
-- and is kept on their phone), and never see who looked a menu up
drop policy if exists "shared rows" on public.food_cache;
create policy "shared rows" on public.food_cache
  for select to anon, authenticated using (shared);
revoke select on public.food_cache from anon, authenticated;
grant select (id, key, name, brand, unit, base, g_per, k, p, c, f, sugar, sodium, est_cf, source_kind, source_url, checked, shared)
  on public.food_cache to anon, authenticated;

drop policy if exists "aliases readable" on public.food_alias;
create policy "aliases readable" on public.food_alias
  for select to anon, authenticated using (true);

drop policy if exists "own lookups" on public.food_lookup_log;
create policy "own lookups" on public.food_lookup_log
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "report once" on public.food_report;
create policy "report once" on public.food_report
  for insert to authenticated with check (user_id = (select auth.uid()));

-- search by name (simple contains match is enough at this size)
create index if not exists food_cache_name on public.food_cache (lower(name));
