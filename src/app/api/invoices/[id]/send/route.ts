import { NextResponse } from "next/server";
import { enqueueEmail } from "@/lib/email/outbox";
import { generateInvoiceEmail } from "@/lib/email/templates/invoice";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const to = body?.to;
    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'to' address" },
        { status: 400 }
      );
    }

    const { subject, html, text } = generateInvoiceEmail({
      invoiceNumber: id,
      tenantName: typeof body?.tenantName === "string" ? body.tenantName : undefined,
    });

    await enqueueEmail({
      to,
      subject,
      html,
      text: text ?? undefined,
    });

    return NextResponse.json({ ok: true, queued: true });
  } catch (err) {
    console.error("Enqueue invoice email error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to enqueue email" },
      { status: 500 }
    );
  }
}
