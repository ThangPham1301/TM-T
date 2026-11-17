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
