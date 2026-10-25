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
import { deleteDemoRequest } from "../../actions/admin";

/** Removes a demo request for good (they're kept until someone does), behind a confirm dialog. */
export function DeleteDemoRequestButton({ requestId, company }: { requestId: string; company: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDelete = () =>
    startTransition(async () => {
      const result = await deleteDemoRequest(requestId);
      if (!result.ok) {
        toast.error("Couldn't delete the request", { description: result.error });
        return;
      }
      toast.success("Demo request deleted");
      setOpen(false);
      router.push("/admin/demo-requests");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm" className="w-full gap-1.5" aria-label={`Delete the demo request from ${company}`}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this demo request?</DialogTitle>
          <DialogDescription>
            The request from {company}, with the person&apos;s details and your notes, is removed for good. Emails already
            sent stay in the inboxes they went to. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isPending} onClick={onDelete} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
