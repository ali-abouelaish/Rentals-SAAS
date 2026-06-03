import { HELP_ARTICLES } from "../content/registry";
import type { HelpArticle } from "../domain/types";

/**
 * Resolve the help article for a given pathname.
 *
 * - Exact articles win when their route equals the pathname.
 * - Otherwise the longest matching prefix article wins, so
 *   `/rent-collection/statements` beats `/rent-collection`.
 * - Returns `null` when nothing matches. Because we only author articles for
 *   PM-module routes, this is what scopes the Help button to PM pages: it
 *   renders only when an article is found.
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
      pathname === article.route || pathname.startsWith(article.route + "/");
    if (!matches) continue;
    if (!best || article.route.length > best.route.length) {
      best = article;
    }
  }
  return best;
}
