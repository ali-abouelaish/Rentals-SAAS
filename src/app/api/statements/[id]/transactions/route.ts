import { NextRequest, NextResponse } from "next/server";
import { getUploadTransactions } from "@/features/statements/data/queries";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const transactions = await getUploadTransactions(params.id);
    const type = req.nextUrl.searchParams.get("type");
    const filtered =
      type === "credit" || type === "debit"
        ? transactions.filter((tx) => tx.transaction_type === type)
        : transactions;
    return NextResponse.json({ transactions: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
