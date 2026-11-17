# Stitch route coverage and visual scope

Read-only audit: 2026-11-17, project [Gói Huế Store Redesign](https://stitch.google.com/projects/3762085109118983605), updated 2026-11-16. Reference metadata and HTML headings are captured in stitch-screen-inventory.json. 23 visible route screens are represented; the hidden older product-detail variant, logos, design-system assets and reference images are not separate application pages.

Base is origin/main 837098c. All 23 reference paths have an existing route entry point; `/account` and `/admin` are additional entry pages. This proves route coverage, **not full visual/feature parity with Stitch**. Current main's structure is deliberately preserved by user instruction: new visual layers do not import the earlier Lân branch's different structure and behaviors.

| Stitch path | Route coverage | Owning entry/component | Existing composition / material difference |
|---|---|---|---|
| `/register` | Present | apps/web/src/app/register/page.tsx → AuthForm(register) | Story and registration form exist; current success redirects are preserved rather than introducing the reference's separate confirmation view. |
| `/products` | Present | apps/web/src/app/products/page.tsx → Catalog | Main uses a horizontal search/category form rather than Stitch's left category/price/stock filter panel. |
| `/login` | Present | apps/web/src/app/login/page.tsx → AuthForm | Two-column story/form exists; do not add provider login, recovery or session flows merely because reference artwork suggests them. |
| `/admin/returns` | Present | apps/web/src/app/admin/[section]/page.tsx → Account(admin) | Return list and expanded processing form exist; reference sidebar/table/detail composition differs. |
| `/account/security` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Password controls exist. Existing account tabs and form grouping remain. |
| `/admin/categories` | Present | apps/web/src/app/admin/[section]/page.tsx → CatalogAdmin | Management rows, filters and inline editor exist; reference table/right drawer is absent from main. |
| `/` | Present | apps/web/src/app/page.tsx → HomeExperience | Main uses hero → categories → products → story → account CTA. Stitch additionally has a value strip, gift section and gallery; these are not introduced by this decoration-only change. |
| `/admin/settings` | Present | apps/web/src/app/admin/[section]/page.tsx → CatalogAdmin | Shipping fee/threshold and receiving-orders controls exist. Preserve the source form and native confirmation. |
| `/checkout` | Present | apps/web/src/app/checkout/page.tsx → Cart(checkout) | Recipient/address controls, COD and summary exist. Preserve existing inline success/navigation and validation behavior. |
| `/account/addresses` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Address list and inline add/edit form exist; reference modal layout is not substituted. |
| `/account/profile` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Profile and marketing panels exist. Account navigation is horizontal tabs, rather than the reference sidebar. |
| `/account/returns` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Return history exists; creation is reached through order details rather than a new independent page form. |
| `/admin/products` | Present | apps/web/src/app/admin/[section]/page.tsx → CatalogAdmin | Management rows, filters and inline editor exist; reference sidebar/table/modal composition is absent from main. |
| `/account/privacy` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Request form/history exists. Reference's five explanatory rights cards/table composition is not present. |
| `/admin/audit` | Present | apps/web/src/app/admin/[section]/page.tsx → Account(admin) | Audit entries exist as rows. Reference admin sidebar, table and richer audit toolbar are not present. |
| `/return-policy` | Present | apps/web/src/app/return-policy/page.tsx → Policies(returns) | Existing draft policy sections remain unchanged. Reference's TOC/cards do not replace approved source content. |
| `/products/[slug]` | Present | apps/web/src/app/products/[slug]/page.tsx → Catalog | Main has a single-image purchase card, without Stitch's gallery, multiple SKUs, tabs and related products. No new adapter/backend capabilities are inferred. |
| `/privacy-policy` | Present | apps/web/src/app/privacy-policy/page.tsx → Policies | Existing policy content and draft warning are authoritative. Reference's table of contents/editorial sections are not added or published. |
| `/account/orders` | Present | apps/web/src/app/account/[section]/page.tsx → Account | Filters, order rows, pagination and expandable detail exist; preserve their current grouping. |
| `/admin/policies` | Present | apps/web/src/app/admin/[section]/page.tsx → Account(admin) | Policy draft editor/history exists. Reference admin sidebar/editor composition differs; no policy text is rewritten. |
| `/admin/orders` | Present | apps/web/src/app/admin/[section]/page.tsx → Account(admin) | Filters, order list and expanded processing form exist; reference admin sidebar/table layout differs. |
| `/cart` | Present | apps/web/src/app/cart/page.tsx → Cart | Item list, quantities, actions and summary exist. Preserve actual warnings, pricing state and controls. |
| `/admin/privacy` | Present | apps/web/src/app/admin/[section]/page.tsx → Account(admin) | Request list and expanded workflow exist; reference admin sidebar/table composition differs. |

## Decoration applied in this phase

Shared mon-02 palette, Playfair Display/Be Vietnam Pro, layered Dó paper, actual brand mark, dark double-framed hero/story, stepped product/category frames, folded functional panels, paper inputs, brown/honey actions, meaningful error/warning/success tones, focus and reduced-motion treatment. Layout grids, widget/list order, text, form fields, routing and API logic stay owned by current source.

## Acceptance evidence

Before/after browser evidence and limitations are recorded in docs/CURRENT_STATE.md. The fixture browser suite checks every reference route at desktop/mobile and compares main DOM order and layout modes. Screenshots are local ignored QA artifacts. No Stitch writes, server calls, production deployment or live persistence acceptance are claimed.
