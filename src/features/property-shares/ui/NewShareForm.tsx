"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createShareAction } from "../actions/shares";
import {
  ShareFormFields,
  type ShareFormPortfolio,
  type ShareFormProperty,
} from "./ShareFormFields";

interface NewShareFormProps {
  portfolios: ShareFormPortfolio[];
  properties: ShareFormProperty[];
}

export function NewShareForm({ portfolios, properties }: NewShareFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createShareAction(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <ShareFormFields portfolios={portfolios} properties={properties} />

      <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
        <Button asChild variant="outline">
          <Link href="/shares">Cancel</Link>
        </Button>
        <Button type="submit" variant="secondary" loading={pending}>
          {pending ? "Creating" : "Create share"}
        </Button>
      </div>
    </form>
  );
}
