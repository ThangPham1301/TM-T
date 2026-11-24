import { cleanAnalyticsUrl, measuredPath, pageKey, sensitive } from "./analytics-policy";
import { mutationEvents, type GaParams, type Measurement, type MutationMeasurement } from "./analytics-commerce";

type CapturedEvent = { name: string; params: GaParams };
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __goiHueAnalytics?: CapturedEvent[];
  }
}
const events = new Set(["page_view", "view_item_list", "select_item", "view_item", "add_to_cart", "remove_from_cart",
  "view_cart", "begin_checkout", "purchase", "view_story", "story_cta_click", "view_offer", "select_offer", "search", "select_content"]);
const allowedKeys = new Set(["currency", "value", "shipping", "transaction_id", "items", "has_auto_discount", "offer_id", "offer_name",
  "payment_method", "checkout_type", "source_surface", "item_list_id", "item_list_name", "story_id", "story_surface", "story_mode",
  "offer_surface", "target_type", "search_term", "results_count", "search_surface", "content_type", "content_id", "page_location", "page_referrer", "page_title"]);
const sent = new Map<string, number>();
const submitted = new Map<string, number>();
const storageKey = "goihue:ga4:dedup:v1", pendingKey = "goihue:ga4:pending:v1", ttl = 30 * 60_000;
let initialized = false, capture = false;
let navigationSerial = 0;
let suppressedNavigation: { key: string; expires: number } | undefined;
export function ignoreFilterUrlChange(url: string | URL) {
  try { suppressedNavigation = { key: pageKey(new URL(url, location.href).href), expires: Date.now() + 3000 }; } catch { /* no-op */ }
}
export function consumeIgnoredPageView(key: string) {
  const skip = suppressedNavigation?.key === key && suppressedNavigation.expires > Date.now();
  suppressedNavigation = undefined; return skip;
}
// Local exposure identity is not a secret; do not require a secure-context crypto API at module load.
const documentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function exposureKey(event: string, identity: string) { return `exposure:${documentId}:${navigationSerial}:${event}:${identity}`; }
const local = () => ["localhost", "127.0.0.1"].includes(window.location.hostname);
export function analyticsEnabled() {
  return typeof window !== "undefined" && process.env.NEXT_PUBLIC_GA_ENABLED === "true" && /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "") &&
    navigator.doNotTrack !== "1" && localStorageSafe("goihue:analytics-consent") !== "denied";
}
function localStorageSafe(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
export function qaDebug() {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("ga_debug") === "1") sessionStorage.setItem("goihue:ga4:debug", "1");
    return sessionStorage.getItem("goihue:ga4:debug") === "1";
  } catch { return false; }
}
function restoreDedup() {
  try { for (const [key, time] of JSON.parse(localStorage.getItem(storageKey) ?? "[]")) if (Number(time) > Date.now() - ttl) {
    submitted.set(String(key), Number(time)); sent.set(String(key), Math.max(sent.get(String(key)) ?? 0, Number(time)));
  } } catch { /* storage is optional */ }
}
function seen(key?: string) { if (!key) return false; restoreDedup(); return (sent.get(key) ?? 0) > Date.now() - ttl; }
function mark(key?: string, persist = true) {
  if (!key) return;
  sent.set(key, Date.now());
  for (const [k, t] of sent) if (t < Date.now() - ttl) sent.delete(k);
  if (persist && !key.startsWith("exposure:")) {
    submitted.set(key, Date.now());
    for (const [k,t] of submitted) if (t < Date.now() - ttl) submitted.delete(k);
    try { localStorage.setItem(storageKey, JSON.stringify([...submitted].slice(-500))); } catch { /* memory dedup remains */ }
  }
}
function pending(): Pending[] { try { return JSON.parse(sessionStorage.getItem(pendingKey) ?? "[]"); } catch { return []; } }
function enqueue(event: Omit<Pending, "expires">) {
  try {
    const queued = pending().filter(e => e.expires > Date.now() && (!event.dedup || e.dedup !== event.dedup));
    queued.push({ ...event, expires: Date.now() + ttl }); sessionStorage.setItem(pendingKey, JSON.stringify(queued.slice(-200)));
  } catch { /* optional recovery */ }
}
function acknowledge(key?: string) {
  if (!key) return;
  mark(key); try { sessionStorage.setItem(pendingKey, JSON.stringify(pending().filter(e => e.dedup !== key))); } catch { /* optional storage */ }
}
export function initializeAnalytics() {
  if (!analyticsEnabled() || !measuredPath(location.pathname) || initialized) return;
  initialized = true;
  if (local()) {
    try {
      if (new URLSearchParams(location.search).get("ga_capture") === "1") sessionStorage.setItem("goihue:ga4:capture", "1");
      capture = sessionStorage.getItem("goihue:ga4:capture") === "1";
    } catch { capture = new URLSearchParams(location.search).get("ga_capture") === "1"; }
  }
  if (capture || qaDebug()) window.__goiHueAnalytics = [];
  window.dataLayer = window.dataLayer ?? [];
  // Google consumes the Arguments object in dataLayer, not a nested event payload.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = window.gtag ?? function () { window.dataLayer.push(arguments); };
  if (!capture) {
    // Remote tag initialization can run before stream config is processed.
    // Apply manual-pageview/privacy defaults before the initialization command.
    window.gtag("set", { send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, ...(qaDebug() ? { debug_mode: true } : {}) });
    window.gtag("js", new Date());
    window.gtag("config", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, { send_page_view: false,
      page_location: cleanAnalyticsUrl(location.href), page_referrer: document.referrer ? cleanAnalyticsUrl(document.referrer) : "",
      allow_google_signals: false, allow_ad_personalization_signals: false, ...(qaDebug() ? { debug_mode: true } : {}) });
    if (!document.getElementById?.("goihue-ga4")) {
      const script = document.createElement("script");
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`;
      script.async = true; script.id = "goihue-ga4"; document.head.appendChild(script);
    }
  }
}
export function trackEvent(name: string, params: GaParams, dedup?: string): boolean {
  try {
    if (!analyticsEnabled() || !measuredPath(location.pathname) || !events.has(name) || seen(dedup)) return false;
    for (const key of Object.keys(params)) if (!allowedKeys.has(key)) throw Error("unapproved parameter");
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "number" && !Number.isFinite(value)) throw Error("non-finite parameter");
      if (typeof value === "string" && !["page_location", "page_referrer"].includes(key) && sensitive(value)) throw Error("sensitive parameter");
    }
    if (Array.isArray(params.items)) {
      const itemKeys = new Set(["item_id", "item_name", "item_category", "price", "quantity", "discount", "price_source", "item_list_id", "item_list_name", "index"]);
      if (params.items.length > 200) throw Error("too many items");
      for (const item of params.items) {
        if (!item.item_id || !item.item_name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1) throw Error("invalid item");
        for (const [key, value] of Object.entries(item)) {
          if (!itemKeys.has(key) || (typeof value === "string" && key !== "item_id" && sensitive(value))) throw Error("unapproved item parameter");
        }
      }
    }
    initializeAnalytics();
    const safe = { ...params, page_location: cleanAnalyticsUrl(location.href),
      ...(params.page_referrer ? { page_referrer: cleanAnalyticsUrl(String(params.page_referrer)) } : {}) };
    if (name === "page_view") navigationSerial++;
    if (name === "page_view" && !capture) window.gtag?.("set", { page_location: safe.page_location, page_referrer: safe.page_referrer ?? "" });
    if (name === "purchase") enqueue({ name, params: safe, dedup });
    if (window.__goiHueAnalytics) window.__goiHueAnalytics.push({ name, params: safe });
    if (window.__goiHueAnalytics && window.__goiHueAnalytics.length > 300) window.__goiHueAnalytics.shift();
    mark(dedup, name !== "purchase");
    if (!capture) window.gtag?.("event", name, { ...safe, ...(qaDebug() ? { debug_mode: true } : {}),
      ...(name === "purchase" ? { event_callback: () => acknowledge(dedup) } : {}) });
    else if (name === "purchase") acknowledge(dedup);
    return true;
  } catch { return false; }
}
type Pending = { name: string; params: GaParams; dedup?: string; expires: number };
export function dispatchCommerce(action: string, result: { measurement?: Measurement; measurementMutation?: MutationMeasurement },
                                 checkoutType: "guest" | "account", source: string) {
  try {
    if (!analyticsEnabled()) return;
    for (const event of mutationEvents(action, result, checkoutType, source)) {
      if (measuredPath(location.pathname)) trackEvent(event.name, event.params, event.dedup);
      else if (source === "reorder" && location.pathname.startsWith("/account")) {
        enqueue(event);
      }
    }
  } catch { /* Never fail commerce because analytics is unavailable or DTO validation fails. */ }
}
export function flushPendingCommerce() {
  try {
    if (!analyticsEnabled() || !measuredPath(location.pathname)) { sessionStorage.removeItem(pendingKey); return; }
    const queued = pending().filter(e => e.expires > Date.now());
    sessionStorage.setItem(pendingKey, JSON.stringify(queued));
    for (const e of queued) if (["add_to_cart", "remove_from_cart", "purchase"].includes(e.name)) {
      const accepted = trackEvent(e.name, e.params, e.dedup);
      if ((accepted || seen(e.dedup)) && e.name !== "purchase") acknowledge(e.dedup);
    }
  } catch { /* optional recovery */ }
}
