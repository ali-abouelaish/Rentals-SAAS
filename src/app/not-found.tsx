import "@/features/site/styles/not-found.css";
import { Arrow } from "@/features/site/ui/icons";
import { NotFoundPanel } from "@/features/site/ui/NotFoundPanel";

export const metadata = {
  // Bare title on purpose: the root layout applies a title template
  // (`%s · Harbor`, or `%s — {brand}` on branded hosts).
  title: "Page not found",
  description: "The page you were looking for doesn't exist on Harbor.",
  robots: { index: false, follow: false },
};

/**
 * Root 404. Catches every unmatched URL on the marketing surface, plus any
 * `notFound()` thrown outside the (app) group — the dashboard has its own
 * not-found so it can stay inside the app shell.
 */
export default function NotFound() {
  return (
    <NotFoundPanel title="This page isn’t here." message="It may have moved, or the link may be mistyped.">
      <a className="go" href="/">
        Back to Harbor
        <Arrow />
      </a>
    </NotFoundPanel>
  );
}
