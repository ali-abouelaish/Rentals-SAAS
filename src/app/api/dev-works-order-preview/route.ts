// Development-only preview of the works order document.
//
// Renders it with representative sample data and stamps the BoldSign signature
// field rectangles on top, so the layout and the field placement can be checked
// together. If the red outlines sit exactly over the dashed boxes, the geometry
// in worksOrderFields.ts agrees with what the contractor will actually see.
//
// Useful whenever the document design changes, which is why it is kept rather
// than deleted — but it takes no auth and renders fake data, so it 404s outside
// development.

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import { WorksOrderPdf } from "@/features/maintenance/pdf/WorksOrderPdf";
import { worksOrderSignatureFields } from "@/features/maintenance/domain/worksOrderFields";
import { PDFDocument, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  try {
  const job = {
    id: "job-1",
    tenant_id: "t-1",
    reference: "WO-00042",
    property_id: "p-1",
    unit_id: "u-1",
    title: "Replace failed immersion heater and make good",
    description:
      "Tenant reports no hot water since Tuesday. Immersion heater element has failed and the " +
      "thermostat is suspect. Replace both, test the system under load, and make good the airing " +
      "cupboard panel removed for access. Photograph the old parts before disposal.",
    category: "plumbing",
    priority: "high",
    status: "open",
    reported_by: null,
    assigned_to: null,
    supplier_id: "s-1",
    scheduled_date: "2026-09-02",
    resolved_date: null,
    total_cost: 48500,
    created_at: "2026-08-28T09:00:00Z",
    updated_at: "2026-08-28T09:00:00Z",
  };

  const costs = [
    {
      id: "c-1",
      tenant_id: "t-1",
      job_id: "job-1",
      property_cost_id: null,
      description: "Immersion heater element and thermostat (parts)",
      amount: 18500,
      date_incurred: "2026-08-28",
      supplier: "Northgate Plumbing",
      invoice_ref: null,
      created_at: "2026-08-28T09:00:00Z",
    },
    {
      id: "c-2",
      tenant_id: "t-1",
      job_id: "job-1",
      property_cost_id: null,
      description: "Labour — 3 hours at standard rate",
      amount: 25000,
      date_incurred: "2026-08-28",
      supplier: "Northgate Plumbing",
      invoice_ref: null,
      created_at: "2026-08-28T09:00:00Z",
    },
    {
      id: "c-3",
      tenant_id: "t-1",
      job_id: "job-1",
      property_cost_id: null,
      description: "Making good and disposal",
      amount: 5000,
      date_incurred: "2026-08-28",
      supplier: "Northgate Plumbing",
      invoice_ref: null,
      created_at: "2026-08-28T09:00:00Z",
    },
  ];

  const supplier = {
    id: "s-1",
    tenant_id: "t-1",
    name: "Northgate Plumbing Ltd",
    trade: "plumbing",
    contact_name: "Dev Patel",
    phone: "020 7946 0821",
    email: "dev@northgateplumbing.example",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  const buffer = await renderToBuffer(
    React.createElement(WorksOrderPdf, {
      job,
      supplier,
      costs,
      propertyName: "Rosewood House",
      propertyAddress: "14 Rosewood Avenue, London, SE15 3QT",
      unitLabel: "Flat 2",
      agencyName: "Harbor Lettings",
      branding: {
        logo_url: null,
        primary_color: "#0F172A",
        accent_color: "#3B82F6",
        from_display_name: "Harbor Lettings",
        reply_to_email: "maintenance@harborlettings.example",
      },
      secondaryColor: "#3B82F6",
    } as never) as never
  );

  const doc = await PDFDocument.load(buffer);
  const fields = worksOrderSignatureFields(doc.getPageCount());

  // Stamp each BoldSign field rectangle onto the rendered document, converting
  // its top-left origin back to PDF's bottom-left. If the integration is
  // correct the stamped outline sits exactly over the dashed box drawn by the
  // layout — which is checkable at a glance, unlike comparing two sets of
  // numbers.
  const page = doc.getPages()[doc.getPageCount() - 1];
  for (const field of fields) {
    page.drawRectangle({
      x: field.x,
      y: page.getHeight() - field.y - field.height,
      width: field.width,
      height: field.height,
      borderColor: rgb(0.9, 0.1, 0.1),
      borderWidth: 1.5,
      opacity: 0,
    });
  }
  const stamped = Buffer.from(await doc.save());

  return new Response(new Uint8Array(stamped), {
    headers: {
      "content-type": "application/pdf",
      "x-signature-fields": JSON.stringify(fields),
    },
  });
  } catch (err) {
    return new Response(
      (err instanceof Error ? err.stack ?? err.message : String(err)),
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }
}
