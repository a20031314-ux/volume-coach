-- Allow saved routines in the sync table.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records
  add constraint records_kind_check
  check (kind in ('log', 'checkin', 'meal', 'body', 'run', 'session', 'routine', 'settings'));
