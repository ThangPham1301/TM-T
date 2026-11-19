# Current handoff

## Task and branch
Lân's five assigned Gói Huế pages are implemented in E:/.vscode/TM-T-Lan on feature/lan-store-products-ui, based on main 837098c. Delivery code HEAD: cdfb071ceded55eb52c6d09dd884d21fc9dc1563, verified identical to the remote feature branch after push. This documentation-only checkpoint records that delivered code. Earlier checkpoints e51351d, 868d2a0, 56b1bd2, 4d0408f and 4996606 were pushed successfully.

## Completed scope
- Home /: hero, values, left categories + six products, two gifts selected by category, gallery and story in Stitch sequence.
- Collection /products: introduction, toolbar, active filters, left category/price/stock/search filters, grid, pagination and story CTA. Default product order is preserved; explicit price sort is available.
- Detail /products/[slug]: primary image gallery/zoom, purchase panel, actual available product selection, bounded quantity/cart/buy-now, three keyboard tabs and related products.
- Admin products: sidebar/topbar, metrics, filters, table and four-section modal editor; existing save/toggle/delete/upload retained.
- Admin categories: sidebar, status filters, display-order/count sort, table, right drawer, category preview and styled delete confirmation/cancel.
- Decoration uses mon-02 assets/tokens: paper Dó, Playfair Display + Be Vietnam Pro, brown/gold/cinnabar, stepped product frames and folded functional corners. Scoped styling and route-specific shell preserve other owners' pages.

## Modified areas
apps/web/src/components/{home,commerce,catalog-admin,site-shell,lan-admin-shell,lan-dialog}.tsx; components/product/{lan-primitives,product-detail}.tsx; styles/lan.css; app/layout.tsx; supplied public/goi-hue/assets; tests/lan-ui.mjs; five Stitch HTML references in docs/ui_web/design/stitch-lan; UI notes in existing customer/admin API state matrices; plans and this handoff. Next's generated AGENTS heading correction is retained as instructed. No package/dependency/API/backend/auth contracts changed.

## Validation
- npm ci: PASS (existing dependency audit reports 7 moderate findings; dependencies not upgraded).
- Focused ESLint including every changed component and browser test: PASS.
- npm run typecheck: PASS.
- npm run build: PASS after final source changes, all routes generated.
- Synthetic headless Edge browser suite tests/lan-ui.mjs: PASS for all five pages, home section order/gifts, collection unaccented search/sort/pagination, detail cart quantity/tabs/zoom/sold-out/404, admin edit/save conflict retention/toggle, category sort/save/preview/delete cancel+confirm, guest/Customer denial, API retry/empty and 390px containment. Desktop and mobile screenshots visually inspected. Screenshots stay ignored in output/playwright.
- Full npm run lint: pre-existing errors in account.tsx:39, cart.tsx:38, lib/store.tsx:159 (react-hooks/set-state-in-effect), plus existing account image warning. None disabled or edited.
- git diff --check: PASS.

## Limits and decisions
No live backend is running at localhost:8088: browser checks use intercepted synthetic responses, not live persistence, upload/storage or server authorization acceptance. Keep existing API/idempotency/revision behavior. Current adapter has one primary image and no SKU contract: do not invent extra variants, facts/reviews/specifications or gallery persistence. Unsupported fields show updating; admin multi-image proposal is labeled and disabled. No merge, deployment, cloud changes or unrelated pages.

## Exact next action
User reviews the pushed feature branch visually. To run: cd apps/web; npm ci; npm run dev. To rerun browser QA, provide Playwright through NODE_PATH, then node tests/lan-ui.mjs while localhost:3000 is running (default Edge channel; BROWSER_CHANNEL can override). Integrate/test against the team's real backend in a separately scoped follow-up. Do not merge automatically.

---

# Web heritage theme handoff (feature branch)

# Current handoff

