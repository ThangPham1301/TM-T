# GA4 implementation checklist

Baseline: main `6915993`, design [v3](ga4-measurement-plan-v3.md), 23 November 2026. Work on `feat/ga4-measurement`; do not merge/deploy automatically.

## Gates

- [x] Contract: safe quote/order measurement and cart mutation deltas; guest/account receipt fields documented. Real HTTP replay acceptance remains below.
- [x] Backend: persist order snapshot at creation; preserve existing business pricing/permissions; source compiled and mapper tests pass.
- [x] Analytics: one loader, opt-in build flag, QA debug switch, clean URLs, private-route boundary. Google-side setup is pending.
- [x] Commerce: record success before state reload; instrument product/cart/assistant/reorder mutations. Assistant/reorder actual UI acceptance remains pending.
- [x] Content: visibility-based list/story/offer events; local UI checks cover polling, countdown and tab remount.
- [x] Infrastructure: GA build args wired into Docker/Compose; default disabled.
- [x] Checks: Java mapper tests, TypeScript mapping/privacy tests, lint/typecheck/build, API contract validation. See dated results for scope and warnings.
- [ ] Local integration: isolated database/demo data, no payments, guest/account + COD/VIETQR.
- [ ] Muse: actual UI and GA4 DebugView evidence; retain NOT RUN/BLOCKED until observed.

Local Playwright testing of the real Next UI with intercepted synthetic APIs passed; it is not a completed real-database/Google acceptance gate. [Results](../04_testing/ga4/results.md).

## Invariants

Product UUID is Item ID. Order number is transaction ID for both checkout types. `value=netSubtotal`; shipping separate. Offer reductions are per unit after exact integer allocation. No coupon code feature is assumed. No raw API body, recipient, phone, guest token, quote token or lookup code is sent.

## Scope

P0: acquisition/pageviews, list/select/detail, cart additions, checkout/purchase, stories and automatic offers. Safe remove/view-cart and search may ship with the same helper, but are not substitutes for P0 acceptance. Keep test records separate from campaign results.
