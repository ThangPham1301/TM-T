# Quy trình đơn hàng, hủy, đổi trả và hoàn tiền

## 1. Vòng đời đơn hàng hiện có

| Bước | Hành vi và trạng thái | Bằng chứng | Phân loại |
| --- | --- | --- | --- |
| 1. Giỏ hàng | Đọc giỏ; thêm/sửa/xóa item; mutation dùng revision `If-Match`. | `services/order-service/internal/transport/http.go:158`, `services/order-service/internal/transport/http.go:167`, `services/order-service/internal/transport/http.go:188`, `services/order-service/internal/transport/http.go:208`, `services/order-service/internal/transport/http.go:209`. | **ĐÃ TRIỂN KHAI**. |
| 2. Quote | Order nhận Cart revision, lấy snapshot Catalog/Shipping và trả quote có thời hạn. | Route quote `services/order-service/internal/transport/http.go:221`; contract yêu cầu `quote_id`, `cart_revision`, `payment_method` (`packages/contracts/mvp/README.md:39`). | **ĐÃ TRIỂN KHAI**, dependency thật còn gate. |
| 3. Checkout admission | `POST /checkout` tạo CheckoutOperation; trả Location để poll; không coi 202 là Order đã tồn tại. | `services/order-service/internal/transport/http.go:243`, `services/order-service/internal/transport/http.go:255`, `services/order-service/internal/transport/http.go:272`; `packages/contracts/mvp/README.md:39`. | **ĐÃ TRIỂN KHAI**. |
| 4. Chống trùng | Idempotency record, quote consumption và submission guard chống dùng lại quote/cart revision. | `services/order-service/migrations/000001_order.up.sql:15`; `services/order-service/migrations/000004_core_foundation.up.sql:21`, `services/order-service/migrations/000004_core_foundation.up.sql:26`. | **ĐÃ TRIỂN KHAI**. |
| 5. Giữ tồn | Inventory reservation phân bổ theo FEFO, khóa SKU theo thứ tự, transaction và idempotency. | `services/inventory-service/internal/application/usecase/reserve_stock.go:45`; stock tables và reservation có trong migration (`services/inventory-service/migrations/000001_init_inventory_schema.up.sql:1`). | **ĐÃ TRIỂN KHAI**. |
| 6. Tạo Order snapshot | Tạo `orders`, `order_items`; item và snapshot thương mại bất biến. | `services/order-service/migrations/000001_order.up.sql:23`, `services/order-service/migrations/000001_order.up.sql:53`, `services/order-service/migrations/000001_order.up.sql:59`, `services/order-service/migrations/000001_order.up.sql:68`. | **ĐÃ TRIỂN KHAI**. |
| 7. Thanh toán | VIETQR/SePay tạo payment intent; nhận webhook/statement, lưu observation mã hóa, allocation/finalization. COD có trạng thái riêng nhưng gate. | `services/order-service/migrations/000004_core_foundation.up.sql:65`; `services/order-service/internal/transport/sepay.go:92`; `services/order-service/README.md:66`. | **ĐÃ TRIỂN KHAI TEST/gated**; live provider chưa chứng minh. |
| 8. Chốt hoặc giải phóng tồn | Paid/COD đủ điều kiện mới commit; timeout/hủy giải phóng reservation. Stock status tách `RESERVED/COMMITTED/RELEASED/UNKNOWN`. | `services/order-service/migrations/000001_order.up.sql:30`, `services/order-service/migrations/000001_order.up.sql:46`, `services/order-service/migrations/000001_order.up.sql:47`; Inventory consumer commit (`services/inventory-service/internal/presentation/kafka/consumer.go:172`). | **ĐÃ TRIỂN KHAI**; cần E2E/chaos evidence cho production. |
| 9. Fulfillment | Ready event → admission/task; nhân viên assign/start/pick/check/seal; video evidence có checksum/scan. | `services/fulfillment-service/README.md:8`, `services/fulfillment-service/README.md:11`; `services/fulfillment-service/migrations/000001_foundation.sql:33`, `services/fulfillment-service/migrations/000001_foundation.sql:147`, `services/fulfillment-service/migrations/000001_foundation.sql:172`. | **ĐÃ TRIỂN KHAI**, integrated-v2/media gated. |
| 10. Tạo vận đơn | Packing event không chứa PII; Shipping gọi Order lấy recipient/COD/fee, tạo một shipment cho mỗi package. | `services/shipping-service/README.md:89`; uniqueness Order/package (`services/shipping-service/migrations/000001_initial.up.sql:30`). | **ĐÃ TRIỂN KHAI**, fake/staging carrier. |
| 11. Giao/Tracking | Carrier webhook được xác thực, map provider status sang status nội bộ và lưu tracking event. | Signed fake webhook (`services/shipping-service/README.md:43`); tracking schema (`services/shipping-service/migrations/000001_initial.up.sql:45`, `services/shipping-service/migrations/000001_initial.up.sql:59`). | **ĐÃ TRIỂN KHAI**. |
| 12. Hoàn tất | State machine có `DELIVERED → COMPLETED`, nhưng completion authority/Care/settlement chưa mở. | `services/order-service/internal/domain/model.go:235`; `packages/contracts/mvp/README.md:72`; `docs/ui_web/MVP_CUSTOMER_ORDER_SHIPPING_ACCEPTANCE.md:76`. | **CHỈ CÓ CODE/THIẾT KẾ GATED**, chưa có bằng chứng production completion. |

