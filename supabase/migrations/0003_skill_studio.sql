-- Private account state (including journals) remains in learning_workspaces.
-- Only a deliberate publish exposes this curriculum snapshot to other accounts.
create table if not exists public.skill_divisions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  author text not null default 'SkillSwap learner' check (length(author) <= 160),
  title text not null check (length(title) between 2 and 160),
  curriculum jsonb not null check (jsonb_typeof(curriculum) = 'object' and octet_length(curriculum::text) <= 240000),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  updated_at timestamptz not null default now()
);
alter table public.skill_divisions enable row level security;
grant select, insert, update, delete on public.skill_divisions to authenticated;
create policy "Read own drafts and published skills" on public.skill_divisions for select to authenticated using (owner_id = auth.uid() or visibility = 'public');
create policy "Create own skills" on public.skill_divisions for insert to authenticated with check (owner_id = auth.uid());
create policy "Edit own skills" on public.skill_divisions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Remove own skills" on public.skill_divisions for delete to authenticated using (owner_id = auth.uid());
create index skill_divisions_public_updated on public.skill_divisions(visibility, updated_at desc);

-- Publishing and its matching private revision commit together.
create function public.save_skill_division(p_id uuid, p_title text, p_curriculum jsonb, p_visibility text, p_personal jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare display_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to save shared skills'; end if;
  select coalesce(nullif(full_name,''),nullif(username,''),'SkillSwap learner') into display_name from public.profiles where id=auth.uid();
  insert into public.skill_divisions(id,owner_id,author,title,curriculum,visibility,updated_at)
  values(p_id,auth.uid(),coalesce(display_name,'SkillSwap learner'),p_title,p_curriculum,p_visibility,now())
  on conflict(id) do update set title=excluded.title,curriculum=excluded.curriculum,visibility=excluded.visibility,author=excluded.author,updated_at=now();
  insert into public.learning_workspaces(student_id,data,updated_at) values(auth.uid(),p_personal,now())
  on conflict(student_id) do update set data=excluded.data,updated_at=now();
end;
$$;
revoke all on function public.save_skill_division(uuid,text,jsonb,text,jsonb) from public,anon;
grant execute on function public.save_skill_division(uuid,text,jsonb,text,jsonb) to authenticated;
