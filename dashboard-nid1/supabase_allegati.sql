-- Allegati delle prove (foto e documenti) della linea NID 1
-- Da eseguire UNA VOLTA in Supabase → SQL Editor → New query → incolla → Run.
-- Crea lo spazio privato "smi-allegati": file fino a 50 MB di qualsiasi tipo (foto, PDF, Word, Excel…),
-- visibili e caricabili solo dagli utenti che hanno fatto l'accesso.

insert into storage.buckets (id, name, public, file_size_limit)
values ('smi-allegati', 'smi-allegati', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "smi allegati: lettura" on storage.objects;
drop policy if exists "smi allegati: caricamento" on storage.objects;
drop policy if exists "smi allegati: sostituzione" on storage.objects;
drop policy if exists "smi allegati: cancellazione" on storage.objects;

create policy "smi allegati: lettura" on storage.objects
  for select to authenticated using (bucket_id = 'smi-allegati');
create policy "smi allegati: caricamento" on storage.objects
  for insert to authenticated with check (bucket_id = 'smi-allegati');
create policy "smi allegati: sostituzione" on storage.objects
  for update to authenticated using (bucket_id = 'smi-allegati') with check (bucket_id = 'smi-allegati');
create policy "smi allegati: cancellazione" on storage.objects
  for delete to authenticated using (bucket_id = 'smi-allegati');
