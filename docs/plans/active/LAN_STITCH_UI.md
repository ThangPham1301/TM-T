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
- [x] Product detail
- [x] Admin products
- [x] Admin categories

## Exact next step
All five page implementations and fixture/visual QA complete. Review pushed feature branch; live backend integration remains unverified and outside this UI delivery. See docs/CURRENT_STATE.md for commands, evidence and limitations.





## Final checkpoint
All five page goals were created in the runtime. Each page has a durable implementation milestone and remote checkpoint. Final focused lint, typecheck, build and five-page browser suite PASS; full lint retains only the recorded pre-existing failures. No live persistence is claimed.

