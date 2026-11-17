# Current handoff

Task: apply mon-02 decoration to the entire web while preserving main's structure and behavior. Branch feature/web-heritage-theme at base 837098cfbd6e98bdd873fbc2ffcb1c29c030a609; worktree E:/.vscode/TM-T-Web-Theme. Earlier Lân branch and its untracked CLAUDE.md are untouched.

Completed: fetched main, read repository/web instructions, inspected all route entry points and relevant components/styles, read library rules, retrieved read-only Stitch inventory and outlines. There are 23 visible reference routes, all covered by existing route entry points, with composition gaps to document. npm ci passed. No code changes or backend edits yet.

Decision: current main DOM/layout is the preservation baseline. Do not cherry-pick earlier branch's composition/logic changes. Only add CSS/assets/import. No Stitch writes, backend/API/auth changes, dependency upgrades, merge or deployment. User's prior commit/push authorization applies to this feature branch.

Validation: baseline browser snapshots and implementation checks pending. Existing main lint failures from prior snapshot must be verified separately.

Exact next action: follow docs/plans/active/WEB_HERITAGE_THEME.md, capture 23-route browser/DOM baseline, then implement shared visual layer.

Baseline milestone: all 23 routes rendered at 1440/390, no page overflow; DOM/order/layout signatures recorded under ignored output/playwright/web-theme/baseline.json. Fixtures intercept all API writes and image requests. Initial fixture setup was corrected to intercept only the application WebSocket, preserving Next HMR hydration. Typecheck PASS. Full lint confirms only the existing three errors and one image warning. Theme CSS prepared but not imported yet. Next: import it, compare all screens, then interaction/visual validation.
