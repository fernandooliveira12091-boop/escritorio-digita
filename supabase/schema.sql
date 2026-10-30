-- Escritório Digital: banco de dados no Supabase.
-- Cole este arquivo inteiro em Supabase › SQL Editor › New query e clique em Run.
-- Pode rodar de novo sem problema: ele não apaga dados.

-- Escritórios (cada conta pertence a um ou mais escritórios).
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Quem é membro de qual escritório.
create table if not exists public.members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Convites por e-mail: viram membros quando a pessoa entra com esse e-mail.
create table if not exists public.invites (
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, email)
);

-- Todos os dados do sistema (tarefas, contatos, processos, lançamentos…), um registro por item.
create table if not exists public.records (
  workspace_id uuid not null references public.workspaces on delete cascade,
  collection text not null,
  id text not null,
  data jsonb not null,
  client_id text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, collection, id)
);

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.records enable row level security;

-- Funções auxiliares (security definer evita recursão nas regras de acesso).
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where workspace_id = ws and user_id = auth.uid() and role = 'owner');
$$;

-- Regras de acesso: só membros do escritório leem e gravam os dados dele.
drop policy if exists "membros leem o escritório" on public.workspaces;
create policy "membros leem o escritório" on public.workspaces for select to authenticated using (public.is_member(id));
drop policy if exists "dono renomeia o escritório" on public.workspaces;
create policy "dono renomeia o escritório" on public.workspaces for update to authenticated using (public.is_owner(id));

drop policy if exists "membros veem a equipe" on public.members;
create policy "membros veem a equipe" on public.members for select to authenticated using (public.is_member(workspace_id));
drop policy if exists "dono remove membros" on public.members;
create policy "dono remove membros" on public.members for delete to authenticated using (public.is_owner(workspace_id) and user_id <> auth.uid());

drop policy if exists "membros veem convites" on public.invites;
create policy "membros veem convites" on public.invites for select to authenticated using (public.is_member(workspace_id));
drop policy if exists "membros convidam" on public.invites;
create policy "membros convidam" on public.invites for insert to authenticated with check (public.is_member(workspace_id));
drop policy if exists "membros cancelam convites" on public.invites;
create policy "membros cancelam convites" on public.invites for delete to authenticated using (public.is_member(workspace_id));

drop policy if exists "membros acessam os dados" on public.records;
create policy "membros acessam os dados" on public.records for all to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

-- Cria um escritório e torna quem criou o dono.
create or replace function public.create_workspace(ws_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into workspaces (name) values (coalesce(nullif(trim(ws_name), ''), 'Meu escritório')) returning id into ws;
  insert into members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end;
$$;

-- Aceita os convites pendentes do e-mail de quem está logado e devolve os escritórios dessa pessoa.
create or replace function public.accept_invites() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare mail text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into members (workspace_id, user_id, role)
    select workspace_id, auth.uid(), 'member' from invites where lower(email) = mail
    on conflict do nothing;
  delete from invites where lower(email) = mail;
  return query select workspace_id from members where user_id = auth.uid() order by created_at;
end;
$$;

revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.accept_invites() from public, anon;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.accept_invites() to authenticated;

-- Atualização em tempo real entre computadores e colegas.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;

-- Agenda para o Google (o mesmo conteúdo de supabase/agenda.sql).

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
