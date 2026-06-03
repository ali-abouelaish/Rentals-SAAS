"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateButton({ protectionId }: { protectionId: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/mydeposits/protections/${protectionId}/certificate`} target="_blank" rel="noopener noreferrer">
        <FileDown className="h-3.5 w-3.5" />
        Certificate
      </a>
    </Button>
  );
}
