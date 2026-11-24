"use client";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { useExposure } from "@/lib/analytics-visibility";
export function StoryRegion({ id, surface, mode, children }: { id: string; surface: string; mode: string; children: React.ReactNode }) {
  const ref = useExposure<HTMLDivElement>("view_story", { story_id: id, story_surface: surface, story_mode: mode }, `${id}:${surface}`);
  return <div ref={ref}>{children}</div>;
}
export function StoryCta({ id, surface, href, className, children }: { id: string; surface: string; href: string; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={className} onClick={() => trackEvent("story_cta_click", { story_id: id, story_surface: surface, target_type: "catalog" })}>{children}</Link>;
}
