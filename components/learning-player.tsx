"use client";

import { useEffect, useRef, useState } from "react";
import { loadFocusVideoAPI, type FocusVideoPlayer } from "@/lib/focus-video";
import { youtubeId } from "@/lib/recommendations";
import { videoPlayer } from "@/lib/discovery";

export default function LearningPlayer({
  url,
  title,
  muted = false,
  onEnded,
}: {
  url: string;
  title: string;
  muted?: boolean;
  onEnded?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const file = useRef<HTMLVideoElement>(null);
  const api = useRef<FocusVideoPlayer | null>(null);
  const initialMuted = useRef(muted);
  const callbacks = useRef({ muted, onEnded });
  callbacks.current = { muted, onEnded };
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const id = youtubeId(url);
  const player = videoPlayer(url);
  useEffect(() => {
    let disposed = false;
    setFailed(false);
    setBlocked(false);
    if (!id) return;
    void loadFocusVideoAPI()
      .then((youtube) => {
        if (disposed || !frame.current) return;
        api.current = new youtube.Player(frame.current, {
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              if (callbacks.current.muted) target.mute();
              else target.unMute();
              if (document.visibilityState === "visible") target.playVideo();
            },
            onStateChange: ({ data }) => {
              if (!disposed && data === 0) callbacks.current.onEnded?.();
              if (!disposed && data === 1) setBlocked(false);
            },
            onError: () => {
              if (!disposed) setFailed(true);
            },
            onAutoplayBlocked: () => {
              if (!disposed) setBlocked(true);
            },
          },
        });
      })
      .catch(() => {
        if (!disposed) setBlocked(true);
      });
    return () => {
      disposed = true;
      api.current?.destroy();
      api.current = null;
    };
  }, [id]);
  useEffect(() => {
    if (muted) api.current?.mute();
    else api.current?.unMute();
  }, [muted]);
  useEffect(() => {
    const pause = () => {
      if (document.hidden) {
        api.current?.pauseVideo();
        file.current?.pause();
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, []);
  if (failed || !player)
    return (
      <div className="learning-player-error">
        <p>This video cannot play here.</p>
        <a href={url} target="_blank" rel="noreferrer">
          Watch at the source ↗
        </a>
      </div>
    );
  return (
    <>
      {id ? (
        <iframe
          ref={frame}
          title={title}
          src={`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&mute=${initialMuted.current ? 1 : 0}${typeof location !== "undefined" ? "&origin=" + encodeURIComponent(location.origin) : ""}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : player.type === "file" ? (
        <video
          ref={file}
          src={player.url}
          aria-label={title}
          controls
          autoPlay
          playsInline
          muted={muted}
          onEnded={onEnded}
          preload="metadata"
        />
      ) : (
        <iframe
          title={title}
          src={player.url}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}
      {blocked && (
        <button
          type="button"
          className="learning-resume"
          onClick={() => {
            api.current?.playVideo();
            void file.current?.play().catch(() => {});
            setBlocked(false);
          }}
        >
          Play video
        </button>
      )}
    </>
  );
}
