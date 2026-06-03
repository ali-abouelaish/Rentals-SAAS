"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { findHelpArticle } from "../lib/matchRoute";
import { HelpMarkdown } from "./HelpMarkdown";

/**
 * Top-bar Help button. Resolves the current route to an authored guide and
 * opens it in a right-side drawer. Renders nothing when no article matches,
 * which scopes it to PM-module pages (the only pages with guides).
 */
export function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const article = findHelpArticle(pathname);

  if (!article) return null;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Help for this page"
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Help</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0 gap-0">
          <SheetHeader>
            <SheetTitle>{article.title}</SheetTitle>
            <SheetDescription>{article.summary}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <HelpMarkdown
              content={article.content}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
