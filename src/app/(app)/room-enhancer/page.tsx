"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Eraser, Save, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "generate" | "edit";

type ApiImage = {
  b64_json: string;
  output_format: "png" | "jpeg" | "webp";
};

type DrawnPoint = {
  x: number;
  y: number;
  size: number;
};

type EditHistoryEntry = {
  id: string;
  createdAt: number;
  prompt: string;
  resultDataUrls: string[];
};

const IMAGE_COUNT_OPTIONS = [
  { value: "1", label: "1 image" },
  { value: "2", label: "2 images" },
  { value: "3", label: "3 images" },
  { value: "4", label: "4 images" },
];

export default function RoomEnhancerPage() {
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<Mode>("edit");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState("1");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<ApiImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMaskEditor, setShowMaskEditor] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [drawnPoints, setDrawnPoints] = useState<DrawnPoint[]>([]);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [maskPreviewUrl, setMaskPreviewUrl] = useState<string | null>(null);
  const [originalImageSize, setOriginalImageSize] = useState<{ width: number; height: number } | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualFeedbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  function getHistoryStorageKey(id: string) {
    return `room-enhancer:edit-history:${id}`;
  }

  function readHistoryFromStorage(id: string): EditHistoryEntry[] {
    try {
      const raw = localStorage.getItem(getHistoryStorageKey(id));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as EditHistoryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistHistory(id: string, nextHistory: EditHistoryEntry[]) {
    localStorage.setItem(getHistoryStorageKey(id), JSON.stringify(nextHistory));
  }

  useEffect(() => {
    async function resolveUser() {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) {
        setEditHistory(readHistoryFromStorage(id));
      } else {
        setEditHistory([]);
      }
    }
    resolveUser();
  }, [supabase.auth]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    setDrawnPoints([]);
    setMaskFile(null);
    setMaskPreviewUrl(null);
    setShowMaskEditor(false);
    setOriginalImageSize(null);

    if (!previewUrl) return;
    const img = new window.Image();
    img.onload = () => {
      setOriginalImageSize({ width: img.width, height: img.height });
      if (!visualFeedbackCanvasRef.current) {
        visualFeedbackCanvasRef.current = document.createElement("canvas");
      }
      visualFeedbackCanvasRef.current.width = img.width;
      visualFeedbackCanvasRef.current.height = img.height;
    };
    img.src = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    const displayCanvas = canvasRef.current;
    const feedbackCanvas = visualFeedbackCanvasRef.current;
    if (!displayCanvas || !feedbackCanvas || !originalImageSize) return;

    displayCanvas.width = originalImageSize.width;
    displayCanvas.height = originalImageSize.height;

    const displayCtx = displayCanvas.getContext("2d");
    const feedbackCtx = feedbackCanvas.getContext("2d");
    if (!displayCtx || !feedbackCtx) return;

    feedbackCtx.clearRect(0, 0, feedbackCanvas.width, feedbackCanvas.height);
    feedbackCtx.fillStyle = "red";
    drawnPoints.forEach((point) => {
      feedbackCtx.beginPath();
      feedbackCtx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      feedbackCtx.fill();
    });

    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.save();
    displayCtx.globalAlpha = 0.45;
    displayCtx.drawImage(feedbackCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.restore();
  }, [drawnPoints, originalImageSize]);

  const resultDataUrls = useMemo(
    () => results.map((img) => `data:image/${img.output_format};base64,${img.b64_json}`),
    [results]
  );

  function getMousePos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function addPoint(x: number, y: number) {
    setDrawnPoints((prev) => [...prev, { x, y, size: brushSize }]);
    setMaskFile(null);
    setMaskPreviewUrl(null);
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    isDrawing.current = true;
    const current = getMousePos(e);
    if (!current) return;
    lastPos.current = current;
    addPoint(current.x, current.y);
  }

  function drawLine(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return;
    e.preventDefault();
    const current = getMousePos(e);
    if (!current || !lastPos.current) return;

    const dist = Math.hypot(current.x - lastPos.current.x, current.y - lastPos.current.y);
    const angle = Math.atan2(current.y - lastPos.current.y, current.x - lastPos.current.x);
    const step = Math.max(1, brushSize / 4);

    for (let i = step; i < dist; i += step) {
      const x = lastPos.current.x + Math.cos(angle) * i;
      const y = lastPos.current.y + Math.sin(angle) * i;
      addPoint(x, y);
    }
    addPoint(current.x, current.y);
    lastPos.current = current;
  }

  function stopDrawing() {
    isDrawing.current = false;
    lastPos.current = null;
  }

  function clearMask() {
    setDrawnPoints([]);
    setMaskFile(null);
    setMaskPreviewUrl(null);
  }

  function saveMask() {
    if (!originalImageSize || drawnPoints.length === 0) {
      setMaskFile(null);
      setMaskPreviewUrl(null);
      return;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = originalImageSize.width;
    offscreen.height = originalImageSize.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    // OpenAI image edit mask: transparent pixels mark editable areas.
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.globalCompositeOperation = "destination-out";
    drawnPoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
      ctx.fill();
    });

    const dataUrl = offscreen.toDataURL("image/png");
    setMaskPreviewUrl(dataUrl);

    offscreen.toBlob((blob) => {
      if (!blob) return;
      setMaskFile(new File([blob], "room-enhancer-mask.png", { type: "image/png" }));
    }, "image/png");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("mode", mode);
      form.append("prompt", prompt.trim());
      form.append("n", count);

      if (mode === "edit") {
        if (!imageFile) {
          throw new Error("Please upload an image first.");
        }
        form.append("image", imageFile, imageFile.name);
        if (maskFile) {
          form.append("mask", maskFile, maskFile.name);
        }
      }

      const res = await fetch("/api/room-enhancer", {
        method: "POST",
        body: form,
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to generate image.");
      }

      const apiImages = (payload.images || []) as ApiImage[];
      setResults(apiImages);

      if (mode === "edit" && userId) {
        const savedUrls = apiImages.map(
          (img) => `data:image/${img.output_format};base64,${img.b64_json}`
        );
        const newEntry: EditHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: Date.now(),
          prompt: prompt.trim(),
          resultDataUrls: savedUrls,
        };
        setEditHistory((prev) => {
          const next = [newEntry, ...prev].slice(0, 15);
          persistHistory(userId, next);
          return next;
        });
      }
    } catch (err: unknown) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Room Enhancer</h1>
        <p className="text-sm text-foreground-secondary mt-1">
          Generate new room concepts or edit an existing room image with AI.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Enhancer Controls</CardTitle>
            <CardDescription>Choose mode, prompt, and model settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="inline-flex rounded-xl border border-border bg-surface-inset p-1">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    mode === "edit"
                      ? "bg-brand text-brand-fg"
                      : "text-foreground-secondary hover:bg-surface-card"
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setMode("generate")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    mode === "generate"
                      ? "bg-brand text-brand-fg"
                      : "text-foreground-secondary hover:bg-surface-card"
                  }`}
                >
                  Generate
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                  Number of images
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={loading}
                  className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary transition-all duration-base cursor-pointer focus:outline-none focus:border-brand focus:ring-2 focus:ring-border-ring/20 disabled:bg-surface-inset disabled:text-foreground-muted disabled:cursor-not-allowed appearance-none bg-no-repeat bg-right"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                    backgroundPosition: "right 0.5rem center",
                    backgroundSize: "1.5em 1.5em",
                    paddingRight: "2.5rem",
                  }}
                >
                  {IMAGE_COUNT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1.5">Prompt</label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Modernize this room with warm lighting, wooden accents, and minimalist furniture."
                  required
                  disabled={loading}
                />
              </div>

              {mode === "edit" && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-foreground-muted">Source image</label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    disabled={loading}
                  />
                  {previewUrl && (
                    <div className="space-y-2 rounded-xl border border-border bg-surface-inset p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground-secondary">Brush Mask Editor</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowMaskEditor((v) => !v)}
                            disabled={!originalImageSize || loading}
                          >
                            {showMaskEditor ? "Hide editor" : "Show editor"}
                          </Button>
                        </div>

                        <div
                          className="relative mx-auto w-full overflow-hidden rounded border border-border"
                          style={{
                            maxWidth: originalImageSize
                              ? `min(100%, ${originalImageSize.width}px)`
                              : undefined,
                            aspectRatio: originalImageSize
                              ? `${originalImageSize.width} / ${originalImageSize.height}`
                              : undefined,
                          }}
                        >
                          <Image
                            src={previewUrl}
                            alt="Uploaded room preview"
                            width={originalImageSize?.width ?? 640}
                            height={originalImageSize?.height ?? 360}
                            className="block h-auto w-full"
                            unoptimized
                          />
                          {showMaskEditor && originalImageSize && (
                            <canvas
                              ref={canvasRef}
                              width={originalImageSize.width}
                              height={originalImageSize.height}
                              className="absolute top-0 left-0 h-full w-full cursor-crosshair"
                              onMouseDown={startDrawing}
                              onMouseMove={drawLine}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              onTouchStart={startDrawing}
                              onTouchMove={drawLine}
                              onTouchEnd={stopDrawing}
                            />
                          )}
                        </div>

                        {showMaskEditor && originalImageSize && (
                          <>
                            <p className="text-xs text-foreground-muted">
                              Paint areas you want AI to change, then click Save Mask.
                            </p>
                            <div className="space-y-1">
                              <label className="block text-xs font-medium text-foreground-secondary">
                                Brush size: {brushSize}px
                              </label>
                              <Input
                                type="range"
                                min={5}
                                max={120}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={clearMask}>
                                <Eraser className="h-4 w-4" />
                                Clear
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={saveMask}
                                disabled={drawnPoints.length === 0}
                              >
                                <Save className="h-4 w-4" />
                                Save Mask
                              </Button>
                            </div>
                          </>
                        )}

                        {maskFile && (
                          <p className="text-xs text-success">
                            Mask ready: {maskFile.name}
                          </p>
                        )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full">
                <Wand2 className="h-4 w-4" />
                {loading ? "Processing..." : "Run Room Enhancer"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>Generated room outputs appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            {resultDataUrls.length === 0 ? (
              <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border text-foreground-muted">
                <div className="text-center">
                  <Upload className="mx-auto mb-2 h-5 w-5" />
                  <p className="text-sm">No results yet</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {resultDataUrls.map((src, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="relative overflow-hidden rounded-xl border border-border bg-surface-inset">
                      <Image
                        src={src}
                        alt={`Room enhancer result ${idx + 1}`}
                        width={800}
                        height={800}
                        className="w-full h-auto object-contain"
                        unoptimized
                      />
                    </div>
                    <a
                      href={src}
                      download={`room-enhancer-${idx + 1}.${results[idx]?.output_format || "png"}`}
                      className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs text-foreground-secondary hover:bg-surface-inset"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Edit history</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!userId) return;
                    setEditHistory([]);
                    persistHistory(userId, []);
                  }}
                  disabled={!userId || editHistory.length === 0}
                >
                  Clear
                </Button>
              </div>

              {!userId ? (
                <p className="text-xs text-foreground-muted">Sign in to keep user-specific edit history.</p>
              ) : editHistory.length === 0 ? (
                <p className="text-xs text-foreground-muted">No edits yet for this user.</p>
              ) : (
                <div className="space-y-3">
                  {editHistory.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-border bg-surface-inset p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-foreground-secondary truncate">{entry.prompt || "No prompt"}</p>
                        <span className="text-[11px] text-foreground-muted whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {entry.resultDataUrls.slice(0, 4).map((src, idx) => (
                          <div key={`${entry.id}-${idx}`} className="overflow-hidden rounded-md border border-border bg-surface-card">
                            <Image
                              src={src}
                              alt={`History result ${idx + 1}`}
                              width={240}
                              height={160}
                              className="w-full h-auto object-cover"
                              unoptimized
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setResults(
                              entry.resultDataUrls.map((dataUrl) => {
                                const format = dataUrl.includes("image/jpeg")
                                  ? "jpeg"
                                  : dataUrl.includes("image/webp")
                                    ? "webp"
                                    : "png";
                                const base64 = dataUrl.split(",")[1] ?? "";
                                return { b64_json: base64, output_format: format as ApiImage["output_format"] };
                              })
                            )
                          }
                        >
                          Load results
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
