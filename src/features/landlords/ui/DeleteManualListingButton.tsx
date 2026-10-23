"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteManualListing } from "../actions/listings";

/** Admin-only delete for a listing added by hand, behind a confirm dialog. */
export function DeleteManualListingButton({
  listingId,
  title,
}: {
  listingId: string;
  title: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDelete = () =>
    startTransition(async () => {
      const result = await deleteManualListing(listingId);
      if (!result.ok) {
        toast.error("Couldn't delete the listing", { description: result.error });
        return;
      }
      toast.success("Listing deleted");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="xs"
          className="gap-1.5"
          aria-label={`Delete listing${title ? ` "${title}"` : ""}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this listing?</DialogTitle>
          <DialogDescription>
            {title ? `"${title}" ` : "This listing "}is removed from the landlord&apos;s Listings, the map and your
            listings API. Any enquiries matched to it stay, but lose the link to it. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isPending} onClick={onDelete} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete listing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
