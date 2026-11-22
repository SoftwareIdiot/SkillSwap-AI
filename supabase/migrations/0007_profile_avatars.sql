begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 3145728, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

-- One current avatar per account. The signed-in owner can manage only that file.
create policy profile_avatar_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-avatars' and name = (select auth.uid())::text || '/avatar')
  with check (bucket_id = 'profile-avatars' and name = (select auth.uid())::text || '/avatar');

commit;
