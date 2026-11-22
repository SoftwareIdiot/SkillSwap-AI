-- Supabase default grants can include explicit anon access in addition to PUBLIC.
-- These RPCs are used only by authenticated SkillSwap sessions.
begin;
revoke execute on function public.join_classroom_by_code(text) from public, anon;
revoke execute on function public.consume_ai_request() from public, anon;
grant execute on function public.join_classroom_by_code(text) to authenticated;
grant execute on function public.consume_ai_request() to authenticated;
commit;
