import { NextRequest, NextResponse } from "next/server";
import { uploadStatement } from "@/features/statements/actions/upload";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const result = await uploadStatement(formData);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
