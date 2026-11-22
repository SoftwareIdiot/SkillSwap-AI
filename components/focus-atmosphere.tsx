"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  AudioLines,
  CloudRain,
  Flame,
  Leaf,
  Moon,
  Play,
  Radio,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { loadFocusVideoAPI, type FocusVideoPlayer } from "@/lib/focus-video";
import { youtubeId } from "@/lib/recommendations";
import { connectSoundscape } from "@/lib/focus-audio";
import {
  backgroundHistory,
  focusBackgrounds,
  recordings,
  rememberBackground,
  soundscapes,
  type FocusBackground,
  type SoundscapeId,
} from "@/lib/focus-library";

const soundIcons = {
  off: VolumeX,
  rain: CloudRain,
  forest: Leaf,
  ocean: Waves,
  fire: Flame,
  brown: AudioLines,
  pink: Radio,
  tones: Moon,
};

function BackgroundChoices({
  items,
  selected,
  select,
  recent = false,
}: {
  items: readonly FocusBackground[];
  selected: string | null;
  select: (item: FocusBackground) => void;
  recent?: boolean;
}) {
  return (
    <div
      className={
        recent ? "focus-background-grid is-recent" : "focus-background-grid"
      }
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="focus-background-choice"
          aria-label={"Play " + item.title}
          aria-pressed={selected === item.id}
          title={item.title}
          onClick={() => select(item)}
        >
          <img
            src={"https://i.ytimg.com/vi/" + item.id + "/mqdefault.jpg"}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span>{item.title}</span>
          <Play size={12} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function VolumeSlider({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (volume: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="focus-volume"
      style={{ "--focus-volume": value + "%" } as CSSProperties}
    >
      <div>
        <label htmlFor={id}>
          <Volume2 size={13} aria-hidden="true" />
          {label}
        </label>
        <span aria-hidden="true">{value}%</span>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        step="1"
        value={value}
        aria-valuetext={value + "%"}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

export default function FocusAtmosphere({
  active,
  showSettings = true,
  allowVideo = true,
  userId = "local-learner",
  toolbar,
  children,
}: {
  active: boolean;
  showSettings?: boolean;
  allowVideo?: boolean;
  userId?: string;
  toolbar?: ReactNode;
  children?: ReactNode;
}) {
  const panelId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [sound, setSound] = useState<SoundscapeId>("off");
  const [volume, setVolume] = useState(20);
  const [soundError, setSoundError] = useState("");
  const [soundLoading, setSoundLoading] = useState(false);
  const audio = useRef<{
    context: AudioContext;
    gain: GainNode;
    request: AbortController;
  } | null>(null);
  const [link, setLink] = useState("");
  const [video, setVideo] = useState<string | null>(null);
  const [videoVolume, setVideoVolume] = useState(20);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState("");
  const videoHost = useRef<HTMLDivElement>(null);
  const videoPlayer = useRef<FocusVideoPlayer | null>(null);
  const latestVideoVolume = useRef(videoVolume);
  const selectedTitle = useRef<FocusBackground>({
    id: "",
    title: "YouTube background",
  });
  const historyKey = "skillswap.focus-backgrounds." + userId;
  const [recent, setRecent] = useState<FocusBackground[]>([]);
  const recentRef = useRef<FocusBackground[]>([]);

  useEffect(() => {
    if (!allowVideo) return;
    const restore = () => {
      try {
        const saved = backgroundHistory(localStorage.getItem(historyKey));
        recentRef.current = saved;
        setRecent(saved);
      } catch {
        /* History remains available for this visit if storage is blocked. */
      }
    };
    restore();
    const sync = (event: StorageEvent) => {
      if (event.key === historyKey || event.key === null) restore();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [allowVideo, historyKey]);

  const rememberPlayed = useCallback(
    (id: string, title: string) => {
      let previous = recentRef.current;
      try {
        const stored = localStorage.getItem(historyKey);
        if (stored !== null) previous = backgroundHistory(stored);
      } catch {}
      const next = rememberBackground(previous, { id, title });
      recentRef.current = next;
      setRecent(next);
      try {
        localStorage.setItem(historyKey, JSON.stringify(next));
      } catch {}
    },
    [historyKey],
  );

  const stopSound = useCallback(() => {
    const engine = audio.current;
    audio.current = null;
    if (engine) {
      engine.request.abort();
      void engine.context.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setSound("off");
      setSoundLoading(false);
      setSoundError("");
      setVideo(null);
      setVideoReady(false);
      setVideoError("");
    }
    return stopSound;
  }, [active, stopSound]);

  useEffect(() => {
    const panel = dialog.current;
    if (
      (!active || !showSettings) &&
      panel?.hidePopover &&
      panel.matches(":popover-open")
    )
      panel.hidePopover();
  }, [active, showSettings]);

  useEffect(() => {
    const host = videoHost.current;
    if (!video || !allowVideo || !active || !host) return;

    let disposed = false;
    let player: FocusVideoPlayer | undefined;
    const frame = document.createElement("iframe");
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: video,
      controls: "0",
      playsinline: "1",
      rel: "0",
      enablejsapi: "1",
      origin: window.location.origin,
    });
    frame.src =
      "https://www.youtube-nocookie.com/embed/" + video + "?" + params;
    frame.title = "YouTube study background";
    frame.tabIndex = -1;
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    host.append(frame);

    const timeout = window.setTimeout(() => {
      setVideoError("YouTube controls are taking a while to load.");
    }, 15000);
    void loadFocusVideoAPI()
      .then((api) => {
        if (disposed) return;
        player = new api.Player(frame, {
          events: {
            onReady: ({ target }) => {
              if (disposed) return;
              window.clearTimeout(timeout);
              target.mute();
              target.setVolume(latestVideoVolume.current);
              videoPlayer.current = target;
              setVideoReady(true);
              setVideoError("");
            },
            onError: () => {
              if (disposed) return;
              window.clearTimeout(timeout);
              setVideoReady(false);
              setVideoError(
                "This YouTube video could not play here. Try another link.",
              );
            },
            onAutoplayBlocked: () => {
              if (!disposed)
                setVideoError(
                  "Playback was blocked. Press Play background to start it.",
                );
            },
            onStateChange: ({ data, target }) => {
              if (disposed || data !== 1) return;
              setVideoError("");
              const title = target.getIframe().title;
              rememberPlayed(
                video,
                selectedTitle.current.id === video &&
                  selectedTitle.current.title !== "YouTube background"
                  ? selectedTitle.current.title
                  : title && title !== "YouTube video player"
                    ? title
                    : "YouTube background",
              );
            },
          },
        });
      })
      .catch(() => {
        if (disposed) return;
        window.clearTimeout(timeout);
        setVideoError(
          "YouTube sound controls could not load. Remove the background and try again.",
        );
      });

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      videoPlayer.current = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [active, allowVideo, rememberPlayed, video]);

  async function selectSound(next: SoundscapeId) {
    setSoundError("");
    if (next === "off") {
      stopSound();
      setSoundLoading(false);
      setSound("off");
      return;
    }
    if (sound === next && audio.current) {
      try {
        await audio.current.context.resume();
      } catch {
        setSoundError("Select another soundscape and try again.");
      }
      return;
    }
    stopSound();
    let engine: NonNullable<typeof audio.current> | undefined;
    try {
      const context = new AudioContext();
      const gain = context.createGain();
      gain.gain.value = volume / 100;
      gain.connect(context.destination);
      engine = { context, gain, request: new AbortController() };
      audio.current = engine;
      setSound(next);
      setSoundLoading(true);
      const resumed = context.resume();
      await Promise.all([
        resumed,
        connectSoundscape(context, next, gain, engine.request.signal),
      ]);
      if (audio.current === engine) setSoundLoading(false);
    } catch {
      if (engine && audio.current !== engine) return;
      stopSound();
      setSoundLoading(false);
      setSound("off");
      setSoundError(
        "This sound could not play. Choose another soundscape or try again.",
      );
    }
  }

  function selectBackground(item: FocusBackground) {
    setLink("https://www.youtube.com/watch?v=" + item.id);
    selectedTitle.current = item;
    setVideoError("");
    if (video === item.id) {
      videoPlayer.current?.playVideo();
      return;
    }
    setVideoMuted(true);
    setVideoReady(false);
    setVideo(item.id);
  }

  function changeVolume(next: number) {
    setVolume(next);
    const engine = audio.current;
    if (engine)
      engine.gain.gain.setTargetAtTime(
        next / 100,
        engine.context.currentTime,
        0.035,
      );
  }

  function toggleVideoSound() {
    const player = videoPlayer.current;
    if (!player) return;
    if (videoMuted) {
      player.setVolume(videoVolume);
      player.unMute();
      player.playVideo();
    } else {
      player.mute();
    }
    setVideoMuted(!videoMuted);
  }

  const settingsButton = (
    <button
      type="button"
      hidden={!showSettings}
      className="focus-atmosphere-toggle btn secondary"
      popoverTarget={panelId}
      aria-haspopup="dialog"
    >
      {allowVideo ? "Sound & background" : "Personal sound"}
    </button>
  );

  return (
    <>
      {allowVideo && active && video && (
        <div ref={videoHost} className="focus-video" aria-hidden="true" />
      )}
      {toolbar ? (
        <div className="focus-room-actions">
          {settingsButton}
          {toolbar}
        </div>
      ) : (
        settingsButton
      )}
      <dialog
        ref={dialog}
        id={panelId}
        popover="auto"
        className="focus-settings-dialog"
        aria-labelledby={panelId + "-title"}
      >
        <div className="focus-drawer-head">
          <div>
            <h2 id={panelId + "-title"} className="focus-settings-title">
              {allowVideo ? "Focus settings" : "Personal sound"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            popoverTarget={panelId}
            popoverTargetAction="hide"
            aria-label="Close focus settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="focus-atmosphere">
          <section
            className="focus-audio-section"
            aria-labelledby={panelId + "-sound"}
          >
            <h3 id={panelId + "-sound"}>Soundscape</h3>
            <div className="focus-sound-choices">
              {soundscapes.map(({ id, label, detail }) => {
                const Icon = soundIcons[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={"btn sound-choice sound-choice--" + id}
                    title={detail}
                    aria-pressed={sound === id}
                    onClick={() => selectSound(id)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <VolumeSlider
              id={panelId + "-volume"}
              label="Soundscape volume"
              value={volume}
              onChange={changeVolume}
            />
            {soundLoading && <small role="status">Loading soundscape...</small>}
            {soundError && (
              <p className="form-error" role="alert">
                {soundError}
              </p>
            )}
          </section>

          {allowVideo && (
            <section
              className="focus-audio-section"
              aria-labelledby={panelId + "-video"}
            >
              <h3 id={panelId + "-video"}>Choose a background</h3>
              <BackgroundChoices
                items={focusBackgrounds}
                selected={video}
                select={selectBackground}
              />
              <div className="focus-background-history">
                <h4>
                  Recently played <span>On this device</span>
                </h4>
                {recent.length ? (
                  <BackgroundChoices
                    items={recent}
                    selected={video}
                    select={selectBackground}
                    recent
                  />
                ) : (
                  <small>Your last four backgrounds will appear here.</small>
                )}
              </div>
              <form
                className="focus-video-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const id = youtubeId(link);
                  if (!id) {
                    setVideoError("Enter a valid HTTPS YouTube video link.");
                    return;
                  }
                  selectBackground(
                    focusBackgrounds.find((item) => item.id === id) || {
                      id,
                      title: "YouTube background",
                    },
                  );
                }}
              >
                <label>
                  <span className="sr-only">YouTube video link</span>
                  <input
                    type="url"
                    value={link}
                    onChange={(event) => setLink(event.currentTarget.value)}
                    placeholder="Paste a YouTube link"
                  />
                </label>
                <button
                  className="btn secondary"
                  aria-label="Play background"
                  title="Play background"
                >
                  <Play size={15} />
                </button>
              </form>
              {video && (
                <>
                  <VolumeSlider
                    id={panelId + "-video-volume"}
                    label="YouTube volume"
                    value={videoVolume}
                    disabled={!videoReady}
                    onChange={(next) => {
                      latestVideoVolume.current = next;
                      setVideoVolume(next);
                      videoPlayer.current?.setVolume(next);
                    }}
                  />
                  <div className="button-row">
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={!videoReady}
                      onClick={toggleVideoSound}
                    >
                      {videoMuted ? "Enable video sound" : "Mute video"}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        setVideo(null);
                        setVideoReady(false);
                        setVideoError("");
                      }}
                    >
                      Remove background
                    </button>
                  </div>
                </>
              )}
              {videoError ? (
                <p className="form-error" role="alert">
                  {videoError}
                </p>
              ) : (
                <small role="status">
                  {video && !videoReady
                    ? "Loading YouTube controls..."
                    : "Videos loop and start muted."}
                </small>
              )}
            </section>
          )}
          <details className="focus-sound-credits">
            <summary>Sound credits</summary>
            {Object.entries(recordings).map(
              ([id, track]) =>
                track && (
                  <p key={id}>
                    <a href={track.source} target="_blank" rel="noreferrer">
                      {soundscapes.find((item) => item.id === id)?.label}
                    </a>{" "}
                    by {track.author}.{" "}
                    {track.licenseUrl ? (
                      <a
                        href={track.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {track.license}
                      </a>
                    ) : (
                      track.license
                    )}
                    .
                  </p>
                ),
            )}
            <p>Recordings use a short crossfade for looping.</p>
          </details>
          {children}
        </div>
      </dialog>
    </>
  );
}
