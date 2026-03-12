import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function AdminNotFound() {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <Building2 className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
        <p className="text-lg font-semibold text-foreground">Resource not found</p>
        <p className="text-sm text-foreground-secondary mt-1">
          The requested tenant or admin resource does not exist.
        </p>
      </CardContent>
    </Card>
  );
}

