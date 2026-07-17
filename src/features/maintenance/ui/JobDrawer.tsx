"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Trash2,
  Plus,
  Image,
  Wrench,
  CalendarDays,
  User,
  Tag,
  BarChart2,
  Receipt,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  JOB_STATUS_LABELS,
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  JOB_STATUS_COLORS,
  JOB_CATEGORY_LABELS,
} from "../domain/types";
import type { MaintenanceJob, JobStatus, MaintenanceCost, MaintenanceSupplier } from "../domain/types";
import { updateJobStatus, addJobCost, deleteJobCost, deleteJobPhoto, uploadJobPhoto } from "../actions";
import { assignSupplierToJob } from "../actions/suppliers";
import { addJobComment, deleteJobComment } from "../actions/comments";
import { CommentsPanel } from "./CommentsPanel";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function fmtPounds(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(pence / 100);
}

// ──────────────────────────────────────────────────────────
// Add Cost form (inline)
// ──────────────────────────────────────────────────────────

const costSchema = z.object({
  description: z.string().min(1, "Required"),
  amount_pounds: z.coerce.number().positive("Must be > 0"),
  date_incurred: z.string().min(1, "Required"),
  supplier: z.string().optional(),
  invoice_ref: z.string().optional(),
});

type CostFormValues = z.infer<typeof costSchema>;

