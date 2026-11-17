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
