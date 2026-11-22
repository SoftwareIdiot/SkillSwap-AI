begin;

alter table public.study_circle_posts add column if not exists moderation_hidden boolean not null default false;
alter table public.achievements add column if not exists moderation_hidden boolean not null default false;

drop policy if exists study_circle_posts_read on public.study_circle_posts;
create policy study_circle_posts_read on public.study_circle_posts
  for select to authenticated using (not moderation_hidden);
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements
  for select to authenticated using (not moderation_hidden);
drop policy if exists study_circle_posts_create on public.study_circle_posts;
create policy study_circle_posts_create on public.study_circle_posts
  for insert to authenticated with check (author_id = (select auth.uid()) and not moderation_hidden);
drop policy if exists achievements_write on public.achievements;
create policy achievements_write on public.achievements
  for insert to authenticated with check (author_id = (select auth.uid()) and not moderation_hidden);

create or replace function public.study_circle_entry_visible(p_post uuid, p_milestone uuid)
returns boolean language sql stable set search_path = '' as $$
  select case when p_post is not null then exists(
    select 1 from public.study_circle_posts where id = p_post and not moderation_hidden
  ) else exists(
    select 1 from public.achievements where id = p_milestone and not moderation_hidden
  ) end
$$;

create table if not exists public.study_circle_replies (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.study_circle_posts(id) on delete cascade,
  milestone_id uuid references public.achievements(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 1500),
  moderation_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (milestone_id is null))
);
create index if not exists study_circle_replies_post on public.study_circle_replies(post_id, created_at, id);
create index if not exists study_circle_replies_milestone on public.study_circle_replies(milestone_id, created_at, id);
alter table public.study_circle_replies enable row level security;
revoke all on public.study_circle_replies from public, anon, authenticated;
grant select, insert, delete on public.study_circle_replies to authenticated;
drop policy if exists study_circle_replies_read on public.study_circle_replies;
create policy study_circle_replies_read on public.study_circle_replies for select to authenticated
  using (not moderation_hidden and public.study_circle_entry_visible(post_id, milestone_id));
drop policy if exists study_circle_replies_create on public.study_circle_replies;
create policy study_circle_replies_create on public.study_circle_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and not moderation_hidden and public.study_circle_entry_visible(post_id, milestone_id));
drop policy if exists study_circle_replies_remove on public.study_circle_replies;
create policy study_circle_replies_remove on public.study_circle_replies for delete to authenticated
  using (author_id = (select auth.uid()));

create table if not exists public.study_circle_helpful (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.study_circle_posts(id) on delete cascade,
  milestone_id uuid references public.achievements(id) on delete cascade,
  check ((post_id is null) <> (milestone_id is null)),
  unique (author_id, post_id),
  unique (author_id, milestone_id)
);
create index if not exists study_circle_helpful_post on public.study_circle_helpful(post_id);
create index if not exists study_circle_helpful_milestone on public.study_circle_helpful(milestone_id);
alter table public.study_circle_helpful enable row level security;
revoke all on public.study_circle_helpful from public, anon, authenticated;
grant select, insert, delete on public.study_circle_helpful to authenticated;
drop policy if exists study_circle_helpful_read on public.study_circle_helpful;
create policy study_circle_helpful_read on public.study_circle_helpful for select to authenticated
  using (author_id = (select auth.uid()));
drop policy if exists study_circle_helpful_create on public.study_circle_helpful;
create policy study_circle_helpful_create on public.study_circle_helpful for insert to authenticated
  with check (author_id = (select auth.uid()) and public.study_circle_entry_visible(post_id, milestone_id));
drop policy if exists study_circle_helpful_remove on public.study_circle_helpful;
create policy study_circle_helpful_remove on public.study_circle_helpful for delete to authenticated
  using (author_id = (select auth.uid()));

create table if not exists public.study_circle_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.study_circle_moderators enable row level security;
revoke all on public.study_circle_moderators from public, anon, authenticated;

create or replace function public.is_study_circle_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.study_circle_moderators where user_id = (select auth.uid()))
$$;

create table if not exists public.study_circle_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'milestone', 'reply')),
  target_id uuid not null,
  title text not null,
  excerpt text not null,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'hidden', 'unavailable')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (reporter_id, target_kind, target_id)
);
create index if not exists study_circle_reports_pending on public.study_circle_reports(status, created_at);
alter table public.study_circle_reports enable row level security;
revoke all on public.study_circle_reports from public, anon, authenticated;
grant select on public.study_circle_reports to authenticated;
drop policy if exists study_circle_reports_read on public.study_circle_reports;
create policy study_circle_reports_read on public.study_circle_reports for select to authenticated
  using ((select public.is_study_circle_moderator()));