Order state machine hiện cho phép chuỗi chính: `PENDING_PAYMENT → PAYMENT_FINALIZING → PAID → PROCESSING → PACKED → SHIPPED → DELIVERED → COMPLETED`, nhánh COD bắt đầu ở `CONFIRMED_COD`, cùng các trạng thái hủy và giao thất bại (`services/order-service/internal/domain/model.go:231`, `services/order-service/internal/domain/model.go:235`). Payment status và stock status là state machine riêng trong schema (`services/order-service/migrations/000001_order.up.sql:29`, `services/order-service/migrations/000001_order.up.sql:30`), phù hợp nguyên tắc không gộp mọi trạng thái thành một trường.

## 2. Hủy đơn

### Đã triển khai

- Customer có `POST /api/v1/orders/{id}/cancel`; yêu cầu review có endpoint riêng (`services/order-service/internal/transport/http.go:394`, `services/order-service/internal/transport/http.go:395`).
- Hủy trực tiếp chỉ cho `PENDING_PAYMENT` hoặc COD đã xác nhận; paid cancellation chuyển review thay vì tự hủy (`services/order-service/internal/app/orders.go:240`, `services/order-service/internal/app/orders.go:254`).
- Request hủy có idempotency qua `command_registry`; audit chỉ lưu hash lý do thay vì nội dung reason trong event này (`services/order-service/internal/app/orders.go:223`, `services/order-service/internal/app/orders.go:267`, `services/order-service/internal/app/orders.go:274`).
- Shipping cho hủy shipment trước carrier handover và không blind retry khi provider timeout (`services/shipping-service/README.md:70`, `services/shipping-service/README.md:72`, `services/shipping-service/README.md:73`).

### Còn thiếu bằng chứng

- **CHƯA CÓ BẰNG CHỨNG NGHIỆM THU:** paid cancellation/reversal qua Order–Payment–Inventory–Fulfillment–Shipping. Fulfillment ghi rõ vẫn disabled (`services/fulfillment-service/README.md:36`).
- **CHƯA TÌM THẤY:** chính sách thời điểm cắt hủy theo SLA thực tế, phí hủy, quyền override, thông báo khách và cơ chế xử lý khi shipment/provider ở trạng thái không chắc chắn.

## 3. Đổi trả

### Phần đã có

