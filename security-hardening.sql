-- SGROVIO — SECURITY HARDENING
-- Eseguire nel SQL Editor di Supabase dopo aver verificato che il nuovo app.js sia online.
-- Questo script non cancella dati. Riduce gli inserimenti anonimi e limita le RPC sensibili.

begin;

-- 1) Tabelle pubbliche che ricevono dati dal frontend: RLS obbligatoria.
alter table public.richieste enable row level security;
alter table public.professionisti enable row level security;
alter table public.sgrovio_admins enable row level security;

-- 2) Nessun INSERT anonimo su richieste/professionisti.
revoke insert on table public.richieste from anon;
revoke insert on table public.professionisti from anon;

grant insert on table public.richieste to authenticated;
grant insert on table public.professionisti to authenticated;

-- Elimina soltanto le vecchie policy INSERT, lasciando intatte SELECT/UPDATE/DELETE.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('richieste','professionisti')
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "cliente_crea_proprie_richieste"
on public.richieste
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "professionista_crea_solo_proprio_profilo"
on public.professionisti
for insert
to authenticated
with check (auth.uid() = user_id);

-- 3) La tabella degli amministratori non deve essere interrogabile direttamente dal browser.
revoke all on table public.sgrovio_admins from anon;
revoke all on table public.sgrovio_admins from authenticated;

-- Le due RPC admin restano disponibili solo a utenti autenticati;
-- il controllo effettivo dell'admin avviene dentro le funzioni SECURITY DEFINER.
revoke all on function public.is_sgrovio_admin() from public;
revoke all on function public.admin_dashboard_data() from public;
grant execute on function public.is_sgrovio_admin() to authenticated;
grant execute on function public.admin_dashboard_data() to authenticated;

-- 4) RPC che modificano stato/dati: mai eseguibili da anon.
-- Usa le firme reali trovate nel database, quindi funziona anche se hanno parametri diversi.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'rispondi_matching_professionista',
        'segnala_lavoro_eseguito_professionista',
        'conferma_completamento_cliente',
        'segnala_problema_cliente',
        'crea_recensione_cliente'
      )
  loop
    execute format('revoke execute on function %s from anon', f.signature);
    execute format('grant execute on function %s to authenticated', f.signature);
  end loop;
end $$;

commit;

-- 5) Controllo finale: deve mostrare RLS attiva e le policy correnti.
select c.relname as tabella, c.relrowsecurity as rls_attiva
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('richieste','professionisti','sgrovio_admins')
order by c.relname;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('richieste','professionisti','sgrovio_admins')
order by tablename, cmd, policyname;
