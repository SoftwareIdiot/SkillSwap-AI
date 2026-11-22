"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <div className="auth-card setup-card">
        <h1>A little interruption.</h1>
        <p>
          We couldn’t open this page. Your saved workspace is still available.
          Try again or return to your workspace.
        </p>
        <div className="button-row">
          <button className="btn primary" onClick={reset}>
            Try again
          </button>
          <Link className="btn secondary" href="/">
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
