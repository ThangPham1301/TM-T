# Ma trận rủi ro sơ bộ

## 1. Cách chấm điểm

Đây là **đánh giá sơ bộ từ source code và tài liệu, không phải số liệu đo thực tế**. Nhóm cần hiệu chỉnh bằng log sự cố, traffic, tỷ lệ giao hàng, chargeback/refund, inventory variance, RTO/RPO và kết quả pentest.

Quy ước phân loại trong bảng: kiểm soát có bằng chứng runtime/migration là **ĐÃ TRIỂN KHAI**; nội dung chỉ nằm trong README, contract hoặc tài liệu là **CHỈ CÓ THIẾT KẾ**; khoảng trống được ghi là **CHƯA TÌM THẤY** chứ không khẳng định không tồn tại; cột xử lý là **ĐỀ XUẤT**.

- Xác suất (P): 1 hiếm, 2 thấp, 3 có thể xảy ra, 4 cao, 5 rất cao.
- Tác động (I): 1 không đáng kể, 2 nhỏ, 3 trung bình, 4 lớn, 5 nghiêm trọng.
- Điểm = P × I. Gợi ý: 1–4 thấp, 5–9 trung bình, 10–16 cao, 17–25 rất cao.

## 2. Ma trận

| ID | Rủi ro | Bằng chứng | P | I | Điểm/mức | Kiểm soát hiện có | Xử lý đề xuất |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| R01 | Rò rỉ credential/PII do secret mặc định, cấu hình dev hoặc log/audit | Kong có credential local trong file (`services/api-gateway/config/kong.yml:364`, `services/api-gateway/config/kong.yml:369`); compose có default credential (`infra/docker/docker-compose.infra.yml:9`); Identity ghi email vào audit và log upstream error body (`services/identity-service/src/main/java/com/hvduong/identity/application/account/impl/AuthenticationServiceImpl.java:158`, `services/identity-service/src/main/java/com/hvduong/identity/application/account/impl/AuthenticationServiceImpl.java:199`). | 4 | 5 | 20 — Rất cao | HttpOnly cookie, encrypted Order snapshot, gateway header stripping. | Secret manager, rotate, secret scan, bỏ defaults, redact log/audit, mã hóa Profile/Shipping PII, DLP và access review. |
| R02 | Truy cập trái phép do token quyền stale, route thiếu authorization hoặc CSRF ở cookie flow | Permission lấy trực tiếp từ JWT (`services/identity-service/src/main/java/com/hvduong/identity/security/SecurityConfig.java:68`); CSRF tắt (`services/identity-service/src/main/java/com/hvduong/identity/security/SecurityConfig.java:34`); BFF có cookie/session filter (`services/identity-service/src/main/java/com/hvduong/identity/security/SecurityConfig.java:47`). | 3 | 5 | 15 — Cao | RS256/issuer/audience/expiry; method security; BFF trusted Origin. | Token version/revocation, TTL ngắn cho staff, policy test từng route, tách bearer/cookie chain và CSRF test. |
| R03 | Sập web/gián đoạn checkout do dependency hoặc hạ tầng đơn lẻ | Checkout phụ thuộc Catalog/Profile/Inventory/Payment; gateway timeout/retry cấu hình theo service (`services/api-gateway/config/kong.yml:168`, `services/api-gateway/config/kong.yml:170`); tài liệu chưa có bằng chứng HA/performance production (`services/fulfillment-service/README.md:52`). | 3 | 5 | 15 — Cao | Async CheckoutOperation, retry worker, inbox/outbox, health/readiness. | SLO/RTO/RPO, HA DB/Kafka/Redis, circuit breaker, capacity/load test, backup-restore drill, degraded UX và runbook. |
| R04 | Gian lận COD: đơn giả, từ chối nhận, sửa số tiền/trạng thái hoặc settlement thiếu | Schema có COD (`services/order-service/migrations/000004_core_foundation.up.sql:17`, `services/order-service/migrations/000004_core_foundation.up.sql:45`) và Shipping lưu COD amount (`services/shipping-service/migrations/000001_initial.up.sql:16`), nhưng COD settlement/completion chưa mở (`packages/contracts/mvp/README.md:5`). | 3 | 4 | 12 — Cao | COD đang gate; snapshot bất biến; state machine tách payment/stock. | OTP/xác minh contact, hạn mức/risk score, COD eligibility, signed carrier reconciliation, failed-delivery policy, settlement ledger và maker-checker. |
| R05 | Sai lệch tồn kho/oversell do race, event trùng/mất hoặc compensation lỗi | Reservation dùng distributed lock/FEFO (`services/inventory-service/internal/application/usecase/reserve_stock.go:45`); stock có `UNKNOWN` (`services/order-service/migrations/000001_order.up.sql:30`); outbox projection dùng deferred trigger (`services/inventory-service/migrations/000004_stock_projection.up.sql:51`). | 3 | 5 | 15 — Cao | Canonical lock order, DB transaction, idempotency, inbox/outbox, unique constraints. | Reconciliation định kỳ Order–Inventory, alert stuck/UNKNOWN, chaos test, tombstone/replay policy và manual repair có audit. |
| R06 | Giao trễ/mất cập nhật tracking do carrier timeout, mapping sai hoặc webhook lỗi | GHN chỉ staging và mặc định tắt (`services/shipping-service/README.md:45`, `services/shipping-service/README.md:47`); tracking map external status (`services/shipping-service/migrations/000001_initial.up.sql:50`, `services/shipping-service/migrations/000001_initial.up.sql:52`). | 4 | 4 | 16 — Cao | Signed webhook; idempotent carrier code; retry/reconcile detail khi timeout (`services/shipping-service/README.md:64`, `services/shipping-service/README.md:73`). | SLA theo vùng/carrier, polling fallback, stale-tracking alert, provider status mapping review, multi-carrier failover và customer notification. |
| R07 | Hỏng hàng/thiếu hàng, tranh chấp không đủ bằng chứng | Fulfillment yêu cầu package/seal/media; media phải scan SAFE mới VERIFIED (`services/fulfillment-service/migrations/000001_foundation.sql:130`, `services/fulfillment-service/migrations/000001_foundation.sql:162`, `services/fulfillment-service/migrations/000001_foundation.sql:172`). Production media policy chưa nghiệm thu (`services/fulfillment-service/README.md:34`). | 3 | 4 | 12 — Cao | Packing checklist, batch allocation, seal, video checksum, legal hold. | Chuẩn video/góc quay, cân nặng đối soát, QC sampling, retention/legal hold chính thức, chain of custody và dispute access control. |
| R08 | Thanh toán/hoàn tiền trùng, sai số tiền hoặc trạng thái UNKNOWN | Provider timeout để lại UNKNOWN (`services/order-service/README.md:75`); refund/evidence có workflow riêng (`services/order-service/internal/transport/sepay_staff.go:92`, `services/order-service/internal/transport/sepay_staff.go:173`). | 3 | 5 | 15 — Cao | Idempotency, HMAC, immutable receipt, observation ciphertext, reconciliation queue. | Không retry mù, unique provider reference, daily reconciliation, segregation of duties, dual approval, amount caps và exception dashboard. |
| R09 | Lạm dụng upload/URL evidence gây malware, SSRF hoặc lộ dữ liệu đổi trả | Web chấp nhận URL HTTP(S) do người dùng nhập (`apps/web-user/src/lib/returns/validation.ts:58`); production upload intent/scan mới là yêu cầu tài liệu (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:101`). | 4 | 4 | 16 — Cao | Giới hạn số URL và format input phía BFF. | File ID nội bộ, presigned upload, size/content sniffing, antivirus, allowlist host, private bucket, URL expiry và không fetch URL tùy ý server-side. |
| R10 | Chính sách đổi trả không nhất quán hoặc bồi hoàn sai vì backend canonical chưa hoàn chỉnh | BFF Return có code nhưng supplement trả 501 (`apps/web-user/src/app/api/returns/return-handler.ts:85`); chưa tìm thấy Return migration/backend; mock nêu chính sách 7 ngày (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:21`) nhưng không phải policy duyệt. | 4 | 4 | 16 — Cao | Validation/idempotency ở BFF; OpenAPI/state matrix. | Chốt policy owner/version, xây Care/Return service canonical, state machine tách biệt, contract/E2E test và audit quyết định. |
| R11 | Mất/không tuân thủ dữ liệu do retention và quyền xóa chưa chốt | Chỉ thấy retention cụ thể cho idempotency/guest/media (`services/order-service/migrations/000001_order.up.sql:18`, `services/order-service/migrations/000005_sepay_payment.up.sql:33`, `services/fulfillment-service/internal/persistence/media.go:81`); các dữ liệu khác chưa có policy runtime. | 3 | 5 | 15 — Cao | Một số immutable ledger/legal hold. | Data inventory, retention schedule theo loại dữ liệu, deletion/anonymization workflow, legal hold, backup expiry và evidence thực thi. |
| R12 | Sai phân quyền database hoặc lateral movement từ một service | Hạ tầng tổng cấp mọi database cho cùng user quản trị (`infra/scripts/init-databases.sql:12`, `infra/scripts/init-databases.sql:18`), DB được publish trên host dev (`infra/docker/docker-compose.infra.yml:12`). | 3 | 5 | 15 — Cao | Một số compose service dùng user riêng; database-per-service ở mức logic. | Per-service DB role/schema, deny cross-db, TLS/mTLS, network policy, credential rotation, audit query và không dùng compose dev trong production. |
| R13 | Tích hợp giả/mock bị hiểu nhầm là production, dẫn đến quyết định sai | Contract tự ghi integration target và CI không chứng minh runtime (`packages/contracts/mvp/README.md:7`); Order chỉ sandbox adapters (`services/order-service/README.md:19`). | 4 | 4 | 16 — Cao | Feature gates, README cảnh báo, test fixtures tách biệt. | Environment badge, capability registry machine-readable, release gate theo provider thật, evidence timestamp/version và sign-off owner. |
| R14 | Rò dữ liệu sang chatbot/AI nếu triển khai mà chưa có governance | AI Provider/trợ lý chỉ ở requirement (`docs/01_requirements/use_case_specification.md:236`), chưa có boundary dữ liệu. | 2 | 5 | 10 — Cao | Chưa có runtime nên chưa có exposure từ chức năng này. | DPIA, consent, prompt redaction, no-training/DPA, allowlist context, retention, human escalation, output safety và audit model/version. |

