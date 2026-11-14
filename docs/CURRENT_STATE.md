# Current handoff

## Task and branch
Lân's five assigned Gói Huế pages are implemented in E:/.vscode/TM-T-Lan on feature/lan-store-products-ui, based on main 837098c. HEAD before final checkpoint: 0c708b35d683bb960c37f25eb02d7294a4f84958. The commit containing this handoff is the final delivery checkpoint; resolve its exact SHA with git log. Earlier checkpoints e51351d, 868d2a0, 56b1bd2, 4d0408f and 4996606 were pushed successfully.

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

