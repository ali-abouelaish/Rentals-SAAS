"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecentEntity, SearchResultKind } from "../domain/types";

const MAX_ENTRIES = 20;
const STORAGE_PREFIX = "harbor_ops:recent_entities:";

function storageKey(tenantId: string) {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function isRecentEntity(value: unknown): value is RecentEntity {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.kind === "string" &&
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    (v.subtitle === null || typeof v.subtitle === "string") &&
    typeof v.href === "string" &&
    typeof v.visitedAt === "number"
  );
}

function readFromStorage(key: string): RecentEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEntity);
  } catch {
    return [];
  }
}

function writeToStorage(key: string, entries: RecentEntity[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // localStorage can throw in private mode / when quota is exceeded —
    // recents are a nice-to-have, never block the UI.
  }
}

export function useRecentEntities(tenantId: string | null) {
  const [recent, setRecent] = useState<RecentEntity[]>([]);

  useEffect(() => {
    if (!tenantId) {
      setRecent([]);
      return;
    }
    setRecent(readFromStorage(storageKey(tenantId)));
  }, [tenantId]);

  const push = useCallback(
    (entity: Omit<RecentEntity, "visitedAt">) => {
      if (!tenantId) return;
      const key = storageKey(tenantId);
      const existing = readFromStorage(key);
      const deduped = existing.filter(
        (e) => !(e.kind === entity.kind && e.id === entity.id)
      );
      const next: RecentEntity[] = [
        { ...entity, visitedAt: Date.now() },
        ...deduped,
      ].slice(0, MAX_ENTRIES);
      writeToStorage(key, next);
      setRecent(next);
    },
    [tenantId]
  );

  return { recent, push };
}

export type { RecentEntity, SearchResultKind };
