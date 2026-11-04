-- =====================================================================
--  Validazione sensibilità SMI · struttura del database
--  Da incollare in Supabase → SQL Editor → New query → Run (una volta sola)
-- =====================================================================

-- Utenti del sito: nome e ruolo
--   admin   = amministratore: tutto, compresi criteri, stato sensore, soglie e ruoli
--   editor  = compilatore: inserisce e corregge prove e dati macchina
--   lettore = sola lettura
create table if not exists public.profili (
  id     uuid primary key references auth.users(id) on delete cascade,
  nome   text,
  ruolo  text not null default 'lettore' check (ruolo in ('admin','editor','lettore'))
);

-- Tutti i dati del sito: prove, configurazione, letture cassette, eventi macchina
create table if not exists public.documenti (
  collezione     text not null,           -- prove | config | pezzi | eventi
  id             text not null,
  data           jsonb not null,
  autore         uuid default auth.uid(),
  modificato_da  uuid default auth.uid(),
  aggiornato     timestamptz not null default now(),
  primary key (collezione, id)
);
alter table public.documenti replica identity full;

-- Ruolo dell'utente collegato
create or replace function public.mio_ruolo() returns text
language sql stable security definer set search_path = public as
$$ select ruolo from public.profili where id = auth.uid() $$;

-- Quando si crea un utente, gli si crea il profilo (sola lettura)
create or replace function public.nuovo_utente() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.profili(id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nuovo_utente();

-- Data e autore dell'ultima modifica
create or replace function public.tocca_documento() returns trigger
language plpgsql as
$$ begin
  new.aggiornato := now();
  new.modificato_da := auth.uid();
  if tg_op = 'UPDATE' then new.autore := old.autore; end if;
  return new;
end $$;
drop trigger if exists documenti_tocca on public.documenti;
create trigger documenti_tocca before insert or update on public.documenti
  for each row execute function public.tocca_documento();

-- Regole di accesso
alter table public.profili   enable row level security;
alter table public.documenti enable row level security;

drop policy if exists "profili leggibili" on public.profili;
create policy "profili leggibili" on public.profili for select to authenticated using (true);
drop policy if exists "profili gestiti da admin" on public.profili;
create policy "profili gestiti da admin" on public.profili for update to authenticated
  using (public.mio_ruolo() = 'admin') with check (public.mio_ruolo() = 'admin');

drop policy if exists "documenti leggibili" on public.documenti;
create policy "documenti leggibili" on public.documenti for select to authenticated using (true);

drop policy if exists "documenti inseriti" on public.documenti;
create policy "documenti inseriti" on public.documenti for insert to authenticated
  with check (case when collezione = 'config' then public.mio_ruolo() = 'admin'
                   else public.mio_ruolo() in ('admin','editor') end);

drop policy if exists "documenti modificati" on public.documenti;
create policy "documenti modificati" on public.documenti for update to authenticated
  using      (case when collezione = 'config' then public.mio_ruolo() = 'admin' else public.mio_ruolo() in ('admin','editor') end)
  with check (case when collezione = 'config' then public.mio_ruolo() = 'admin' else public.mio_ruolo() in ('admin','editor') end);

drop policy if exists "documenti eliminati" on public.documenti;
create policy "documenti eliminati" on public.documenti for delete to authenticated
  using (case when collezione = 'config' then public.mio_ruolo() = 'admin' else public.mio_ruolo() in ('admin','editor') end);

-- Aggiornamenti in tempo reale tra più persone collegate
do $$ begin
  alter publication supabase_realtime add table public.documenti;
exception when duplicate_object then null; end $$;

-- =====================================================================
--  DOPO aver creato il tuo utente (Authentication → Users → Add user),
--  rendilo amministratore sostituendo l'email qui sotto ed eseguendo:
--
--  update public.profili set ruolo = 'admin', nome = 'Lorenzo'
--  where id = (select id from auth.users where email = 'la-tua-email@azienda.it');
--
--  Per gli altri utenti:
--  update public.profili set ruolo = 'editor'  where id = (select id from auth.users where email = '...');
--  update public.profili set ruolo = 'lettore' where id = (select id from auth.users where email = '...');
-- =====================================================================
