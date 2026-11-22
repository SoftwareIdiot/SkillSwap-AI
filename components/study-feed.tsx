"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import {
  clipLimit,
  clipDuration,
  clipType,
  clipTypes,
  lessonLimit,
  lessonDuration,
  type FeedKind,
  type StudyPost,
} from "@/lib/study-feed";
import { safeLink, type WorkspaceData } from "@/lib/workspace";
import type { Engagement } from "@/lib/study-discussion";
import StudyDiscussion, { discussionRequest } from "./study-discussion";
import StudyModeration from "./study-moderation";
import DiscoveryView from "./discovery-view";
import "./study-circle.css";

const endpoint = "/api/groups/feed";
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

async function checkVideo(file: File, short: boolean) {
  if (file.size > (short ? clipLimit : lessonLimit))
    throw new Error(`Choose a video up to ${short ? 20 : 40} MB.`);
  if (!(await clipType(file))) throw new Error("Choose an MP4 or WebM video.");
  const preview = document.createElement("video");
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("Could not read this video. Choose another file.")),
        6000,
      );
      preview.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(preview.duration);
      };
      preview.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Could not read this video. Choose another file."));
      };
      preview.preload = "metadata";
      preview.src = url;
    });
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > (short ? clipDuration : lessonDuration)
    )
      throw new Error(
        short
          ? "Choose a Veel up to 90 seconds."
          : "Choose a video up to 15 minutes.",
      );
  } finally {
    preview.removeAttribute("src");
    preview.load();
    URL.revokeObjectURL(url);
  }
}