create or replace function public.study_circle_engagement(p_posts uuid[], p_milestones uuid[])
returns table(kind text, target_id uuid, replies integer, helpful integer, reacted boolean)
language sql stable security definer set search_path = '' as $$
  with entries as (
    select 'post'::text as kind, id from public.study_circle_posts
      where id = any(p_posts) and not moderation_hidden
    union all
    select 'milestone'::text as kind, id from public.achievements
      where id = any(p_milestones) and not moderation_hidden
  )
  select e.kind, e.id,
    (select count(*)::integer from public.study_circle_replies r where not r.moderation_hidden
      and ((e.kind = 'post' and r.post_id = e.id) or (e.kind = 'milestone' and r.milestone_id = e.id))),
    h.total, h.reacted
  from entries e
  cross join lateral (
    select count(*)::integer as total, coalesce(bool_or(h.author_id = auth.uid()), false) as reacted
    from public.study_circle_helpful h
    where (e.kind = 'post' and h.post_id = e.id) or (e.kind = 'milestone' and h.milestone_id = e.id)
  ) h
  where auth.uid() is not null and cardinality(p_posts) + cardinality(p_milestones) <= 240
$$;

create or replace function public.report_study_circle_entry(p_kind text, p_id uuid, p_reason text, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  learner uuid := auth.uid();
  target_author uuid;
  target_title text;
  target_body text;
begin
  if learner is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  case p_kind
    when 'post' then
      select author_id, title, body into target_author, target_title, target_body
        from public.study_circle_posts where id = p_id and not moderation_hidden;
    when 'milestone' then
      select author_id, title, description into target_author, target_title, target_body
        from public.achievements where id = p_id and not moderation_hidden;
    when 'reply' then
      select author_id, 'Reply', body into target_author, target_title, target_body
        from public.study_circle_replies where id = p_id and not moderation_hidden
          and public.study_circle_entry_visible(post_id, milestone_id);
    else raise exception 'Invalid target' using errcode = '22023';
  end case;
  if target_author is null then raise exception 'Content unavailable' using errcode = 'P0002'; end if;
  if target_author = learner then raise exception 'Cannot report your own content' using errcode = '22023'; end if;
  insert into public.study_circle_reports(reporter_id, target_kind, target_id, title, excerpt, reason, details)
    values(learner, p_kind, p_id, target_title, target_body, p_reason, p_details)
    on conflict (reporter_id, target_kind, target_id) do nothing;
end;
$$;

create or replace function public.review_study_circle_report(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  report public.study_circle_reports%rowtype;
  changed integer;
begin
  if not public.is_study_circle_moderator() then raise exception 'Moderator access required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('hide', 'dismiss') then
    raise exception 'Invalid review action' using errcode = '22023';
  end if;
  select * into report from public.study_circle_reports where id = p_id and status = 'pending';
  if not found then raise exception 'Report no longer pending' using errcode = 'P0002'; end if;
  -- Serialize review of reports about the same item without locking a second report first.
  perform pg_advisory_xact_lock(hashtextextended(report.target_kind || ':' || report.target_id::text, 0));
  select * into report from public.study_circle_reports where id = p_id and status = 'pending' for update;
  if not found then raise exception 'Report no longer pending' using errcode = 'P0002'; end if;
  if p_action = 'dismiss' then
    update public.study_circle_reports set status = 'dismissed', reviewed_at = now(), reviewed_by = auth.uid() where id = p_id;
    return;
  end if;
  case report.target_kind
    when 'post' then update public.study_circle_posts set moderation_hidden = true where id = report.target_id;
    when 'milestone' then update public.achievements set moderation_hidden = true where id = report.target_id;
    when 'reply' then update public.study_circle_replies set moderation_hidden = true where id = report.target_id;
  end case;
  get diagnostics changed = row_count;
  update public.study_circle_reports set status = case when changed > 0 then 'hidden' else 'unavailable' end,
    reviewed_at = now(), reviewed_by = auth.uid()
    where target_kind = report.target_kind and target_id = report.target_id and status = 'pending';
end;
$$;

revoke all on function public.study_circle_entry_visible(uuid,uuid), public.is_study_circle_moderator(),
  public.study_circle_engagement(uuid[],uuid[]), public.report_study_circle_entry(text,uuid,text,text),
  public.review_study_circle_report(uuid,text) from public, anon;
grant execute on function public.study_circle_entry_visible(uuid,uuid), public.is_study_circle_moderator(),
  public.study_circle_engagement(uuid[],uuid[]), public.report_study_circle_entry(text,uuid,text,text),
  public.review_study_circle_report(uuid,text) to authenticated;

commit;
