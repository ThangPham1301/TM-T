"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsEnabled, trackEvent, exposureKey } from "./analytics";
import type { GaParams } from "./analytics-commerce";

/** Parameters can change with price polling, but exposure identity does not. */
export function useExposure<T extends HTMLElement>(event: string, params: GaParams, identity: string, enabled = true) {
  const ref = useRef<T>(null), latest = useRef(params), recorded = useRef<string | null>(null), pathname = usePathname();
  useEffect(() => { latest.current = params; });
  useEffect(() => {
    const element = ref.current, key = `${pathname}:${identity}`;
    if (!element || !enabled || !analyticsEnabled() || recorded.current === key || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let visible = false;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const schedule = () => {
      cancel();
      if (!visible || document.visibilityState !== "visible" || element.closest('[aria-hidden="true"], [inert]')) return;
      timer = setTimeout(() => {
        const context = `${identity}:${latest.current.offer_surface ?? latest.current.story_surface ?? latest.current.item_list_id ?? ""}`;
        if (document.visibilityState === "visible" && !element.closest('[aria-hidden="true"], [inert]') && trackEvent(event, latest.current, exposureKey(event, context))) {
          recorded.current = key; observer.disconnect();
        }
      }, 1000);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.5; schedule(); }, { threshold: [0, 0.5] });
    observer.observe(element); document.addEventListener("visibilitychange", schedule);
    return () => { cancel(); observer.disconnect(); document.removeEventListener("visibilitychange", schedule); };
  }, [event, identity, enabled, pathname]);
  return ref;
}
