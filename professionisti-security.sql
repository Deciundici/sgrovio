-- SGROVIO — sicurezza registrazione professionisti
-- Esegui questo script nel SQL Editor di Supabase DOPO che il nuovo app.js è online.
-- Obiettivo: impedire inserimenti anonimi e permettere a un utente autenticato
-- di creare soltanto il proprio profilo professionista.

alter table public.professionisti enable row level security;

-- Rimuove tutte le policy INSERT esistenti sulla tabella professionisti,
-- così non restano vecchie policy permissive che potrebbero bypassare il controllo user_id.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'professionisti'
      and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.professionisti', p.policyname);
  end loop;
end $$;

-- Nessun inserimento diretto da utenti anonimi.
revoke insert on table public.professionisti from anon;

-- Gli utenti autenticati possono inserire, ma la RLS sotto obbliga
-- user_id a coincidere con l'utente della sessione.
grant insert on table public.professionisti to authenticated;

create policy "professionista_crea_solo_proprio_profilo"
on public.professionisti
for insert
to authenticated
with check (auth.uid() = user_id);

-- Controllo utile: mostra le policy attive sulla tabella.
select schemaname, tablename, policyname, cmd, roles, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'professionisti'
order by cmd, policyname;
