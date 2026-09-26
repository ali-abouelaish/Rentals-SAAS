import Link from "next/link";
import { Warehouse } from "lucide-react";
import type { OwnerPropertySummary } from "../domain/types";

export function OwnerPropertiesTable({ properties }: { properties: OwnerPropertySummary[] }) {
  if (properties.length === 0) {
    return (
      <div className="rounded-bento bg-surface-card shadow-bento p-5">
        <p className="text-sm text-foreground-secondary">
          No properties are owned by this landlord yet. Open a property and set them in the
          Ownership section to link it here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-bento bg-surface-card shadow-bento p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3">
        Properties ({properties.length})
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-foreground-muted">
              <th className="pb-2 pr-3 font-medium">Property</th>
              <th className="pb-2 pr-3 font-medium">Postcode</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium text-right">Occupancy</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="py-2 pr-3">
                  <Link
                    href={`/properties/${p.id}`}
                    className="inline-flex min-h-11 md:min-h-0 items-center gap-1.5 text-brand hover:underline"
                  >
                    <Warehouse className="h-3.5 w-3.5" />
                    {p.address_line_1 ?? p.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-foreground-secondary">{p.postcode ?? "—"}</td>
                <td className="py-2 pr-3 text-foreground-secondary capitalize">
                  {p.property_type ? p.property_type.replace(/_/g, " ") : "—"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-foreground-secondary">
                  {p.total_units > 0 ? `${p.occupied_units} / ${p.total_units} let` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