interface AddCostFormProps {
  jobId: string;
  propertyId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function AddCostForm({ jobId, propertyId, onSaved, onCancel }: AddCostFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CostFormValues>({
    resolver: zodResolver(costSchema),
    defaultValues: { date_incurred: new Date().toISOString().split("T")[0] },
  });

  async function onSubmit(v: CostFormValues) {
    setSubmitting(true);
    try {
      const result = await addJobCost({
        job_id: jobId,
        property_id: propertyId,
        description: v.description,
        amount_pounds: v.amount_pounds,
        date_incurred: v.date_incurred,
        supplier: v.supplier || null,
        invoice_ref: v.invoice_ref || null,
      });
      if (result?.error) toast.error(result.error);
      else { toast.success("Cost added"); onSaved(); }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-surface-inset rounded-xl p-4 space-y-3 border border-border">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">New Cost</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">Description <span className="text-red-500">*</span></label>
          <input
            {...register("description")}
            placeholder="e.g. Plumber call-out"
            className={cn("w-full rounded-lg border px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/50", errors.description ? "border-red-400" : "border-border")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Amount (£) <span className="text-red-500">*</span></label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...register("amount_pounds")}
            placeholder="0.00"
            className={cn("w-full rounded-lg border px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/50", errors.amount_pounds ? "border-red-400" : "border-border")}
          />
          {errors.amount_pounds && <p className="text-xs text-red-600 mt-0.5">{errors.amount_pounds.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            {...register("date_incurred")}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Supplier</label>
          <input
            {...register("supplier")}
            placeholder="Contractor name"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Invoice Ref</label>
          <input
            {...register("invoice_ref")}
            placeholder="INV-001"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-surface-card transition-colors">Cancel</button>
        <button type="submit" disabled={submitting} className="text-sm px-4 py-1.5 rounded-lg bg-brand text-brand-fg font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
          {submitting ? "Saving…" : "Save Cost"}
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────
// Status Selector
// ──────────────────────────────────────────────────────────

const ALL_STATUSES: JobStatus[] = ["open", "in_progress", "pending_parts", "pending_quote", "resolved", "closed"];

interface StatusSelectorProps {
  current: JobStatus;
  jobId: string;
  onChanged: (newStatus: JobStatus) => void;
}

function StatusSelector({ current, jobId, onChanged }: StatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sColors = JOB_STATUS_COLORS[current];

  async function change(s: JobStatus) {
    if (s === current) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    try {
      const result = await updateJobStatus(jobId, s);
      if (result?.error) toast.error(result.error);
      else { toast.success(`Status → ${JOB_STATUS_LABELS[s]}`); onChanged(s); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer select-none transition-opacity",
          sColors.bg, sColors.text,
          loading && "opacity-60"
        )}
      >
        {loading ? "Updating…" : JOB_STATUS_LABELS[current]}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-surface-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            {ALL_STATUSES.map((s) => {
              const c = JOB_STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  onClick={() => change(s)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-xs font-medium transition-colors hover:bg-surface-inset",
                    s === current ? `${c.bg} ${c.text}` : "text-foreground"
                  )}
                >
                  {JOB_STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Main Drawer
// ──────────────────────────────────────────────────────────

interface JobDrawerProps {
  job: MaintenanceJob | null;
  suppliers: MaintenanceSupplier[];
  open: boolean;
  onClose: () => void;
  onJobUpdated: (updated: Partial<MaintenanceJob> & { id: string }) => void;
}

export function JobDrawer({ job, suppliers, open, onClose, onJobUpdated }: JobDrawerProps) {
  const [showAddCost, setShowAddCost] = useState(false);
  const [deletingCostId, setDeletingCostId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [assigningSupplier, setAssigningSupplier] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!job) return null;

  const pColors = JOB_PRIORITY_COLORS[job.priority];

  async function handleDeleteCost(cost: MaintenanceCost) {
    if (!confirm(`Delete cost "${cost.description}"? This will also remove it from Profitability.`)) return;
    setDeletingCostId(cost.id);
    try {
      const result = await deleteJobCost(cost.id, job!.id, job!.property_id);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Cost removed");
        const newCosts = (job!.costs ?? []).filter((c) => c.id !== cost.id);
        const newTotal = newCosts.reduce((s, c) => s + c.amount, 0);
        onJobUpdated({ id: job!.id, costs: newCosts, total_cost: newTotal });
      }
    } finally {
      setDeletingCostId(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    setDeletingPhotoId(photoId);
    try {
      const result = await deleteJobPhoto(photoId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Photo removed");
        const newPhotos = (job!.photos ?? []).filter((p) => p.id !== photoId);
        onJobUpdated({ id: job!.id, photos: newPhotos });
      }
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function handleAddComment(body: string): Promise<string | null> {
    const result = await addJobComment(job!.id, body);
    if (result?.error || !result?.comment) {
      return result?.error ?? "Couldn't post note";
    }
    toast.success("Note added");
    onJobUpdated({ id: job!.id, comments: [...(job!.comments ?? []), result.comment] });
    return null;
  }

  async function handleDeleteComment(commentId: string): Promise<string | null> {
    const result = await deleteJobComment(commentId);
    if (result?.error) return result.error;
    toast.success("Note deleted");
    onJobUpdated({
      id: job!.id,
      comments: (job!.comments ?? []).filter((c) => c.id !== commentId),
    });
    return null;
  }

  async function handleAssignSupplier(supplierId: string) {
    const newId = supplierId || null;
    if (newId === (job!.supplier_id ?? null)) return;
    setAssigningSupplier(true);
    try {
      const result = await assignSupplierToJob(job!.id, newId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success(newId ? "Supplier assigned" : "Supplier unassigned");
        onJobUpdated({
          id: job!.id,
          supplier_id: newId,
          assigned_to: result.assigned_to ?? null,
        });
      }
    } finally {
      setAssigningSupplier(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${job!.tenant_id}/maintenance/${job!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("property_photos").upload(path, file);
      if (uploadError) { toast.error("Failed to upload photo"); return; }
      const { data: urlData } = supabase.storage.from("property_photos").getPublicUrl(path);
      const result = await uploadJobPhoto(job!.id, urlData.publicUrl);
      if (result?.error) { toast.error(result.error); return; }
      toast.success("Photo added");
      const newPhotos = [...(job!.photos ?? []), result.photo!];
      onJobUpdated({ id: job!.id, photos: newPhotos });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  const costs = job.costs ?? [];
  const photos = job.photos ?? [];
  const comments = job.comments ?? [];
  const totalCost = costs.reduce((s, c) => s + c.amount, 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-[600px] p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                    pColors.bg, pColors.text, pColors.border
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", pColors.dot)} />
                  {JOB_PRIORITY_LABELS[job.priority]}
                </span>
                <span className="text-xs text-foreground-secondary">{JOB_CATEGORY_LABELS[job.category]}</span>
              </div>
              <SheetTitle className="text-base font-semibold leading-snug">{job.title}</SheetTitle>
              <SheetDescription className="text-xs text-foreground-secondary mt-0.5">
                {job.property_name}
                {job.unit_label && ` · ${job.unit_label}`}
              </SheetDescription>
            </div>
            <StatusSelector
              current={job.status}
              jobId={job.id}
              onChanged={(s) => onJobUpdated({ id: job.id, status: s })}
            />
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="h-full">
            <div className="px-6 pt-4 pb-0 border-b border-border">
              <TabsList className="w-full justify-start gap-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="costs">
                  Costs
                  {costs.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand/10 text-brand text-[10px] px-1.5 py-0.5 font-semibold">
                      {costs.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="photos">
                  Photos
                  {photos.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand/10 text-brand text-[10px] px-1.5 py-0.5 font-semibold">
                      {photos.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes">
                  Notes
                  {comments.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-brand/10 text-brand text-[10px] px-1.5 py-0.5 font-semibold">
                      {comments.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="p-6 space-y-5">
              {/* Description */}
              {job.description && (
                <div>
                  <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-foreground leading-relaxed bg-surface-inset rounded-xl p-4">
                    {job.description}
                  </p>
                </div>
              )}

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Tag, label: "Category", value: JOB_CATEGORY_LABELS[job.category] },
                  { icon: BarChart2, label: "Priority", value: JOB_PRIORITY_LABELS[job.priority] },
                  { icon: User, label: "Reported by", value: job.reported_by ?? "—" },
                  { icon: Wrench, label: "Assigned to", value: job.assigned_to ?? "Unassigned" },
                  { icon: CalendarDays, label: "Scheduled", value: job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                  { icon: CalendarDays, label: "Resolved", value: job.resolved_date ? new Date(job.resolved_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-surface-inset rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} className="text-foreground-muted" />
                      <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Supplier assignment */}
              <div>
                <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                  Assigned Supplier
                </p>
                <SearchableSelect
                  value={job.supplier_id ?? ""}
                  onChange={handleAssignSupplier}
                  disabled={assigningSupplier}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...suppliers.map((s) => ({
                      value: s.id,
                      label: s.name,
                      sublabel: JOB_CATEGORY_LABELS[s.trade],
                    })),
                  ]}
                  placeholder="Unassigned"
                />
                <p className="text-[11px] text-foreground-muted mt-1.5">
                  Pick from your preferred suppliers directory. Manage the directory in the Suppliers tab.
                </p>
              </div>

              {/* Dates */}
              <div className="text-xs text-foreground-muted">
                Opened: {new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                {job.updated_at !== job.created_at && (
                  <span className="ml-3">Updated: {new Date(job.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                )}
              </div>
            </TabsContent>

            {/* ── Costs ── */}
            <TabsContent value="costs" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Total</p>
                  <p className="text-xl font-bold text-foreground tabular-nums">
                    {fmtPounds(totalCost)}
                  </p>
                </div>
                {!showAddCost && (
                  <button
                    onClick={() => setShowAddCost(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:opacity-90 transition-opacity"
                  >
                    <Plus size={14} />
                    Add Cost
                  </button>
                )}
              </div>

              {showAddCost && (
                <AddCostForm
                  jobId={job.id}
                  propertyId={job.property_id}
                  onSaved={() => { setShowAddCost(false); window.location.reload(); }}
                  onCancel={() => setShowAddCost(false)}
                />
              )}

              {costs.length > 0 ? (
                <div className="space-y-2">
                  {costs.map((cost) => (
                    <div
                      key={cost.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface-inset group"
                    >
                      <div className="p-2 rounded-lg bg-surface-card shrink-0">
                        <Receipt size={14} className="text-foreground-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{cost.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {cost.supplier && (
                            <span className="text-xs text-foreground-secondary">{cost.supplier}</span>
                          )}
                          {cost.invoice_ref && (
                            <span className="text-xs text-foreground-muted">· {cost.invoice_ref}</span>
                          )}
                          <span className="text-xs text-foreground-muted">
                            {new Date(cost.date_incurred).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {fmtPounds(cost.amount)}
                        </span>
                        <button
                          onClick={() => handleDeleteCost(cost)}
                          disabled={deletingCostId === cost.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-foreground-muted hover:text-red-600 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !showAddCost && (
                  <div className="py-10 text-center">
                    <Receipt size={28} className="mx-auto text-foreground-muted mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-foreground-secondary">No costs logged yet</p>
                    <button
                      onClick={() => setShowAddCost(true)}
                      className="text-brand text-sm font-medium hover:underline mt-1"
                    >
                      Add the first cost
                    </button>
                  </div>
                )
              )}

              {costs.length > 0 && (
                <p className="text-xs text-foreground-muted">
                  Costs are automatically synced to the Profitability module.
                </p>
              )}
            </TabsContent>

            {/* ── Photos ── */}
            <TabsContent value="photos" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {photos.length} photo{photos.length !== 1 ? "s" : ""}
                </p>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-foreground-secondary hover:text-foreground hover:border-foreground-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  {uploadingPhoto ? "Uploading…" : "Upload Photo"}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                />
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-surface-inset aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption ?? "Job photo"}
                        className="w-full h-full object-cover"
                      />
                      {photo.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                          <p className="text-[11px] text-white truncate">{photo.caption}</p>
                        </div>
                      )}
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        disabled={deletingPhotoId === photo.id}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/60 text-white hover:bg-red-600/80 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Image size={32} className="mx-auto text-foreground-muted mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-foreground-secondary">No photos attached</p>
                  <p className="text-xs text-foreground-muted mt-1">Click &ldquo;Upload Photo&rdquo; to add before/after or progress photos.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Notes ── */}
            <TabsContent value="notes" className="p-6">
              <CommentsPanel
                comments={comments}
                hint="Internal only — tenants never see job notes. Max 2000 characters."
                emptyText="No notes yet. Keep call outcomes, quotes, and decisions here."
                onAdd={handleAddComment}
                onDelete={handleDeleteComment}
              />
            </TabsContent>

            {/* ── Activity ── */}
            <TabsContent value="activity" className="p-6">
              <div className="space-y-1">
                {buildActivityItems(job).map((item, i) => (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="mt-0.5 h-2 w-2 rounded-full bg-brand shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-foreground-muted">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────
// Activity timeline builder (derived from job data)
// ──────────────────────────────────────────────────────────

function buildActivityItems(job: MaintenanceJob): { label: string; time: string }[] {
  const items: { label: string; time: string; ts: number }[] = [];

  items.push({
    label: `Job raised: "${job.title}"`,
    time: new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    ts: new Date(job.created_at).getTime(),
  });

  if (job.assigned_to) {
    items.push({
      label: `Assigned to ${job.assigned_to}`,
      time: new Date(job.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      ts: new Date(job.updated_at).getTime() - 1,
    });
  }

  for (const cost of job.costs ?? []) {
    items.push({
      label: `Cost added: ${cost.description} — £${(cost.amount / 100).toFixed(2)}`,
      time: new Date(cost.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      ts: new Date(cost.created_at).getTime(),
    });
  }

  if (job.resolved_date) {
    items.push({
      label: "Job marked as resolved",
      time: new Date(job.resolved_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      ts: new Date(job.resolved_date).getTime(),
    });
  }

  return items.sort((a, b) => b.ts - a.ts);
}
