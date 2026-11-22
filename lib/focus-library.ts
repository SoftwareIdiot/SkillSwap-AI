export const soundscapes = [
  { id: "off", label: "Silence", detail: "A quiet room" },
  { id: "rain", label: "Soft rain", detail: "Gentle rainfall" },
  { id: "forest", label: "Forest", detail: "Morning birds" },
  { id: "ocean", label: "Ocean", detail: "Rolling waves" },
  { id: "fire", label: "Campfire", detail: "Warm crackles" },
  { id: "brown", label: "Deep noise", detail: "Low and steady" },
  { id: "pink", label: "Pink noise", detail: "Balanced texture" },
  { id: "tones", label: "Soft tones", detail: "Soft sustained notes" },
] as const;
export type SoundscapeId = (typeof soundscapes)[number]["id"];

export const recordings: Partial<
  Record<
    SoundscapeId,
    {
      file: string;
      author: string;
      source: string;
      license: string;
      licenseUrl?: string;
    }
  >
> = {
  rain: {
    file: "/audio/focus/rain.mp3",
    author: "ezwa",
    source: "https://commons.wikimedia.org/wiki/File:Rain_(1).ogg",
    license: "Public domain",
  },
  forest: {
    file: "/audio/focus/forest.mp3",
    author: "Barracuda1983",
    source: "https://commons.wikimedia.org/wiki/File:Birds_forest.ogg",
    license: "Public domain",
  },
  ocean: {
    file: "/audio/focus/ocean.mp3",
    author: "Luftrum",
    source: "https://commons.wikimedia.org/wiki/File:Oceanwavescrushing.ogg",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
  fire: {
    file: "/audio/focus/fire.mp3",
    author: "Glaneur de sons",
    source:
      "https://commons.wikimedia.org/wiki/File:Campfire_sound_ambience.ogg",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  },
};

export type FocusBackground = { id: string; title: string };
export const focusBackgrounds: readonly FocusBackground[] = [
  { id: "GfYkRRH2ScQ", title: "Rainy neon night" },
  { id: "2jIMBAcrXPg", title: "Forest stream" },
  { id: "SNA2eDDLI3E", title: "Ocean shore" },
  { id: "RjZvN8b_Yuk", title: "Cozy fireplace" },
];

export function backgroundHistory(raw: string | null): FocusBackground[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    const found = new Set<string>();
    return value
      .filter((item): item is FocusBackground => {
        if (
          !item ||
          typeof item.id !== "string" ||
          !/^[\w-]{11}$/.test(item.id) ||
          typeof item.title !== "string" ||
          !item.title.trim() ||
          found.has(item.id)
        )
          return false;
        found.add(item.id);
        return true;
      })
      .slice(0, 4)
      .map(({ id, title }) => ({ id, title: title.trim().slice(0, 120) }));
  } catch {
    return [];
  }
}

export function rememberBackground(
  previous: FocusBackground[],
  next: FocusBackground,
) {
  return backgroundHistory(
    JSON.stringify([next, ...previous.filter((item) => item.id !== next.id)]),
  );
}
