"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/store";
import type { PricingFeed } from "@/lib/pricing";

export function usePricing() {
  const [feed, setFeed] = useState<PricingFeed | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    let request = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      clearTimeout(timer);
      const id = ++request;
      let delay = 15_000;
      try {
        const next: PricingFeed = await api("pricing");
        if (!active || request !== id) return;
        setFeed(next);
        const boundary = next.nextChangeAt
          ? Date.parse(next.nextChangeAt) - Date.parse(next.asOf)
          : Infinity;
        delay = Math.min(delay, Math.max(100, boundary));
      } catch {
        // Keep the last valid quote on a transient network error. The backend validates before purchase.
      } finally {
        if (active && request === id) timer = setTimeout(refresh, delay);
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [revision]);

  return { feed, reload: () => setRevision((value) => value + 1) };
}