## 3. Ưu tiên xử lý

### Ngay trước demo có dữ liệu thật

1. R01/R12: loại credential mặc định, tách DB account và kiểm tra log không chứa PII/token.
2. R02: xác minh toàn bộ mutation cookie-auth có Origin/CSRF; kiểm role/scope ở backend.
3. R09: không nhận URL evidence tùy ý; chỉ demo bằng mock/synthetic nếu upload pipeline chưa có.
4. R13: dán nhãn rõ fake/sandbox/staging trên UI và tài liệu nghiệm thu.

### Trước pilot

1. R05/R08: reconciliation và chaos test cho tồn kho, payment, refund.
2. R06/R07: carrier SLA, packing evidence và dispute runbook.
3. R10/R11: policy đổi trả/retention được phê duyệt và backend Return canonical.

### Trước production

1. R03: HA, load, backup/restore, DR và SLO monitoring.
2. R04: COD fraud/settlement controls nếu mở COD.
3. R14: AI governance nếu bật chatbot.

## 4. Chỉ số cần thu thập để thay đánh giá sơ bộ

- Tỷ lệ 5xx, timeout, checkout failure, retry và CheckoutOperation stuck theo stage.
- Inventory variance, reservation expiry, duplicate event, trạng thái `UNKNOWN` và thời gian reconcile.
- Payment unmatched/duplicate, refund `UNKNOWN`, thời gian xử lý và số lần manual intervention.
- On-time pickup/delivery, stale tracking, delivery failed, hàng hỏng/thiếu theo carrier/SKU.
- Return rate theo reason/SKU/carrier, approval rate, thời gian từng state, chi phí refund/return shipping.
- Security: failed login/rate limit, revoked/stale token, access denied, secret scan, dependency vulnerability, log-redaction violation.
- Availability: uptime, p95/p99 latency, RTO/RPO thực đo, restore drill và consumer lag.
