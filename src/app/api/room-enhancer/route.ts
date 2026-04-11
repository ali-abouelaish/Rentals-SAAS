import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set on the server.");
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_API_BASE_URL,
    });
  }

  return openaiClient;
}

type Mode = "generate" | "edit";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (
      msg.includes("413") ||
      msg.toLowerCase().includes("too large") ||
      msg.toLowerCase().includes("payload") ||
      msg.toLowerCase().includes("limit")
    ) {
      return NextResponse.json(
        { error: "The uploaded image is too large to process. Please try a smaller image." },
        { status: 413 }
      );
    }
    return NextResponse.json({ error: "Failed to read request body." }, { status: 400 });
  }

  try {

    const mode = (formData.get("mode") as Mode | null) ?? "generate";
    const model =
      (formData.get("model") as "gpt-image-1" | "gpt-image-1-mini" | "gpt-image-1.5" | null) ??
      "gpt-image-1.5";
    const prompt = ((formData.get("prompt") as string | null) ?? "").trim();
    const n = Math.max(1, Math.min(Number(formData.get("n") ?? 1), 4));

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const openai = getOpenAI();

    if (mode === "generate") {
      const result = await openai.images.generate({
        model,
        prompt,
        n,
        size: "auto",
        quality: "auto",
        output_format: "png",
        background: "auto",
        moderation: "auto",
      });

      const images = (result.data ?? [])
        .filter((item) => !!item.b64_json)
        .map((item) => ({
          b64_json: item.b64_json!,
          output_format: "png" as const,
        }));

      return NextResponse.json({ images, usage: result.usage ?? null });
    }

    const inputImages = formData.getAll("image").filter((f): f is File => f instanceof File);
    if (inputImages.length === 0) {
      return NextResponse.json(
        { error: "At least one image file is required in edit mode." },
        { status: 400 }
      );
    }

    const mask = formData.get("mask");
    const hasMask = mask instanceof File;

    const referenceImage = formData.get("reference");
    const hasReference = referenceImage instanceof File;

    const editResults = await Promise.all(
      inputImages.map((img) =>
        openai.images.edit({
          model,
          prompt,
          image: hasReference ? [referenceImage as File, img] : [img],
          ...(hasMask ? { mask } : {}),
          n,
          size: "auto",
          quality: "auto",
        })
      )
    );

    const images = editResults.flatMap((result) =>
      (result.data ?? [])
        .filter((item) => !!item.b64_json)
        .map((item) => ({
          b64_json: item.b64_json!,
          output_format: "png" as const,
        }))
    );

    const usage = editResults.reduce<Record<string, number> | null>((acc, r) => {
      if (!r.usage) return acc;
      const u = r.usage as unknown as Record<string, number>;
      if (!acc) return { ...u };
      return Object.fromEntries(
        Object.keys(u).map((k) => [k, (acc[k] ?? 0) + (u[k] ?? 0)])
      );
    }, null);

    return NextResponse.json({ images, usage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected Room Enhancer error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
