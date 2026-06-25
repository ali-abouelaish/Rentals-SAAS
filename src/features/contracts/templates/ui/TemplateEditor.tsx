"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveContractTemplateFields } from "../actions/fields";
import { aiDetectFields } from "../actions/ai-detect";
import { updateContractTemplateMeta } from "../actions/templates";
import { DATA_KEY_GROUPS } from "../domain/data-keys";
import type {
  AiFieldProposal,
  ContractTemplateField,
  ContractTemplateWithFields,
  FieldSource,
  TemplateFieldInput,
} from "../domain/types";
import type { BookingQuestionOption } from "../data/lookups";
import type { Portfolio } from "@/features/properties/domain/types";

const RENDER_SCALE = 1.5;

// Human-readable labels for each binding source, mirroring the "Bind to" dropdown.
const SOURCE_LABELS: Record<FieldSource, string> = {
  manual: "Manual entry at generation",
  booking_response: "Booking form answer",
  pm_tenant: "Tenant",
  booking: "Booking",
  property: "Property",
  unit: "Unit",
  landlord: "Landlord",
  agency: "Agency",
  computed: "Computed",
};

const DATA_KEY_SOURCES = ["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"];

type EditableField = TemplateFieldInput & { localId: string };

// Returns the first field whose binding is incomplete, plus a friendly message,
// so we can surface a clear validation prompt instead of a raw server error.
function findIncompleteField(
  fields: EditableField[],
): { localId: string; message: string } | null {
  for (const f of fields) {
    const name = f.label?.trim() ? `"${f.label.trim()}"` : "An unnamed field";
    if (f.source === "booking_response" && !f.question_id) {
      return { localId: f.localId, message: `${name} is bound to "Booking form answer" — please choose which question it should read before saving.` };
    }
    if (DATA_KEY_SOURCES.includes(f.source) && !f.data_key) {
      return { localId: f.localId, message: `${name} is bound to "${SOURCE_LABELS[f.source]}" — please choose which field it should read before saving.` };
    }
    if (f.source === "manual" && !f.manual_key?.trim()) {
      return { localId: f.localId, message: `${name} uses manual entry — please enter a field key before saving.` };
    }
  }
  return null;
}

function toEditable(f: ContractTemplateField): EditableField {
  return {
    localId: f.id,
    id: f.id,
    label: f.label,
    page_index: f.page_index,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    source: f.source,
    question_id: f.question_id,
    data_key: f.data_key,
    manual_key: f.manual_key,
    manual_default: f.manual_default,
    format: f.format,
    font_size: f.font_size,
    font_weight: f.font_weight,
    text_align: f.text_align,
    truncate_overflow: f.truncate_overflow,
    ai_confidence: f.ai_confidence,
    sort_order: f.sort_order,
  };
}

interface Props {
  template: ContractTemplateWithFields;
  questions: BookingQuestionOption[];
  portfolios: Portfolio[];
}

