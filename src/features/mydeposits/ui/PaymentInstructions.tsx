import { Landmark } from "lucide-react";

const KNOWN_FIELDS: { key: string; label: string; prefix?: string }[] = [
  { key: "amount", label: "Amount", prefix: "£" },
  { key: "accountName", label: "Account name" },
  { key: "sortCode", label: "Sort code" },
  { key: "accountNumber", label: "Account number" },
  { key: "reference", label: "Payment reference" },
];

export function PaymentInstructions({
  instructions,
}: {
  instructions: Record<string, unknown> | null | undefined;
}) {
  if (!instructions) {
    return (
      <p className="text-xs text-foreground-secondary">
        Payment instructions will appear here once the scheme returns them.
      </p>
    );
  }

  const rows = KNOWN_FIELDS.filter((f) => instructions[f.key] != null);

  return (
    <div className="rounded-lg border border-border bg-surface-inset p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Landmark className="h-3.5 w-3.5 text-brand" />
        Bank transfer instructions
      </div>
      {rows.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          {rows.map((f) => (
            <div key={f.key} className="contents">
              <dt className="text-foreground-muted text-xs">{f.label}</dt>
              <dd className="text-foreground font-medium tabular-nums">
                {f.prefix}
                {String(instructions[f.key])}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="overflow-x-auto rounded bg-surface-card p-2 text-[11px] text-foreground-secondary">
          {JSON.stringify(instructions, null, 2)}
        </pre>
      )}
    </div>
  );
}
