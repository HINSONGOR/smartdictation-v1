-- Stage 1 (學生管理中心): allow the new synced collections "tasks" and "planner".
-- Run once in Supabase → SQL Editor, before the app version with the management centre is used.
alter table public.sync_records drop constraint if exists sync_records_collection_check;
alter table public.sync_records add constraint sync_records_collection_check
  check (collection in ('students', 'lists', 'mistakes', 'sessions', 'owner', 'tasks', 'planner'));
