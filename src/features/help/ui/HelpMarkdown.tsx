"use client";

import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

/**
 * Renders an authored help guide (markdown) for the help drawer.
 *
 * Relative links (starting with "/") become in-app Next links that also close
 * the drawer; anything else opens in a new tab. Raw HTML is intentionally not
 * rendered (no rehype-raw), so the authored markdown is the only output.
 *
 * Each component destructures `node` out of the props react-markdown passes so
 * it is never spread onto a DOM element (which would trigger React warnings).
 */
export function HelpMarkdown({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="text-sm leading-relaxed text-foreground-secondary">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, className, ...props }) => (
            <h1
              className={cn(
                "mt-6 mb-2 text-lg font-semibold text-foreground first:mt-0",
                className
              )}
              {...props}
            />
          ),
          h2: ({ node, className, ...props }) => (
            <h2
              className={cn(
                "mt-6 mb-2 text-base font-semibold text-foreground first:mt-0",
                className
              )}
              {...props}
            />
          ),
          h3: ({ node, className, ...props }) => (
            <h3
              className={cn(
                "mt-4 mb-1.5 text-sm font-semibold text-foreground first:mt-0",
                className
              )}
              {...props}
            />
          ),
          p: ({ node, className, ...props }) => (
            <p className={cn("my-2.5", className)} {...props} />
          ),
          ul: ({ node, className, ...props }) => (
            <ul
              className={cn("my-2.5 list-disc space-y-1 pl-5", className)}
              {...props}
            />
          ),
          ol: ({ node, className, ...props }) => (
            <ol
              className={cn("my-2.5 list-decimal space-y-1 pl-5", className)}
              {...props}
            />
          ),
          li: ({ node, className, ...props }) => (
            <li className={cn("pl-1", className)} {...props} />
          ),
          strong: ({ node, className, ...props }) => (
            <strong
              className={cn("font-semibold text-foreground", className)}
              {...props}
            />
          ),
          code: ({ node, className, ...props }) => (
            <code
              className={cn(
                "rounded bg-surface-inset px-1.5 py-0.5 font-mono text-[0.8em] text-foreground",
                className
              )}
              {...props}
            />
          ),
          a: ({ node, href, children, className, ...props }) => {
            if (href && href.startsWith("/")) {
              return (
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "font-medium text-foreground-link underline-offset-2 hover:underline",
                    className
                  )}
                >
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "font-medium text-foreground-link underline-offset-2 hover:underline",
                  className
                )}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
