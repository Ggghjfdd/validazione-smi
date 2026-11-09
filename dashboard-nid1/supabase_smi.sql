-- =====================================================================
--  Dashboard Linea SMI — tabelle Supabase
--  Incolla tutto in Supabase → SQL Editor → New query → Run
-- =====================================================================

-- 1) Dati inviati dal lettore (una riga per tipo: vivo, storico, parametri, allarmi)
create table if not exists public.smi_dati (
  id          text primary key,
  dati        jsonb not null,
  aggiornato  timestamptz not null default now()
);

-- 2) Richieste "Aggiorna" dalla dashboard al PC della linea
create table if not exists public.smi_comandi (
  id        bigint generated always as identity primary key,
  comando   text not null default 'aggiorna',
  creato    timestamptz not null default now(),
  eseguito  timestamptz
);

-- 3) Sicurezza: solo gli utenti che hanno fatto il login possono leggere e scrivere
alter table public.smi_dati    enable row level security;
alter table public.smi_comandi enable row level security;

drop policy if exists "smi_dati lettura"    on public.smi_dati;
drop policy if exists "smi_dati inserimento" on public.smi_dati;
drop policy if exists "smi_dati modifica"   on public.smi_dati;
create policy "smi_dati lettura"     on public.smi_dati for select to authenticated using (true);
create policy "smi_dati inserimento" on public.smi_dati for insert to authenticated with check (true);
create policy "smi_dati modifica"    on public.smi_dati for update to authenticated using (true) with check (true);

drop policy if exists "smi_comandi lettura"    on public.smi_comandi;
drop policy if exists "smi_comandi inserimento" on public.smi_comandi;
drop policy if exists "smi_comandi modifica"   on public.smi_comandi;
create policy "smi_comandi lettura"     on public.smi_comandi for select to authenticated using (true);
create policy "smi_comandi inserimento" on public.smi_comandi for insert to authenticated with check (true);
create policy "smi_comandi modifica"    on public.smi_comandi for update to authenticated using (true) with check (true);

-- 4) Aggiornamenti in tempo reale (la dashboard si aggiorna da sola)
do $$ begin
  begin alter publication supabase_realtime add table public.smi_dati;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.smi_comandi; exception when duplicate_object then null; end;
end $$;

-- 5) Pulizia automatica dei comandi vecchi (facoltativa, tiene la tabella leggera)
create or replace function public.smi_pulisci_comandi() returns trigger language plpgsql as $$
begin
  delete from public.smi_comandi where creato < now() - interval '2 days';
  return new;
end $$;
drop trigger if exists smi_pulisci on public.smi_comandi;
create trigger smi_pulisci after insert on public.smi_comandi
  for each statement execute function public.smi_pulisci_comandi();
