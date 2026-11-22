import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { isSameOrigin } from "@/lib/request-origin";

const uuid = z.string().uuid();
const schema = z.object({
  room: uuid,
  session: uuid,
  action: z.enum(["join", "leave", "poll", "signal"]),
  after: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  mic: z.boolean().optional(),
  camera: z.boolean().optional(),
  target: uuid.optional(),
  description: z
    .object({
      type: z.enum(["offer", "answer"]),
      sdp: z.string().min(1).max(28000),
    })
    .optional(),
});

function iceServers(session: string): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const urls = (process.env.STUDY_TURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => /^turns?:/i.test(url));
  const secret = process.env.STUDY_TURN_SECRET;
  if (urls.length && secret) {
    const username = `${Math.floor(Date.now() / 1000) + 7200}:${session}`;
    servers.push({
      urls,
      username,
      credential: createHmac("sha1", secret).update(username).digest("base64"),
    });
  }
  return servers;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 34000)
      return NextResponse.json(
        { error: "Call signal is too large." },
        { status: 413 },
      );
    const input = schema.parse(JSON.parse(raw));
    if (input.action === "signal" && (!input.target || !input.description))
      return NextResponse.json(
        { error: "Incomplete call signal." },
        { status: 400 },
      );
    const client = await db();
    const { data, error } = await client.rpc("study_voice", {
      p_room: input.room,
      p_session: input.session,
      p_action: input.action,
      p_after: input.after ?? 0,
      p_target: input.target ?? null,
      p_description: input.description ?? null,
      p_mic: input.mic ?? false,
      p_camera: input.camera ?? false,
    });
    if (error) {
      if (error.code === "42501")
        return NextResponse.json(
          { error: "Your room access or session has ended. Join again." },
          { status: 403 },
        );
      if (error.code === "PGRST202")
        return NextResponse.json(
          { error: "Voice rooms need the latest database migration." },
          { status: 503 },
        );
      if (error.message.includes("room is full"))
        return NextResponse.json(
          { error: "This room already has four people." },
          { status: 409 },
        );
      return NextResponse.json(
        { error: "The call could not connect. Please try again." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      input.action === "join"
        ? { iceServers: iceServers(input.session) }
        : data,
    );
  } catch {
    return NextResponse.json(
      { error: "The call request could not be completed." },
      { status: 400 },
    );
  }
}
