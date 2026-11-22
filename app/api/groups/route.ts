import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { loadStudyGroups } from "@/lib/workspace-server";
import { operationSchema } from "@/lib/workspace";
import { isSameOrigin } from "@/lib/request-origin";
export async function GET() {
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Sign in to use study groups." },
        { status: 401 },
      );
    const rooms = await loadStudyGroups(client, user.id);
    return NextResponse.json(
      { rooms },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Groups could not be loaded." },
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
    if (raw.length > 5000) throw new Error("Group update is too large.");
    const op = operationSchema.parse(JSON.parse(raw));
    if (!["room.create", "room.join"].includes(op.type))
      throw new Error("Unsupported group action.");
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Sign in to use study groups." },
        { status: 401 },
      );
    let result;
    if (op.type === "room.create") {
      const { randomBytes } = await import("node:crypto");
      result = await client
        .from("classrooms")
        .insert({
          host_id: user.id,
          ...op.value,
          code: "SKILL-" + randomBytes(5).toString("hex").toUpperCase(),
        });
    } else if (op.type === "room.join") {
      result = await client.rpc("join_classroom_by_code", {
        room_code: op.code,
      });
    } else throw new Error("Unsupported group action.");
    if (result.error) throw new Error(result.error.message);
    const rooms = await loadStudyGroups(client, user.id);
    return NextResponse.json({ rooms });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update group." },
      { status: 400 },
    );
  }
}
