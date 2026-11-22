export const clipLimit = 20 * 1024 * 1024;
export const lessonLimit = 40 * 1024 * 1024;
export const clipDuration = 90;
export const lessonDuration = 15 * 60;
export const clipTypes = ["video/mp4", "video/webm"] as const;
export type FeedKind = "post" | "clip";
export type StudyPost = {
  id: string;
  author_id: string;
  kind: FeedKind;
  title: string;
  body: string;
  youtube_id: string | null;
  media_type: string | null;
  created_at: string;
  author: string;
  videoUrl: string | null;
};

export async function clipType(file: Blob) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp")
    return "video/mp4";
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "video/webm";
  return null;
}