export function TemplateEditor({ template, questions, portfolios }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<EditableField[]>(template.fields.map(toEditable));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<AiFieldProposal[]>([]);
  const [showProposals, setShowProposals] = useState(false);

  const [name, setName] = useState(template.name);
  const [portfolioId, setPortfolioId] = useState<string>(template.portfolio_id ?? "");
  const [isActive, setIsActive] = useState(template.is_active);

  const [isSaving, startSave] = useTransition();
  const [isAiPending, startAi] = useTransition();
  const [isMetaPending, startMeta] = useTransition();

  const selectedField = fields.find((f) => f.localId === selectedId) ?? null;

  const updateField = (localId: string, patch: Partial<EditableField>) => {
    setFields((prev) => prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
  };

  const deleteField = (localId: string) => {
    setFields((prev) => prev.filter((f) => f.localId !== localId));
    if (selectedId === localId) setSelectedId(null);
  };

  const addField = (rect: { page_index: number; x: number; y: number; width: number; height: number }) => {
    const localId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newField: EditableField = {
      localId,
      label: "New field",
      page_index: rect.page_index,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      source: "manual",
      question_id: null,
      data_key: null,
      manual_key: "field_" + (fields.length + 1),
      manual_default: null,
      format: "text",
      font_size: 10,
      font_weight: "normal",
      text_align: "left",
      truncate_overflow: true,
      ai_confidence: null,
      sort_order: fields.length,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedId(localId);
  };

  const handleSave = () => {
    const incomplete = findIncompleteField(fields);
    if (incomplete) {
      setSelectedId(incomplete.localId);
      toast.error(incomplete.message);
      return;
    }
    startSave(async () => {
      try {
        await saveContractTemplateFields({
          templateId: template.id,
          fields: fields.map(({ localId: _localId, ...rest }) => rest),
        });
        toast.success("Template saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  };

  const handleAiSuggest = () => {
    startAi(async () => {
      try {
        const { proposals: ps } = await aiDetectFields({ templateId: template.id });
        if (ps.length === 0) {
          toast.message("No proposals returned. Mark fields manually by dragging on the PDF.");
        } else {
          toast.success(`${ps.length} proposal${ps.length === 1 ? "" : "s"} ready to review`);
        }
        setProposals(ps);
        setShowProposals(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI detection failed");
      }
    });
  };

  const acceptProposals = (selected: AiFieldProposal[]) => {
    const newFields: EditableField[] = selected.map((p, idx) => ({
      localId: `ai-${Date.now()}-${idx}`,
      label: p.label,
      page_index: p.page_index,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      source: p.suggested_source,
      question_id: p.suggested_source === "booking_response" ? p.suggested_question_id : null,
      data_key:
        ["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"].includes(p.suggested_source)
          ? p.suggested_key
          : null,
      manual_key: p.suggested_source === "manual" ? p.suggested_key : null,
      manual_default: null,
      format: "text",
      font_size: 10,
      font_weight: "normal",
      text_align: "left",
      truncate_overflow: true,
      ai_confidence: p.ai_confidence,
      sort_order: fields.length + idx,
    }));
    setFields((prev) => [...prev, ...newFields]);
    setProposals([]);
    setShowProposals(false);
    toast.success(`Added ${newFields.length} field${newFields.length === 1 ? "" : "s"}`);
  };

  const handleMetaSave = () => {
    startMeta(async () => {
      try {
        await updateContractTemplateMeta({
          id: template.id,
          name: name.trim(),
          description: template.description,
          portfolio_id: portfolioId || null,
          is_active: isActive,
        });
        toast.success("Updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Meta bar */}
      <div className="rounded-xl border border-border bg-surface-card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-foreground-secondary block mb-1">Template name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs font-medium text-foreground-secondary block mb-1">Portfolio</label>
          <select
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">All portfolios</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <Button variant="outline" size="sm" onClick={handleMetaSave} loading={isMetaPending}>
          Update details
        </Button>
        <Button variant="outline" size="sm" onClick={handleAiSuggest} loading={isAiPending}>
          <Sparkles size={14} /> AI suggest fields
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSave} loading={isSaving}>
          <Save size={14} /> Save fields
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <PdfCanvasWithOverlay
          sourceUrl={template.source_signed_url}
          pageSizes={template.page_sizes}
          fields={fields}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddField={addField}
          onUpdateField={updateField}
        />

        <div className="space-y-3">
          {selectedField ? (
            <FieldEditorPanel
              key={selectedField.localId}
              field={selectedField}
              questions={questions}
              onChange={(patch) => updateField(selectedField.localId, patch)}
              onDelete={() => deleteField(selectedField.localId)}
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface-card p-4 text-sm text-foreground-secondary">
              Drag on the PDF to draw a field, or click an existing rectangle to edit it.
            </div>
          )}

          <FieldsSidebar
            fields={fields}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteField}
          />
        </div>
      </div>

      {showProposals && (
        <AiProposalsPanel
          proposals={proposals}
          questions={questions}
          onClose={() => setShowProposals(false)}
          onAccept={acceptProposals}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

interface PdfCanvasProps {
  sourceUrl: string;
  pageSizes: { width: number; height: number }[];
  fields: EditableField[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddField: (rect: { page_index: number; x: number; y: number; width: number; height: number }) => void;
  onUpdateField: (id: string, patch: Partial<EditableField>) => void;
}

function PdfCanvasWithOverlay({
  sourceUrl,
  pageSizes,
  fields,
  selectedId,
  onSelect,
  onAddField,
  onUpdateField,
}: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs").catch(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => import("pdfjs-dist/legacy/build/pdf.mjs") as any,
        );
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument({ url: sourceUrl });
        const doc = await loadingTask.promise;
        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = "";

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: RENDER_SCALE });

          const pageWrap = document.createElement("div");
          pageWrap.dataset.pageIndex = String(i - 1);
          pageWrap.className =
            "relative mx-auto mb-4 shadow-bento rounded-lg overflow-hidden bg-white";
          pageWrap.style.width = `${viewport.width}px`;
          pageWrap.style.height = `${viewport.height}px`;

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "absolute inset-0";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          pageWrap.appendChild(canvas);
          container.appendChild(pageWrap);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }

        if (!cancelled) setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render PDF");
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  // Drag-to-create + selection logic, attached as a single pointer-handler on the container.
  const dragState = useRef<{
    pageIndex: number;
    startX: number;
    startY: number;
    pageEl: HTMLElement;
    overlay: HTMLDivElement;
    mode: "create" | "move" | "resize";
    fieldId?: string;
    initialField?: EditableField;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;

    // Click on existing field rect?
    const fieldEl = target.closest<HTMLElement>("[data-field-id]");
    if (fieldEl) {
      const fid = fieldEl.dataset.fieldId!;
      onSelect(fid);
      const field = fields.find((f) => f.localId === fid);
      if (!field || !containerRef.current) return;

      const pageEl = fieldEl.closest<HTMLElement>("[data-page-index]");
      if (!pageEl) return;

      const isHandle = target.dataset.handle;
      const rect = pageEl.getBoundingClientRect();
      dragState.current = {
        pageIndex: field.page_index,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        pageEl,
        overlay: fieldEl as HTMLDivElement,
        mode: isHandle ? "resize" : "move",
        fieldId: fid,
        initialField: { ...field },
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }

    // Otherwise, drag on a page to create a new field.
    const pageEl = target.closest<HTMLElement>("[data-page-index]");
    if (!pageEl) {
      onSelect(null);
      return;
    }
    const pageIndex = Number(pageEl.dataset.pageIndex);
    const rect = pageEl.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const overlay = document.createElement("div");
    overlay.className = "absolute pointer-events-none border-2 border-dashed border-accent bg-accent/10";
    overlay.style.left = `${startX}px`;
    overlay.style.top = `${startY}px`;
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    pageEl.appendChild(overlay);

    dragState.current = {
      pageIndex,
      startX,
      startY,
      pageEl,
      overlay,
      mode: "create",
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;

    const rect = st.pageEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (st.mode === "create") {
      const left = Math.min(st.startX, x);
      const top = Math.min(st.startY, y);
      const w = Math.abs(x - st.startX);
      const h = Math.abs(y - st.startY);
      st.overlay.style.left = `${left}px`;
      st.overlay.style.top = `${top}px`;
      st.overlay.style.width = `${w}px`;
      st.overlay.style.height = `${h}px`;
      return;
    }

    if (st.mode === "move" && st.fieldId && st.initialField) {
      const dx = (x - st.startX) / RENDER_SCALE;
      const dy = (y - st.startY) / RENDER_SCALE;
      const newX = Math.max(0, st.initialField.x + dx);
      const newY = Math.max(0, st.initialField.y + dy);
      onUpdateField(st.fieldId, { x: newX, y: newY });
      return;
    }

    if (st.mode === "resize" && st.fieldId && st.initialField) {
      const dx = (x - st.startX) / RENDER_SCALE;
      const dy = (y - st.startY) / RENDER_SCALE;
      onUpdateField(st.fieldId, {
        width: Math.max(8, st.initialField.width + dx),
        height: Math.max(8, st.initialField.height + dy),
      });
      return;
    }
  };

  const onPointerUp = () => {
    const st = dragState.current;
    if (!st) return;

    if (st.mode === "create") {
      const left = parseFloat(st.overlay.style.left);
      const top = parseFloat(st.overlay.style.top);
      const w = parseFloat(st.overlay.style.width);
      const h = parseFloat(st.overlay.style.height);
      st.overlay.remove();
      if (w >= 8 && h >= 8) {
        onAddField({
          page_index: st.pageIndex,
          x: left / RENDER_SCALE,
          y: top / RENDER_SCALE,
          width: w / RENDER_SCALE,
          height: h / RENDER_SCALE,
        });
      }
    }

    dragState.current = null;
  };

  const fieldsByPage = useMemo(() => {
    const map = new Map<number, EditableField[]>();
    fields.forEach((f) => {
      if (!map.has(f.page_index)) map.set(f.page_index, []);
      map.get(f.page_index)!.push(f);
    });
    return map;
  }, [fields]);

  return (
    <div className="rounded-xl border border-border bg-surface-inset p-4 max-h-[80vh] overflow-auto">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}
      {!loaded && !error && (
        <div className="text-sm text-foreground-secondary py-4">Loading PDF…</div>
      )}
      <div
        ref={containerRef}
        className="relative select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {/* Render React-controlled field rectangles on top of canvases */}
      {loaded && containerRef.current && (
        <div className="hidden">
          {/* Effect below sync's DOM overlays. We use direct DOM manipulation via portal-less effect for perf. */}
          <FieldOverlays
            container={containerRef.current}
            fieldsByPage={fieldsByPage}
            pageSizes={pageSizes}
            selectedId={selectedId}
          />
        </div>
      )}
    </div>
  );
}

interface FieldOverlaysProps {
  container: HTMLElement;
  fieldsByPage: Map<number, EditableField[]>;
  pageSizes: { width: number; height: number }[];
  selectedId: string | null;
}

function FieldOverlays({ container, fieldsByPage, pageSizes: _pageSizes, selectedId }: FieldOverlaysProps) {
  useEffect(() => {
    const pageEls = container.querySelectorAll<HTMLElement>("[data-page-index]");
    pageEls.forEach((pageEl) => {
      // Clear previous field overlays
      pageEl.querySelectorAll<HTMLElement>("[data-field-id]").forEach((el) => el.remove());

      const idx = Number(pageEl.dataset.pageIndex);
      const list = fieldsByPage.get(idx) ?? [];
      for (const f of list) {
        const div = document.createElement("div");
        div.dataset.fieldId = f.localId;
        const isSelected = selectedId === f.localId;
        div.className = `absolute cursor-move border-2 ${
          isSelected
            ? "border-accent bg-accent/20"
            : "border-blue-400/70 bg-blue-400/10 hover:bg-blue-400/20"
        }`;
        div.style.left = `${f.x * RENDER_SCALE}px`;
        div.style.top = `${f.y * RENDER_SCALE}px`;
        div.style.width = `${f.width * RENDER_SCALE}px`;
        div.style.height = `${f.height * RENDER_SCALE}px`;

        const label = document.createElement("div");
        label.className =
          "absolute -top-5 left-0 text-[10px] font-medium px-1 py-0.5 rounded bg-accent text-accent-fg whitespace-nowrap";
        label.textContent = f.label;
        div.appendChild(label);

        if (isSelected) {
          const handle = document.createElement("div");
          handle.dataset.handle = "se";
          handle.className =
            "absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-accent border border-white rounded-sm cursor-nwse-resize";
          div.appendChild(handle);
        }

        pageEl.appendChild(div);
      }
    });
  });

  return null;
}

// ── Field editor panel ─────────────────────────────────────────────

interface FieldEditorProps {
  field: EditableField;
  questions: BookingQuestionOption[];
  onChange: (patch: Partial<EditableField>) => void;
  onDelete: () => void;
}

function FieldEditorPanel({ field, questions, onChange, onDelete }: FieldEditorProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-foreground">Field details</h3>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-red-500 hover:bg-red-50"
          aria-label="Delete field"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Label</label>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">Bind to</label>
        <select
          value={field.source}
          onChange={(e) =>
            onChange({
              source: e.target.value as FieldSource,
              data_key: null,
              question_id: null,
              manual_key: e.target.value === "manual" ? field.manual_key ?? "field" : null,
            })
          }
          className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
        >
          <option value="manual">Manual entry at generation</option>
          <option value="booking_response">Booking form answer</option>
          <option value="pm_tenant">Tenant</option>
          <option value="booking">Booking</option>
          <option value="property">Property</option>
          <option value="unit">Unit</option>
          <option value="landlord">Landlord</option>
          <option value="agency">Agency</option>
          <option value="computed">Computed</option>
        </select>
      </div>

      {field.source === "booking_response" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Question</label>
          <select
            value={field.question_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              // Built-in applicant fields live on the booking, not as questions —
              // selecting one rebinds the field to the "Booking" source.
              if (v.startsWith("booking:")) {
                onChange({ source: "booking", data_key: v.slice("booking:".length), question_id: null });
              } else {
                onChange({ question_id: v || null });
              }
            }}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          >
            <option value="">Select a question…</option>
            <optgroup label="Collected on every booking form">
              {(DATA_KEY_GROUPS["booking"] ?? [])
                .filter((opt) => opt.key.startsWith("booking.applicant"))
                .map((opt) => (
                  <option key={opt.key} value={`booking:${opt.key}`}>
                    {opt.label}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Custom questions">
              {questions.map((q) => {
                const disabled = q.question_type === "file_upload" || q.question_type === "info";
                return (
                  <option key={q.id} value={q.id} disabled={disabled}>
                    {q.form_name ? `${q.form_name} → ` : ""}
                    {q.question_text}
                    {disabled ? " (not stampable)" : ""}
                  </option>
                );
              })}
            </optgroup>
          </select>
        </div>
      )}

      {["property", "unit", "landlord", "agency", "booking", "pm_tenant", "computed"].includes(field.source) && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Field</label>
          <select
            value={field.data_key ?? ""}
            onChange={(e) => onChange({ data_key: e.target.value || null })}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          >
            <option value="">Select a field…</option>
            {(DATA_KEY_GROUPS[field.source] ?? []).map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {field.source === "manual" && (
        <>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Field key (e.g. start_date)</label>
            <input
              value={field.manual_key ?? ""}
              onChange={(e) => onChange({ manual_key: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Default value (optional)</label>
            <input
              value={field.manual_default ?? ""}
              onChange={(e) => onChange({ manual_default: e.target.value || null })}
              className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Format</label>
          <select
            value={field.format}
            onChange={(e) => onChange({ format: e.target.value as EditableField["format"] })}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          >
            <option value="text">Text</option>
            <option value="date">Date</option>
            <option value="currency_gbp">GBP</option>
            <option value="number">Number</option>
            <option value="multiline">Multiline</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Font size</label>
          <input
            type="number"
            min={4}
            max={48}
            value={field.font_size}
            onChange={(e) => onChange({ font_size: Number(e.target.value) || 10 })}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Weight</label>
          <select
            value={field.font_weight}
            onChange={(e) => onChange({ font_weight: e.target.value as EditableField["font_weight"] })}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Align</label>
          <select
            value={field.text_align}
            onChange={(e) => onChange({ text_align: e.target.value as EditableField["text_align"] })}
            className="w-full rounded-lg border border-border bg-surface-inset px-2 py-1.5 text-sm"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={field.truncate_overflow}
          onChange={(e) => onChange({ truncate_overflow: e.target.checked })}
        />
        Truncate overflow with ellipsis (otherwise shrink to fit)
      </label>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-foreground-secondary pt-2 border-t border-border">
        <span>Page {field.page_index + 1}</span>
        <span>x {Math.round(field.x)}, y {Math.round(field.y)}</span>
        <span>w {Math.round(field.width)}</span>
        <span>h {Math.round(field.height)}</span>
      </div>
    </div>
  );
}

interface FieldsSidebarProps {
  fields: EditableField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function FieldsSidebar({ fields, selectedId, onSelect, onDelete }: FieldsSidebarProps) {
  if (fields.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface-card p-3 max-h-[40vh] overflow-y-auto">
      <p className="text-xs font-semibold text-foreground-secondary mb-2 px-1">{fields.length} field{fields.length === 1 ? "" : "s"}</p>
      <ul className="space-y-1">
        {fields.map((f) => (
          <li
            key={f.localId}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${
              selectedId === f.localId ? "bg-accent/10 text-foreground" : "hover:bg-surface-inset text-foreground-secondary"
            }`}
            onClick={() => onSelect(f.localId)}
          >
            <span className="truncate">
              <span className="font-medium text-foreground">p{f.page_index + 1}</span> — {f.label}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(f.localId);
              }}
              className="text-red-500 hover:bg-red-50 rounded p-0.5"
              aria-label="Delete field"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface AiProposalsPanelProps {
  proposals: AiFieldProposal[];
  questions: BookingQuestionOption[];
  onClose: () => void;
  onAccept: (selected: AiFieldProposal[]) => void;
}

function AiProposalsPanel({ proposals, questions: _questions, onClose, onAccept }: AiProposalsPanelProps) {
  const [picked, setPicked] = useState<Set<number>>(new Set(proposals.map((_, i) => i)));

  if (proposals.length === 0) return null;

  const toggle = (idx: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-border rounded-2xl shadow-bento max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">AI proposals</h2>
          <button type="button" onClick={onClose} className="text-sm text-foreground-secondary hover:text-foreground">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {proposals.map((p, idx) => (
            <label
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                picked.has(idx) ? "border-accent bg-accent/5" : "border-border bg-surface-inset"
              }`}
            >
              <input
                type="checkbox"
                checked={picked.has(idx)}
                onChange={() => toggle(idx)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.label}</p>
                <p className="text-xs text-foreground-secondary">
                  Page {p.page_index + 1} · {p.suggested_source}
                  {p.suggested_key ? ` → ${p.suggested_key}` : ""}
                  {" · "}
                  confidence {Math.round(p.ai_confidence * 100)}%
                </p>
              </div>
            </label>
          ))}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAccept(proposals.filter((_, i) => picked.has(i)))}
          >
            <Plus size={14} /> Add {picked.size} field{picked.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
