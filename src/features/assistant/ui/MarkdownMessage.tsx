"use client";

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders an assistant reply as Markdown. Only relative ("/…") links become
 * clickable internal Next.js links — anything else (external URLs, mailto:,
 * javascript:) renders as plain text, so a model can never inject a navigable
 * off-app or unsafe link. Raw HTML is not rendered (react-markdown default).
 */
const COMPONENTS: Components = {
  a({ href, children }) {
    if (typeof href === "string" && href.startsWith("/")) {
      return (
        <Link
          href={href}
          className="font-medium text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand"
        >
          {children}
        </Link>
      );
    }
    return <span>{children}</span>;
  },
  p({ children }) {
    return <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="my-1.5 list-disc space-y-0.5 pl-5 first:mt-0 last:mb-0">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-1.5 list-decimal space-y-0.5 pl-5 first:mt-0 last:mb-0">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },
  h1({ children }) {
    return <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0">{children}</h3>;
  },
  h2({ children }) {
    return <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0">{children}</h3>;
  },
  h3({ children }) {
    return <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0">{children}</h3>;
  },
  code({ children }) {
    return <code className="rounded bg-surface-inset px-1 py-0.5 text-[0.85em]">{children}</code>;
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border border-border bg-surface-inset px-2 py-1 text-left font-semibold">{children}</th>;
  },
  td({ children }) {
    return <td className="border border-border px-2 py-1">{children}</td>;
  },
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}
