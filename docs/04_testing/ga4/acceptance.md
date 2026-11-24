# GA4 acceptance and evidence

Read [design v3](../../03_api_specs/ga4-measurement-plan-v3.md) before testing. Status starts NOT RUN. Automated tests do not prove Google received events.

| ID | Action | Expected |
|---|---|---|
| A01 | Enter public page with campaign UTM; navigate and Back | One pageview/navigation; clean URL, campaign retained initially |
| A02 | Filter/page catalog; trigger focus/feed refresh or rerender without navigation | Visible cards only; one exposure/item/list context in the same navigation instance. Polling/refreshing data must not duplicate |
| A02-reload | Reload the whole catalog document, then view the same card | One new page_view and one new view_item_list for that visible card. Whole-document reload is a new exposure, not a duplicate of the prior page |
| A03 | Select card; add 3 when cart has 2 | select_item, view_item, add_to_cart quantity 3 |
| A04 | Buy now | One add, then begin_checkout after form displays |
| A05-assistant | Explicitly ask to add one named product, then confirm the proposal dialog | No add event before confirmation; one successful delta with source_surface=assistant. A generic recommendation request must not be expected to open a cart-confirmation dialog |
| A05-reorder | Use Mua lại from account order history, then return to checkout | Safe deltas queued from private route, source_surface=reorder, no conversation/history/identity content |
| A06 | Guest/account × COD/VIETQR checkout | One purchase at order creation, not payment; consistent transaction ID |
| A07 | Replay POST/refresh confirmation | No extra purchase/cart events for the same operation |
| A08 | Quote poll/state reload fails | No extra checkout; successful POST still dispatched before reload |
| A09 | Offer percent/fixed/floor/mixed price source | Event item totals match backend; non-BASE not discounted again |
| A10 | 3 units, 10,000 VND line discount | Net 140,000 at 50,000 original/unit; integer split exact |
| A11 | Story offscreen/default/disclosure/keyboard | Only visible content qualifies; hidden content not counted |
| A12 | Offer countdown/reopen; activate the actual link in aside[aria-label="Ưu đãi Gói Huế"] | No per-second impressions; actual CTA fires one select_offer. Selecting a nonexistent locator or obtaining click delta 0 is not evidence of CTA PASS |
| A13 | Enter private route from storefront | Full document boundary, no GA on private destination; no sensitive URLs |
| A14 | Missing ID, disabled GA, blocked tag/storage | Commerce still works; no UI failure caused by analytics |
| A15 | QA Google DebugView/filter | Actual parameters observed; test traffic excluded before campaign starts |

For each case record date/time UTC+7, build/commit, URL, outcome PASS/FAIL/NOT RUN/BLOCKED, sanitized screenshot/request evidence and any defect. Never claim DebugView PASS from local dataLayer alone. Never count QA orders toward campaign KPIs.

## Review clarification

The earlier shorthand “no refresh duplicates” meant a data refresh/rerender within a page instance, not a hard document reload. Exposure counts measure occurrences, not unique products per user/session. See [independent review](codex-review.md) and `apps/web/tests/ga4-review.mjs`. Do not merge the historical Muse row totals with these split cases into a new blanket pass percentage.
