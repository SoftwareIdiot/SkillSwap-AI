begin;

create table public.study_voice_rooms (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 70),
  background text not null check (background in ('night', 'forest', 'dawn')),
  created_at timestamptz not null default now()
);
create index study_voice_rooms_group_idx on public.study_voice_rooms(classroom_id, created_at);
alter table public.study_voice_rooms enable row level security;
revoke all on public.study_voice_rooms from public, anon, authenticated;
grant select, insert on public.study_voice_rooms to authenticated;
create policy study_voice_rooms_read on public.study_voice_rooms for select to authenticated
  using (exists(select 1 from public.classroom_members m where m.classroom_id = study_voice_rooms.classroom_id and m.student_id = (select auth.uid())));
create policy study_voice_rooms_create on public.study_voice_rooms for insert to authenticated
  with check (created_by = (select auth.uid()) and exists(select 1 from public.classroom_members m where m.classroom_id = study_voice_rooms.classroom_id and m.student_id = (select auth.uid())));

create table public.study_voice_sessions (
  id uuid primary key,
  room_id uuid not null references public.study_voice_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  mic boolean not null default false,
  camera boolean not null default false,
  unique(room_id, user_id)
);
create table public.study_voice_signals (
  id bigint generated always as identity primary key,
  sender uuid not null references public.study_voice_sessions(id) on delete cascade,
  recipient uuid not null references public.study_voice_sessions(id) on delete cascade,
  description jsonb not null,
  created_at timestamptz not null default now()
);
create index study_voice_signals_recipient_idx on public.study_voice_signals(recipient, id);
create index study_voice_signals_sender_idx on public.study_voice_signals(sender);
alter table public.study_voice_sessions enable row level security;
alter table public.study_voice_signals enable row level security;
revoke all on public.study_voice_sessions, public.study_voice_signals from public, anon, authenticated;

-- One signed-in learner per room and at most four media participants.
-- All writes and signal reads verify group membership and session ownership.
create function public.study_voice(
  p_room uuid, p_session uuid, p_action text, p_after bigint default 0,
  p_target uuid default null, p_description jsonb default null,
  p_mic boolean default false, p_camera boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  learner uuid := auth.uid();
  community uuid;
  members jsonb;
  signals jsonb;
begin
  select r.classroom_id into community from public.study_voice_rooms r where r.id = p_room;
  if learner is null or community is null or not exists(
    select 1 from public.classroom_members m where m.classroom_id = community and m.student_id = learner
  ) then raise exception 'Join the community first' using errcode = '42501'; end if;

  if p_action = 'join' then
    perform 1 from public.study_voice_rooms where id = p_room for update;
    delete from public.study_voice_sessions where room_id = p_room and (user_id = learner or last_seen < now() - interval '35 seconds');
    if (select count(*) from public.study_voice_sessions where room_id = p_room) >= 4 then
      raise exception 'This room is full (4 people)';
    end if;
    insert into public.study_voice_sessions(id, room_id, user_id) values(p_session, p_room, learner);
    return '{}'::jsonb;
  end if;

  if not exists(select 1 from public.study_voice_sessions where id = p_session and room_id = p_room and user_id = learner) then
    raise exception 'Your voice session has ended. Join again.' using errcode = '42501';
  end if;
  if p_action = 'leave' then
    delete from public.study_voice_sessions where id = p_session;
    return '{}'::jsonb;
  end if;
  if p_action = 'signal' then
    if p_target = p_session or not exists(
      select 1 from public.study_voice_sessions s
      join public.classroom_members m on m.student_id = s.user_id and m.classroom_id = community
      where s.id = p_target and s.room_id = p_room and s.last_seen >= now() - interval '35 seconds'
    ) then raise exception 'The other participant left the room'; end if;
    -- Keep signal IDs ordered by commit for this recipient's polling cursor.
    perform 1 from public.study_voice_sessions where id = p_target for no key update;
    if coalesce(jsonb_typeof(p_description), '') <> 'object'
       or coalesce(p_description->>'type', '') not in ('offer','answer')
       or coalesce(jsonb_typeof(p_description->'sdp'), '') <> 'string'
       or octet_length(p_description::text) > 32000 then
      raise exception 'Invalid call signal';
    end if;
    if (select count(*) from public.study_voice_signals where sender = p_session and created_at > now() - interval '1 minute') >= 40 then
      raise exception 'Too many call signals. Rejoin in a moment.';
    end if;
    insert into public.study_voice_signals(sender, recipient, description) values(p_session, p_target, p_description);
    return '{}'::jsonb;
  end if;
  if p_action <> 'poll' then raise exception 'Invalid voice action'; end if;

  update public.study_voice_sessions set last_seen = now(), mic = p_mic, camera = p_camera where id = p_session;
  delete from public.study_voice_signals where recipient = p_session and (id <= p_after or created_at < now() - interval '1 minute');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', coalesce(nullif(p.full_name,''), nullif(p.username,''), 'Study partner'),
    'mic', s.mic, 'camera', s.camera
  ) order by s.id), '[]'::jsonb) into members
    from public.study_voice_sessions s
    join public.classroom_members m on m.student_id = s.user_id and m.classroom_id = community
    left join public.profiles p on p.id = s.user_id
    where s.room_id = p_room and s.last_seen >= now() - interval '35 seconds';
  select coalesce(jsonb_agg(to_jsonb(delivery) order by delivery.id), '[]'::jsonb) into signals from (
    select g.id, g.sender, g.description from public.study_voice_signals g
    join public.study_voice_sessions s on s.id = g.sender
    join public.classroom_members m on m.student_id = s.user_id and m.classroom_id = community
    where g.recipient = p_session and s.last_seen >= now() - interval '35 seconds'
    order by g.id limit 32
  ) delivery;
  return jsonb_build_object('members', members, 'signals', signals);
end;
$$;
revoke all on function public.study_voice(uuid,uuid,text,bigint,uuid,jsonb,boolean,boolean) from public, anon;
grant execute on function public.study_voice(uuid,uuid,text,bigint,uuid,jsonb,boolean,boolean) to authenticated;

commit;
