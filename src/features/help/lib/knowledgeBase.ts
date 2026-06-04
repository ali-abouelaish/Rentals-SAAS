import { HELP_ARTICLES } from "../content/registry";

/**
 * Concatenate every help article into a single markdown document.
 *
 * Pure and server-safe (no React imports) so it can be consumed directly as
 * AI context. This is wired into the admin AI assistant's system prompt in
 * `src/lib/ai/assistant.ts` (under "USING THE APP — PRODUCT GUIDE") so it can
 * answer "how do I…" / "where do I…" questions about using the app.
 */
export function buildHelpKnowledgeBase(): string {
  return HELP_ARTICLES.map(
    (article) =>
      `## ${article.title} (${article.route})\n_${article.summary}_\n\n${article.content}`
  ).join("\n\n---\n\n");
}
