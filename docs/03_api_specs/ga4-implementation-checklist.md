# GA4 implementation checklist

Baseline: main `6915993`, integrated with reviewed atomic reorder from `26e1418`. Design [v3](ga4-measurement-plan-v3.md). Updated 24 November 2026. The user authorized committing and pushing to main; deployment configuration is a separate operational step.

## Gates

- [x] Contract: safe quote/order measurement and cart mutation deltas; guest/account receipt fields documented. Real HTTP replay acceptance remains below.
- [x] Backend: persist order snapshot at creation; preserve existing business pricing/permissions; source compiled and mapper tests pass.
- [x] Analytics: one loader, opt-in build flag, QA debug switch, clean URLs, private-route boundary. Google-side setup and post-fix purchase were manually verified.
- [x] Commerce: record success before state reload; instrument product/cart/assistant/reorder mutations. Original flows have manual QA; the newer atomic reorder integration has the automated coverage recorded below.
- [x] Content: visibility-based list/story/offer events; local UI checks cover polling, countdown and tab remount.
- [x] Infrastructure: GA build args wired into Docker/Compose; default disabled.
- [x] Checks: Java mapper tests, TypeScript mapping/privacy tests, lint/typecheck/build, API contract validation. See dated results for scope and warnings.
- [x] Local integration: isolated database/demo data and guest/account + COD/VIETQR reviewed during manual QA; no real payments.
- [x] Muse: actual UI, independent F3 matrix and Google DebugView purchase after the F3 fix.
- [x] Current main: atomic reorder returns safe net deltas; frontend queues them on the private route and flushes at checkout. Java mapper, unit and synthetic UI regression cover this integration.
- [ ] Supplementary data validation: target-product SCHEDULE price_source at Google and complete closed-funnel count reconciliation await suitable data. The new reorder integration has automated coverage, not a new manual live-backend sign-off.

Local Playwright tests use synthetic intercepted APIs; they do not independently prove Google ingestion. The dated manual QA covers that separately. [Published validation summary](../04_testing/ga4/README.md). Raw account/browser evidence remains local and is not part of the release commit.

## Invariants

Product UUID is Item ID. Order number is transaction ID for both checkout types. `value=netSubtotal`; shipping separate. Offer reductions are per unit after exact integer allocation. No coupon code feature is assumed. No raw API body, recipient, phone, guest token, quote token or lookup code is sent.

## Scope

P0: acquisition/pageviews, list/select/detail, cart additions, checkout/purchase, stories and automatic offers. Safe remove/view-cart and search may ship with the same helper, but are not substitutes for P0 acceptance. Keep test records separate from campaign results.
