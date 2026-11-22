begin;
create table public.circle_preferences(user_id uuid primary key references auth.users on delete cascade, messages boolean not null default true, ranking boolean not null default false);
create table public.circle_follows(follower uuid references auth.users on delete cascade, followed uuid references auth.users on delete cascade, primary key(follower,followed), check(follower<>followed));
create table public.circle_blocks(blocker uuid references auth.users on delete cascade, blocked uuid references auth.users on delete cascade, primary key(blocker,blocked), check(blocker<>blocked));
create table public.circle_chats(id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade, name text not null check(char_length(name) between 2 and 80), goal text not null default '' check(char_length(goal)<=240), created_at timestamptz not null default now());
create table public.circle_chat_members(chat_id uuid references public.circle_chats on delete cascade, user_id uuid references auth.users on delete cascade, accepted boolean not null default false, primary key(chat_id,user_id));
create index circle_chat_members_user on public.circle_chat_members(user_id,chat_id);
create table public.circle_chat_messages(id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.circle_chats on delete cascade, sender_id uuid not null references auth.users on delete cascade, body text not null check(char_length(trim(body)) between 1 and 2000), created_at timestamptz not null default now());
create index circle_chat_messages_recent on public.circle_chat_messages(chat_id,created_at desc);
create index circle_chat_messages_sender on public.circle_chat_messages(sender_id,created_at desc);
create table public.circle_checkins(chat_id uuid references public.circle_chats on delete cascade, user_id uuid references auth.users on delete cascade, day date not null default (now() at time zone 'UTC')::date, primary key(chat_id,user_id,day));
create table public.circle_person_reports(id uuid primary key default gen_random_uuid(), reporter uuid not null references auth.users on delete cascade, target uuid not null references auth.users on delete cascade, reason text not null check(char_length(reason) between 3 and 500), resolved boolean not null default false, created_at timestamptz not null default now());
alter table public.circle_preferences enable row level security;
alter table public.circle_follows enable row level security;
alter table public.circle_blocks enable row level security;
alter table public.circle_chats enable row level security;
alter table public.circle_chat_members enable row level security;
alter table public.circle_chat_messages enable row level security;
alter table public.circle_checkins enable row level security;
alter table public.circle_person_reports enable row level security;
revoke all on public.circle_preferences,public.circle_follows,public.circle_blocks,public.circle_chats,public.circle_chat_members,public.circle_chat_messages,public.circle_checkins,public.circle_person_reports from public,anon,authenticated;

