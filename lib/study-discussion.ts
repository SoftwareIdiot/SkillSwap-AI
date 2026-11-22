export type EntryKind = "post" | "milestone";
export type ReportKind = EntryKind | "reply";
export const reportReasons = {
  spam: "Spam or misleading content",
  harassment: "Harassment or bullying",
  unsafe: "Unsafe content or exposed personal information",
  other: "Other",
} as const;
export type ReportReason = keyof typeof reportReasons;

export type Engagement = {
  kind: EntryKind;
  target_id: string;
  replies: number;
  helpful: number;
  reacted: boolean;
};
export type StudyReply = {
  id: string;
  author_id: string;
  author: string;
  body: string;
  created_at: string;
};
export type StudyReport = {
  id: string;
  target_kind: ReportKind;
  title: string;
  excerpt: string;
  reason: ReportReason;
  details: string;
  created_at: string;
  youtubeId: string | null;
  videoUrl: string | null;
};
