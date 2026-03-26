"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addQuickLink,
  updateQuickLink,
  deleteQuickLink,
} from "@/features/quick-links/actions/quickLinks";
import type { QuickLink } from "@/features/quick-links/data/queries";

// ── Submit button helper ──────────────────────────────────────────
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

// ── Add link form ─────────────────────────────────────────────────
function AddLinkForm() {
  const [state, action] = useFormState(addQuickLink, {});
  const [key, setKey] = useState(0);

  return (
    <form
      key={key}
      action={async (fd) => {
        const result = await action(fd);
        if (!(result as { error?: string } | undefined)?.error) setKey((k) => k + 1);
      }}
      className="space-y-3 pt-4 border-t border-border"
    >
      <p className="text-sm font-medium text-foreground">Add a new link</p>
      <div>
        <label className="text-xs font-medium text-foreground-secondary mb-1 block">
          Title
        </label>
        <Input name="title" placeholder="e.g. Rightmove" required />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground-secondary mb-1 block">
          URL
        </label>
        <Input name="url" placeholder="https://example.com" type="url" required />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground-secondary mb-1 block">
          Description <span className="text-foreground-muted">(optional)</span>
        </label>
        <Input name="description" placeholder="Short description" />
      </div>
      {state?.error && (
        <p className="text-xs text-error">{state.error}</p>
      )}
      <SubmitButton label="Add link" />
    </form>
  );
}

// ── Edit link row ─────────────────────────────────────────────────
function EditLinkRow({ link }: { link: QuickLink }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useFormState(updateQuickLink, {});

  if (editing) {
    return (
      <form
        action={async (fd) => {
          const result = await action(fd);
          if (!(result as { error?: string } | undefined)?.error) setEditing(false);
        }}
        className="space-y-2 p-3 rounded-xl bg-surface-inset"
      >
        <input type="hidden" name="id" value={link.id} />
        <div>
          <label className="text-xs font-medium text-foreground-secondary mb-1 block">
            Title
          </label>
          <Input name="title" defaultValue={link.title} required />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground-secondary mb-1 block">
            URL
          </label>
          <Input name="url" defaultValue={link.url} type="url" required />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground-secondary mb-1 block">
            Description <span className="text-foreground-muted">(optional)</span>
          </label>
          <Input name="description" defaultValue={link.description ?? ""} />
        </div>
        {state?.error && (
          <p className="text-xs text-error">{state.error}</p>
        )}
        <div className="flex gap-2">
          <SubmitButton label="Save" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-inset transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{link.title}</p>
        {link.description && (
          <p className="text-xs text-foreground-muted truncate">{link.description}</p>
        )}
        <p className="text-xs text-foreground-muted truncate">{link.url}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setEditing(true)}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <form action={deleteQuickLink}>
          <input type="hidden" name="id" value={link.id} />
          <Button
            type="submit"
            variant="destructive"
            size="icon"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// ── Manage dialog ─────────────────────────────────────────────────
function ManageDialog({ links }: { links: QuickLink[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Manage links
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Useful Resources</DialogTitle>
        </DialogHeader>

        {links.length > 0 ? (
          <div className="space-y-1">
            {links.map((link) => (
              <EditLinkRow key={link.id} link={link} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted py-2">
            No links yet. Add your first one below.
          </p>
        )}

        <AddLinkForm />
      </DialogContent>
    </Dialog>
  );
}

// ── Favicon with fallback ─────────────────────────────────────────
function LinkFavicon({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);
  let domain = "";
  try { domain = new URL(url).hostname; } catch { /* invalid url */ }

  if (!domain || errored) {
    return (
      <div className="w-10 h-10 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0">
        <ExternalLink className="h-5 w-5 text-brand" strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={40}
      height={40}
      className="w-10 h-10 rounded-xl object-contain bg-white p-1.5 shrink-0"
      onError={() => setErrored(true)}
    />
  );
}

// ── Public-facing link card ───────────────────────────────────────
function LinkCard({ link }: { link: QuickLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-xl bg-surface-inset p-4 transition-all duration-base hover:shadow-md hover:-translate-y-0.5 hover:bg-surface-highlight"
    >
      <div className="flex items-start justify-between gap-2">
        <LinkFavicon url={link.url} />
        <ExternalLink className="h-3.5 w-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
          {link.title}
        </p>
        {link.description && (
          <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
            {link.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ── Main exported section ─────────────────────────────────────────
export function QuickLinksSection({
  links,
  isAdmin,
}: {
  links: QuickLink[];
  isAdmin: boolean;
}) {
  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-brand-subtle">
            <Link2 className="h-4 w-4 text-brand" strokeWidth={2} />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Useful Resources
          </h2>
        </div>
        {isAdmin && <ManageDialog links={links} />}
      </div>

      {links.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </div>
      ) : isAdmin ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-3 rounded-xl bg-surface-inset mb-3">
            <Plus className="h-6 w-6 text-foreground-muted" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-foreground-secondary">No links yet</p>
          <p className="text-xs text-foreground-muted mt-1">
            Click &ldquo;Manage links&rdquo; to add useful resources for your team
          </p>
        </div>
      ) : null}
    </div>
  );
}
