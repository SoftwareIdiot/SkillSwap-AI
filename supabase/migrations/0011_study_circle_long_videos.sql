begin;

alter table public.study_circle_posts drop constraint if exists study_circle_posts_check;
alter table public.study_circle_posts drop constraint if exists study_circle_posts_content_check;
alter table public.study_circle_posts add constraint study_circle_posts_content_check check (
  (kind = 'post' and (
    (youtube_id is null and media_type is null and char_length(trim(body)) >= 3)
    or ((youtube_id is null) <> (media_type is null))
  ))
  or (kind = 'clip' and ((youtube_id is null) <> (media_type is null)))
);

update storage.buckets set file_size_limit = 41943040 where id = 'study-clips';

commit;
