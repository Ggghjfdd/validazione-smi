-- Foto degli scarti della linea NID 1
-- Da eseguire UNA VOLTA in Supabase → SQL Editor → New query → incolla → Run.
-- Crea lo spazio privato "smi-foto": solo gli utenti che hanno fatto l'accesso possono vedere,
-- caricare o cancellare le foto (il lettore sul PC della linea carica, la dashboard guarda).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('smi-foto', 'smi-foto', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "smi foto: lettura" on storage.objects;
drop policy if exists "smi foto: caricamento" on storage.objects;
drop policy if exists "smi foto: sostituzione" on storage.objects;
drop policy if exists "smi foto: cancellazione" on storage.objects;

create policy "smi foto: lettura" on storage.objects
  for select to authenticated using (bucket_id = 'smi-foto');
create policy "smi foto: caricamento" on storage.objects
  for insert to authenticated with check (bucket_id = 'smi-foto');
create policy "smi foto: sostituzione" on storage.objects
  for update to authenticated using (bucket_id = 'smi-foto') with check (bucket_id = 'smi-foto');
create policy "smi foto: cancellazione" on storage.objects
  for delete to authenticated using (bucket_id = 'smi-foto');
