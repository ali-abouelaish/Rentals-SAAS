// Rendering a works order to a PDF buffer, ready to send for signature.
//
// Mirrors src/features/owner-statements/lib/generate.ts: load the data with the
// admin client, render with @react-pdf/renderer, hand back a Buffer.
//
// It also returns the signature field geometry and the contractor's details, so
// a caller can pass the whole lot straight to sendForSignature() without
// knowing anything about how the document is laid out.

import "server-only";

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";

import { loadAgencyBrand } from "@/lib/branding/agency-brand";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SignatureFieldSpec } from "@/lib/boldsign/types";

import { worksOrderSignatureFields } from "../domain/worksOrderFields";
import type { MaintenanceCost, MaintenanceJob, MaintenanceSupplier } from "../domain/types";
import { WorksOrderPdf } from "../pdf/WorksOrderPdf";

export type WorksOrderDocument = {
  pdf: Buffer;
  fileName: string;
  /** Where the contractor signs. Matches the boxes drawn on the document. */
  fields: SignatureFieldSpec[];
  /** Null when no contractor is assigned — the caller must handle that. */
  contractor: { name: string; email: string } | null;
  reference: string;
  title: string;
};

type JobRow = MaintenanceJob & {
  properties?: { name: string; address_line_1: string | null; address_line_2: string | null; postcode: string | null } | null;
  units?: { unit_type: string | null; room_number: string | null } | null;
  maintenance_costs?: MaintenanceCost[] | null;
};

/** "12 High Street, Flat 2, SW1A 1AA" — blank parts dropped. */
function formatAddress(property: JobRow["properties"]): string | null {
  if (!property) return null;
  const parts = [property.address_line_1, property.address_line_2, property.postcode]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatUnitLabel(unit: JobRow["units"]): string | null {
  if (!unit) return null;
  const parts = [unit.unit_type, unit.room_number]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Build the works order document for a job.
 *
 * Tenant-scoped explicitly rather than relying on RLS, because the admin client
 * bypasses it — the caller passes the tenant it has already authorised.
 */
export async function buildWorksOrderDocument(
  tenantId: string,
  jobId: string
): Promise<WorksOrderDocument> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("maintenance_jobs")
    .select(
      "*, properties(name, address_line_1, address_line_2, postcode), units(unit_type, room_number), maintenance_costs(*)"
    )
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle<JobRow>();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Work order not found.");

  let supplier: MaintenanceSupplier | null = null;
  if (data.supplier_id) {
    const { data: supplierRow } = await admin
      .from("maintenance_suppliers")
      .select("*")
      .eq("id", data.supplier_id)
      .eq("tenant_id", tenantId)
      .maybeSingle<MaintenanceSupplier>();
    supplier = supplierRow ?? null;
  }

  const brand = await loadAgencyBrand(tenantId);
  if (!brand) throw new Error("Unknown agency.");

  const costs = (data.maintenance_costs ?? []).slice().sort((a, b) =>
    a.date_incurred.localeCompare(b.date_incurred)
  );

  // `as any` matches src/features/owner-statements/lib/generate.ts: react-pdf
  // types renderToBuffer as taking a ReactElement<DocumentProps>, so a
  // component that *returns* a <Document> — rather than being one — never
  // satisfies it. The cast is at the boundary only.
  const pdf = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(WorksOrderPdf, {
      job: data,
      supplier,
      costs,
      propertyName: data.properties?.name ?? "Property",
      propertyAddress: formatAddress(data.properties),
      unitLabel: formatUnitLabel(data.units),
      agencyName: brand.displayName,
      branding: brand.branding,
      secondaryColor: brand.secondaryColor,
    }) as any
  );

  // The signature block is absolutely positioned, so it renders on whichever
  // page the flow reaches — the last one. Read the real page count rather than
  // assuming a single page: a works order with a long description or many cost
  // lines runs to two, and a field left on page 1 would be stranded away from
  // the box it belongs to.
  const pageCount = (await PDFDocument.load(pdf)).getPageCount();

  return {
    pdf,
    fileName: `${data.reference}.pdf`,
    fields: worksOrderSignatureFields(pageCount),
    contractor:
      supplier?.email?.trim()
        ? { name: supplier.contact_name?.trim() || supplier.name, email: supplier.email.trim() }
        : null,
    reference: data.reference,
    title: data.title,
  };
}
