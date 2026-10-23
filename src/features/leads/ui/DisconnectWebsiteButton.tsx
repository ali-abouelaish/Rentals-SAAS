"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { revokeWebsiteConnection } from "../actions/websiteLeads";

export function DisconnectWebsiteButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const disconnect = () => {
    startTransition(async () => {
      const result = await revokeWebsiteConnection(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} disconnected`);
      setOpen(false);
    });
  };

  return (
    <>
      <Tooltip content="Stops this website's enquiries arriving straight away — use it if the key was exposed or the site is retired. Leads it already sent are kept.">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Unplug className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect {label}?</DialogTitle>
            <DialogDescription>
              Enquiries from this website stop arriving straight away; the site will get an &quot;invalid
              key&quot; error. Leads it already sent stay on your Leads page. To reconnect, connect the website
              again and paste the new key into the site.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" loading={isPending} onClick={disconnect}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
