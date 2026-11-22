-- Study Circle uses the existing classroom tables and their existing RLS rules.
-- These indexes improve discovery and per-learner membership lookups without
-- changing membership, visibility, permissions, or saved learning records.
begin;
create index if not exists classrooms_public_recent_idx
  on public.classrooms (created_at desc) where visibility = 'public';
create index if not exists classroom_members_student_idx
  on public.classroom_members (student_id, classroom_id);
create index if not exists classrooms_host_idx
  on public.classrooms (host_id);
commit;
