import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody } from "@/lib/bounded-body";
import { db } from "@/lib/supabase";
import { isSameOrigin } from "@/lib/request-origin";
import type { Engagement, EntryKind } from "@/lib/study-discussion";

const uuid = z.string().uuid();
const entry = z.object({ id: uuid, kind: z.enum(["post", "milestone"]) });
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("summary"),
    posts: z.array(uuid).max(40),
    milestones: z.array(uuid).max(200),
  }),
  entry.extend({
    action: z.literal("reply"),
    body: z.string().trim().min(2).max(1500),
  }),
  entry.extend({ action: z.literal("helpful"), active: z.boolean() }),
  z.object({ action: z.literal("remove-reply"), id: uuid }),
  z.object({
    action: z.literal("report"),
    id: uuid,
    kind: z.enum(["post", "milestone", "reply"]),
    reason: z.enum(["spam", "harassment", "unsafe", "other"]),
    details: z.string().trim().max(500),
  }),
  z.object({
    action: z.literal("review"),
    id: uuid,
    decision: z.enum(["hide", "dismiss"]),
  }),
]);
const headers = { "Cache-Control": "private, no-store" };
const respond = (payload: object, status = 200) =>
  NextResponse.json(payload, { status, headers });
const problem = (error: string, status: number) => respond({ error }, status);
const failure = (code: string) => {
  if (["PGRST202", "PGRST205", "42P01"].includes(code))
    return problem(
      "Discussion tools are waiting for their database setup.",
      503,
    );
  if (code === "42501")
    return problem(
      "This content or action is unavailable to your account.",
      403,
    );
  if (code === "P0002")
    return problem("This content or report is no longer available.", 404);
  if (code === "22023" || code === "23514")
    return problem("Check the details and try again.", 400);
  return problem("The discussion could not be updated. Try again.", 503);
};
const field = (kind: EntryKind) =>
  kind === "post" ? "post_id" : "milestone_id";

