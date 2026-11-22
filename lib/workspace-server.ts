import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyPersonal,
  normalizePersonal,
  emptyWorkspace,
  log,
  type Operation,
  type Personal,
  type WorkspaceData,
  type Room,
} from "./workspace";
import { curriculumSchema } from "./skill-paths";

export async function loadStudyGroups(
  client: SupabaseClient,
  userId: string,
): Promise<Room[]> {
  const [publicRooms, memberships] = await Promise.all([
    client
      .from("classrooms")
      .select("*")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("classroom_members")
      .select("classroom_id")
      .eq("student_id", userId),
  ]);
  if (publicRooms.error || memberships.error)
    throw new Error(publicRooms.error?.message || memberships.error?.message);
  const joined = new Set<string>(
    (memberships.data || []).map((m) => m.classroom_id),
  );
  const privateRooms = joined.size
    ? await client
        .from("classrooms")
        .select("*")
        .in("id", [...joined])
    : { data: [], error: null };
  if (privateRooms.error) throw new Error(privateRooms.error.message);
  return [
    ...new Map(
      [...(publicRooms.data || []), ...(privateRooms.data || [])].map((r) => [
        r.id,
        r,
      ]),
    ).values(),
  ].map((r) => ({ ...r, joined: joined.has(r.id) }));
}

