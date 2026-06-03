import { HELP_ARTICLES } from "../content/registry";

/**
 * Concatenate every help article into a single markdown document.
 *
 * Pure and server-safe (no React imports) so it can be consumed directly as
 * AI context. There is no internal product assistant today (only the
 * tenant-facing maintenance-triage bot in `src/lib/ai/maintenance-triage.ts`),
 * so this is not wired anywhere yet. When an internal assistant is built,
 * append the output of this function to its system prompt, e.g.:
 *
 *   `${baseSystemPrompt}\n\n# PRODUCT GUIDE\n${buildHelpKnowledgeBase()}`
 */
export function buildHelpKnowledgeBase(): string {
  return HELP_ARTICLES.map(
    (article) =>
      `## ${article.title} (${article.route})\n_${article.summary}_\n\n${article.content}`
  ).join("\n\n---\n\n");
}
