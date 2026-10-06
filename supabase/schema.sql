-- SmartDictation V1 cloud sync — run once in Supabase → SQL Editor.
-- One row per V1 record (student, word list, mistake, practice session, owner PIN),
-- owned by the logged-in family account. Row Level Security: a family only sees its own rows.

create table if not exists public.sync_records (
  family_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection  text        not null check (collection in ('students', 'lists', 'mistakes', 'sessions', 'owner')),
  id          text        not null,
  data        jsonb,                                  -- null when deleted
  deleted     boolean     not null default false,
  modified_at timestamptz not null,                   -- when the device changed it
  updated_at  timestamptz not null default clock_timestamp(), -- server time, for "what changed since"
  primary key (family_id, collection, id)
);

create index if not exists sync_records_family_updated on public.sync_records (family_id, updated_at);

-- Server sets updated_at on every write (devices pull rows newer than their last sync).
create or replace function public.sync_records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists sync_records_touch on public.sync_records;
create trigger sync_records_touch before insert or update on public.sync_records
  for each row execute function public.sync_records_touch();

-- Row Level Security: only the owning family.
alter table public.sync_records enable row level security;

drop policy if exists "family reads own records" on public.sync_records;
create policy "family reads own records" on public.sync_records
  for select to authenticated using (family_id = (select auth.uid()));

drop policy if exists "family inserts own records" on public.sync_records;
create policy "family inserts own records" on public.sync_records
  for insert to authenticated with check (family_id = (select auth.uid()));

drop policy if exists "family updates own records" on public.sync_records;
create policy "family updates own records" on public.sync_records
  for update to authenticated using (family_id = (select auth.uid())) with check (family_id = (select auth.uid()));

drop policy if exists "family deletes own records" on public.sync_records;
create policy "family deletes own records" on public.sync_records
  for delete to authenticated using (family_id = (select auth.uid()));

-- Expose the table to logged-in users only (anonymous visitors get nothing).
revoke all on public.sync_records from anon;
grant select, insert, update, delete on public.sync_records to authenticated;
