"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { agentCreateSchema, type AgentCreateValues } from "../domain/schemas";
import { createAgent } from "../actions/agents";

export function CreateAgentDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<AgentCreateValues>({
    resolver: zodResolver(agentCreateSchema),
    defaultValues: {
      email: "",
      display_name: "",
      role: "agent"
    }
  });

  const onSubmit = (values: AgentCreateValues) => {
    startTransition(async () => {
      const result = await createAgent(values);
      if (!result.ok) {
        toast.error("User could not be created", {
          description: result.error ?? "Something went wrong. Please try again.",
          duration: 6000
        });
        return;
      }
      form.reset({ email: "", display_name: "", role: "agent" });
      setOpen(false);
      toast.success("User created successfully", {
        description: `An email has been sent to ${values.email} so they can set their password and sign in.`,
        duration: 6000
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new admin, agent, marketing agent, or combined agent to this tenant.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Name
            </label>
            <Input
              placeholder="Display name"
              {...form.register("display_name")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              type="email"
              placeholder="user@example.com"
              {...form.register("email")}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Role
            </label>
            <select
              className="flex h-10 w-full rounded-lg border bg-surface-card px-3 py-2 text-sm border-border text-foreground-secondary"
              {...form.register("role")}
              disabled={isPending}
            >
              <option value="agent">Agent</option>
              <option value="marketing_only">Marketing Only</option>
              <option value="agent_and_marketing">Agent + Marketing</option>
              <option value="admin">Admin (Agent + Marketing)</option>
            </select>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={isPending} className="w-full">
              Create user
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
