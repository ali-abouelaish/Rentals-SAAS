"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog";
import { BonusForm } from "./BonusForm";

export function SubmitBonusDialog({
    landlords,
    agents,
    isAdmin,
    currentAgentId,
}: {
    landlords: { id: string; name: string }[];
    agents: { id: string; name: string }[];
    isAdmin: boolean;
    currentAgentId: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Submit Bonus
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Submit Bonus</DialogTitle>
                    <DialogDescription>
                        Fill in the bonus details below. It will be submitted as pending for admin review.
                    </DialogDescription>
                </DialogHeader>
                <BonusForm
                    landlords={landlords}
                    agents={agents}
                    isAdmin={isAdmin}
                    currentAgentId={currentAgentId}
                />
            </DialogContent>
        </Dialog>
    );
}
