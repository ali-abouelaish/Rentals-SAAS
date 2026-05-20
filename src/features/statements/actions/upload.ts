"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseStatement } from "../parser";
import { checkMissingRentPayments, matchCredits } from "../matcher";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface UploadResult {
  ok: true;
  upload_id: string;
  bank_detected: string;
  transaction_count: number;
  credit_count: number;
  match_summary: { matched: number; flagged: number; unmatched: number };
  missing_rent_count: number;
}

export interface UploadError {
  ok: false;
  error: string;
}

export async function uploadStatement(
  formData: FormData,
): Promise<UploadResult | UploadError> {
  const profile = await requireRole([...ADMIN_ROLES]);
  const tenantId = profile.tenant_id;

  const file = formData.get("file");
  const portfolioId = formData.get("portfolio_id");

  if (!(file instanceof File)) {
    return { ok: false, error: "No file uploaded." };
  }
  if (typeof portfolioId !== "string" || !portfolioId) {
    return { ok: false, error: "Pick a portfolio first." };
  }
  if (file.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File is larger than 10MB." };
  }

  const filename = file.name;
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".pdf")) {
    return { ok: false, error: "Only CSV and PDF statements are supported." };
  }

  const supabase = createSupabaseServerClient();

  const { data: portfolio, error: pfErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .single();
  if (pfErr || !portfolio) {
    return { ok: false, error: "Portfolio not found." };
  }

  const { data: insertedUpload, error: insErr } = await supabase
    .from("bank_statement_uploads")
    .insert({
      tenant_id: tenantId,
      portfolio_id: portfolioId,
      filename,
      status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !insertedUpload) {
    return { ok: false, error: insErr?.message ?? "Could not create upload record." };
  }

  const uploadId = insertedUpload.id;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStatement(buffer, filename, file.type);

    if (parsed.transactions.length === 0) {
      await supabase
        .from("bank_statement_uploads")
        .update({
          status: "failed",
          bank_name: parsed.bank,
          file_format: parsed.format,
          error_message: "No transactions could be parsed from the file.",
        })
        .eq("id", uploadId);
      return { ok: false, error: "No transactions could be parsed. Try a CSV export." };
    }

    const creditCount = parsed.transactions.filter((t) => t.transaction_type === "credit").length;
    const fromIso = parsed.statementFrom ? toIsoDate(parsed.statementFrom) : null;
    const toIso = parsed.statementTo ? toIsoDate(parsed.statementTo) : null;

    await supabase
      .from("bank_statement_uploads")
      .update({
        bank_name: parsed.bank,
        file_format: parsed.format,
        statement_from: fromIso,
        statement_to: toIso,
        total_credits: creditCount,
      })
      .eq("id", uploadId);

    const txRows = parsed.transactions.map((tx) => ({
      upload_id: uploadId,
      tenant_id: tenantId,
      transaction_date: toIsoDate(tx.transaction_date),
      description: tx.description.slice(0, 1000),
      amount_pence: tx.amount_pence,
      transaction_type: tx.transaction_type,
      balance_pence: tx.balance_pence ?? null,
      reference: tx.reference ?? null,
      raw_row: tx.raw_row,
    }));

    const chunkSize = 500;
    for (let i = 0; i < txRows.length; i += chunkSize) {
      const chunk = txRows.slice(i, i + chunkSize);
      const { error: txErr } = await supabase.from("bank_transactions").insert(chunk);
      if (txErr) throw new Error(txErr.message);
    }

    const matchSummary = await matchCredits(supabase, uploadId, tenantId, portfolioId, toIso);

    let missingCount = 0;
    if (fromIso && toIso) {
      missingCount = await checkMissingRentPayments(
        supabase,
        uploadId,
        tenantId,
        portfolioId,
        fromIso,
        toIso,
      );
    }

    await supabase
      .from("bank_statement_uploads")
      .update({ status: "parsed" })
      .eq("id", uploadId);

    revalidatePath("/rent-collection/statements");

    return {
      ok: true,
      upload_id: uploadId,
      bank_detected: parsed.bank,
      transaction_count: parsed.transactions.length,
      credit_count: creditCount,
      match_summary: matchSummary,
      missing_rent_count: missingCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parse error";
    await supabase
      .from("bank_statement_uploads")
      .update({ status: "failed", error_message: message })
      .eq("id", uploadId);
    return { ok: false, error: message };
  }
}