## Scope and branch
Task: apply the approved mon-02 decoration to the entire web, preserving current main's DOM, composition, field/list/widget order and behavior. Workspace E:/.vscode/TM-T-Web-Theme; branch feature/web-heritage-theme based on origin/main 837098cfbd6e98bdd873fbc2ffcb1c29c030a609. Audit/baseline checkpoint d3d4b33 was pushed successfully. HEAD before theme delivery: d3d4b33. The commit containing this handoff is the theme delivery checkpoint.

The earlier feature/lan-store-products-ui branch and its untracked CLAUDE.md are untouched. Its structural/logic changes were not imported. User reconfirmed that Stitch is read-only and only UI code may change; backend is out of scope.

## Completed
- Read-only audit of all 23 visible Stitch routes, metadata and HTML outlines. All 23 have existing route entry points. Detailed composition differences are recorded in docs/ui_web/design/WEB_THEME_COVERAGE.md; route presence is not a claim of full Stitch parity.
- Added one final visual layer apps/web/src/styles/web-theme.css and one import in app/layout.tsx. No existing components, lib/store, app/api or backend source changed.
- Shared paper Dó, Playfair Display/Be Vietnam Pro, approved brown/honey/cinnabar tokens, actual logo, dark double-frame hero/auth, light plaque, stepped category/product cards, folded functional panels, paper inputs/actions, semantic states, focus/reduced-motion and forced-color fallback.
- Copied only theme/QA assets under public/goi-hue/assets; removed three unused assets introduced in the audit checkpoint.
- Added tests/web-theme.mjs and read-only route inventory; generated screenshots/signatures are ignored under output/playwright/web-theme.

## Validation
- npm ci: PASS; no dependency/lockfile upgrades. Existing audit reports seven moderate findings.
- npm run typecheck: PASS; npm run build: PASS.
- ESLint for changed layout/test: PASS; Prettier check on theme/test: PASS.
- Full lint: three pre-existing react-hooks/set-state-in-effect errors in account.tsx:39, cart.tsx:38 and lib/store.tsx:159, plus the existing account image warning. No rule disabled or unrelated code changed.
- Baseline: 23 routes at 1440px and 390px, all rendered without page overflow.
- Final comparison: 46/46 route/viewport checks PASS for identical main DOM/order, original grid/flex modes, headings, no page overflow, paper background and display font.
- Synthetic interaction/state checks PASS: profile/address/password writes, idempotency on existing mutations, order expansion, admin failed save retained and retry success, Customer/guest access gates, cart empty/error, reduced motion. API calls are intercepted fixtures, not live backend acceptance.
- Desktop/mobile contact sheets for all 23 pages and representative full screenshots were visually reviewed. Hero frame adjusted away from text. No backend/provider/Stitch write was made.
- Boundary check: git diff origin/main -- apps/web/src/components apps/web/src/lib apps/web/src/app/api is empty. The only runtime source changes are the added stylesheet and its layout import.

## Decisions and limitations
Main's current layout is intentionally preserved even where it is simpler than Stitch (horizontal filters/tabs, management rows/inline forms rather than sidebars/tables/drawers; simpler home/detail). No new features, fields, policy claims, social auth, variants or persistence were fabricated. Native browser confirmations remain native.

Fonts use the supplied library's Google Fonts import with serif/system fallbacks. Live backend, real uploads and real account/order persistence are not verified. No merge, deployment, cloud edits, auth changes or database work is authorized by this delivery.

## Exact next action
User visually reviews the pushed feature branch. Full route audit: docs/ui_web/design/WEB_THEME_COVERAGE.md. Local preview server, if still running, is http://127.0.0.1:3001 (no live data claimed).

Run from apps/web: npm ci, npm run dev -- --hostname 127.0.0.1 --port 3001. Browser QA requires Playwright supplied on NODE_PATH; then node tests/web-theme.mjs (BASE_URL can override). Its ignored baseline.json was captured before the theme import. To recreate baseline, serve audit checkpoint d3d4b33 and run the test with --baseline, then serve the delivered theme branch and run without --baseline. Keep both servers/checkouts isolated. Do not merge automatically.
