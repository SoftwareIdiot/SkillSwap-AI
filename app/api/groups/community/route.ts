import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { isSameOrigin } from "@/lib/request-origin";

const uuid = z.string().uuid();
const roomFields = "id,title,background";
const voiceSetup =
  "Voice rooms are unavailable until the Study Circle database setup is applied.";
const missingVoiceSchema = (code: string) =>
  ["PGRST205", "42P01"].includes(code);
const write = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("message"),
    community: uuid,
    body: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal("room"),
    community: uuid,
    title: z.string().trim().min(3).max(70),
    background: z.enum(["night", "forest", "dawn"]),
  }),
]);

async function access(community: string) {
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return {
      error: NextResponse.json(
        { error: "Sign in to open Study Circle." },
        { status: 401 },
      ),
    };
  const { data, error } = await client
    .from("classroom_members")
    .select("classroom_id")
    .eq("classroom_id", community)
    .eq("student_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Membership could not be checked. Try again.");
  if (!data)
    return {
      error: NextResponse.json(
        { error: "Join the community to continue." },
        { status: 403 },
      ),
    };
  return { client, user };
}

export async function GET(request: NextRequest) {
  const community = uuid.safeParse(
    request.nextUrl.searchParams.get("community"),
  );
  if (!community.success)
    return NextResponse.json({ error: "Select a community." }, { status: 400 });
  try {
    const result = await access(community.data);
    if (result.error) return result.error;
    const { client } = result;
    const [chat, rooms] = await Promise.all([
      client
        .from("classroom_messages")
        .select("id,sender_id,body,created_at")
        .eq("classroom_id", community.data)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100),
      client
        .from("study_voice_rooms")
        .select(roomFields)
        .eq("classroom_id", community.data)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (chat.error) throw new Error("Community messages could not be loaded.");
    const messages = (chat.data || []).reverse();
    const ids = [...new Set(messages.map((message) => message.sender_id))];
    const { data: profiles } = ids.length
      ? await client
          .from("profiles")
          .select("id,full_name,username")
          .in("id", ids)
      : { data: [] };
    const names = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile.full_name || profile.username,
      ]),
    );
    return NextResponse.json(
      {
        messages: messages.map((message) => ({
          ...message,
          name: names.get(message.sender_id) || "Study partner",
        })),
        rooms: rooms.data || [],
        voiceAvailable: !rooms.error,
        voiceError: rooms.error
          ? missingVoiceSchema(rooms.error.code)
            ? voiceSetup
            : "Voice rooms could not load. Try again in a moment."
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Study Circle could not load.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 10000)
      return NextResponse.json(
        { error: "This update is too large." },
        { status: 413 },
      );
    const operation = write.parse(JSON.parse(raw));
    const result = await access(operation.community);
    if (result.error) return result.error;
    const { client, user } = result;
    const saved =
      operation.action === "message"
        ? await client.from("classroom_messages").insert({
            classroom_id: operation.community,
            sender_id: user.id,
            body: operation.body,
          })
        : await client
            .from("study_voice_rooms")
            .insert({
              classroom_id: operation.community,
              created_by: user.id,
              title: operation.title,
              background: operation.background,
            })
            .select(roomFields)
            .single();
    if (saved.error) {
      if (operation.action === "room" && missingVoiceSchema(saved.error.code))
        return NextResponse.json({ error: voiceSetup }, { status: 503 });
      return NextResponse.json(
        {
          error:
            operation.action === "room"
              ? "The room could not be created. Try again in a moment."
              : "The message could not be sent. Try again in a moment.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { saved: true, room: saved.data },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "This update could not be saved. Review the fields and try again.",
      },
      { status: 400 },
    );
  }
}
