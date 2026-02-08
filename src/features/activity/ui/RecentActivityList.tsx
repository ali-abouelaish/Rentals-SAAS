"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils/formatters";

export function RecentActivityList({ activity }: { activity: any[] }) {
    const [filter, setFilter] = useState("all");

    const filteredActivity = filter === "all"
        ? activity
        : activity.filter(item => item.action === filter);

    const actions = Array.from(new Set(activity.map(a => a.action)));
    const filterOptions = [
        { label: "All Activities", value: "all" },
        ...actions.map(action => ({
            label: (action as string).replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
            value: action as string
        }))
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-brand transition-colors">Recent activity</p>
                <Select
                    value={filter}
                    onChange={setFilter}
                    options={filterOptions}
                    className="w-40 h-8 text-xs"
                />
            </div>
            <ul className="space-y-4">
                {filteredActivity.length > 0 ? (
                    filteredActivity.map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-4 border-b border-surface-100 pb-3 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-brand capitalize">{item.action.replace("_", " ")}</span>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(item.created_at)}
                                </span>
                            </div>
                        </li>
                    ))
                ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No activity found matching the filter.</p>
                )}
            </ul>
        </div>
    );
}