export default function StudyFeed({
  data,
  connected,
  kind,
  shareMilestone,
  removeMilestone,
  refreshWorkspace,
}: {
  data: WorkspaceData;
  connected: boolean;
  kind: FeedKind;
  shareMilestone: () => void;
  removeMilestone: (id: string) => void;
  refreshWorkspace: () => Promise<void>;
}) {
  const clips = kind === "clip";
  const [posts, setPosts] = useState<StudyPost[]>([]);
  const [notes, setNotes] = useState<StudyPost[]>([]);
  const [loading, setLoading] = useState(connected);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [source, setSource] = useState<"text" | "link" | "upload">(
    clips ? "link" : "text",
  );
  const [surface, setSurface] = useState<"discover" | "community">("discover");
  const [filter, setFilter] = useState<"all" | "milestones" | "posts">("all");
  const [playing, setPlaying] = useState("");
  const [reload, setReload] = useState(0);
  const [engagement, setEngagement] = useState<Record<string, Engagement>>({});
  const [discussionReady, setDiscussionReady] = useState(false);
  const [discussionError, setDiscussionError] = useState("");
  const [moderator, setModerator] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<{ title: string; body: string }>();
  useEffect(() => {
    if (clips || !connected) return;
    const raw = sessionStorage.getItem("skillswap.study-question");
    if (!raw) return;
    sessionStorage.removeItem("skillswap.study-question");
    try {
      const draft = JSON.parse(raw);
      if (typeof draft.title !== "string" || typeof draft.body !== "string") return;
      setQuestionDraft(draft);
      setSource("text");
      setSurface("community");
      setComposing(true);
    } catch {
      // An invalid draft must not prevent the feed from opening.
    }
  }, [clips, connected]);
  const updateEngagement = useCallback((entry: Engagement) => {
    setEngagement((previous) => ({
      ...previous,
      [`${entry.kind}:${entry.target_id}`]: entry,
    }));
  }, []);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`${endpoint}?kind=${kind}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) {
          setPosts(result.posts);
          setNotes(result.notes || []);
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "The feed could not load.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [connected, kind, reload]);
  useEffect(() => {
    if (!connected || loading) return;
    const controller = new AbortController();
    void discussionRequest<{ entries: Engagement[]; moderator: boolean }>(
      {
        action: "summary",
        posts: posts.map((post) => post.id),
        milestones: clips
          ? []
          : data.proofs.slice(0, 200).map((proof) => proof.id),
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setEngagement(
          Object.fromEntries(
            result.entries.map((entry) => [
              `${entry.kind}:${entry.target_id}`,
              entry,
            ]),
          ),
        );
        setModerator(result.moderator);
        setDiscussionReady(true);
        setDiscussionError("");
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setDiscussionError(
            reason instanceof Error
              ? reason.message
              : "Discussion tools could not load.",
          );
      });
    return () => controller.abort();
  }, [connected, clips, data.proofs, loading, posts]);

  const entries = [
    ...(filter !== "milestones"
      ? posts.map((post) => ({
          kind: "post" as const,
          post,
          date: post.created_at,
        }))
      : []),
    ...(!clips && filter !== "posts"
      ? data.proofs.slice(0, 200).map((proof) => ({
          kind: "milestone" as const,
          proof,
          date: proof.created_at,
        }))
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));

  async function remove(id: string) {
    if (
      busy ||
      !window.confirm(clips ? "Remove this Veel?" : "Remove this post?")
    )
      return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setPosts((previous) => previous.filter((post) => post.id !== id));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not remove this entry.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (reviewOpen && moderator)
    return (
      <StudyModeration
        back={() => setReviewOpen(false)}
        onReview={() => {
          setReload((value) => value + 1);
          void refreshWorkspace().catch(() => {});
        }}
      />
    );

  return (
    <div
      className={`study-feed ${clips ? "study-feed-veels" : "study-feed-lessons"}`}
    >
      <div className="feed-toolbar">
        <div className="tabs" role="group" aria-label="Learning feed view">
          {(
            [
              ["discover", "For you"],
              ["community", "Community"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={surface === id ? "active" : ""}
              aria-pressed={surface === id}
              onClick={() => {
                setSurface(id);
                setPlaying("");
                if (id === "discover") setComposing(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="button-row">
          {moderator && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setReviewOpen(true)}
            >
              <ShieldCheck size={16} /> Report queue
            </button>
          )}
          {!clips && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setSurface("community");
                shareMilestone();
              }}
              disabled={!connected}
            >
              <Trophy size={16} /> Share milestone
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            aria-expanded={composing}
            disabled={!connected}
            onClick={() => {
              setSurface("community");
              if (composing) setQuestionDraft(undefined);
              setComposing((value) => surface === "discover" || !value);
            }}
          >
            <Plus size={16} />{" "}
            {composing
              ? "Close composer"
              : clips
                ? "Share a Veel"
                : "Create a post"}
          </button>
        </div>
      </div>
      {surface === "discover" ? (
        <>
          <DiscoveryView
            mode={clips ? "veels" : "feed"}
            workspace={data}
            community={posts}
            notes={notes}
            openCommunity={() => setSurface("community")}
          />
          {!clips && entries.length > 0 && (
            <section className="panel circle-community-preview">
              <div className="circle-section-heading">
                <h2>From SkillSwap</h2>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setSurface("community")}
                >
                  Open community <ArrowUpRight size={14} />
                </button>
              </div>
              <ul>
                {entries.slice(0, 3).map((entry) => {
                  const item = entry.kind === "post" ? entry.post : entry.proof;
                  return <li key={item.id}>{item.title}</li>;
                })}
              </ul>
            </section>
          )}
        </>
      ) : (
        <>
          {!connected && (
            <p className="muted">
              Sign in to publish and see community updates.
            </p>
          )}
          {discussionError && (
            <p className="muted" role="status">
              {discussionError}
            </p>
          )}
          {composing && (
            <form
              className="panel form-stack circle-composer"
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                const form = new FormData(event.currentTarget);
                form.set("kind", kind);
                setError("");
                setBusy(true);
                try {
                  if (source === "upload") {
                    const file = form.get("video");
                    if (!(file instanceof File) || !file.size)
                      throw new Error("Choose a video file.");
                    await checkVideo(file, clips);
                  }
                  const response = await fetch(endpoint, {
                    method: "POST",
                    body: form,
                  });
                  if (!response.ok)
                    throw new Error((await response.json()).error);
                  setComposing(false);
                  setQuestionDraft(undefined);
                  setFilter("all");
                  setReload((previous) => previous + 1);
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not publish. Try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Title
                <input
                  name="title"
                  defaultValue={questionDraft?.title}
                  minLength={3}
                  maxLength={140}
                  required
                  placeholder={
                    clips
                      ? "Explain what the clip teaches"
                      : "What are you working on?"
                  }
                />
              </label>
              <label>
                {source === "text" ? "Your post" : "Caption (optional)"}
                <textarea
                  name="body"
                  defaultValue={questionDraft?.body}
                  rows={4}
                  minLength={source === "text" ? 3 : 0}
                  maxLength={2500}
                  required={source === "text"}
                />
              </label>
              <>
                <div className="tabs" role="group" aria-label="Video source">
                  {!clips && (
                    <button
                      type="button"
                      aria-pressed={source === "text"}
                      className={source === "text" ? "active" : ""}
                      onClick={() => setSource("text")}
                    >
                      Text post
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={source === "link"}
                    className={source === "link" ? "active" : ""}
                    onClick={() => setSource("link")}
                  >
                    YouTube link
                  </button>
                  <button
                    type="button"
                    aria-pressed={source === "upload"}
                    className={source === "upload" ? "active" : ""}
                    onClick={() => setSource("upload")}
                  >
                    Upload a video
                  </button>
                </div>
                {source === "link" ? (
                  <label>
                    YouTube URL
                    <input
                      type="url"
                      name="youtube"
                      maxLength={1500}
                      required
                      placeholder={
                        clips
                          ? "https://www.youtube.com/shorts/…"
                          : "https://www.youtube.com/watch?v=…"
                      }
                    />
                  </label>
                ) : source === "upload" ? (
                  <label>
                    Video file
                    <input
                      type="file"
                      name="video"
                      accept={clipTypes.join(",")}
                      required
                    />
                    <small>
                      {clips
                        ? "MP4 or WebM, up to 20 MB and 90 seconds."
                        : "MP4 or WebM, up to 40 MB and 15 minutes."}
                    </small>
                  </label>
                ) : null}
              </>
              <p className="muted">Visible to signed-in SkillSwap learners.</p>
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Publishing…" : clips ? "Publish Veel" : "Publish post"}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {loadError && (
            <div className="circle-feed-notice">
              <p role="status">{loadError}</p>
              <button
                type="button"
                className="text-link"
                onClick={() => setReload((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!clips && (
            <div className="tabs" role="group" aria-label="Feed filters">
              {(
                [
                  ["all", "All updates"],
                  ["posts", "Posts"],
                  ["milestones", "Milestones"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {loading && !entries.length && (
            <p role="status">Loading {clips ? "clips" : "the feed"}…</p>
          )}
          {!loading && !loadError && !entries.length && (
            <p className="panel muted">
              {clips
                ? "There are no community Veels yet."
                : "No updates in this view yet."}
            </p>
          )}
          <div className={clips ? "study-clip-grid" : "study-feed-list"}>
            {entries.map((entry) => {
              if (entry.kind === "milestone") {
                const proof = entry.proof;
                const author = data.people.find(
                  (person) => person.id === proof.author_id,
                );
                const link = safeLink(proof.evidence_url || "");
                return (
                  <article
                    key={`milestone-${proof.id}`}
                    className="panel circle-post"
                  >
                    <div className="circle-post-type">
                      <Trophy size={15} /> Milestone{" "}
                      <span className="badge">{proof.category}</span>
                    </div>
                    <h3>{proof.title}</h3>
                    <p>{proof.description}</p>
                    {link && (
                      <a
                        className="text-link"
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open supporting work <ArrowUpRight size={13} />
                      </a>
                    )}
                    <footer>
                      <small>
                        {author?.full_name || author?.username || "Learner"} ·{" "}
                        {dateLabel(proof.created_at)}
                      </small>
                      {proof.author_id === data.userId && (
                        <button
                          className="text-link"
                          onClick={() => removeMilestone(proof.id)}
                        >
                          Remove
                        </button>
                      )}
                    </footer>
                    {discussionReady && (
                      <StudyDiscussion
                        kind="milestone"
                        id={proof.id}
                        author={proof.author_id}
                        viewer={data.userId}
                        engagement={engagement[`milestone:${proof.id}`]}
                        update={updateEngagement}
                      />
                    )}
                  </article>
                );
              }
              const post = entry.post;
              return (
                <article key={post.id} className="panel circle-post">
                  {(post.youtube_id || post.media_type) && (
                    <div className="circle-clip-media">
                      {playing === post.id &&
                      post.youtube_id &&
                      /^[A-Za-z0-9_-]{11}$/.test(post.youtube_id) ? (
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${post.youtube_id}?autoplay=1`}
                          title={post.title}
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      ) : playing === post.id && post.videoUrl ? (
                        <video
                          src={post.videoUrl}
                          controls
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <button
                          type="button"
                          className="circle-clip-play"
                          disabled={!post.youtube_id && !post.videoUrl}
                          onClick={() => setPlaying(post.id)}
                        >
                          <Play size={27} />{" "}
                          {post.youtube_id
                            ? "Play YouTube clip"
                            : post.videoUrl
                              ? "Play uploaded clip"
                              : "Video unavailable"}
                        </button>
                      )}
                    </div>
                  )}
                  {!clips && (
                    <div className="circle-post-type">
                      <MessageSquare size={15} /> Learning post
                    </div>
                  )}
                  <h3>{post.title}</h3>
                  {post.body && <p>{post.body}</p>}
                  <footer>
                    <small>
                      {post.author} · {dateLabel(post.created_at)}
                    </small>
                    {post.author_id === data.userId && (
                      <button
                        className="text-link"
                        disabled={busy}
                        onClick={() => void remove(post.id)}
                      >
                        Remove
                      </button>
                    )}
                  </footer>
                  {discussionReady && (
                    <StudyDiscussion
                      kind="post"
                      id={post.id}
                      author={post.author_id}
                      viewer={data.userId}
                      engagement={engagement[`post:${post.id}`]}
                      update={updateEngagement}
                    />
                  )}
                </article>
              );
            })}
          </div>
          {connected && !loadError && (
            <button
              className="text-link circle-refresh"
              disabled={loading}
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCw size={15} /> {clips ? "Refresh Veels" : "Refresh feed"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