export async function loadWorkspace(
  client: SupabaseClient,
  userId: string,
  activeRoom?: string,
): Promise<WorkspaceData> {
  const [
    profiles,
    skills,
    proofs,
    rooms,
    members,
    messages,
    tasks,
    exchanges,
    personal,
    myProfile,
    mySkills,
    myProofs,
    community,
  ] = await Promise.all([
    client.from("profiles").select("*").limit(1000),
    client
      .from("skills")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    client
      .from("achievements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    activeRoom
      ? client
          .from("classrooms")
          .select("*")
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    activeRoom
      ? client
          .from("classroom_members")
          .select("classroom_id")
          .eq("student_id", userId)
      : Promise.resolve({ data: [], error: null }),
    activeRoom
      ? client
          .from("classroom_messages")
          .select("*")
          .eq("classroom_id", activeRoom)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("tasks")
      .select("*")
      .eq("student_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("exchange_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("learning_workspaces")
      .select("data")
      .eq("student_id", userId)
      .maybeSingle(),
    client.from("profiles").select("*").eq("id", userId).maybeSingle(),
    client
      .from("skills")
      .select("*")
      .eq("student_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("achievements")
      .select("*")
      .eq("author_id", userId)
      .order("created_at", { ascending: false }),
    client
      .from("skill_divisions")
      .select("id,owner_id,author,title,curriculum")
      .eq("visibility", "public")
      .neq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  for (const result of [
    profiles,
    skills,
    proofs,
    rooms,
    members,
    messages,
    tasks,
    exchanges,
    personal,
    myProfile,
    mySkills,
    myProofs,
  ])
    if (result.error)
      throw new Error(
        result.error.code === "42P01"
          ? "Your learning data is temporarily unavailable. Please try again shortly."
          : result.error.message,
      );
  const initial = emptyWorkspace(userId);
  const communityDivisions = (community.data || []).flatMap((row) => {
    const result = curriculumSchema.safeParse(row.curriculum);
    return result.success
      ? [
          {
            ...result.data,
            id: row.id,
            visibility: "public" as const,
            source: "user" as const,
            author: row.author,
          },
        ]
      : [];
  });
  const joined = new Set(members.data?.map((m) => m.classroom_id));
  const joinedRooms = joined.size
    ? await client
        .from("classrooms")
        .select("*")
        .in("id", [...joined])
    : { data: [], error: null };
  if (joinedRooms.error) throw new Error(joinedRooms.error.message);
  const unique = <T extends { id: string }>(items: T[]) =>
    Array.from(new Map(items.map((item) => [item.id, item])).values());
  return {
    ...initial,
    communityDivisions,
    communityNotice: community.error
      ? "Community skills are temporarily unavailable. Your private learning workspace is still available."
      : undefined,
    profile: myProfile.data || initial.profile,
    people: unique([
      ...(profiles.data || []),
      ...(myProfile.data ? [myProfile.data] : []),
    ]),
    skills: unique([...(mySkills.data || []), ...(skills.data || [])]),
    proofs: unique([...(myProofs.data || []), ...(proofs.data || [])])
      .map((p) => ({ ...p, evidence_url: p.evidence_url || "" }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    rooms: unique([...(joinedRooms.data || []), ...(rooms.data || [])]).map(
      (r) => ({ ...r, joined: joined.has(r.id) }),
    ),
    messages: (messages.data || []).reverse(),
    tasks: tasks.data || [],
    exchanges: exchanges.data || [],
    personal: normalizePersonal(personal.data?.data),
  };
}
export async function performOperation(
  client: SupabaseClient,
  userId: string,
  op: Operation,
) {
  if (op.type === "checkpoint.answer") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: current, error } = await client
        .from("learning_workspaces")
        .select("data,updated_at")
        .eq("student_id", userId)
        .maybeSingle();
      if (error) throw new Error("Could not load your checkpoint progress.");
      if (!current) throw new Error("Enroll in the skill before answering a checkpoint.");
      const personal = applyPersonal(normalizePersonal(current.data), op);
      const result = await client
        .from("learning_workspaces")
        .update({ data: personal, updated_at: new Date(Math.max(Date.now(), Date.parse(current.updated_at) + 1)).toISOString() })
        .eq("student_id", userId)
        .eq("updated_at", current.updated_at)
        .select("student_id")
        .maybeSingle();
      if (result.error) throw new Error("Could not save your checkpoint answer.");
      if (result.data) return { checkpointAttempts: personal.checkpointAttempts };
    }
    throw new Error("Your workspace changed on another device. Try saving again.");
  }
  const check = async (
    query: PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const r = await query;
    if (r.error) throw new Error(r.error.message);
  };
  const p = await client
    .from("learning_workspaces")
    .select("data")
    .eq("student_id", userId)
    .maybeSingle();
  if (p.error)
    throw new Error("Apply migration 0002 to enable the upgraded workspace.");
  let personal: Personal = applyPersonal(normalizePersonal(p.data?.data), op);
  switch (op.type) {
    case "division.save":
    case "division.visibility": {
      const division = personal.divisions.find(
        (d) => d.id === (op.type === "division.save" ? op.value.id : op.id),
      );
      if (!division) throw new Error("Skill draft not found.");
      const {
        id,
        visibility,
        source,
        draft: ignoredDraft,
        author: ignoredAuthor,
        ...curriculum
      } = division;
      const result = await client.rpc("save_skill_division", {
        p_id: id,
        p_title: curriculum.title,
        p_curriculum: curriculum,
        p_visibility: visibility,
        p_personal: personal,
      });
      if (result.error)
        throw new Error(
          "Could not save shared skill data. Apply migration 0003 and check your connection. Your prior draft is unchanged.",
        );
      return;
    }
    case "division.delete":
      await check(
        client
          .from("skill_divisions")
          .delete()
          .eq("id", op.id)
          .eq("owner_id", userId),
      );
      break;
    case "profile":
      await check(
        client.from("profiles").upsert({
          id: userId,
          ...op.value,
          updated_at: new Date().toISOString(),
        }),
      );
      break;
    case "skill.add":
      await check(
        client.from("skills").insert({ student_id: userId, ...op.value }),
      );
      break;
    case "skill.delete":
      await check(
        client.from("skills").delete().eq("id", op.id).eq("student_id", userId),
      );
      break;
    case "task.add": {
      const result = await client
        .from("tasks")
        .insert({ student_id: userId, title: op.title })
        .select("id")
        .single();
      if (result.error) throw new Error(result.error.message);
      personal.taskMinutes[result.data.id] = op.minutes || 25;
      if (op.quizTopic) personal.taskQuizTopics[result.data.id] = op.quizTopic;
      if (op.checkpoint) personal.taskCheckpoints[result.data.id] = op.checkpoint;
      break;
    }
    case "task.delete":
      await check(
        client.from("tasks").delete().eq("id", op.id).eq("student_id", userId),
      );
      break;
    case "task.toggle": {
      const { data, error } = await client
        .from("tasks")
        .select("done,title")
        .eq("id", op.id)
        .eq("student_id", userId)
        .single();
      if (error || !data) throw new Error("Task not found.");
      await check(
        client
          .from("tasks")
          .update({ done: !data.done })
          .eq("id", op.id)
          .eq("student_id", userId),
      );
      if (!data.done) log(personal, "Completed: " + data.title);
      break;
    }
    case "proof.add":
      await check(
        client.from("achievements").insert({ author_id: userId, ...op.value }),
      );
      log(personal, "Published: " + op.value.title);
      break;
    case "proof.delete":
      await check(
        client
          .from("achievements")
          .delete()
          .eq("id", op.id)
          .eq("author_id", userId),
      );
      break;
    case "room.create": {
      const { randomBytes } = await import("node:crypto");
      await check(
        client.from("classrooms").insert({
          host_id: userId,
          ...op.value,
          code: "SKILL-" + randomBytes(5).toString("hex").toUpperCase(),
        }),
      );
      break;
    }
    case "room.join":
      await check(client.rpc("join_classroom_by_code", { room_code: op.code }));
      break;
    case "room.message":
      await check(
        client.from("classroom_messages").insert({
          classroom_id: op.roomId,
          sender_id: userId,
          body: op.body,
        }),
      );
      break;
    case "exchange.request":
      await check(
        client
          .from("exchange_requests")
          .insert({ sender_id: userId, ...op.value }),
      );
      break;
    case "exchange.respond": {
      const result = await client
        .from("exchange_requests")
        .update({ status: op.status })
        .eq("id", op.id)
        .eq("status", "pending")
        .eq(op.status === "cancelled" ? "sender_id" : "receiver_id", userId)
        .select("id");
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.length)
        throw new Error(
          "This request is no longer pending or does not belong to you.",
        );
      break;
    }
  }
  // Personal metadata is bounded and belongs only to the signed-in user.
  await check(
    client.from("learning_workspaces").upsert({
      student_id: userId,
      data: personal,
      updated_at: new Date().toISOString(),
    }),
  );
}
