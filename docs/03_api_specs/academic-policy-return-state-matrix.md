# Academic Policy Return demo contract

Status: DRAFT / ACADEMIC DEMO. Two role bundles: CUSTOMER and ADMIN. This contract is isolated from existing stable Customer/Employee contracts. No test or production acceptance is claimed.

Browser calls `/api/academic/*`; Next BFF forwards to private loopback `/api/demo/*` on 8088. Backend creates a separate opaque cookie `gh_academic`, HttpOnly/SameSite Strict, 8 hours, path `/api/academic`. Local HTTP only; deployment over public networks requires TLS, Secure cookie and independent security review. Roles resolve to explicit permission sets in backend; record ownership is checked on each read/write. No client-supplied owner or role is used.

## Operations

| Method/path after prefix | Input | Access/output |
| --- | --- | --- |
| GET policy | none | Public, latest DRAFT policy |
| POST auth/register | name (1–100), email (≤150), password (12–72 UTF-8 bytes) | Public, CUSTOMER only; seeds two synthetic orders and creates session |
| POST auth/login | email, password | Public; generic 401; bounded in-memory login attempts per email; 12 attempts/15 minutes, resets on success/restart |
| POST auth/logout | {} | Authenticated; revoke current session |
| GET state | none | User, own orders/privacy/returns/consent; ADMIN sees all cases/orders plus 200 audit records and policy versions |
| POST command | action-specific JSON below, required Idempotency-Key (16–80 alphanumeric/hyphen characters) | Atomic mutation; same actor/key/body replays result; altered body conflicts |
| POST evidence/intents | name (≤120) | CUSTOMER; creates caller-owned UPLOADING fileId |
| PUT evidence/{id}/content | octet-stream ≤5MB, PNG/JPEG signature | Owner; complete once; private volume. No antivirus: STORED_UNSCANNED. UI accepts at most 5 refs per case |
| GET evidence/{id}/content | none | Owner/ADMIN, attachment only, no-store/nosniff |
| GET privacy/{id}/export | none | Owner/ADMIN; completed ACCESS/EXPORT only, JSON attachment |

All mutations require trusted Origin. BFF permits exact same browser origin; backend permits localhost/127.0.0.1 ports 3000 and 3100. No browser CORS is opened. Secrets and credentials are generated locally by setup.ps1 and are not committed.

## Command payloads and permissions

| action | Payload besides action | Permission |
| --- | --- | --- |
| profile | name, phone (≤30), address (≤400) | self.manage |
| consent | granted boolean | self.manage; append history and current policy version |
| privacy-create | type ACCESS/EXPORT/DELETE/RESTRICT/COMPLAINT, description 1–2000 | privacy.create |
| return-create | orderId UUID, quantity positive integer, reason WRONG_ITEM/MISSING_ITEM/DAMAGED/UNSAFE/QUALITY, resolution REFUND/REPLACEMENT, description 1–2000, evidenceIds UUID[] | return.create; owned delivered order, remaining quantity, 7-day demo window except UNSAFE/QUALITY |
| privacy-supplement / return-supplement | id UUID, revision, note 1–2000 | Owner CUSTOMER; nonterminal; evidence-required returns to reviewing |
| privacy-update | id, revision, status, note | privacy.decide (ADMIN) |
| return-update | id, revision, status, note; approval also approvedQuantity, resolution, returnRequired boolean; inspection also disposition | return.decide (ADMIN) |
| policy | version 1–40, content 1–16000 | policy.manage (ADMIN); append new DRAFT version |

ADMIN permission bundle: privacy.decide, return.decide, policy.manage, audit.read. CUSTOMER: self.manage, privacy.create, return.create. A global PostgreSQL transaction advisory lock serializes command mutations for this small demo. Revision is incremented on each case update; stale revision =409. Quantities in active/non-rejected cases reserve the requested amount conservatively, even when approval is partial. Refund amount uses net order total pro-rated by approved quantity; no client-supplied monetary amount. Only one product line per seeded order in this MVP. There is no external provider call, real stock movement or email/SMS.

Privacy: SUBMITTED → REVIEWING → EVIDENCE_REQUIRED / COMPLETED / REJECTED; EVIDENCE_REQUIRED → REVIEWING. ACCESS/EXPORT completion creates scoped snapshot. RESTRICT turns off marketing and explicitly flags remaining processing for manual review. DELETE closes account/revokes sessions, removes contact fields, evidence files/refs and consents, redacts request descriptions/history and cached operation results. Transaction snapshots, identifiers and audit remain for demo reconciliation; retention pending approval. File deletion is not transactionally reversible: on a filesystem error, review manually before retry. The requester loses login on completed deletion; ADMIN can see the final result. Export can contain other case evidence references but cannot bypass access checks.

Return: REQUESTED → REVIEWING → EVIDENCE_REQUIRED / APPROVED / REJECTED; EVIDENCE_REQUIRED → REVIEWING. APPROVED either requires receipt → inspection, or waives physical return. Then PROCESSING → RESOLVED. Inspection dispositions: QUARANTINE/DAMAGED/DISPOSE, never automatic sellable restock. Execution is PENDING_SIMULATION → SUCCEEDED_SIMULATED. Approval is not completion. This MVP does not simulate failed/unknown provider outcomes or appeal/reopen.

## UI state matrix

| Situation | UI/result |
| --- | --- |
| Initial load | Busy state; policy publicly readable |
| Session absent/expired | Login/register; backend 401; mutation error shown |
| Empty collection | Empty message, [] response |
| Validation | Browser constraints plus backend safe 422 message |
| Cross-owner | Generic 404, no record content |
| Wrong permission/Origin | 403 |
| Concurrent change/idempotency mismatch | 409 with reload guidance |
| Upstream unavailable | BFF 503 guidance to start Compose |
| Mutation pending | Buttons disabled; error/status region announced |
| Success | Refresh state/timeline; success notice |
| Evidence | Private download, explicit unscanned demo label |
| Refund/replacement | Explicit simulation labels; no real transaction claim |
| Draft policy | Not effective; version history visible to ADMIN |

Open decisions: production policy/SLA/retention, payment/shipping adapters, actual antivirus, separated duties, full catalog/checkout integration, multi-line/combo calculation, attachment cleanup and full abuse protection. No production guarantees.