- Web có trang eligibility, tạo case, xem case; request được allowlist và validate line/quantity/reason/evidence/refund account (`apps/web-user/src/lib/returns/validation.ts:23`, `apps/web-user/src/lib/returns/validation.ts:36`, `apps/web-user/src/lib/returns/validation.ts:47`, `apps/web-user/src/lib/returns/validation.ts:73`).
- BFF yêu cầu Customer session, trusted Origin và forward idempotency key (`apps/web-user/src/app/api/returns/return-handler.ts:55`, `apps/web-user/src/app/api/returns/return-handler.ts:58`, `apps/web-user/src/app/api/returns/return-handler.ts:74`).
- Mobile có REST repository cho tạo và đọc return (`apps/mobile-app/lib/features/returns/data/rest_returns_repository.dart:28`, `apps/mobile-app/lib/features/returns/data/rest_returns_repository.dart:47`).
- Contract/UI mô hình hóa Return Case, returned goods và refund projection riêng (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:72`, `docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:77`, `docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:78`).

### Phần chưa được coi là backend đã triển khai

- Search các backend service không tìm thấy route `/api/v1/returns`, entity/migration Return Case; kết quả implementation nằm ở client, mock và contract. Đây là **CHƯA TÌM THẤY**, không phải khẳng định tuyệt đối không tồn tại ngoài repository.
- BFF hiện suy eligibility từ Order detail (`apps/web-user/src/app/api/returns/return-handler.ts:65`) và gọi `/returns` upstream (`apps/web-user/src/app/api/returns/return-handler.ts:74`), nhưng Order transport không đăng ký route return trong danh sách route đã đọc.
- Supplement được BFF trả `501` (`apps/web-user/src/app/api/returns/return-handler.ts:85`).
- Tài liệu mock nêu cửa sổ 7 ngày (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:21`, `docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:23`), nhưng đây là fixture/mock, **không được coi là chính sách đã phê duyệt**.
- Web đang nhận URL media do người dùng nhập (`apps/web-user/src/app/(storefront)/orders/[orderId]/after-sales/request/after-sales-request-flow.tsx:88`); tài liệu yêu cầu production chuyển sang upload intent, scan và content sniffing (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:101`).

## 4. Hoàn tiền

### Đã triển khai trong payment subsystem

- Schema có `refunds` với amount/status và quan hệ receipt/order (`services/order-service/migrations/000001_order.up.sql:103`, `services/order-service/migrations/000001_order.up.sql:106`).
- Internal endpoint tiếp nhận refund trả 202 (`services/order-service/internal/transport/http.go:493`, `services/order-service/internal/transport/http.go:506`).
- Staff API có queue/detail, claim/start/retry/cancel obligation, evidence và verify (`services/order-service/internal/transport/sepay_staff.go:64`, `services/order-service/internal/transport/sepay_staff.go:80`, `services/order-service/internal/transport/sepay_staff.go:92`, `services/order-service/internal/transport/sepay_staff.go:141`, `services/order-service/internal/transport/sepay_staff.go:173`).
- Approval/evidence nhạy cảm được lưu ciphertext và đọc qua cipher (`services/order-service/internal/persistence/payment_refund.go:215`, `services/order-service/internal/persistence/payment_refund_evidence.go:52`).

### Khoảng trống

- **CHƯA TÌM THẤY:** Return service phát sự kiện/command đã phê duyệt để tạo refund trong Order.
- **CHƯA TÌM THẤY:** chính sách ai chịu phí chuyển khoản/hoàn hàng, phương thức hoàn theo phương thức thanh toán gốc, thời hạn hoàn, xử lý sai thông tin tài khoản, partial refund, đổi hàng thay hoàn tiền và phê duyệt theo ngưỡng.
- **CHƯA CÓ BẰNG CHỨNG PRODUCTION:** provider refund thực; Order README coi adapter/payment hiện tại là sandbox/TEST (`services/order-service/README.md:19`, `services/order-service/README.md:66`).

## 5. Chính sách đổi trả đề xuất để nhóm chốt

Các mục dưới đây là **ĐỀ XUẤT cấu trúc chính sách**, không tự đặt số ngày/SLA:

1. **Điều kiện áp dụng:** xác định nhóm sản phẩm được trả/không trả, tình trạng niêm phong, hạn sử dụng, hàng cá nhân hóa/quà tặng/combo và hàng giảm giá.
2. **Mốc tính cửa sổ:** dùng thời điểm carrier `DELIVERED` đã xác minh; định nghĩa xử lý khi tracking sai, giao một phần hoặc giao thất bại. Con số ngày do nhóm phê duyệt.
3. **Lý do và bằng chứng:** hỏng do vận chuyển, sai/thiếu hàng, chất lượng, đổi ý; quy định ảnh/video bắt buộc và tiêu chí chấp nhận.
4. **Các state machine tách biệt:** Return Case, Returned Goods, Return Shipment và Refund. Requirement cũng yêu cầu tách các vòng đời này (`docs/01_requirements/epics/EPIC_14_Return_Refund.md:455`, `docs/01_requirements/epics/EPIC_14_Return_Refund.md:464`).
5. **Phân quyền:** Customer tạo/xem case của mình; CSKH triage; Warehouse xác nhận hàng; Finance phê duyệt/chi; manager xử lý ngoại lệ. Không cho một actor tự tạo, phê duyệt và chi refund.
6. **Chi phí:** chốt bên chịu phí lấy hàng, phí hoàn, chênh lệch đổi hàng và trường hợp lỗi của cửa hàng/carrier/khách.
7. **SLA:** chốt thời gian tiếp nhận, review, lấy hàng, kiểm hàng, quyết định và hoàn tiền; có pause reason và escalation.
8. **Tồn kho trả về:** không tự restock chỉ vì Return được duyệt. Chỉ nhập lại sau inspection, phân loại sellable/damaged/quarantine và audit batch/HSD.
9. **Bảo vệ dữ liệu:** dùng file ID thay URL tùy ý, mask tài khoản ngân hàng, mã hóa evidence/refund data, retention/legal hold, và xóa theo policy đã duyệt.
10. **Idempotency/audit:** mọi mutation có key, version/If-Match, reason code và audit append-only; webhook/carrier callback có signature và replay protection.

## 6. Tiêu chí nghiệm thu đề xuất

- **ĐỀ XUẤT:** Contract test và integration test chứng minh ownership: Customer A không xem/tạo Return trên Order của Customer B.
- **ĐỀ XUẤT:** Race test hai yêu cầu Return cùng line không vượt quantity; refund không vượt số tiền đã thu sau các refund trước.
- **ĐỀ XUẤT:** E2E Return approved → pickup → inspection → refund, có retry/idempotency và phục hồi khi từng dependency timeout.
- **ĐỀ XUẤT:** Security test upload malware/content-type mismatch, URL SSRF, IDOR, forged staff role, replay webhook và log redaction.
- **ĐỀ XUẤT:** Reconciliation test chứng minh refund `UNKNOWN` không bị retry mù và không chi hai lần.
- **ĐỀ XUẤT:** Báo cáo evidence tách fake/sandbox/staging/production, đúng cảnh báo integration target (`packages/contracts/mvp/README.md:7`).
