// Server-side text-with-positions extraction for AI field detection.
// Uses pdfjs-dist's legacy Node-friendly build.
//
// Coordinates are converted from PDF.js's PDF-baseline space (origin
// bottom-left, item y = transform[5]) to our top-left points space
// (origin top-left, y increases downward). All downstream code — the
// editor UI, AI payloads, pdf-lib stamping — speaks the top-left system.

export type ExtractedTextItem = {
  text: string;
  x: number;
  y: number; // top-left origin
  w: number;
  h: number;
};

export type ExtractedPage = {
  page_index: number;
  page_width: number;
  page_height: number;
  items: ExtractedTextItem[];
};

type PdfJsTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export async function extractTextWithPositions(sourceBytes: Uint8Array | ArrayBuffer): Promise<ExtractedPage[]> {
  // Dynamic import — pdfjs-dist's legacy build is ESM and we want it lazy-loaded.
  // The legacy build is the Node-friendly entry point.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdfjs-dist 4.x bootstraps a "fake worker" in Node even when disableWorker
  // is true; that bootstrap insists on a valid workerSrc, so point it at the
  // installed worker file via a file:// URL.
  if (pdfjs.GlobalWorkerOptions) {
    const path = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  }

  const data =
    sourceBytes instanceof Uint8Array ? sourceBytes : new Uint8Array(sourceBytes);

  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  const out: ExtractedPage[] = [];
  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const pageWidth = viewport.width;

    const content = await page.getTextContent();
    const items: ExtractedTextItem[] = (content.items as PdfJsTextItem[])
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => {
        const tx = it.transform; // [a, b, c, d, e, f]
        const x = tx[4];
        const yBaseline = tx[5];
        // Approximate visual height = font size component (|d|).
        const h = Math.max(Math.abs(tx[3]), it.height ?? 0) || 10;
        const yTopLeft = pageHeight - yBaseline - h;
        return {
          text: it.str,
          x,
          y: yTopLeft,
          w: it.width ?? 0,
          h,
        };
      });

    out.push({
      page_index: pageIndex,
      page_width: pageWidth,
      page_height: pageHeight,
      items,
    });
  }
  return out;
}

/**
 * Truncate items per page when payload would blow the OpenAI token budget.
 * Returns a shallow copy with each page's items capped.
 */
export function capItemsPerPage(pages: ExtractedPage[], maxPerPage: number): ExtractedPage[] {
  return pages.map((p) => ({
    ...p,
    items: p.items.length > maxPerPage ? p.items.slice(0, maxPerPage) : p.items,
  }));
}
