-- Escritório Digital: busca automática nos tribunais (DJEN e DataJud).
-- Rode DEPOIS de publicar a função "tribunais" e de criar o secret CRON_SECRET.
-- Antes de rodar, troque COLE_AQUI_O_SEGREDO pelo mesmo valor do secret CRON_SECRET.

-- 1. OAB monitorada: DF 70.620 (só é criada nos escritórios que ainda não têm nenhuma OAB cadastrada).
insert into public.records (workspace_id, collection, id, data)
select w.id, 'monitoredTerms', 'oab_df_70620',
       jsonb_build_object('id', 'oab_df_70620', 'term', 'OAB/DF 70.620', 'kind', 'OAB', 'oabUf', 'DF', 'oabNumber', '70620', 'createdAt', now())
from public.workspaces w
where not exists (
  select 1 from public.records r where r.workspace_id = w.id and r.collection = 'monitoredTerms'
)
on conflict do nothing;

-- 2. Busca automática todo dia às 7h e às 16h (horário de Brasília = 10h e 19h UTC).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('tribunais-diario') where exists (select 1 from cron.job where jobname = 'tribunais-diario');

select cron.schedule(
  'tribunais-diario',
  '0 10,19 * * *',
  $$
  select net.http_post(
    url := 'https://lihwcjlstpgdqyvdkmjd.supabase.co/functions/v1/tribunais',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'COLE_AQUI_O_SEGREDO'),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
