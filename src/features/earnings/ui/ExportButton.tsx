"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ExportButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => toast("Export coming soon")}
    >
      <Download size={14} className="mr-2" />
      Export
    </Button>
  );
}
