import { NextResponse } from "next/server";
import {
  CONTRACTS_BUCKET,
  externalLink,
  requireDocumentViewer,
  signedDocumentUrl,
  storagePathFromUrl,
} from "@/lib/storage/contractDocuments";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/properties/{propertyId}/contract-document — the landlord contract file. */
export async function GET(_req: Request, { params }: { params: { propertyId: string } }) {
  if (!UUID.test(params.propertyId)) return new NextResponse("Not found", { status: 404 });

  const viewer = await requireDocumentViewer();
  if (!viewer.ok) {
    return new NextResponse(viewer.status === 401 ? "Please sign in" : "Forbidden", { status: viewer.status });
  }

  // Under RLS: another agency's property simply isn't found.
  const { data: property } = await viewer.supabase
    .from("properties")
    .select("*")
    .eq("id", params.propertyId)
    .maybeSingle<{ contract_document_url: string | null; contract_document_path?: string | null }>();
  if (!property) return new NextResponse("Property not found", { status: 404 });

  const path =
    property.contract_document_path ?? storagePathFromUrl(property.contract_document_url, CONTRACTS_BUCKET);
  if (!path) {
    const external = externalLink(property.contract_document_url);
    if (external) return NextResponse.redirect(external, 302);
    return new NextResponse("No contract uploaded for this property", { status: 404 });
  }

  const url = await signedDocumentUrl(CONTRACTS_BUCKET, path);
  if (!url) return new NextResponse("Document file not found", { status: 404 });

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
