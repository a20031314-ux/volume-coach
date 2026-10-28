-- Volume Coach: one sync table for every kind of user record.
-- Each row is one client record (workout log, check-in, meal, body composition, settings),
-- stored as JSON so the app can add fields without a migration.

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('log', 'checkin', 'meal', 'body', 'settings')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null,            -- client clock, ms; last writer wins
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_server_updated_idx
  on public.records (user_id, server_updated_at);

-- Keep the newer client version when two devices write the same record,
-- and stamp every accepted write so other devices can pull it.
create or replace function public.records_lww()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_lww on public.records;
create trigger records_lww
  before insert or update on public.records
  for each row execute function public.records_lww();

-- Row level security: each user sees and writes only their own rows.
alter table public.records enable row level security;

drop policy if exists "own rows select" on public.records;
create policy "own rows select" on public.records
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own rows insert" on public.records;
create policy "own rows insert" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own rows update" on public.records;
create policy "own rows update" on public.records
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own rows delete" on public.records;
create policy "own rows delete" on public.records
  for delete to authenticated using (user_id = (select auth.uid()));

-- In-app account deletion (required by the App Store and Google Play for apps with sign-up).
-- Deleting the auth user cascades to all of that user's records.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
