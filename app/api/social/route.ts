import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { boundedBody } from "@/lib/bounded-body";
import { isSameOrigin } from "@/lib/request-origin";
const input = z.object({
  action: z
    .enum([
      "read",
      "follow",
      "unfollow",
      "block",
      "unblock",
      "preferences",
      "create",
      "accept",
      "leave",
      "send",
      "goal",
      "checkin",
      "report",
      "resolve",
    ])
    .default("read"),
  target: z.string().uuid().nullable().optional(),
  room: z.string().uuid().nullable().optional(),
  body: z.string().max(2000).default(""),
  title: z.string().max(80).default(""),
  invitees: z.array(z.string().uuid()).max(7).default([]),
  search: z.string().max(80).default(""),
});
export async function POST(request: NextRequest) {
  const reply = (value: object, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (!isSameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return reply({ error: "Sign in to connect with learners." }, 401);
    const body = await boundedBody(request, 12000);
    const parsed = input.safeParse(
      body
        ? await body
            .text()
            .then(JSON.parse)
            .catch(() => null)
        : null,
    );
    if (!parsed.success)
      return reply({ error: "Check your message and try again." }, 400);
    const { data, error } = await client.rpc("circle_social", parsed.data);
    if (error)
      return reply(
        {
          error:
            error.code === "PGRST202"
              ? "Connections are waiting for the database update. Your existing workspace is available."
              : error.code === "P0001"
                ? error.message
                : "This update could not be completed. Please try again.",
          setup: error.code === "PGRST202",
        },
        error.code === "PGRST202" ? 503 : 400,
      );
    return reply(data);
  } catch {
    return reply(
      { error: "Connections are temporarily unavailable. Please try again." },
      503,
    );
  }
}
