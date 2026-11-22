"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Flag, MessageCircle, Send, ThumbsUp } from "lucide-react";
import {
  reportReasons,
  type Engagement,
  type EntryKind,
  type ReportKind,
  type StudyReply,
} from "@/lib/study-discussion";

export const discussionEndpoint = "/api/groups/discussion";
export async function discussionRequest<T>(
  action: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(discussionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

export default function StudyDiscussion({
  id,
  kind,
  viewer,
  author,
  engagement,
  update,
}: {
  id: string;
  kind: EntryKind;
  viewer: string;
  author: string;
  engagement?: Engagement;
  update: (engagement: Engagement) => void;
}) {
  const threadId = useId();
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<StudyReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<{ id: string; kind: ReportKind }>();
  const [reported, setReported] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(
          `${discussionEndpoint}?kind=${kind}&id=${encodeURIComponent(id)}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setReplies(data.replies);
          update(data.engagement);
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load replies.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id, kind, open, reload, update]);

  async function write(
    action: object,
    onSuccess: (data: { engagement?: Engagement }) => void,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await discussionRequest<{ engagement?: Engagement }>(action);
      onSuccess(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save this update.",
      );
    } finally {
      setBusy(false);
    }
  }

  function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report) return;
    const form = new FormData(event.currentTarget);
    void write(
      {
        action: "report",
        ...report,
        reason: form.get("reason"),
        details: form.get("details"),
      },
      () => {
        setReported((previous) => [...previous, report.id]);
        setReport(undefined);
        setNotice("Report submitted for review.");
      },
    );
  }

  return (
    <div className="circle-discussion">
      <div className="circle-discussion-actions">
        <button
          type="button"
          className="circle-discussion-button"
          disabled={busy || !engagement}
          aria-pressed={engagement?.reacted || false}
          onClick={() =>
            void write(
              { action: "helpful", id, kind, active: !engagement?.reacted },
              (data) => {
                if (data.engagement) update(data.engagement);
              },
            )
          }
        >
          <ThumbsUp size={15} /> Helpful{" "}
          {engagement ? <span>{engagement.helpful}</span> : null}
        </button>
        <button
          type="button"
          className="circle-discussion-button"
          aria-controls={threadId}
          aria-expanded={open}
          onClick={() => {
            setError("");
            setOpen((value) => !value);
          }}
        >
          <MessageCircle size={15} /> Replies{" "}
          {engagement ? <span>{engagement.replies}</span> : null}
        </button>
        {viewer !== author && (
          <button
            type="button"
            className="circle-discussion-button circle-report-button"
            disabled={reported.includes(id) || busy}
            aria-expanded={report?.id === id}
            onClick={() => {
              setNotice("");
              setReport(report?.id === id ? undefined : { id, kind });
            }}
          >
            <Flag size={14} /> {reported.includes(id) ? "Reported" : "Report"}
          </button>
        )}
      </div>
      <section
        className="circle-replies"
        id={threadId}
        hidden={!open}
        aria-label="Discussion replies"
      >
        {loading && <p role="status">Loading replies…</p>}
        {!loading && !replies.length && (
          <p className="muted">
            No replies yet. Share an example or ask a follow-up.
          </p>
        )}
        {engagement && engagement.replies > replies.length && !loading && (
          <small>Showing the latest {replies.length} replies.</small>
        )}
        {replies.map((reply) => (
          <article className="circle-reply" key={reply.id}>
            <div className="circle-reply-heading">
              <strong>
                {reply.author_id === viewer ? "You" : reply.author}
              </strong>
              <time dateTime={reply.created_at}>
                {new Date(reply.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>
            <p>{reply.body}</p>
            {reply.author_id === viewer ? (
              <button
                className="text-link"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Remove this reply?"))
                    void write({ action: "remove-reply", id: reply.id }, () => {
                      setReplies((previous) =>
                        previous.filter((item) => item.id !== reply.id),
                      );
                      setReload((value) => value + 1);
                    });
                }}
              >
                Remove reply
              </button>
            ) : (
              <button
                className="text-link"
                type="button"
                disabled={busy || reported.includes(reply.id)}
                onClick={() => {
                  setNotice("");
                  setReport({ id: reply.id, kind: "reply" });
                }}
              >
                {reported.includes(reply.id) ? "Reported" : "Report reply"}
              </button>
            )}
          </article>
        ))}
        <form
          className="circle-reply-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim().length < 2) return;
            void write({ action: "reply", id, kind, body }, () => {
              setBody("");
              setReload((value) => value + 1);
            });
          }}
        >
          <label className="circle-reply-field">
            Write a reply
            <textarea
              rows={2}
              minLength={2}
              maxLength={1500}
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn secondary"
            disabled={busy || body.trim().length < 2}
          >
            <Send size={14} /> Reply
          </button>
        </form>
      </section>
      {report && (
        <form
          className="circle-report-form form-stack"
          onSubmit={submitReport}
          key={report.id}
        >
          <h4>
            {report.kind === "reply" ? "Report this reply" : "Report this item"}
          </h4>
          <p>Only assigned moderators can see your report.</p>
          <label>
            Reason
            <select name="reason" defaultValue="" required>
              <option value="" disabled>
                Choose a reason
              </option>
              {Object.entries(reportReasons).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Additional details (optional)
            <textarea name="details" rows={2} maxLength={500} />
          </label>
          <div className="button-row">
            <button type="submit" className="btn primary" disabled={busy}>
              Submit report
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => setReport(undefined)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="muted">
          {notice}
        </p>
      )}
    </div>
  );
}