create function public.circle_social(action text default 'read', target uuid default null, room uuid default null, body text default '', title text default '', invitees uuid[] default '{}', search text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); selected uuid:=room; other uuid; result jsonb; today date:=(now() at time zone 'UTC')::date;
begin
 if me is null then raise exception 'Sign in to use Study Circle'; end if;
 if action<>'read' then perform pg_advisory_xact_lock(hashtext('social:'||me::text)); end if;
 if action='follow' then
   if target=me or not exists(select 1 from public.profiles where id=target) or exists(select 1 from public.circle_blocks where (blocker=me and blocked=target) or (blocker=target and blocked=me)) then raise exception 'This connection is unavailable'; end if;
   if (select count(*) from public.circle_follows where follower=me)>=1000 then raise exception 'Following limit reached'; end if;
   insert into public.circle_follows values(me,target) on conflict do nothing;
 elsif action='unfollow' then delete from public.circle_follows where follower=me and followed=target;
 elsif action='block' then
   insert into public.circle_blocks values(me,target) on conflict do nothing;
   delete from public.circle_follows where (follower=me and followed=target) or (follower=target and followed=me);
 elsif action='unblock' then delete from public.circle_blocks where blocker=me and blocked=target;
 elsif action='preferences' then
   insert into public.circle_preferences values(me,body='true',title='true') on conflict(user_id) do update set messages=excluded.messages,ranking=excluded.ranking;
 elsif action='create' then
   if cardinality(invitees) not between 1 and 7 or char_length(trim(title)) not between 2 and 80 then raise exception 'Choose 1–7 connections and a room name'; end if;
   if (select count(*) from public.circle_chat_members where user_id=me)>=50 then raise exception 'Leave an old conversation before creating another'; end if;
   foreach other in array invitees loop
     if other=me or not exists(select 1 from public.circle_follows a join public.circle_follows b on b.follower=a.followed and b.followed=a.follower where a.follower=me and a.followed=other) or exists(select 1 from public.circle_preferences where user_id=other and not messages) or exists(select 1 from public.circle_blocks where (blocker=me and blocked=other) or (blocker=other and blocked=me)) then raise exception 'Invite mutual followers who allow messages'; end if;
   end loop;
   insert into public.circle_chats(owner_id,name) values(me,trim(title)) returning id into selected;
   insert into public.circle_chat_members values(selected,me,true);
   insert into public.circle_chat_members select selected,u,false from (select distinct unnest(invitees) u) ids;
 elsif action='accept' then
   if exists(select 1 from public.circle_chat_members m join public.circle_blocks b on (b.blocker=me and b.blocked=m.user_id) or (b.blocker=m.user_id and b.blocked=me) where m.chat_id=room) then raise exception 'This invitation is unavailable'; end if;
   update public.circle_chat_members set accepted=true where chat_id=room and user_id=me;
 elsif action='leave' then delete from public.circle_chat_members where chat_id=room and user_id=me; selected:=null;
 elsif action in ('send','goal','checkin') then
   if not exists(select 1 from public.circle_chat_members where chat_id=room and user_id=me and accepted) then raise exception 'Accept an invitation before entering this room'; end if;
   if exists(select 1 from public.circle_chat_members m join public.circle_blocks b on (b.blocker=me and b.blocked=m.user_id) or (b.blocker=m.user_id and b.blocked=me) where m.chat_id=room) then raise exception 'A blocked connection is in this room. Leave to end the conversation'; end if;
   if action='send' then
     if (select count(*) from public.circle_chat_messages where sender_id=me and created_at>now()-interval '1 minute')>=10 then raise exception 'Please wait a minute before sending more messages'; end if;
     insert into public.circle_chat_messages(chat_id,sender_id,body) values(room,me,trim(body));
   elsif action='goal' then update public.circle_chats set goal=trim(body) where id=room and owner_id=me;
   else
     if not exists(select 1 from public.circle_chats where id=room and goal<>'') then raise exception 'Set a shared goal first'; end if;
     insert into public.circle_checkins values(room,me,today) on conflict do nothing;
   end if;
 elsif action='report' then
   if target=me or not exists(select 1 from public.profiles where id=target) then raise exception 'Choose another learner'; end if;
   if exists(select 1 from public.circle_person_reports where reporter=me and circle_person_reports.target=circle_social.target and created_at>now()-interval '1 day') then raise exception 'Your report is already received'; end if;
   insert into public.circle_person_reports(reporter,target,reason) values(me,target,trim(body));
 elsif action='resolve' then
   if not public.is_study_circle_moderator() then raise exception 'Moderator access required'; end if;
   update public.circle_person_reports set resolved=true where id=target;
 elsif action<>'read' then raise exception 'Unknown action';
 end if;
 if selected is not null and not exists(select 1 from public.circle_chat_members where chat_id=selected and user_id=me and accepted) then selected:=null; end if;
 select jsonb_build_object(
 'me',me,'selected',selected,
 'preferences',coalesce((select to_jsonb(p) from public.circle_preferences p where user_id=me),'{"messages":true,"ranking":false}'::jsonb),
 'people',coalesce((select jsonb_agg(p) from (select p.id,p.username,p.full_name,p.bio,p.institution,exists(select 1 from public.circle_follows where follower=me and followed=p.id) following,exists(select 1 from public.circle_follows where follower=p.id and followed=me) follows_you from public.profiles p where p.id<>me and (search='' or p.full_name ilike '%'||left(search,80)||'%' or p.username ilike '%'||left(search,80)||'%') and not exists(select 1 from public.circle_blocks where (blocker=me and blocked=p.id) or (blocker=p.id and blocked=me)) order by following desc,follows_you desc,p.username limit 40) p),'[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name)) from public.circle_blocks b join public.profiles p on p.id=b.blocked where b.blocker=me),'[]'::jsonb),
 'rooms',coalesce((select jsonb_agg(r) from (select c.*,m.accepted from public.circle_chats c join public.circle_chat_members m on m.chat_id=c.id where m.user_id=me order by c.created_at desc limit 50) r),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg(msg order by msg.created_at) from (select m.*,p.full_name from public.circle_chat_messages m join public.profiles p on p.id=m.sender_id where m.chat_id=selected and not exists(select 1 from public.circle_blocks where (blocker=me and blocked=m.sender_id) or (blocker=m.sender_id and blocked=me)) order by m.created_at desc,m.id desc limit 50) msg),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'accepted',m.accepted)) from public.circle_chat_members m join public.profiles p on p.id=m.user_id where m.chat_id=selected),'[]'::jsonb),
 'checked',exists(select 1 from public.circle_checkins where chat_id=selected and user_id=me and day=today),
 'ranking',coalesce((select jsonb_agg(r) from (select p.id,p.full_name,count(c.day)::int days from public.circle_chat_members m join public.circle_preferences s on s.user_id=m.user_id and s.ranking join public.profiles p on p.id=m.user_id left join public.circle_checkins c on c.user_id=m.user_id and c.chat_id=selected and c.day>=today-6 where m.chat_id=selected and m.accepted group by p.id,p.full_name order by days desc,p.full_name) r),'[]'::jsonb),
 'reports',case when public.is_study_circle_moderator() then coalesce((select jsonb_agg(r) from (select r.id,r.reason,r.target,p.full_name from public.circle_person_reports r join public.profiles p on p.id=r.target where not r.resolved order by r.created_at limit 30) r),'[]'::jsonb) else '[]'::jsonb end
 ) into result;
 return result;
end; $$;
revoke all on function public.circle_social(text,uuid,uuid,text,text,uuid[],text) from public,anon;
grant execute on function public.circle_social(text,uuid,uuid,text,text,uuid[],text) to authenticated;
commit;
