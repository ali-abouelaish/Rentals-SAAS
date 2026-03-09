"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewerDocument = {
  id: string;
  file_name: string;
  url: string;
};

type ViewerSet = {
  id: string;
  set_type: string;
  documents: ViewerDocument[];
};

function isImageFile(fileName: string) {
  return /\.(png|jpe?g|webp|gif|bmp|svg|heic)$/i.test(fileName);
}

function isPdfFile(fileName: string) {
  return /\.pdf$/i.test(fileName);
}

function formatSetType(value: string) {
  return value.replaceAll("_", " ");
}

export function RentalDocumentsViewer({ sets }: { sets: ViewerSet[] }) {
  const [open, setOpen] = useState(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeSet = useMemo(
    () => sets.find((set) => set.id === activeSetId) ?? null,
    [sets, activeSetId]
  );
  const activeDocs = activeSet?.documents ?? [];
  const activeDoc = activeDocs[activeIndex];

  const openSet = (setId: string) => {
    setActiveSetId(setId);
    setActiveIndex(0);
    setOpen(true);
  };

  return (
    <div className="space-y-2 text-sm text-foreground-secondary">
      {sets.map((set) => (
        <div key={set.id} className="space-y-1">
          <p className="font-medium text-brand capitalize">{formatSetType(set.set_type)}</p>
          <div className="flex items-center gap-2">
            <p>{set.documents.length} documents</p>
            {set.documents.length > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => openSet(set.id)}>
                View
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {activeSet ? formatSetType(activeSet.set_type) : "Documents"}
            </DialogTitle>
            <DialogDescription>
              {activeDocs.length > 1
                ? `Scroll through ${activeDocs.length} uploaded documents.`
                : "Uploaded document preview."}
            </DialogDescription>
          </DialogHeader>

          {activeDoc ? (
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-surface-inset">
                {isImageFile(activeDoc.file_name) ? (
                  <img
                    src={activeDoc.url}
                    alt={activeDoc.file_name}
                    className="mx-auto h-auto max-w-full object-contain"
                  />
                ) : isPdfFile(activeDoc.file_name) ? (
                  <iframe
                    src={activeDoc.url}
                    title={activeDoc.file_name}
                    className="h-[60vh] w-full"
                  />
                ) : (
                  <div className="flex h-[40vh] items-center justify-center">
                    <a
                      href={activeDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand underline-offset-2 hover:underline"
                    >
                      Open file
                    </a>
                  </div>
                )}
              </div>

              {activeDocs.length > 1 ? (
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-2">
                    {activeDocs.map((doc, index) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`w-36 shrink-0 overflow-hidden rounded-lg border text-left transition ${
                          index === activeIndex
                            ? "border-brand bg-brand/5"
                            : "border-border bg-surface-card hover:bg-surface-inset"
                        }`}
                      >
                        <div className="h-20 w-full overflow-hidden bg-surface-inset">
                          {isImageFile(doc.file_name) ? (
                            <img src={doc.url} alt={doc.file_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">
                              {isPdfFile(doc.file_name) ? "PDF" : "File"}
                            </div>
                          )}
                        </div>
                        <div className="truncate px-2 py-1 text-xs text-foreground-secondary">
                          {doc.file_name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-foreground-secondary">No document selected.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
