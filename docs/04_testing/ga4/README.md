# GA4 validation and release notes

Updated 24 November 2026. Scope: default-enabled storefront measurement, identity-free commerce snapshots, automatic-offer analysis, content engagement and reviewed reorder integration. See the [design](../../03_api_specs/ga4-measurement-plan-v3.md), [acceptance cases](acceptance.md) and [deployment configuration](../../05_deployment/goihue-coolify.md).

## Accepted behavior

- One manually controlled page_view for each measured navigation/document load; no extra views on focus or rerender. Global manual-pageview, privacy and QA defaults precede tag initialization. Stream config repeats the relevant defaults.
- New quote/order responses expose allowlisted measurement snapshots. Merchandise value excludes shipping and reflects applied discounts with exact whole-VND item allocation. Purchase is measured at demo order creation, not real payment settlement.
- Successful cart changes emit quantity deltas; previews, rejected mutations and unchanged quantities do not invent additions. Private routes do not load the tag or expose recipient/order lookup details.
- Current main's atomic reorder confirmation returns one measurementMutation for the net before/after cart changes. Its operation ID is stored in the idempotent response. The private account flow queues safe source_surface=reorder deltas and flushes at checkout. It does not copy source-order IDs or recipient details into analytics.

## Validation performed

Java application compilation and dependency-free mapper assertions cover snapshot money, allowlisting, floor/non-BASE discount behavior, cart deltas and atomic replacement deltas. Analytics unit tests cover privacy, integer allocation, success/replay handling, initialization order and private-route reorder replay.

The frontend fixture browser suite exercises actual Next UI with intercepted APIs and local capture, including guest/account COD/VIETQR, reload failure after success, content exposure and the atomic reorder dialog. These tests create no real database orders and do not send collection to Google.

Before integrating current main, F3 was independently verified with 15 dev and 15 compiled-build runs by Codex and 15 additional runs by Muse. The real-library collection tests intercepted outbound collection; the absence of duplicate hits was checked alongside correct destination, debug and event presence. Loader delay/blocking and pending purchase replay were also checked. Historical raw evidence stays local rather than publishing signed-in account screenshots, credentials or environment backups.

Manual signed-in Google QA on 24 November separately confirmed page_view/view_item and one post-fix demo purchase with matching transaction ID, merchandise value, shipping, currency, payment method and offer metadata. Developer traffic is Active, Enhanced Measurement is OFF, 11 custom dimensions were registered and purchase is the sole key event. Two Explore funnels are configured and have data for that date.

## Limits that remain explicit

- Google DebugView showed standard item fields but did not expose item custom price_source. Explore showed BASE for existing products; matching the target products and SCHEDULE still requires suitable processed data. Correct BASE/SCHEDULE payloads and Item scope have been verified; no payload defect is established.
- Funnel configuration and presence of data do not prove complete closed-funnel count reconciliation. Counts are users, not automatically order counts. Debug traffic excluded by an effective Active filter must not be expected to appear later in normal Explore reports.
- Purchase requests can be lost if a tag never loads or a user leaves early. Pending data may retry on a public-route return within its expiry; callbacks are submission signals, not proof Google ingested a hit.
- Integrating newer main changes the reorder flow. Its new measurement wiring has automated regression coverage; historical manual reorder evidence predates this integration.
- Local/build/Google QA is not production deployment verification. GA defaults enabled for project stream G-06239FHPPM in direct Next builds, Docker and Compose. An explicit NEXT_PUBLIC_GA_ENABLED=false disables it; changing an existing build still requires rebuilding the web image. An existing API process/jar must also be rebuilt/restarted to serve new endpoints and snapshots.

## Reproducible checks

From apps/web run `npm run test:analytics`, `npm run typecheck`, `npm run lint` and `npm run build`. The synthetic UI suite is `npm run test:analytics:browser`; set `ANALYTICS_TEST_ORIGIN=http://localhost:3000` to reuse an existing GA-enabled dev server rather than starting a second Next dev process. All suite API traffic is mocked and capture prevents collection. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may select an installed browser.

From the repo root run `python scripts/test-ga4-backend.py` after populating the Maven cache through the normal API build. Validate `docs/03_api_specs/goihue.openapi.yaml` and `ga4-measurement.schema.yaml` with Redocly. Tests requiring real tag serialization are under apps/web/tests/ga4-f3-*.mjs; read their scope and use interception before running them. Product slugs/fixtures in those diagnostics are local QA data, not required production seed data.

## Production verification checklist

1. Build API and web from the same reviewed revision. Build defaults enable NEXT_PUBLIC_GA_ENABLED=true and NEXT_PUBLIC_GA_MEASUREMENT_ID=G-06239FHPPM. Remove or update any existing false/blank hosting override, then rebuild. Changing only runtime environment does not update bundled public variables.
2. Preserve property settings and filters. Check debug pageview count, add-to-cart, checkout and a single permitted demo purchase at the production hostname; compare its safe snapshot with DebugView. Keep personal contacts/tokens out of analytics and test artifacts.
3. Confirm private routes, duplicate submission/reload, disabled/blocked analytics and the reviewed reorder path behave correctly. Capture the exact deployed revision and test time.
4. Record the actual start of the measurement period after deployment verification. Do not treat historical local QA or pre-fix data as campaign KPIs. Resolve supplementary price_source/funnel checks when valid data exists without polluting the campaign property with non-debug QA.
5. To disable tracking, rebuild the web with NEXT_PUBLIC_GA_ENABLED=false. Preserve business data and existing property filters; do not delete orders or rewrite pricing as a tracking rollback.
