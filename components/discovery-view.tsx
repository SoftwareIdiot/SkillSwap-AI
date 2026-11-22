"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Film,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  videoPlayer,
  type DiscoveryMode,
  type LearningResource,
  type ResourceKind,
} from "@/lib/discovery";
import { starterResources } from "@/lib/discovery-starters";
import type { StudyPost } from "@/lib/study-feed";
import type { WorkspaceData } from "@/lib/workspace";
import { youtubeId } from "@/lib/recommendations";
import "./discovery.css";
import LearningPlayer from "./learning-player";
import VideoFeed from "./video-feed";

const formats = {
  video: "Video",
  pdf: "PDF",
  article: "Article",
  news: "News",
} as const;
const resourceId = (url: string) => youtubeId(url) ?? url;
const dateLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

function Player({
  player,
  title,
}: {
  player: NonNullable<ReturnType<typeof videoPlayer>>;
  title: string;
}) {
  return player.type === "embed" ? (
    <iframe
      title={title}
      src={player.url}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  ) : (
    <video
      src={player.url}
      aria-label={title}
      controls
      autoPlay
      playsInline
      preload="none"
    />
  );
}

function YouTubeCover({ id }: { id: string | null | undefined }) {
  return id ? (
    <img
      className="discovery-thumbnail"
      src={"https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  ) : null;
}

type Reel = {
  id: string;
  title: string;
  source: string;
  note: string;
  resource?: LearningResource;
  post?: StudyPost;
};

function VeelsStack({
  resources,
  community,
  notes,
  openCommunity,
}: {
  resources: LearningResource[];
  community: StudyPost[];
  notes: StudyPost[];
  openCommunity?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [muted, setMuted] = useState(true);
  const items = useMemo(() => {
    const shorts = resources
      .filter((item) => item.short)
      .map((resource): Reel => ({
        id: resourceId(resource.url),
        title: resource.title,
        source: resource.source,
        note: resource.note,
        resource,
      }));
    const items = [...shorts];
    community
      .filter((post) => post.youtube_id || post.videoUrl)
      .slice(0, 4)
      .forEach((post, index) => {
        items.splice(Math.min(items.length, 1 + index * 3), 0, {
          id: post.id,
          title: post.title,
          source: post.author,
          note: post.body,
          post,
        });
      });
    resources
      .filter((item) => item.kind === "news")
      .slice(0, 2)
      .forEach((resource, index) => {
        items.splice(Math.min(items.length, 2 + index * 4), 0, {
          id: resource.url,
          title: resource.title,
          source: resource.source,
          note: resource.note,
          resource,
        });
      });
    notes.forEach((post, index) => {
      items.splice(Math.min(items.length, 3 + index * 5), 0, {
        id: post.id,
        title: post.title,
        source: post.author,
        note: post.body,
        post,
      });
    });
    return items;
  }, [resources, community, notes]);
  useLayoutEffect(() => {
    const previous = items.findIndex((item) => item.id === active.current);
    const index = Math.max(0, previous);
    if (previous < 0) {
      active.current = items[index]?.id ?? null;
    }
    setCurrent(index);
    if (scroller.current)
      scroller.current.scrollTop = index * scroller.current.clientHeight;
  }, [items]);
  useEffect(() => {
    const view = scroller.current;
    if (!view) return;
    const resize = new ResizeObserver(() => {
      const index = items.findIndex((item) => item.id === active.current);
      view.scrollTop = Math.max(0, index) * view.clientHeight;
    });
    resize.observe(view);
    return () => resize.disconnect();
  }, [items]);
  function move(offset: number) {
    const view = scroller.current;
    if (!view) return;
    const index = Math.min(items.length - 1, Math.max(0, current + offset));
    view.scrollTo({
      top: index * view.clientHeight,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  if (!items.length) return null;
  const currentId = active.current ?? items[0]?.id;
  return (
    <div className="veel-view">
      <div
        className="veel-scroll"
        ref={scroller}
        tabIndex={0}
        aria-label="Veels. Use the up and down arrow keys to browse."
        onScroll={(event) => {
          const view = event.currentTarget;
          const index = Math.min(
            items.length - 1,
            Math.max(0, Math.round(view.scrollTop / view.clientHeight)),
          );
          if (index !== current) {
            active.current = items[index]?.id ?? null;
            setCurrent(index);
          }
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
          }
        }}
      >
        {items.map((item, index) => {
          const { post, resource } = item;
          const player = resource
            ? videoPlayer(resource.url)
            : post?.youtube_id
              ? videoPlayer(
                  `https://www.youtube.com/watch?v=${post.youtube_id}`,
                )
              : post?.videoUrl
                ? { type: "file" as const, url: post.videoUrl }
                : null;
          return (
            <article
              className="veel-slide"
              key={item.id}
              aria-label={`${index + 1} of ${items.length}`}
            >
              <div className="veel-media">
                {player && currentId === item.id ? (
                  <LearningPlayer
                    key={item.id}
                    url={
                      resource?.url ??
                      (post?.youtube_id
                        ? `https://www.youtube.com/watch?v=${post.youtube_id}`
                        : (post?.videoUrl ?? ""))
                    }
                    title={item.title}
                    muted={muted}
                    onEnded={() => move(1)}
                  />
                ) : player ? (
                  <button
                    className="veel-play"
                    type="button"
                    onClick={() => {
                      active.current = item.id;
                      move(index - current);
                    }}
                  >
                    <YouTubeCover
                      id={
                        post?.youtube_id ??
                        (resource && youtubeId(resource.url))
                      }
                    />
                    <span className="discovery-play-label">
                      <Play size={24} /> Play{" "}
                      {post ? "community Veel" : "Short"}
                    </span>
                  </button>
                ) : (
                  <div className="veel-news">
                    <BookOpen size={33} />
                    <span className="eyebrow">
                      {post ? "COMMUNITY POST" : "FIELD UPDATE"}
                    </span>
                    <h3>{item.title}</h3>
                  </div>
                )}
              </div>
              <div className="veel-caption">
                <span className="eyebrow">
                  {index + 1 < 10 ? "0" : ""}
                  {index + 1} / LEARN SOMETHING NEW
                </span>
                <div className="veel-source">
                  <span className="badge">
                    {post
                      ? "SkillSwap"
                      : resource?.kind === "news"
                        ? "News"
                        : "YouTube Short"}
                  </span>
                  {resource?.starter && (
                    <span className="badge">Starter pick</span>
                  )}
                  <span>{item.source}</span>
                  {resource?.date && (
                    <time dateTime={resource.date}>
                      {dateLabel(resource.date)}
                    </time>
                  )}
                </div>
                {player && <h3>{item.title}</h3>}
                {item.note && <p>{item.note}</p>}
                {resource && (
                  <a
                    className="text-link"
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source <ArrowUpRight size={14} />
                  </a>
                )}
                {post?.kind === "post" && (
                  <a className="text-link" href="/student?tab=feed">
                    Open Learning Feed <ArrowUpRight size={14} />
                  </a>
                )}
                {post?.kind === "clip" && openCommunity && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={openCommunity}
                  >
                    Open community clips <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="veel-controls" aria-label="Browse Veels">
        <button
          type="button"
          className="icon-btn"
          aria-label={muted ? "Unmute Veels" : "Mute Veels"}
          onClick={() => setMuted((value) => !value)}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={current <= 0}
          aria-label="Previous Veel"
          onClick={() => move(-1)}
        >
          <ArrowUp size={18} />
        </button>
        <span aria-live="polite">
          {current + 1} / {items.length}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={current >= items.length - 1}
          aria-label="Next Veel"
          onClick={() => move(1)}
        >
          <ArrowDown size={18} />
        </button>
      </div>
    </div>
  );
}

const emptyPosts: StudyPost[] = [];

export default function DiscoveryView({
  mode,
  workspace,
  community = emptyPosts,
  notes = emptyPosts,
  openCommunity,
}: {
  mode: DiscoveryMode;
  workspace?: WorkspaceData;
  community?: StudyPost[];
  notes?: StudyPost[];
  openCommunity?: () => void;
}) {
  const research = mode === "research";
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState<string | null>(research ? null : "");
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(!research);
  const [error, setError] = useState("");
  const [personalized, setPersonalized] = useState(false);
  const [stale, setStale] = useState(false);
  const [format, setFormat] = useState<"all" | ResourceKind>("all");
  const [playing, setPlaying] = useState("");
  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (research) setPlaying("");
    void (async () => {
      try {
        const response = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, topic: query }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          if (research || data.results.length > 0) {
            setResults(data.results);
            setPersonalized(data.personalized);
          }
          setStale(Boolean(data.stale));
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Discovery could not load.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [mode, query, research, revision]);

  const starters = useMemo(
    () => (mode === "research" ? [] : starterResources(mode, workspace)),
    [mode, workspace?.personal],
  );
  const resources = useMemo(() => {
    if (research) return results;
    const live = new Set(results.map((item) => resourceId(item.url)));
    return [
      ...results,
      ...starters.filter((item) => !live.has(resourceId(item.url))),
    ];
  }, [research, results, starters]);
  const activeFormat = resources.some((item) => item.kind === format)
    ? format
    : "all";

  const visible =
    activeFormat === "all"
      ? resources
      : resources.filter((item) => item.kind === activeFormat);
  const refresh = () => {
    if (research) setFormat("all");
    setRevision((value) => value + 1);
  };
  return (
    <div className="learning-discovery">
      {research ? (
        <form
          className="panel discovery-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (topic.trim().length < 2) return;
            setResults([]);
            setQuery(topic.trim());
            refresh();
          }}
        >
          <div>
            <span className="eyebrow">
              <Sparkles size={14} /> AI WEB SEARCH
            </span>
            <h2>Find material for what you’re learning</h2>
            <p>
              Search a concept to find PDFs, videos, course notes, and articles
              with their original sources.
            </p>
          </div>
          <label className="discovery-input">
            <Search size={19} />
            <input
              type="search"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              required
              minLength={2}
              maxLength={240}
              aria-label="Study topic"
              placeholder="e.g. Network packet analysis for beginners"
            />
            <button className="btn primary" type="submit" disabled={loading}>
              Search
            </button>
          </label>
        </form>
      ) : (
        <div className="discovery-heading">
          <div>
            <span className="eyebrow">
              <Sparkles size={14} />{" "}
              {results.length ? "AI DISCOVERY" : "STARTER COLLECTION"}
            </span>
            <h3>
              {results.length
                ? personalized
                  ? "Picked for your studies"
                  : "Learning picks"
                : "Start learning now"}
            </h3>
          </div>
          <button
            type="button"
            className="btn secondary"
            disabled={loading}
            onClick={refresh}
          >
            <RefreshCw size={15} /> Refresh picks
          </button>
        </div>
      )}
      {loading && (
        <p className="discovery-status" role="status">
          <span className="live-dot" />{" "}
          {research
            ? "Searching the web for useful sources…"
            : "Looking for fresh picks in the background…"}
        </p>
      )}
      {research && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!research && !loading && (error || stale || !results.length) && (
        <p className="discovery-status" role="status">
          {error || stale
            ? results.length
              ? "Live discovery is temporarily unavailable. Your previous picks and starter resources are still here."
              : "Live discovery is temporarily unavailable. Browse the starter collection below."
            : "Browse the starter collection while more picks become available."}
        </p>
      )}
      {mode === "veels" ? (
        <VeelsStack
          resources={resources}
          community={community}
          notes={notes}
          openCommunity={openCommunity}
        />
      ) : mode === "feed" ? (
        <VideoFeed resources={resources} />
      ) : (
        <>
          {resources.length > 0 && (
            <div
              className="tabs discovery-filters"
              role="group"
              aria-label="Resource type"
            >
              {(["all", "video", "pdf", "article", "news"] as const).map(
                (value) =>
                  (value === "all" ||
                    resources.some((item) => item.kind === value)) && (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={activeFormat === value}
                      className={activeFormat === value ? "active" : ""}
                      onClick={() => setFormat(value)}
                    >
                      {value === "all" ? "All sources" : formats[value]}
                    </button>
                  ),
              )}
            </div>
          )}
          <div className="discovery-grid">
            {visible.map((item) => {
              const player = videoPlayer(item.url);
              const id = resourceId(item.url);
              return (
                <article className="panel discovery-card" key={id}>
                  {player && (
                    <div className="discovery-media">
                      {playing === id ? (
                        <Player player={player} title={item.title} />
                      ) : (
                        <button
                          type="button"
                          className="discovery-play"
                          onClick={() => setPlaying(id)}
                        >
                          <YouTubeCover id={youtubeId(item.url)} />
                          <span className="discovery-play-label">
                            <Film size={20} /> Play video
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                  <div className="discovery-source">
                    <span className="badge">{formats[item.kind]}</span>
                    {item.starter && (
                      <span className="badge">Starter pick</span>
                    )}
                    <span>{item.source}</span>
                    {item.date && (
                      <time dateTime={item.date}>{dateLabel(item.date)}</time>
                    )}
                  </div>
                  <h3>{item.title}</h3>
                  {item.note && <p>{item.note}</p>}
                  <a
                    className="text-link"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.kind === "pdf" ? "Open PDF" : "Open source"}{" "}
                    <ArrowUpRight size={14} />
                  </a>
                </article>
              );
            })}
          </div>
          {research &&
            !loading &&
            !error &&
            query !== null &&
            !results.length && (
              <p className="panel muted">
                No matching sources were found. Try a more specific topic.
              </p>
            )}
        </>
      )}
    </div>
  );
}
