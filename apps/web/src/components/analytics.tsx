"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsEnabled, consumeIgnoredPageView, flushPendingCommerce, initializeAnalytics, trackEvent } from "@/lib/analytics";
import { cleanAnalyticsUrl, measuredPath, pageKey } from "@/lib/analytics-policy";

export function Analytics() {
  const pathname = usePathname(), params = useSearchParams();
  const previous = useRef<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!analyticsEnabled() || !measuredPath(pathname)) return;
    initializeAnalytics();
    const key = pageKey(location.href), url = cleanAnalyticsUrl(location.href);
    const filterOnly = consumeIgnoredPageView(key);
    if (filterOnly) previous.current = { key, url };
    if (!filterOnly && previous.current?.key !== key) {
      const title = pathname === "/" ? "Gói Huế" : pathname.startsWith("/products/") ? "Chi tiết sản phẩm" :
        ({ "/products": "Danh mục sản phẩm", "/cart": "Giỏ hàng", "/checkout": "Đặt đơn mô phỏng", "/cau-chuyen-hue": "Câu chuyện Huế" }[pathname] ?? "Gói Huế");
      trackEvent("page_view", { page_title: title, page_referrer: previous.current?.url ?? (document.referrer ? cleanAnalyticsUrl(document.referrer) : "") });
      previous.current = { key, url };
    }
    flushPendingCommerce();
  }, [pathname, params]);
  useEffect(() => {
    if (!analyticsEnabled()) return;
    // A full document boundary removes Google's listeners before a private destination loads.
    const methods = ["pushState", "replaceState"] as const;
    const originals = methods.map((name) => history[name]);
    methods.forEach((name, index) => {
      history[name] = function (data, unused, url) {
        if (url && measuredPath(location.pathname)) {
          const target = new URL(String(url), location.href);
          if (target.origin === location.origin && !measuredPath(target.pathname)) { location.assign(target.href); return; }
        }
        return originals[index].call(history, data, unused, url);
      };
    });
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !measuredPath(location.pathname)) return;
      const anchor = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank") return;
      const target = new URL(anchor.href, location.href);
      if (target.origin === location.origin && !measuredPath(target.pathname)) {
        event.preventDefault(); event.stopPropagation(); location.assign(target.href);
      }
    };
    document.addEventListener("click", click, true);
    return () => { methods.forEach((name, index) => { history[name] = originals[index]; }); document.removeEventListener("click", click, true); };
  }, []);
  return null;
}
