"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, GripVertical, Check, Info as InfoIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  createFormQuestion,
  deleteFormQuestion,
  reorderFormQuestions,
} from "../actions/form-questions";
import { formQuestionSchema, type FormQuestionValues } from "../domain/schemas";
import { QUESTION_TYPE_LABELS, type FormQuestion } from "../domain/types";

const inputCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const textareaCls = "w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";
const selectCls = "h-9 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand";

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface AddQuestionFormProps {
  formId: string;
  nextSortOrder: number;
  onAdded: (question: FormQuestion) => void;
  onCancel: () => void;
}

function AddQuestionForm({ formId, nextSortOrder, onAdded, onCancel }: AddQuestionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [optionInput, setOptionInput] = useState("");
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormQuestionValues>({
    resolver: zodResolver(formQuestionSchema),
    defaultValues: { question_type: "text", is_required: false, sort_order: nextSortOrder, options: [] },
  });

  const questionType = watch("question_type");
  const options = watch("options") ?? [];
  const needsOptions = questionType === "select";
  const isInfo = questionType === "info";

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    setValue("options", [...options, trimmed]);
    setOptionInput("");
  };

  const removeOption = (i: number) => {
    setValue("options", options.filter((_, idx) => idx !== i));
  };

  const onSubmit = (values: FormQuestionValues) => {
    startTransition(async () => {
      try {
        const payload = isInfo
          ? { ...values, is_required: false, options: [] }
          : values;
        const question = await createFormQuestion(formId, payload);
        toast.success(isInfo ? "Info block added" : "Question added");
        onAdded(question as FormQuestion);
      } catch {
        toast.error("Failed to add item");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-brand/30 bg-surface-card p-4 space-y-3">
      <FormField label="Type">
        <select {...register("question_type")} className={selectCls}>
          {Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </FormField>

      <FormField
        label={isInfo ? "Note / info text *" : "Question text *"}
        error={errors.question_text?.message}
      >
        {isInfo ? (
          <textarea
            {...register("question_text")}
            rows={4}
            className={textareaCls}
            placeholder="e.g. The holding deposit is equivalent to one week's rent and secures the room while references are checked. It will be offset against your first month's rent."
            autoFocus
          />
        ) : (
          <input
            {...register("question_text")}
            className={inputCls}
            placeholder="e.g. What is your current address?"
            autoFocus
          />
        )}
      </FormField>

      {!isInfo && (
        <FormField label="Required">
          <select {...register("is_required", { setValueAs: (v) => v === "true" })} className={selectCls}>
            <option value="false">Optional</option>
            <option value="true">Required</option>
          </select>
        </FormField>
      )}

      {needsOptions && (
        <FormField label="Options">
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-foreground bg-surface-inset rounded-lg px-3 py-1.5">{opt}</span>
                <button type="button" onClick={() => removeOption(i)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                className={`${inputCls} flex-1`}
                placeholder="Add an option…"
              />
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </FormField>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="secondary" size="sm" loading={isPending}>
          <Check className="h-3.5 w-3.5 mr-1" />
          {isInfo ? "Add info block" : "Add question"}
        </Button>
      </div>
    </form>
  );
}

interface SortableQuestionItemProps {
  question: FormQuestion;
  onDeleted: () => void;
}

function SortableQuestionItem({ question, onDeleted }: SortableQuestionItemProps) {
  const [isPending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteFormQuestion(question.id);
        toast.success("Deleted");
        onDeleted();
      } catch {
        toast.error("Failed to delete");
      }
    });
  };

  const isInfo = question.question_type === "info";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 rounded-xl border p-3 group ${
        isInfo ? "border-brand/30 bg-brand/[0.04]" : "border-border bg-surface-card"
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none mt-0.5 shrink-0 text-foreground-muted hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        {isInfo ? (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <InfoIcon className="h-3.5 w-3.5 text-brand" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                Info block
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{question.question_text}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">{question.question_text}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-foreground-muted">{QUESTION_TYPE_LABELS[question.question_type]}</span>
              {question.is_required && (
                <span className="text-[10px] font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5">Required</span>
              )}
              {question.options && question.options.length > 0 && (
                <span className="text-[11px] text-foreground-muted">· {question.options.length} options</span>
              )}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5 text-red-500" />
      </button>
    </div>
  );
}

interface QuestionEditorProps {
  formId: string;
  questions: FormQuestion[];
  onQuestionsChange: (questions: FormQuestion[]) => void;
}

export function QuestionEditor({ formId, questions, onQuestionsChange }: QuestionEditorProps) {
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, idx) => ({
      ...q,
      sort_order: idx,
    }));

    onQuestionsChange(reordered);

    reorderFormQuestions(reordered.map((q) => ({ id: q.id, sort_order: q.sort_order })))
      .catch(() => {
        toast.error("Failed to save order");
        onQuestionsChange(questions);
      });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Form items ({questions.length})</h3>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add item
          </Button>
        )}
      </div>

      {questions.length === 0 && !adding && (
        <p className="text-sm text-foreground-muted text-center py-6">
          No items yet. Add a question or an info block to get started.
        </p>
      )}

      {questions.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {questions.map((q) => (
                <SortableQuestionItem
                  key={q.id}
                  question={q}
                  onDeleted={() => onQuestionsChange(questions.filter((x) => x.id !== q.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {adding && (
        <AddQuestionForm
          formId={formId}
          nextSortOrder={questions.length}
          onAdded={(question) => {
            setAdding(false);
            onQuestionsChange([...questions, question]);
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
