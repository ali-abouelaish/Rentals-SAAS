"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runLandlordScraper } from "../actions/landlords";

export function RunScraperButton({ landlordId }: { landlordId: string }) {
  const [isPending, startTransition] = useTransition();

  const onRun = () =>
    startTransition(async () => {
      try {
        const res = await runLandlordScraper(landlordId);
        toast.success(res.message);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Scraper run failed");
      }
    });

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="gap-2"
      loading={isPending}
      onClick={onRun}
      title="Scrape this landlord's SpareRoom profile now instead of waiting for the daily scheduled run. Takes up to a couple of minutes."
    >
      <RefreshCw className="h-4 w-4" />
      Run scraper
    </Button>
  );
}
