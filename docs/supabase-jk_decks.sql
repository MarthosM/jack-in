-- Jack In Treino: decks dos usuários (cada um vê e altera só os seus).
-- Projeto Supabase "mesa" (o mesmo do MESA e do Elysium 2P).
create table if not exists public.jk_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (key ~ '^my_[a-z0-9]{4,12}$'),
  name text not null default '' check (char_length(name) <= 60),
  side text not null default 'r' check (side in ('r','c')),
  text text not null default '' check (char_length(text) <= 20000),
  upd bigint not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
alter table public.jk_decks enable row level security;
drop policy if exists "jk_decks: ver os meus" on public.jk_decks;
drop policy if exists "jk_decks: criar os meus" on public.jk_decks;
drop policy if exists "jk_decks: alterar os meus" on public.jk_decks;
drop policy if exists "jk_decks: apagar os meus" on public.jk_decks;
create policy "jk_decks: ver os meus" on public.jk_decks for select to authenticated using (user_id = auth.uid());
create policy "jk_decks: criar os meus" on public.jk_decks for insert to authenticated with check (user_id = auth.uid());
create policy "jk_decks: alterar os meus" on public.jk_decks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jk_decks: apagar os meus" on public.jk_decks for delete to authenticated using (user_id = auth.uid());
create or replace function public.jk_decks_touch() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists jk_decks_touch on public.jk_decks;
create trigger jk_decks_touch before update on public.jk_decks for each row execute function public.jk_decks_touch();
