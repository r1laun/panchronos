-- Панхронос MVP: таблица записей
-- Прогоняется один раз в Supabase SQL Editor (или как миграция).
-- Использует встроенную auth.users от Supabase Auth.

create table if not exists public.entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_number int not null check (entry_number >= 1),
  answer text,
  thought text not null check (char_length(thought) > 0),
  question text not null check (char_length(question) > 0),
  created_at timestamptz not null default now(),
  -- Календарные сутки в UTC, в которых создана запись.
  -- Источник истины для правила "максимум 1 запись в сутки".
  entry_day date generated always as ((created_at at time zone 'UTC')::date) stored,

  unique (user_id, entry_number),
  unique (user_id, entry_day)
);

create index if not exists idx_entries_user_number
  on public.entries (user_id, entry_number);

alter table public.entries enable row level security;

-- Строго свои записи на чтение.
drop policy if exists "select own" on public.entries;
create policy "select own"
  on public.entries for select
  using (auth.uid() = user_id);

-- Создание только от своего имени.
drop policy if exists "insert own" on public.entries;
create policy "insert own"
  on public.entries for insert
  with check (auth.uid() = user_id);

-- UPDATE/DELETE политик намеренно НЕТ:
-- после сохранения запись нельзя редактировать или удалять (п.4 спеки).
