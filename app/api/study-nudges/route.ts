import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  nudgeSettingsSchema,
  nextStudyTopic,
  studyNudge,
} from "@/lib/study-nudge";
import { normalizePersonal } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STUDY_NUDGE_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key)
    return NextResponse.json(
      { error: "Study messages are not connected." },
      { status: 503 },
    );
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const channels = (process.env.STUDY_NUDGE_CHANNELS || "")
    .split(",")
    .map((channel) => channel.trim())
    .filter((channel) => channel === "email" || channel === "whatsapp");
  if (!channels.length)
    return NextResponse.json(
      { jobs: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  const { data: accounts, error } = await client
    .from("learning_workspaces")
    .select("student_id, data")
    .in("data->studyNudges->>channel", channels)
    .order("student_id");
  if (error)
    return NextResponse.json(
      { error: "Unable to load subscriptions." },
      { status: 503 },
    );

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const jobs = [];
  for (const account of accounts) {
    if (jobs.length >= 5) break;
    const personal = normalizePersonal(account.data);
    const settings = nudgeSettingsSchema.safeParse(personal.studyNudges);
    if (!settings.success || settings.data.channel === "off") continue;
    const topic = nextStudyTopic(personal);
    if (!topic) continue;
    const { data: previous, error: lookupError } = await client
      .from("study_nudge_dispatches")
      .select("sent_at")
      .eq("student_id", account.student_id)
      .gte("sent_at", since)
      .limit(1)
      .maybeSingle();
    if (lookupError)
      return NextResponse.json(
        { error: "Study message tracking is unavailable." },
        { status: 503 },
      );
    if (previous) continue;

    const channel = settings.data.channel;
    const recipient =
      channel === "email"
        ? (await client.auth.admin.getUserById(account.student_id)).data.user
        : null;
    const destination =
      channel === "email"
        ? recipient?.email_confirmed_at && recipient.email
        : settings.data.phone;
    if (!destination) continue;

    try {
      const message = await studyNudge(topic);
      const { data: claim, error: claimError } = await client.rpc(
        "claim_study_nudge",
        {
          learner: account.student_id,
          expected_channel: channel,
          expected_phone: settings.data.phone,
        },
      );
      if (!claimError && claim === true)
        jobs.push({ channel, destination, topic: topic.title, ...message });
    } catch {
      // The next scheduled run can retry generation.
      break;
    }
  }
  return NextResponse.json(
    { jobs },
    { headers: { "Cache-Control": "no-store" } },
  );
}
