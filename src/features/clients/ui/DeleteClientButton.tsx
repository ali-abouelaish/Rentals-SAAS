"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteClient } from "@/features/clients/actions/clients";
import { toast } from "sonner";

type Props = {
  clientId: string;
  clientName: string;
  rentalsCount: number;
};

export function DeleteClientButton({ clientId, clientName, rentalsCount }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await deleteClient(clientId);
      setOpen(false);
      // redirect() in action navigates away
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete client");
      setIsPending(false);
    }
  }

  const rentalsWarning =
    rentalsCount > 0
      ? ` This will also permanently delete ${rentalsCount} rental code${rentalsCount === 1 ? "" : "s"} linked to this client.`
      : "";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-status-error-fg border-status-error-border hover:bg-status-error-bg"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete client
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete client</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{clientName}</strong>?
              {rentalsWarning}
              {" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? "Deleting…" : "Delete client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
