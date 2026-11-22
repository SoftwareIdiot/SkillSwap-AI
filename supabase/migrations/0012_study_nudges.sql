create table if not exists public.study_nudge_dispatches (
  student_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null
);
alter table public.study_nudge_dispatches enable row level security;
revoke all on public.study_nudge_dispatches from anon, authenticated;
grant select, insert, update on public.study_nudge_dispatches to service_role;

create or replace function public.claim_study_nudge(learner uuid, expected_channel text, expected_phone text)
returns boolean language plpgsql set search_path = '' as $$
begin
  perform 1 from public.learning_workspaces
    where student_id = learner
    and data -> 'studyNudges' ->> 'channel' = expected_channel
    and coalesce(data -> 'studyNudges' ->> 'phone', '') = expected_phone
    for update;
  if not found then return false; end if;

  insert into public.study_nudge_dispatches as dispatch (student_id, sent_at)
  values (learner, now())
  on conflict (student_id) do update set sent_at = excluded.sent_at
    where dispatch.sent_at <= now() - interval '7 days';
  return found;
end;
$$;
revoke all on function public.claim_study_nudge(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_study_nudge(uuid, text, text) to service_role;
