# Whole-web mon-02 decoration

## Goal and reason
Extend the already approved Gói Huế visual system to all web pages, without replacing the current main branch's composition or business logic.

## Dependencies and current state
- Main 837098c; fresh isolated worktree E:/.vscode/TM-T-Web-Theme, feature/web-heritage-theme.
- Stitch project 3762085109118983605, 23 visible route screens (plus a hidden old product detail and non-page assets). Read-only metadata and HTML outlines fetched 2026-11-17.
- Supplied library E:/Goi-Hue-Brand-Report/mon-02/bo-ui-v01, especially Quy-chuan-UI.md, ui.css and assets. npm ci passed; existing dependency audit remains unchanged.
- Main has routes for all 23 screens, but does not have identical composition in every screen. Route coverage is distinct from visual parity; preserve current main structure and document gaps.

## Scope and decisions
- Add one final CSS layer and only its layout.tsx import; reuse existing selectors. No TSX component restructuring, content changes, sorting changes, new API/state logic or backend edits.
- Local supplied assets: seamless Dó paper, logo, stepped frame SVGs, Huế architectural/botanical motifs and existing imagery where banner decoration is needed.
- Tokens: ivory #FCF9F4, brown #563A26/#352014, warm brown #70513B, honey #D4A24C, cinnabar #8B261D, Playfair Display + Be Vietnam Pro.
- Four frame treatments: dark double-frame hero, light plaque, stepped product/category cards and folded functional panels.
- Keep error/warning/success meaning and readable contrast; hover/focus/disabled, reduced motion, long text and mobile overflow must be verified. Native browser confirmations remain native; do not rewrite their behavior to restyle them.
- No schema/auth/security/API contract changes. No provider, deploy or Stitch write operations.

## Files and steps
1. Route/heading inventory in docs/ui_web/design/WEB_THEME_COVERAGE.md and stitch-screen-inventory.json.
2. Browser baseline and regression script in apps/web/tests/web-theme.mjs; generated screenshots/baseline under ignored output/playwright/web-theme.
3. Copy only used assets to apps/web/public/goi-hue/assets.
4. Implement apps/web/src/styles/web-theme.css, imported last from app/layout.tsx. Do not change the existing grid/flex, dimensions, breakpoints or DOM order.
5. Compare all 23 screens at 1440px and 390px with synthetic fixture data; preserve main DOM structure and layout modes. Review screenshots of each page group, expanded forms and error/empty/disabled/guest/forbidden states.
6. Lint changed JS/TSX, typecheck, production build; record pre-existing full lint failures separately. Verify no BE/component/API/store modifications; checkpoint/push.

## Acceptance and risks
All 23 routes render under the same theme; fixture-backed interactions still submit the same actions; DOM and layout composition match baseline. Tests do not establish live backend persistence. Font metrics may alter wrapping while widget order and grids remain unchanged. External Google Fonts needs a serif/system fallback. Decoration must not intercept input or obscure body text.

## Progress
- [x] Branch and read-only Stitch/route audit
- [x] Baseline captured
- [x] Theme implementation
- [x] Browser/structure/interaction verification
- [x] Final validation and remote checkpoint

## Next step
Review the pushed feature branch; no further implementation is required in this visual phase. Refer to CURRENT_STATE.md for validation evidence and baseline reproduction.

## Completed validation
46/46 before/after DOM/order/layout/heading/overflow/theme checks PASS. Synthetic account/admin/commerce state checks PASS. Typecheck/build and focused lint/format checks PASS. Full lint retains only the recorded pre-existing errors. No changes under components, lib/store, app/api or backend. Native confirmation behavior and source policy content retained.
