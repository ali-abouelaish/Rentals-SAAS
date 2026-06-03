export type HelpMatchMode = "exact" | "prefix";

export interface HelpArticle {
  /** Stable id, e.g. "rent-collection". */
  slug: string;
  /** Drawer heading. */
  title: string;
  /** Canonical route, e.g. "/rent-collection". */
  route: string;
  /** How `route` is matched against the live pathname. */
  match: HelpMatchMode;
  /** One-liner shown under the title; doubles as the AI blurb. */
  summary: string;
  /** Full markdown guide. */
  content: string;
}
