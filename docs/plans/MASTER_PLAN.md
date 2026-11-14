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
