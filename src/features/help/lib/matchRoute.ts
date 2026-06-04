import { HELP_ARTICLES } from "../content/registry";
import type { HelpArticle } from "../domain/types";

/**
 * Resolve the help article for a given pathname.
 *
 * - Exact articles win when their route equals the pathname.
 * - Otherwise the longest matching prefix article wins, so
 *   `/rent-collection/statements` beats `/rent-collection`.
 * - The `general` article (route "/") matches every pathname but, being the
 *   shortest prefix, only wins when nothing more specific matches — so it acts
 *   as a catch-all fallback and the Help button shows on every app page.
 * - Returns `null` only if the registry has no general fallback at all.
 */
export function findHelpArticle(pathname: string): HelpArticle | null {
  const exact = HELP_ARTICLES.find(
    (article) => article.match === "exact" && article.route === pathname
  );
  if (exact) return exact;

  let best: HelpArticle | null = null;
  for (const article of HELP_ARTICLES) {
    if (article.match !== "prefix") continue;
    const matches =
      article.route === "/"
        ? true
        : pathname === article.route || pathname.startsWith(article.route + "/");
    if (!matches) continue;
    if (!best || article.route.length > best.route.length) {
      best = article;
    }
  }
  return best;
}
