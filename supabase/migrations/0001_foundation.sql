-- SkillSwap AI foundation. Apply through Supabase SQL editor or CLI.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 full_name text not null check (char_length(full_name) between 2 and 100),
 bio text not null default '', institution text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.achievements (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 140), description text not null check (char_length(description) between 3 and 2500),
 category text not null, created_at timestamptz not null default now()
);
create index achievements_recent_idx on public.achievements(created_at desc);
create table public.skills (
 id uuid primary key default gen_random_uuid(), student_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 80), kind text not null check (kind in ('teach','learn')),
 level text not null check (level in ('beginner','intermediate','advanced')),
 created_at timestamptz not null default now()
);
create index skills_student_idx on public.skills(student_id);
create table public.classrooms (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 3 and 120),
 topic text not null, description text not null default '', visibility text not null check (visibility in ('public','private')),
 code text not null unique, created_at timestamptz not null default now()
);
create table public.classroom_members (
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(classroom_id,student_id)
);
create table public.classroom_messages (
 id uuid primary key default gen_random_uuid(), classroom_id uuid not null references public.classrooms(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000), created_at timestamptz not null default now()
);
create index classroom_messages_recent_idx on public.classroom_messages(classroom_id,created_at);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 2 and 200),done boolean not null default false,created_at timestamptz not null default now()
);
create index tasks_student_idx on public.tasks(student_id);

alter table public.profiles enable row level security;
alter table public.achievements enable row level security;
alter table public.skills enable row level security;
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_messages enable row level security;
alter table public.tasks enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy achievements_read on public.achievements for select to authenticated using (true);
create policy achievements_write on public.achievements for insert to authenticated with check (author_id=auth.uid());
create policy achievements_delete on public.achievements for delete to authenticated using (author_id=auth.uid());
create policy skills_read on public.skills for select to authenticated using (true);
create policy skills_write on public.skills for insert to authenticated with check (student_id=auth.uid());
create policy skills_delete on public.skills for delete to authenticated using (student_id=auth.uid());
-- Private classroom metadata is visible only to members or the host.
create policy classroom_read on public.classrooms for select to authenticated using (visibility='public' or host_id=auth.uid() or exists(select 1 from public.classroom_members m where m.classroom_id=id and m.student_id=auth.uid()));
create policy classroom_create on public.classrooms for insert to authenticated with check (host_id=auth.uid());
create policy classroom_modify on public.classrooms for update to authenticated using (host_id=auth.uid()) with check (host_id=auth.uid());
-- Host can add their own membership. Other members join through the controlled RPC.
create policy member_read on public.classroom_members for select to authenticated using (student_id=auth.uid());
create policy member_host_join on public.classroom_members for insert to authenticated with check (student_id=auth.uid() and exists(select 1 from public.classrooms c where c.id=classroom_id and c.host_id=auth.uid()));
create policy member_leave on public.classroom_members for delete to authenticated using (student_id=auth.uid());
create policy messages_read on public.classroom_messages for select to authenticated using (exists(select 1 from public.classroom_members m where m.classroom_id=classroom_messages.classroom_id and m.student_id=auth.uid()));
create policy messages_write on public.classroom_messages for insert to authenticated with check (sender_id=auth.uid() and exists(select 1 from public.classroom_members m where m.classroom_id=classroom_messages.classroom_id and m.student_id=auth.uid()));
create policy tasks_own on public.tasks for all to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());

-- Lookup by code keeps nonmember private classroom metadata hidden.
create or replace function public.join_classroom_by_code(room_code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select id into target from public.classrooms where code=upper(trim(room_code));
 if target is null then raise exception 'Invalid classroom code'; end if;
 insert into public.classroom_members(classroom_id,student_id) values(target,auth.uid()) on conflict do nothing;
 return target;
end;$$;
revoke all on function public.join_classroom_by_code(text) from public;
grant execute on function public.join_classroom_by_code(text) to authenticated;
