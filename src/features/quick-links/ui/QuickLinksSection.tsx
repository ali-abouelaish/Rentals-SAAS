"use client";

import { useEffect, useState } from "react";
import { ExternalLink, GripVertical, KeyRound, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  deleteQuickLink,
  reorderQuickLinks,
} from "@/features/quick-links/actions/quickLinks";
import type { QuickLink } from "@/features/quick-links/data/queries";
import { QuickLinkForm, type SavedQuickLink } from "./QuickLinkForm";
import { SiteSignInDialog, type SiteSignInTarget } from "./SiteSignInDialog";

// ── Add link form ─────────────────────────────────────────────────
function AddLinkForm({ onSaved }: { onSaved: (saved: SavedQuickLink) => void }) {
  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground">Add a new link</p>
      <QuickLinkForm onSaved={onSaved} />
    </div>
  );
}

// ── Sortable link row ─────────────────────────────────────────────
function SortableLinkRow({
  link,
  onSaved,
  onSetup,
}: {
  link: QuickLink;
  onSaved: (saved: SavedQuickLink) => void;
  onSetup: (link: SiteSignInTarget) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="p-3 rounded-xl bg-surface-inset">
        <QuickLinkForm
          link={link}
          onSaved={(saved) => {
            setEditing(false);
            onSaved(saved);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-colors ${
        isDragging ? "bg-surface-inset shadow-lg" : "hover:bg-surface-inset"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0 text-foreground-muted hover:text-foreground"
        aria-label={`Drag to reorder ${link.title}`}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{link.title}</p>
        {link.description && (
          <p className="text-xs text-foreground-muted truncate">{link.description}</p>
        )}
        <p className="text-xs text-foreground-muted truncate">{link.url}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {link.sso_enabled && (
          <Tooltip content="Get the secret and the sign-in handler your web developer adds to the website.">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSetup(link)}
              aria-label={`Website sign-in setup for ${link.title}`}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        )}
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
  // Local copy so a drag reorders instantly; the server action persists in the
  // background and revalidation feeds the saved order back through `links`.
  const [items, setItems] = useState(links);
  const [setupLink, setSetupLink] = useState<SiteSignInTarget | null>(null);

  // Only resync when the server data actually changes (add/edit/delete/reorder)
  // — `links` is a fresh array on every parent render, so we compare content.
  const signature = links
    .map((l) => `${l.id}:${l.title}:${l.url}:${l.description ?? ""}:${l.sso_enabled}:${l.sso_callback_url ?? ""}`)
    .join("|");
  useEffect(() => {
    setItems(links);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((l) => l.id === active.id);
    const newIndex = items.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = items;
    const reordered = arrayMove(items, oldIndex, newIndex).map((l, idx) => ({
      ...l,
      position: idx,
    }));
    setItems(reordered);

    reorderQuickLinks(
      reordered.map((l) => ({ id: l.id, position: l.position }))
    ).catch(() => {
      toast.error("Failed to save order");
      setItems(previous);
    });
  };

  // Switching sign-in on goes straight to its setup, since the site can't
  // accept sign-ins until the developer has the secret.
  const handleSaved = (saved: SavedQuickLink) => {
    if (saved.signInJustEnabled) setSetupLink(saved);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Manage links
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Useful Resources</DialogTitle>
        </DialogHeader>

        {items.length > 0 ? (
          <>
            <p className="text-xs text-foreground-muted">
              Drag the handle to reorder — the order here is the order shown on
              the dashboard.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {items.map((link) => (
                    <SortableLinkRow key={link.id} link={link} onSaved={handleSaved} onSetup={setSetupLink} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        ) : (
          <p className="text-sm text-foreground-muted py-2">
            No links yet. Add your first one below.
          </p>
        )}

        <AddLinkForm onSaved={handleSaved} />
        <SiteSignInDialog link={setupLink} onOpenChange={(open) => !open && setSetupLink(null)} />
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
      // Sign-in links go via Harbor, which signs the person in on the way.
      href={link.sso_enabled ? `/api/quick-links/${link.id}/launch` : link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-xl bg-surface-inset p-4 transition-all duration-base hover:shadow-md hover:-translate-y-0.5 hover:bg-surface-highlight"
    >
      <div className="flex items-start justify-between gap-2">
        <LinkFavicon url={link.url} />
        <ExternalLink className="h-3.5 w-3.5 text-foreground-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" strokeWidth={1.5} />
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
        {link.sso_enabled && (
          <Tooltip content="Opens with you already signed in, using your Harbor account.">
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand">
              <KeyRound className="h-3 w-3" strokeWidth={2} />
              Signs you in
            </span>
          </Tooltip>
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
