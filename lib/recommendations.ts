import type { WorkspaceData } from "./workspace.ts";
export function recommendationTerms(data: WorkspaceData) {
  const p = data.personal;
  const text = [
    p.onboarding.answers?.studying,
    p.goal,
    p.interests,
    ...p.journeys.map((j) => j.title),
  ]
    .join(" ")
    .toLowerCase();
  const expanded =
    text +
    (/cse|computer|software|cyber/.test(text)
      ? " development programming python frontend sql security"
      : "") +
    (/design|figma/.test(text) ? " ui design research" : "");
  return [...new Set(expanded.match(/[a-z]{3,}/g) || [])].filter(
    (w) =>
      ![
        "the",
        "and",
        "with",
        "for",
        "learn",
        "through",
        "practical",
        "work",
      ].includes(w),
  );
}
export function relevance(text: string, data: WorkspaceData) {
  const haystack = text.toLowerCase();
  return recommendationTerms(data).filter((w) => haystack.includes(w)).length;
}
export function recommend<T>(
  items: T[],
  text: (item: T) => string,
  data: WorkspaceData,
) {
  return items
    .map((item, index) => ({ item, index, score: relevance(text(item), data) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}
export function youtubeId(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    )
      id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1] ||
        null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
