"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TdsCertificateButton({ depositId }: { depositId: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={`/api/tds/certificate/${depositId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileDown className="h-3.5 w-3.5" />
        DPC certificate
      </a>
    </Button>
  );
}
