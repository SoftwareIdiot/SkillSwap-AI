import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { loadWorkspace, performOperation } from "@/lib/workspace-server";
import { operationSchema } from "@/lib/workspace";
import { isSameOrigin } from "@/lib/request-origin";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const activeRoom = request.nextUrl.searchParams.get("room") || undefined;
    if (activeRoom && !/^[a-f0-9-]{36}$/i.test(activeRoom))
      return NextResponse.json(
        { error: "Invalid classroom." },
        { status: 400 },
      );
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    return NextResponse.json(await loadWorkspace(client, user.id, activeRoom), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Unable to load your workspace.",
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
    if (raw.length > 250000)
      return NextResponse.json(
        { error: "This update is too large." },
        { status: 413 },
      );
    const parsed = operationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update." },
        { status: 400 },
      );
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      );
    const update = await performOperation(client, user.id, parsed.data);
    if (update) return NextResponse.json(update);
    return NextResponse.json(
      await loadWorkspace(
        client,
        user.id,
        parsed.data.type === "room.message" ? parsed.data.roomId : undefined,
      ),
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Could not save your changes.",
      },
      { status: 400 },
    );
  }
}
