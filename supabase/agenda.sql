-- Escritório Digital: endereços pessoais da agenda (.ics) para assinar no Google Agenda.
-- Cole em Supabase › SQL Editor › New query e clique em Run. Pode rodar de novo sem problema.

create table if not exists public.calendar_feeds (
  token text primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

-- Cada pessoa vê, cria e revoga só os próprios endereços, e só de um escritório do qual é membro.
drop policy if exists "dono vê o endereço" on public.calendar_feeds;
create policy "dono vê o endereço" on public.calendar_feeds for select to authenticated using (user_id = auth.uid());
drop policy if exists "dono cria o endereço" on public.calendar_feeds;
create policy "dono cria o endereço" on public.calendar_feeds for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(workspace_id));
drop policy if exists "dono revoga o endereço" on public.calendar_feeds;
create policy "dono revoga o endereço" on public.calendar_feeds for delete to authenticated using (user_id = auth.uid());
