import { youtubeId } from "./recommendations.ts";

export type DiscoveryMode = "research" | "veels" | "feed";
export type ResourceKind = "video" | "pdf" | "article" | "news";
export type LearningResource = {
  url: string;
  title: string;
  source: string;
  kind: ResourceKind;
  note: string;
  date?: string;
  short?: boolean;
  starter?: true;
};

const newsrooms = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "npr.org",
  "theconversation.com",
  "nasa.gov",
  "who.int",
  "un.org",
  "nature.com",
  "sciencemag.org",
  "science.org",
];
const educational = [
  "arxiv.org",
  "khanacademy.org",
  "freecodecamp.org",
  "wikipedia.org",
  "mozilla.org",
  "python.org",
  "microsoft.com",
  "google.com",
  "openstax.org",
  "owasp.org",
  "ietf.org",
  "w3.org",
  "github.com",
  "edx.org",
  "coursera.org",
];
const within = (host: string, domain: string) =>
  host === domain || host.endsWith("." + domain);
const trusted = (host: string) =>
  /\.(edu|gov|ac\.uk|ac\.in|edu\.au|gov\.in|gov\.uk)$/.test(host) ||
  [...newsrooms, ...educational].some((domain) => within(host, domain));

export function publicResourceUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) ||
      /\.(local|localhost|internal|test|invalid)$/.test(url.hostname)
    )
      return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["fbclid", "gclid", "si"].includes(key))
        url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
}

export function videoPlayer(value: string) {
  const url = publicResourceUrl(value);
  if (!url) return null;
  const youtube = youtubeId(url.href);
  if (youtube)
    return {
      type: "embed" as const,
      url: `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`,
    };
  const vimeo = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(
    url.hostname,
  )
    ? url.pathname.match(/^\/(?:video\/)?(\d{1,14})\/?$/)?.[1]
    : null;
  if (vimeo)
    return {
      type: "embed" as const,
      url: `https://player.vimeo.com/video/${vimeo}?autoplay=1`,
    };
  if (/\.(mp4|webm)$/i.test(url.pathname))
    return { type: "file" as const, url: url.href };
  return null;
}

type SearchCandidate = {
  url?: unknown;
  title?: unknown;
  published_date?: unknown;
  publishedDate?: unknown;
};
type SearchMessage = {
  content?: unknown;
  executed_tools?: {
    name?: unknown;
    search_results?: { results?: SearchCandidate[] };
  }[];
};

function key(url: URL) {
  const video = youtubeId(url.href);
  if (video) return "youtube:" + video;
  const sorted = new URL(url);
  sorted.searchParams.sort();
  return sorted.href.replace(/\/$/, "");
}

function selected(content: unknown): { url?: unknown; note?: unknown }[] {
  if (typeof content !== "string") return [];
  const json = content.match(/\{\s*"picks"\s*:[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const result = JSON.parse(json);
      if (Array.isArray(result.picks)) return result.picks.slice(0, 16);
    } catch {
      // Some tool responses use prose or Markdown around grounded links.
    }
  }
  return Array.from(content.matchAll(/https:\/\/[^\s<>"\])]+/g), ([url]) => ({
    url: url.replace(/[.,;]+$/, ""),
  })).slice(0, 16);
}

export function extractLearningResources(
  message: SearchMessage,
  mode: DiscoveryMode,
  now = Date.now(),
) {
  const found = new Map<string, LearningResource>();
  for (const call of message.executed_tools || []) {
    if (call.name !== "browser.search") continue;
    for (const candidate of call.search_results?.results || []) {
      const url =
        typeof candidate.url === "string" && publicResourceUrl(candidate.url);
      if (!url || typeof candidate.title !== "string") continue;
      const title = candidate.title.replace(/\s+/g, " ").trim().slice(0, 180);
      if (!title) continue;
      const source = url.hostname.replace(/^www\./, "");
      const player = videoPlayer(url.href);
      const short = Boolean(
        youtubeId(url.href) && url.pathname.startsWith("/shorts/"),
      );
      const dateValue = candidate.published_date ?? candidate.publishedDate;
      const timestamp =
        typeof dateValue === "string" ? Date.parse(dateValue) : NaN;
      const date =
        Number.isFinite(timestamp) && timestamp <= now
          ? new Date(timestamp).toISOString().slice(0, 10)
          : undefined;
      const news = newsrooms.some((domain) => within(source, domain));
      const kind = player
        ? "video"
        : /\.pdf$/i.test(url.pathname)
          ? "pdf"
          : news
            ? "news"
            : "article";
      if (mode === "veels" && !short && kind !== "news") continue;
      if (mode === "feed" && short) continue;
      if (mode !== "research" && kind !== "video" && !trusted(source)) continue;
      if (
        mode !== "research" &&
        kind === "video" &&
        player?.type !== "embed" &&
        !trusted(source)
      )
        continue;
      if (
        mode !== "research" &&
        kind === "news" &&
        date &&
        now - timestamp > 45 * 86400000
      )
        continue;
      const id = key(url);
      if (!found.has(id) || short)
        found.set(id, {
          url: url.href,
          title,
          source,
          kind,
          note: "",
          date,
          short,
        });
    }
  }
  const picks: LearningResource[] = [];
  for (const pick of selected(message.content)) {
    const url = typeof pick?.url === "string" && publicResourceUrl(pick.url);
    if (!url) continue;
    const id = key(url);
    const resource = found.get(id);
    if (!resource) continue;
    const note =
      typeof pick.note === "string"
        ? pick.note.replace(/\s+/g, " ").trim().slice(0, 240)
        : "";
    picks.push({ ...resource, note });
    found.delete(id);
  }
  if (mode !== "research") return picks.slice(0, 12);
  const leading: LearningResource[] = [];
  for (const kind of ["video", "pdf", "article", "news"] as const) {
    if (picks.some((item) => item.kind === kind)) continue;
    const candidate = [...found].find(([, item]) => item.kind === kind);
    if (!candidate) continue;
    leading.push(candidate[1]);
    found.delete(candidate[0]);
  }
  return [
    ...picks.slice(0, 8),
    ...leading,
    ...picks.slice(8),
    ...found.values(),
  ].slice(0, 12);
}
