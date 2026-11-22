-- Apply after 0001_foundation.sql. No service-role key is needed by the app.
alter table public.achievements add column if not exists evidence_url text not null default ''
 check (evidence_url='' or evidence_url ~ '^https?://');

create table public.learning_workspaces (
 student_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object' and octet_length(data::text)<1000000),
 updated_at timestamptz not null default now()
);
alter table public.learning_workspaces enable row level security;
create policy workspace_own on public.learning_workspaces for all to authenticated
 using (student_id=auth.uid()) with check (student_id=auth.uid());

create table public.exchange_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 skill_name text not null check(char_length(skill_name) between 2 and 80),
 offering text not null check(char_length(offering) between 2 and 80),
 message text not null check(char_length(message) between 3 and 1000),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),check(sender_id<>receiver_id)
);
create unique index exchange_pending_unique on public.exchange_requests(sender_id,receiver_id,lower(skill_name)) where status='pending';
create index exchange_receiver_idx on public.exchange_requests(receiver_id,created_at desc);
alter table public.exchange_requests enable row level security;
create policy exchange_read on public.exchange_requests for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
create policy exchange_insert on public.exchange_requests for insert to authenticated with check (
 sender_id=auth.uid() and status='pending'
 and exists(select 1 from public.skills s where s.student_id=receiver_id and s.kind='teach' and lower(s.name)=lower(skill_name))
 and exists(select 1 from public.skills s where s.student_id=auth.uid() and s.kind='teach' and lower(s.name)=lower(offering))
);
create policy exchange_update on public.exchange_requests for update to authenticated using ((sender_id=auth.uid() or receiver_id=auth.uid()) and status='pending') with check (sender_id=auth.uid() or receiver_id=auth.uid());
create function public.guard_exchange_update() returns trigger language plpgsql set search_path=public as $$
begin
 if new.sender_id<>old.sender_id or new.receiver_id<>old.receiver_id or new.skill_name<>old.skill_name or new.offering<>old.offering or new.message<>old.message or new.id<>old.id or new.created_at<>old.created_at then raise exception 'Only request status may change';end if;
 if old.status<>'pending' then raise exception 'Request is already resolved';end if;
 if auth.uid()=old.sender_id and new.status<>'cancelled' then raise exception 'Senders may only cancel requests';end if;
 if auth.uid()=old.receiver_id and new.status not in ('accepted','declined') then raise exception 'Choose accept or decline';end if;
 return new;
end;$$;
create trigger protect_exchange_status before update on public.exchange_requests for each row execute function public.guard_exchange_update();

-- Host membership is created atomically with the room, including older clients.
create function public.add_classroom_host() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.classroom_members(classroom_id,student_id) values(new.id,new.host_id) on conflict do nothing;return new;end;$$;
create trigger classroom_host_membership after insert on public.classrooms for each row execute function public.add_classroom_host();
insert into public.classroom_members(classroom_id,student_id) select id,host_id from public.classrooms on conflict do nothing;

-- A bounded, database-backed quota works across application instances.
create table public.ai_requests(student_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create index ai_requests_user_time_idx on public.ai_requests(student_id,created_at);
alter table public.ai_requests enable row level security;
create function public.consume_ai_request() returns boolean language plpgsql security definer set search_path=public as $$
declare recent_count integer;
begin
 if auth.uid() is null then return false;end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 delete from public.ai_requests where student_id=auth.uid() and created_at<now()-interval '1 hour';
 select count(*) into recent_count from public.ai_requests where student_id=auth.uid();
 if recent_count>=30 then return false;end if;
 if (select count(*) from public.ai_requests where student_id=auth.uid() and created_at>now()-interval '1 minute')>=5 then return false;end if;
 insert into public.ai_requests(student_id) values(auth.uid());return true;
end;$$;
revoke all on function public.consume_ai_request() from public;
grant execute on function public.consume_ai_request() to authenticated;
