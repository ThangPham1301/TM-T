const publicPaths = /^(?:\/|\/products(?:\/[a-z0-9-]+)?|\/cart|\/checkout|\/cau-chuyen-hue)$/;
export const measuredPath = (pathname: string) => publicPaths.test(pathname);
export const sensitive = (value: string) => /@|(?:\+?84|0)[\d\s().-]{8,}|(?:token|password|email|phone|address|lookupcode)\s*[=:]/i.test(value);
const queryKeys = new Set(["category", "discount", "pricing", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]);
export function cleanAnalyticsUrl(input: string, base = "https://goihue.io.vn"): string {
  try {
    const url = new URL(input, base);
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (queryKeys.has(key) && /^[a-z0-9_-]{1,100}$/.test(value) && !sensitive(value)) params.set(key, value);
    }
    const path = measuredPath(url.pathname) && !sensitive(decodeURIComponent(url.pathname)) ? url.pathname : "/";
    return `${url.origin}${path}${params.size ? `?${params}` : ""}`;
  } catch { return base; }
}
export function pageKey(input: string): string {
  const url = new URL(cleanAnalyticsUrl(input));
  for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_")) url.searchParams.delete(key);
  return url.pathname + url.search;
}
export function safeSearchTerm(value: string): string | undefined {
  const term = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return term.length >= 2 && !sensitive(term) ? term : undefined;
}
