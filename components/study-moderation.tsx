"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { reportReasons, type StudyReport } from "@/lib/study-discussion";
import { discussionEndpoint, discussionRequest } from "./study-discussion";

export default function StudyModeration({
  back,
  onReview,
}: {
  back: () => void;
  onReview: () => void;
}) {
  const [reports, setReports] = useState<StudyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`${discussionEndpoint}?view=moderation`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setReports(data.reports);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load reports.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [reload]);

  async function review(id: string, decision: "hide" | "dismiss") {
    if (
      busy ||
      (decision === "hide" &&
        !window.confirm("Hide this content from Study Circle?"))
    )
      return;
    setError("");
    setBusy(true);
    try {
      await discussionRequest({ action: "review", id, decision });
      setReports((previous) => previous.filter((report) => report.id !== id));
      setReload((value) => value + 1);
      onReview();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not review this report.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="study-feed">
      <section className="panel circle-intro">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={14} /> MODERATOR ACCESS
          </span>
          <h2>Report queue</h2>
          <p>
            Review the reported content and choose whether to hide it or dismiss
            the report.
          </p>
        </div>
        <div className="button-row">
          <button type="button" className="btn secondary" onClick={back}>
            <ArrowLeft size={15} /> Back to feed
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={loading || busy}
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </section>
      {loading && <p role="status">Loading reports…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {!loading && !error && !reports.length && (
        <p className="panel muted">There are no pending reports.</p>
      )}
      {reports.map((report) => (
        <article className="panel circle-post" key={report.id}>
          <div className="circle-post-type">
            <span className="badge">{reportReasons[report.reason]}</span>
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          <h3>{report.title}</h3>
          {report.excerpt && (
            <blockquote className="circle-report-excerpt">
              {report.excerpt}
            </blockquote>
          )}
          {report.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(report.youtubeId) && (
            <a
              className="text-link"
              href={`https://www.youtube.com/watch?v=${report.youtubeId}`}
              rel="noreferrer"
              target="_blank"
            >
              Open reported clip <ExternalLink size={14} />
            </a>
          )}
          {report.videoUrl && (
            <video
              className="circle-review-video"
              src={report.videoUrl}
              controls
              preload="none"
              playsInline
            />
          )}
          {report.details && (
            <p>
              <strong>Reporter’s notes</strong>
              <br />
              {report.details}
            </p>
          )}
          <div className="button-row">
            <button
              type="button"
              className="btn secondary"
              disabled={busy || loading}
              onClick={() => void review(report.id, "dismiss")}
            >
              Dismiss report
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy || loading}
              onClick={() => void review(report.id, "hide")}
            >
              Hide content
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
