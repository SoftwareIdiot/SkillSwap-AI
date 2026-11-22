export type FocusVideoPlayer = {
  getIframe: () => HTMLIFrameElement;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};

type PlayerEvent = { target: FocusVideoPlayer };
type PlayerOptions = {
  events: {
    onReady: (event: PlayerEvent) => void;
    onError: () => void;
    onAutoplayBlocked: () => void;
    onStateChange: (event: PlayerEvent & { data: number }) => void;
  };
};

type YouTubeAPI = {
  Player: new (
    frame: HTMLIFrameElement,
    options: PlayerOptions,
  ) => FocusVideoPlayer;
};

let pending: Promise<YouTubeAPI> | undefined;

export function loadFocusVideoAPI() {
  const page = window as Window & {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (page.YT?.Player) return Promise.resolve(page.YT);
  if (pending) return pending;

  pending = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = page.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(failed, 12000);
    const ready = () => {
      if (page.YT?.Player) {
        cleanup();
        resolve(page.YT);
      }
      previous?.();
    };

    function cleanup() {
      window.clearTimeout(timeout);
      script.onerror = null;
      if (page.onYouTubeIframeAPIReady === ready)
        page.onYouTubeIframeAPIReady = previous;
    }

    function failed() {
      cleanup();
      script.remove();
      reject(new Error("YouTube player controls could not load."));
    }

    page.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = failed;
    document.head.append(script);
  }).catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
