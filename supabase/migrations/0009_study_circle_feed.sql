begin;

create table if not exists public.study_circle_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post', 'clip')),
  title text not null check (char_length(trim(title)) between 3 and 140),
  body text not null default '' check (char_length(body) <= 2500),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  media_type text check (media_type in ('video/mp4', 'video/webm')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'post' and char_length(trim(body)) >= 3 and youtube_id is null and media_type is null)
    or (kind = 'clip' and ((youtube_id is null) <> (media_type is null)))
  )
);
create index if not exists study_circle_posts_kind_recent
  on public.study_circle_posts (kind, created_at desc, id desc);
create unique index if not exists study_circle_posts_clip_path
  on public.study_circle_posts ((author_id::text || '/' || id::text)) where media_type is not null;
alter table public.study_circle_posts enable row level security;
revoke all on public.study_circle_posts from public, anon, authenticated;
grant select, insert, delete on public.study_circle_posts to authenticated;
drop policy if exists study_circle_posts_read on public.study_circle_posts;
create policy study_circle_posts_read on public.study_circle_posts for select to authenticated using (true);
drop policy if exists study_circle_posts_create on public.study_circle_posts;
create policy study_circle_posts_create on public.study_circle_posts for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists study_circle_posts_remove on public.study_circle_posts;
create policy study_circle_posts_remove on public.study_circle_posts for delete to authenticated using (author_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-clips', 'study-clips', false, 20971520, array['video/mp4', 'video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists study_clips_read on storage.objects;
create policy study_clips_read on storage.objects for select to authenticated using (
  bucket_id = 'study-clips' and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or exists (
      select 1 from public.study_circle_posts p
      where p.media_type is not null and p.author_id::text || '/' || p.id::text = storage.objects.name
    )
  )
);
drop policy if exists study_clips_upload on storage.objects;
create policy study_clips_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'study-clips'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
);
drop policy if exists study_clips_remove on storage.objects;
create policy study_clips_remove on storage.objects for delete to authenticated using (
  bucket_id = 'study-clips' and split_part(name, '/', 1) = (select auth.uid())::text
);

commit;
