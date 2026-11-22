import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-page">
      <div className="auth-card setup-card">
        <span className="eyebrow">404 · A SMALL DETOUR</span>
        <h1>Let’s get you back to learning.</h1>
        <p>This page isn’t here. Your workspace is a good place to start.</p>
        <div className="button-row">
          <Link className="btn primary" href="/">
            Back to workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
