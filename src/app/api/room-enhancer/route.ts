import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

type Mode = "generate" | "edit";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Server missing OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();

    const mode = (formData.get("mode") as Mode | null) ?? "generate";
    const model =
      (formData.get("model") as "gpt-image-1" | "gpt-image-1-mini" | "gpt-image-1.5" | null) ??
      "gpt-image-1.5";
    const prompt = ((formData.get("prompt") as string | null) ?? "").trim();
    const n = Math.max(1, Math.min(Number(formData.get("n") ?? 1), 4));

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

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

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required in edit mode." },
        { status: 400 }
      );
    }

    const mask = formData.get("mask");
    const hasMask = mask instanceof File;

    const result = await openai.images.edit({
      model,
      prompt,
      image: [image],
      ...(hasMask ? { mask } : {}),
      n,
      size: "auto",
      quality: "auto",
    });

    const images = (result.data ?? [])
      .filter((item) => !!item.b64_json)
      .map((item) => ({
        b64_json: item.b64_json!,
        output_format: "png" as const,
      }));

    return NextResponse.json({ images, usage: result.usage ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected Room Enhancer error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
