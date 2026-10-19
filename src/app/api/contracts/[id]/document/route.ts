import { type NextRequest, NextResponse } from "next/server";
import { SIGNED_DOCUMENTS_BUCKET } from "@/lib/boldsign/artifacts";
import {
  CONTRACTS_BUCKET,
  externalLink,
  requireDocumentViewer,
  signedDocumentUrl,
  storagePathFromUrl,
} from "@/lib/storage/contractDocuments";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ContractRow = {
  id: string;
  document_url: string | null;
  document_bucket?: string | null;
  document_path?: string | null;
  generated_pdf_path: string | null;
};

/**
 * GET /api/contracts/{id}/document?file=current|generated|signed|audit
 *
 * current   — the contract's document as it stands: the executed copy once
 *             e-signed, else the last generated or uploaded file.
 * generated — the last PDF generated from the template (unsigned).
 * signed    — the executed copy returned by BoldSign.
 * audit     — BoldSign's audit trail for that signing.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return new NextResponse("Not found", { status: 404 });

  const viewer = await requireDocumentViewer();
  if (!viewer.ok) {
    return new NextResponse(viewer.status === 401 ? "Please sign in" : "Forbidden", { status: viewer.status });
  }
  const { supabase } = viewer;

  // Under RLS: a contract from another agency simply isn't found.
  const { data: contract } = await supabase
    .from("property_contracts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<ContractRow>();
  if (!contract) return new NextResponse("Contract not found", { status: 404 });

  const file = req.nextUrl.searchParams.get("file") ?? "current";
  let bucket: string | null = null;
  let path: string | null = null;

  if (file === "signed" || file === "audit") {
    const { data: doc } = await supabase
      .from("boldsign_documents")
      .select("signed_pdf_path, audit_trail_path")
      .eq("entity_type", "contract")
      .eq("entity_id", contract.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ signed_pdf_path: string | null; audit_trail_path: string | null }>();
    bucket = SIGNED_DOCUMENTS_BUCKET;
    path = (file === "signed" ? doc?.signed_pdf_path : doc?.audit_trail_path) ?? null;
  } else if (file === "generated") {
    bucket = CONTRACTS_BUCKET;
    path = contract.generated_pdf_path;
  } else {
    if (contract.document_path) {
      bucket = contract.document_bucket ?? CONTRACTS_BUCKET;
      path = contract.document_path;
    } else if (contract.generated_pdf_path) {
      bucket = CONTRACTS_BUCKET;
      path = contract.generated_pdf_path;
    } else {
      const legacy = storagePathFromUrl(contract.document_url, CONTRACTS_BUCKET);
      if (legacy) {
        bucket = CONTRACTS_BUCKET;
        path = legacy;
      } else {
        const external = externalLink(contract.document_url);
        if (external) return NextResponse.redirect(external, 302);
      }
    }
  }

  if (!bucket || !path) return new NextResponse("No document on this contract yet", { status: 404 });

  const url = await signedDocumentUrl(bucket, path);
  if (!url) return new NextResponse("Document file not found", { status: 404 });

  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
