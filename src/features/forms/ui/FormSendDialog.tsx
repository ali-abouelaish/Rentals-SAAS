"use client";

import { useState, useTransition } from "react";
import { X, Send, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendFormLinks } from "../actions/form-send";
import type { Client } from "@/features/clients/domain/types";

interface FormSendDialogProps {
  formId: string;
  formName: string;
  clients: Pick<Client, "id" | "full_name" | "email">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormSendDialog({
  formId,
  formName,
  clients,
  open,
  onOpenChange,
}: FormSendDialogProps) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const addEmails = (raw: string) => {
    const parsed = raw
      .split(/[\s,;\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && emailRegex.test(e) && !emails.includes(e));
    if (parsed.length > 0) {
      setEmails((prev) => [...prev, ...parsed]);
    }
    setEmailInput("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const addClientEmail = (email: string) => {
    const e = email.trim().toLowerCase();
    if (e && emailRegex.test(e) && !emails.includes(e)) {
      setEmails((prev) => [...prev, e]);
    }
  };

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  const handleSend = () => {
    if (emails.length === 0) {
      toast.error("Add at least one email address");
      return;
    }
    startTransition(async () => {
      try {
        const result = await sendFormLinks(formId, emails);
        if (result.errors.length === 0) {
          toast.success(`Form sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}`);
        } else {
          toast.success(`Sent to ${result.sent}, failed: ${result.errors.length}`);
          for (const err of result.errors) {
            toast.error(err, { duration: 6000 });
          }
        }
        setEmails([]);
        setEmailInput("");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send form</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <p className="text-sm text-foreground-secondary">
            Sending: <strong>{formName}</strong>
          </p>

          {/* Email chips */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-inset px-2.5 py-1 text-xs"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="text-foreground-muted hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Email input */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Email addresses</label>
            <div className="flex gap-2">
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addEmails(emailInput);
                  }
                }}
                onBlur={() => {
                  if (emailInput.trim()) addEmails(emailInput);
                }}
                className="h-9 flex-1 rounded-lg border border-border bg-surface-inset px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                placeholder="email@example.com — press Enter or comma to add"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addEmails(emailInput)}
              >
                Add
              </Button>
            </div>
            <p className="text-[11px] text-foreground-muted">Separate multiple with commas or new lines</p>
          </div>

          {/* Pick from clients */}
          {clients.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground">Pick from clients</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted pointer-events-none" />
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-surface-inset pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  placeholder="Search clients…"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5 mt-1">
                {filteredClients.slice(0, 30).map((client) => {
                  const already = emails.includes(client.email.toLowerCase());
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => addClientEmail(client.email)}
                      disabled={already}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        already
                          ? "opacity-40 cursor-default"
                          : "hover:bg-surface-inset"
                      }`}
                    >
                      <span className="font-medium text-foreground truncate">{client.full_name}</span>
                      <span className="text-xs text-foreground-muted truncate">{client.email}</span>
                    </button>
                  );
                })}
                {filteredClients.length === 0 && (
                  <p className="text-xs text-foreground-muted px-3 py-2">No clients found</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={isPending}
              onClick={handleSend}
              disabled={emails.length === 0}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Send to {emails.length || "…"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
