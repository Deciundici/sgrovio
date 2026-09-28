-- SGROVIO — setup Area Admin
-- Esegui questo file una sola volta nel SQL Editor di Supabase.
-- Prima di eseguirlo, sostituisci INSERISCI_LA_TUA_EMAIL con l'email dell'account Supabase che userai come amministratore.

create table if not exists public.sgrovio_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.sgrovio_admins enable row level security;

-- Nessuna policy diretta: la tabella degli admin non deve essere leggibile dal client.

create or replace function public.is_sgrovio_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.sgrovio_admins a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_sgrovio_admin() from public;
grant execute on function public.is_sgrovio_admin() to authenticated;

create or replace function public.admin_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_sgrovio_admin() then
    raise exception 'Accesso admin negato';
  end if;

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'richieste_totali', (select count(*) from public.richieste),
      'richieste_nuove', (select count(*) from public.richieste where stato = 'nuova'),
      'clienti', (select count(distinct user_id) from public.richieste where user_id is not null),
      'professionisti_totali', (select count(*) from public.professionisti),
      'professionisti_disponibili', (select count(*) from public.professionisti where disponibile is true),
      'professionisti_verificati', (select count(*) from public.professionisti where verificato is true),
      'matching_totali', (select count(*) from public.matching),
      'matching_proposti', (select count(*) from public.matching where stato = 'proposto'),
      'matching_accettati', (select count(*) from public.matching where stato = 'accettato'),
      'recensioni', (select count(*) from public.recensioni)
    ),
    'richieste_recenti', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select id, nome_cliente, email, telefono, categoria, descrizione, comune, cap,
               budget, urgenza, stato, created_at
        from public.richieste
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'professionisti_recenti', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select id, nome, attivita, email, telefono, categoria, comune, provincia,
               raggio_km, disponibile, verificato, stato, created_at
        from public.professionisti
        order by created_at desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'matching_recenti', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select m.id, m.richiesta_id, m.professionista_id, m.punteggio, m.stato, m.created_at,
               r.categoria, r.comune,
               coalesce(p.attivita, p.nome) as professionista
        from public.matching m
        left join public.richieste r on r.id = m.richiesta_id
        left join public.professionisti p on p.id = m.professionista_id
        order by m.created_at desc
        limit 80
      ) x
    ), '[]'::jsonb),
    'recensioni_recenti', coalesce((
      select jsonb_agg(to_jsonb(x))
      from (
        select re.id, re.voto, re.commento, re.created_at,
               coalesce(p.attivita, p.nome) as professionista
        from public.recensioni re
        left join public.professionisti p on p.id = re.professionista_id
        order by re.created_at desc
        limit 30
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard_data() from public;
grant execute on function public.admin_dashboard_data() to authenticated;

-- Crea il tuo accesso amministratore.
-- IMPORTANTE: l'account deve già esistere in Authentication > Users.
insert into public.sgrovio_admins (user_id)
select id
from auth.users
where lower(email) = lower('INSERISCI_LA_TUA_EMAIL')
on conflict (user_id) do nothing;

-- Verifica finale: deve restituire una riga dopo aver sostituito l'email corretta.
select a.user_id, u.email, a.created_at
from public.sgrovio_admins a
join auth.users u on u.id = a.user_id;
