-- Stage 4 (個人溫習知識庫): allow the new synced collection "knowledge".
-- Run once in Supabase → SQL Editor, before the app version with the knowledge base is used.
alter table public.sync_records drop constraint if exists sync_records_collection_check;
alter table public.sync_records add constraint sync_records_collection_check
  check (collection in ('students', 'lists', 'mistakes', 'sessions', 'owner', 'tasks', 'planner', 'prompts', 'knowledge'));
