-- Stage 3 (AI 指令收納庫): allow the new synced collection "prompts".
-- Run once in Supabase → SQL Editor, before the app version with the prompt library is used.
alter table public.sync_records drop constraint if exists sync_records_collection_check;
alter table public.sync_records add constraint sync_records_collection_check
  check (collection in ('students', 'lists', 'mistakes', 'sessions', 'owner', 'tasks', 'planner', 'prompts'));
