"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Play, Search, X } from "lucide-react";
import { videoPlayer, type LearningResource } from "@/lib/discovery";
import { youtubeId } from "@/lib/recommendations";
import LearningPlayer from "./learning-player";

export default function VideoFeed({
  resources,
}: {
  resources: LearningResource[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LearningResource | null>(null);
  const [autoNext, setAutoNext] = useState(false);
  const videos = useMemo(
    () => resources.filter((item) => videoPlayer(item.url) && !item.short),
    [resources],
  );
  const visible = videos.filter((item) =>
    `${item.title} ${item.source} ${item.note}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const reads = resources.filter((item) => !videoPlayer(item.url));
  const next = selected
    ? videos[
        (videos.findIndex((item) => item.url === selected.url) + 1) %
          videos.length
      ]
    : null;
  const select = (item: LearningResource) => {
    setSelected(item);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  return (
    <div className="video-library">
      <div className="video-library-bar">
        <span>{videos.length} lessons · ordered for your studies</span>
        <label className="video-library-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Find a lesson or creator…"
            aria-label="Search learning videos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {selected && (
        <section className="lesson-theater" aria-label="Now watching">
          <div className="lesson-player" key={selected.url}>
            <LearningPlayer
              url={selected.url}
              title={selected.title}
              onEnded={() => {
                if (autoNext && next) setSelected(next);
              }}
            />
          </div>
          <div className="lesson-detail">
            <span className="eyebrow">NOW LEARNING</span>
            <h2>{selected.title}</h2>
            <p>{selected.source}</p>
            <p>{selected.note}</p>
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              Open original ↗
            </a>
            <label className="lesson-auto">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => setAutoNext(e.target.checked)}
              />
              Play next automatically
            </label>
            {next && next.url !== selected.url && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelected(next)}
              >
                Next lesson <ArrowRight size={16} />
              </button>
            )}
            <button
              type="button"
              className="text-link"
              onClick={() => setSelected(null)}
            >
              <X size={14} />
              Close player
            </button>
          </div>
        </section>
      )}
      <div className="lesson-grid">
        {visible.map((item, index) => (
          <article className="lesson-card" key={item.url}>
            <button
              className="lesson-cover"
              type="button"
              onClick={() => select(item)}
              aria-label={`Watch ${item.title}`}
              aria-pressed={selected?.url === item.url}
            >
              {youtubeId(item.url) && (
                <img
                  src={`https://i.ytimg.com/vi/${youtubeId(item.url)}/hqdefault.jpg`}
                  alt=""
                  loading={index < 3 ? "eager" : "lazy"}
                  decoding="async"
                />
              )}
              <span className="lesson-play">
                <Play size={22} />
              </span>
              <span className="lesson-cover-label">
                {selected?.url === item.url ? "Now playing" : "Watch lesson"}
              </span>
            </button>
            <div className="lesson-copy">
              <span className="lesson-creator">
                {item.source}
                {item.starter ? " · Curated" : " · AI discovery"}
              </span>
              <button
                type="button"
                onClick={() => select(item)}
                className="lesson-title"
              >
                {item.title}
              </button>
              <p>{item.note}</p>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <p className="muted">
          No lessons match this search. Try a broader keyword.
        </p>
      )}
      {reads.length > 0 && (
        <section className="lesson-reads">
          <h3>Read alongside your lessons</h3>
          <div>
            {reads.map((item) => (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                key={item.url}
              >
                <span>
                  {item.kind} · {item.source}
                </span>
                <strong>{item.title}</strong>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