export async function GET(request: NextRequest) {
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return problem("Sign in to open Study Circle discussions.", 401);
    const params = request.nextUrl.searchParams;
    if (params.get("view") === "moderation") {
      const role = await client.rpc("is_study_circle_moderator");
      if (role.error) return failure(role.error.code);
      if (!role.data) return problem("Moderator access is required.", 403);
      const reports = await client
        .from("study_circle_reports")
        .select(
          "id,target_id,target_kind,title,excerpt,reason,details,created_at",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(40);
      if (reports.error) return failure(reports.error.code);
      const ids = [
        ...new Set(
          reports.data
            .filter((report) => report.target_kind === "post")
            .map((report) => report.target_id),
        ),
      ];
      const targets = ids.length
        ? await client
            .from("study_circle_posts")
            .select("id,author_id,youtube_id,media_type")
            .in("id", ids)
        : { data: [] };
      const posts = new Map(
        (targets.data || []).map((post) => [post.id, post]),
      );
      const paths = (targets.data || [])
        .filter((post) => post.media_type)
        .map((post) => `${post.author_id}/${post.id}`);
      const signed = paths.length
        ? await client.storage.from("study-clips").createSignedUrls(paths, 900)
        : { data: [] };
      const urls = new Map(
        (signed.data || []).map((file) => [file.path, file.signedUrl]),
      );
      return respond({
        reports: reports.data.map(({ target_id, ...report }) => {
          const post =
            report.target_kind === "post" ? posts.get(target_id) : undefined;
          return {
            ...report,
            youtubeId: post?.youtube_id || null,
            videoUrl: post
              ? urls.get(`${post.author_id}/${post.id}`) || null
              : null,
          };
        }),
      });
    }
    const target = entry.safeParse({
      kind: params.get("kind"),
      id: params.get("id"),
    });
    if (!target.success) return problem("Select a post or milestone.", 400);
    const { kind, id } = target.data;
    const [replies, summary] = await Promise.all([
      client
        .from("study_circle_replies")
        .select("id,author_id,body,created_at")
        .eq(field(kind), id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50),
      client.rpc("study_circle_engagement", {
        p_posts: kind === "post" ? [id] : [],
        p_milestones: kind === "milestone" ? [id] : [],
      }),
    ]);
    if (replies.error || summary.error)
      return failure(replies.error?.code || summary.error?.code || "");
    const counts = (summary.data as Engagement[])[0];
    if (!counts) return problem("This discussion is no longer available.", 404);
    const ids = [...new Set(replies.data.map((reply) => reply.author_id))];
    const profiles = ids.length
      ? await client
          .from("profiles")
          .select("id,full_name,username")
          .in("id", ids)
      : { data: [] };
    const names = new Map(
      (profiles.data || []).map((profile) => [
        profile.id,
        profile.full_name || profile.username,
      ]),
    );
    return respond({
      engagement: counts,
      replies: replies.data
        .reverse()
        .map((reply) => ({
          ...reply,
          author: names.get(reply.author_id) || "Learner",
        })),
    });
  } catch {
    return problem("The discussion could not be loaded. Try again.", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return problem("Invalid request origin.", 403);
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return problem("Sign in to use Study Circle discussions.", 401);
    const body = await boundedBody(request, 16 * 1024);
    if (!body) return problem("This discussion request is too large.", 413);
    const input = actions.safeParse(
      await new Response(body).json().catch(() => null),
    );
    if (!input.success) return problem("Check the details and try again.", 400);
    const action = input.data;
    switch (action.action) {
      case "summary": {
        const [summary, role] = await Promise.all([
          client.rpc("study_circle_engagement", {
            p_posts: action.posts,
            p_milestones: action.milestones,
          }),
          client.rpc("is_study_circle_moderator"),
        ]);
        if (summary.error || role.error)
          return failure(summary.error?.code || role.error?.code || "");
        return respond({
          entries: summary.data,
          moderator: Boolean(role.data),
        });
      }
      case "reply": {
        const result = await client.from("study_circle_replies").insert({
          author_id: user.id,
          [field(action.kind)]: action.id,
          body: action.body,
        });
        return result.error
          ? failure(result.error.code)
          : respond({ saved: true }, 201);
      }
      case "helpful": {
        const column = field(action.kind);
        const votes = client.from("study_circle_helpful");
        const result = action.active
          ? await votes.upsert(
              { author_id: user.id, [column]: action.id },
              { onConflict: `author_id,${column}`, ignoreDuplicates: true },
            )
          : await votes.delete().eq("author_id", user.id).eq(column, action.id);
        if (result.error) return failure(result.error.code);
        const { data, error } = await client.rpc("study_circle_engagement", {
          p_posts: action.kind === "post" ? [action.id] : [],
          p_milestones: action.kind === "milestone" ? [action.id] : [],
        });
        if (error) return failure(error.code);
        const engagement = (data as Engagement[])[0];
        return engagement
          ? respond({ engagement })
          : problem("This content is no longer available.", 404);
      }
      case "remove-reply": {
        const result = await client
          .from("study_circle_replies")
          .delete()
          .eq("id", action.id)
          .eq("author_id", user.id)
          .select("id");
        if (result.error) return failure(result.error.code);
        return result.data.length
          ? respond({ removed: true })
          : problem("This reply is no longer available.", 404);
      }
      case "report": {
        const result = await client.rpc("report_study_circle_entry", {
          p_kind: action.kind,
          p_id: action.id,
          p_reason: action.reason,
          p_details: action.details,
        });
        return result.error
          ? failure(result.error.code)
          : respond({ submitted: true }, 201);
      }
      case "review": {
        const result = await client.rpc("review_study_circle_report", {
          p_id: action.id,
          p_action: action.decision,
        });
        return result.error
          ? failure(result.error.code)
          : respond({ reviewed: true });
      }
    }
  } catch {
    return problem("The discussion could not be updated. Try again.", 503);
  }
}
