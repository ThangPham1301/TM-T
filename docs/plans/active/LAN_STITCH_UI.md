# Five Stitch pages with mon-02 decoration

## Goal and dependencies
Implement Lân's five assigned pages in the existing Next.js app. Stitch project 3762085109118983605 defines structure; E:/Goi-Hue-Brand-Report/mon-02 defines decoration. User explicitly approved implementation, feature branch, checkpoint commits and pushes.

## Decisions and boundaries
- Reuse existing API/store, authorization, image upload and mutation contracts. No REST changes.
- Use Playfair Display / Be Vietnam Pro, paper Dó texture, brown #563A26, gold #D4A24C, stepped frames and supplied motifs. These override Stitch decoration, not layout.
- Shared decoration is scoped to the five pages. Other owners' account, cart, auth, settings and policy work stays intact.
- Preserve server ordering unless user chooses an explicit sort/filter. Display actual API data; no fabricated product specifications, review counts, trust claims or successful writes.
- Reference HTML snapshots: docs/ui_web/design/stitch-lan. These are reference material, not executable application pages.

## Steps and expected files
1. Home and scoped tokens/assets, reusable product card; home.tsx and lan.css.
2. Collection sidebar/filter/grid: commerce.tsx, product helpers.
3. Product detail gallery, purchase, tabs, related products; same existing API.
4. Admin product table/editor and scoped admin shell: catalog-admin.tsx.
5. Admin categories table/editor, final visual and interaction QA.

## UX, risks and validation
Loading, API error + retry, empty/reset, missing image, sold-out/disabled purchase, authenticated admin guards, labels/focus, mobile stacking, reduced motion. Quantity must stay within stock. Existing API has one primary image and no documented SKU/gallery contract: do not invent persistence for unsupported variants/gallery.

Commands (apps/web): npm ci; npm run lint; npm run typecheck; npm run build. Local browser QA against controlled fixtures if backend unavailable. Check filtering/sort, detail/cart payload, admin edit/save/toggle/delete payload and authorization, mobile overflow and section order.

## Progress
- [x] Home
- [x] Collection
- [ ] Product detail
- [ ] Admin products
- [ ] Admin categories

## Exact next step
Implement collection with left filters, grid, sorting and pagination; retain API. Final visual/fixture validation follows the five page checkpoints.


