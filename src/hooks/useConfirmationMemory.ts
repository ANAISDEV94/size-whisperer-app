import { useState, useCallback, useMemo } from "react";
import type { SizeRecommendation } from "@/types/panel";

const STORAGE_KEY = "altaana_confirmed_sizes";

interface ConfirmedEntry {
  size: string;
  recommendation: SizeRecommendation;
  confirmedAt: string;
}

function getStorageMap(): Record<string, ConfirmedEntry> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function buildKey(brandKey: string, productUrl?: string): string {
  return productUrl ? `${brandKey}::${productUrl}` : brandKey;
}

export function useConfirmationMemory(brandKey: string, productUrl?: string) {
  const key = useMemo(() => buildKey(brandKey, productUrl), [brandKey, productUrl]);

  const [cached] = useState<ConfirmedEntry | null>(() => {
    const map = getStorageMap();
    return map[key] || null;
  });

  const save = useCallback((size: string, recommendation: SizeRecommendation) => {
    const map = getStorageMap();
    map[key] = { size, recommendation: { ...recommendation, size }, confirmedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }, [key]);

  return { cached, save };
}
