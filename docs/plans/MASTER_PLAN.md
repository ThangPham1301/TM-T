# Lân storefront UI delivery

Scope approved: five Stitch screens, with original section/widget/list order and layout; decoration from the supplied mon-02 library. Existing Next.js application and API remain the architecture. No backend, auth, deployment, paid service, merge or unrelated page work.

Branch: feature/lan-store-products-ui, based on origin/main 837098c.

## Milestones
1. Home: hero, value strip, category sidebar + bestsellers, gifts, gallery, story.
2. Collection: introduction, toolbar, left filters, product grid, pagination, story CTA.
3. Detail: breadcrumb, gallery + purchase panel, content tabs, related products.
4. Admin products: sidebar, heading, metrics, filters, table, editor sections.
5. Admin categories: sidebar, heading, filters, table, editor and delete confirmation.

Every page gets a native goal and a committed/pushed checkpoint. Final acceptance: lint, typecheck, production build, desktop/mobile visual inspection and focused interaction checks. Backend-dependent checks must distinguish fixture QA from live integration.

Active task plan: active/LAN_STITCH_UI.md. Handoff: ../CURRENT_STATE.md.

Status: all five UI milestones complete; focused lint/typecheck/build and synthetic desktop/mobile QA pass. Next is user visual review, followed by a separately scoped real backend acceptance run. No merge/deploy authorized.

---

# Whole-web visual theme

Approved scope (2026-11-17): start a feature branch from current main, check all Stitch screens, and apply the established mon-02 design language across the web. Preserve current page structure, component/list order, responsive grids and interactions. Read Stitch only. No backend, API, auth, data, dependency upgrade, merge or deployment work.

Base: origin/main 837098cfbd6e98bdd873fbc2ffcb1c29c030a609. Branch: feature/web-heritage-theme. The earlier feature/lan-store-products-ui branch is not merged into main and is not imported, because it also changes page structure/behavior.

## Milestones
1. Audit all 23 visible Stitch screens against routes, record structural gaps and capture baseline page structure.
2. Shared design tokens, supplied assets and global CSS decoration, keeping existing TSX composition.
3. Verify public/auth/commerce, account and admin surfaces at desktop/mobile; compare structure against baseline, test important states/interactions.
4. Focused lint/typecheck/build, local diff/BE boundary audit, committed/pushed checkpoints and handoff.

The current phase plan is active/WEB_HERITAGE_THEME.md. Current handoff is ../CURRENT_STATE.md. Route/reference evidence is ../ui_web/design/WEB_THEME_COVERAGE.md.

Status (2026-11-17): all four milestones complete. The 23 reference routes exist; material composition differences are documented and preserved. Shared theme, 46 before/after browser comparisons, interaction/state checks, typecheck/build and scoped lint have passed. Next: user review of the pushed feature branch.
