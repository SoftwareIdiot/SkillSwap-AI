import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody } from "@/lib/bounded-body";
import { youtubeId } from "@/lib/recommendations";
import { isSameOrigin } from "@/lib/request-origin";
import { clipLimit, clipType, lessonLimit } from "@/lib/study-feed";
import { db } from "@/lib/supabase";

const columns = "id,author_id,kind,title,body,youtube_id,media_type,created_at";
const kindSchema = z.enum(["post", "clip"]);
const publishSchema = z.object({
  kind: kindSchema,
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().max(2500),
  youtube: z.string().trim().max(1500).optional(),
});
const privateHeaders = { "Cache-Control": "private, no-store" };

function problem(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: privateHeaders });
}

function feedError(code: string) {
  return ["PGRST205", "42P01"].includes(code)
    ? problem("The Study Circle feed is waiting for its database setup.", 503)
    : problem("Study Circle could not complete the update. Try again.", 503);
}

export async function GET(request: NextRequest) {
  const kind = kindSchema.safeParse(
    request.nextUrl.searchParams.get("kind") || "post",
  );
  if (!kind.success) return problem("Select a feed.", 400);
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return problem("Sign in to use the Study Circle feed.", 401);
    const recent = () =>
      client
        .from("study_circle_posts")
        .select(columns)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    const [{ data, error }, notes] = await Promise.all([
      recent().eq("kind", kind.data).limit(40),
      kind.data === "clip"
        ? recent()
            .eq("kind", "post")
            .is("youtube_id", null)
            .is("media_type", null)
            .limit(2)
        : { data: [] },
    ]);
    if (error) return feedError(error.code);
    const communityNotes = notes.data || [];
    const ids = [
      ...new Set([...data, ...communityNotes].map((post) => post.author_id)),
    ];
    const paths = data
      .filter((post) => post.media_type)
      .map((post) => `${post.author_id}/${post.id}`);
    const [profiles, signed] = await Promise.all([
      ids.length
        ? client.from("profiles").select("id,full_name,username").in("id", ids)
        : { data: [] },
      paths.length
        ? client.storage.from("study-clips").createSignedUrls(paths, 3600)
        : { data: [] },
    ]);
    const authors = new Map(
      (profiles.data || []).map((person) => [
        person.id,
        person.full_name || person.username,
      ]),
    );
    const urls = new Map(
      (signed.data || []).map((file) => [file.path, file.signedUrl]),
    );
    return NextResponse.json(
      {
        ...(kind.data === "clip"
          ? {
              notes: communityNotes.map((post) => ({
                ...post,
                author: authors.get(post.author_id) || "Learner",
                videoUrl: null,
              })),
            }
          : {}),
        posts: data.map((post) => ({
          ...post,
          author: authors.get(post.author_id) || "Learner",
          videoUrl: urls.get(`${post.author_id}/${post.id}`) || null,
        })),
      },
      { headers: privateHeaders },
    );
  } catch {
    return problem("The feed could not be loaded. Try again.", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return problem("Invalid request origin.", 403);
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return problem("Sign in to publish to Study Circle.", 401);
    const contentType = request.headers.get("Content-Type");
    if (!contentType?.startsWith("multipart/form-data"))
      return problem("Send the post using the publish form.", 415);
    const body = await boundedBody(request, lessonLimit + 64 * 1024);
    if (!body) return problem("Choose a video up to 40 MB.", 413);
    const form = await new Response(body, {
      headers: { "Content-Type": contentType },
    })
      .formData()
      .catch(() => null);
    if (!form)
      return problem(
        "The upload could not be read. Choose the file again.",
        400,
      );
    const input = publishSchema.safeParse(Object.fromEntries(form));
    if (!input.success)
      return problem("Check the title and description before publishing.", 400);
    const file = form.get("video");
    const video = file instanceof File && file.size > 0 ? file : null;
    const { kind, title, body: caption, youtube } = input.data;
    const linked = youtube ? youtubeId(youtube) : null;
    if (kind === "post" && !youtube && !video && caption.length < 3)
      return problem("Write a post with at least three characters.", 400);
    if (
      (kind === "clip" && !linked && !video) ||
      (linked && video) ||
      (youtube && !linked)
    )
      return problem(
        "Choose one MP4 or WebM video, or enter a valid YouTube link.",
        400,
      );
    const limit = kind === "clip" ? clipLimit : lessonLimit;
    if (video && video.size > limit)
      return problem(
        `Choose a video up to ${kind === "clip" ? 20 : 40} MB.`,
        413,
      );
    const mediaType = video ? await clipType(video) : null;
    if (video && (!mediaType || (video.type && video.type !== mediaType)))
      return problem("Choose an MP4 or WebM video.", 415);

    const id = crypto.randomUUID();
    const key = `${user.id}/${id}`;
    const bucket = client.storage.from("study-clips");
    if (video && mediaType) {
      const { error } = await bucket.upload(
        key,
        video.slice(0, video.size, mediaType),
        { contentType: mediaType },
      );
      if (error)
        return problem(
          error.status === 413
            ? "The video exceeds the storage limit. Try a smaller file."
            : "The video could not be uploaded. Check that video storage is enabled and try again.",
          503,
        );
    }
    const { error } = await client.from("study_circle_posts").insert({
      id,
      author_id: user.id,
      kind,
      title,
      body: caption,
      youtube_id: linked,
      media_type: mediaType,
    });
    if (error) {
      // An explicit database rejection means there is no published row.
      if (video && error.code) await bucket.remove([key]);
      if (kind === "post" && (video || linked) && error.code === "23514")
        return problem(
          "Long-form video posts are waiting for their database update.",
          503,
        );
      return feedError(error.code);
    }
    return NextResponse.json({ id }, { status: 201, headers: privateHeaders });
  } catch {
    return problem("The post could not be published. Try again.", 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return problem("Invalid request origin.", 403);
  const id = z
    .string()
    .uuid()
    .safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return problem("Select a post to remove.", 400);
  try {
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return problem("Sign in to remove a post.", 401);
    const { data, error } = await client
      .from("study_circle_posts")
      .select("media_type")
      .eq("id", id.data)
      .eq("author_id", user.id)
      .maybeSingle();
    if (error) return feedError(error.code);
    if (!data) return problem("That post is not in your account.", 404);
    if (data.media_type) {
      const removed = await client.storage
        .from("study-clips")
        .remove([`${user.id}/${id.data}`]);
      if (removed.error)
        return problem("The clip file could not be removed. Try again.", 503);
    }
    const result = await client
      .from("study_circle_posts")
      .delete()
      .eq("id", id.data)
      .eq("author_id", user.id);
    if (result.error) return feedError(result.error.code);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch {
    return problem("The post could not be removed. Try again.", 503);
  }
}
