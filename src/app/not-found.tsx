import "./harbor-landing.css";
import "./harbor-error.css";
import { PublicErrorShell } from "@/components/landing/PublicErrorShell";

export const metadata = {
  // Bare title on purpose: the root layout applies a `%s — {brand}` template on
  // branded hosts, so hardcoding "— Harbor Ops" would double up the suffix.
  title: "Page not found",
  description: "The page you were looking for doesn't exist on Harbor Ops.",
  robots: { index: false, follow: false },
};

/**
 * Root 404. Catches every unmatched URL on the marketing surface, plus any
 * `notFound()` thrown outside the (app) group — the dashboard has its own
 * not-found so it can stay inside the app shell.
 */
export default function NotFound() {
  return (
    <PublicErrorShell>
      <span className="err-glyph" aria-hidden>
        404
      </span>

      <span className="err-status">Error 404 · Page not found</span>

      <h1>
        This page has <em>checked out</em>.
      </h1>

      <p className="lede">
        The address you followed doesn&apos;t match anything on Harbor Ops. It may have
        been moved or renamed, or the link that brought you here may be out of date.
      </p>

      <div className="err-ctas">
        <a href="/" className="btn btn-primary btn-lg">
          Back to home
        </a>
        <a href="/login" className="btn btn-secondary btn-lg">
          Sign in to your workspace →
        </a>
      </div>

      <div className="err-links">
        <a href="/dashboard" className="err-link">
          <div className="t">Dashboard</div>
          <div className="d">Occupancy, margin and maintenance across your portfolio.</div>
        </a>
        <a href="/login" className="err-link">
          <div className="t">Sign in</div>
          <div className="d">Already have a workspace? Pick up where you left off.</div>
        </a>
        <a href="/signup" className="err-link">
          <div className="t">Request a demo</div>
          <div className="d">See Harbor Ops run against a room-by-room portfolio.</div>
        </a>
      </div>
    </PublicErrorShell>
  );
}
