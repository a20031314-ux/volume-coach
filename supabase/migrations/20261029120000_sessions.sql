-- Allow workout sessions (timeline per exercise and per set) in the sync table.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records
  add constraint records_kind_check check (kind in ('log', 'checkin', 'meal', 'body', 'run', 'session', 'settings'));
