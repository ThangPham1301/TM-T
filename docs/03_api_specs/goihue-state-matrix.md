# Hợp đồng API và trạng thái Gói Huế

Hợp đồng của khung thống nhất sau xây dựng lại. Trạng thái DRAFT vì chính sách, SLA và retention còn chờ phê duyệt. BFF `/api/store/*` forward đến Spring `/api/v1/*`, giữ nguyên query string; đường dẫn `agent/chat` nằm trong danh sách cho phép của BFF và có timeout riêng (180s) phục vụ streaming SSE. Không dùng Mockoon hoặc Identity cũ. Chức năng hoạt động trên dữ liệu PostgreSQL; các thao tác thanh toán/giao vận là ghi nhận thủ công, không phải simulator/provider API.

## Xác thực và quyền

Opaque session lưu hash trong DB, cookie `goihue_session`, HttpOnly/SameSite Strict, path `/api/store`, 8 giờ. APP_COOKIE_SECURE=true bật Secure cookie cho HTTPS; compose.coolify.yml bật sẵn. Logout hủy phiên hiện tại; đóng tài khoản hủy toàn bộ phiên. Mật khẩu BCrypt, tối thiểu 12 ký tự/tối đa 72 byte UTF-8; kiểm tra email trùng. Rate limit login theo email trong bộ nhớ, 12 lần/15 phút; reset sau thành công/restart.

- CUSTOMER: self.manage, cart.manage, order.create, privacy.create, return.create; chỉ hồ sơ/đơn/ảnh của mình.
- ADMIN: catalog.manage, order.manage, policy.manage, privacy.decide, return.decide, audit.read; không mặc định là khách để tạo giỏ/đơn.

Các thao tác ghi của trình duyệt yêu cầu Origin tin cậy và same-origin tại BFF. APP_PUBLIC_ORIGINS được truyền tới cả web và API trong cấu hình Coolify. Webhook SePay có route POST riêng, giữ raw body và hai header HMAC, xác thực chữ ký thay cho Origin/cookie. Mã đơn/hồ sơ không phải thông tin xác thực; API trả 404 chung cho sai ownership.

## API

| Method và path sau prefix | Input | Kết quả/quyền |
| --- | --- | --- |
| GET products | Không | Catalog đang active, public |
| GET products/{slug} | Slug | Chi tiết public hoặc 404 |
| GET products/recommended | surface=home\|product\|cart, productId?, budget?, limit=1..8 | BOUGHT_TOGETHER → PERSONALIZED khi có consent riêng → POPULAR. Điểm chỉ từ đơn DELIVERED. Chỉ budget > 0 mới lọc giá; bỏ qua giá trị 0/âm như không truyền ngân sách. budgetApplied trả số dương hoặc null. rankingBasis=CATALOG nghĩa là chưa có dữ liệu bán chạy; từng item có description/deliveredQuantity, không gọi món có số đã giao bằng 0 là bán chạy. Lọc tồn/active/danh mục trước khi xếp hạng; loại sản phẩm trong ngữ cảnh. Cart cần cart.manage. 200 items=[] khi trống, 401 phiên thiếu/hết hạn, 403 sai quyền, 422 tham số sai. Rail có loading/empty/error và nút thử lại. |
| GET/PUT recommendations/consent | granted, revision; PUT cần Idempotency-Key | self.manage, owner-only. Mặc định false, consent tiếp thị cũ không áp dụng. Revision dùng chung với agent/consent, stale hoặc key dùng sai nội dung trả 409. |
| GET/PUT agent/consent | historyUse, memoryUse, revision; PUT cần Idempotency-Key | self.manage, hai lựa chọn riêng mặc định false. Rút đồng ý xóa chat hoặc ai_memory trong cùng transaction. Revision chặn lượt đang chạy lưu lại dữ liệu sau khi rút đồng ý. 401/403/409/422 dùng Error envelope. |
| GET agent/history | conversationId? | self.manage; chủ sở hữu và consent được kiểm tra ở server. Trả hội thoại gần nhất hoặc UUID chỉ định, messages tối đa 40, memory và revision. Consent tắt trả danh sách/memory rỗng. Không lấy dữ liệu tài khoản khác. |
| DELETE agent/history | Idempotency-Key | self.manage; xóa toàn bộ chat và ai_memory của chính khách, tăng revision; giữ lựa chọn đồng ý. Gửi lại cùng key trả kết quả cũ. UI xóa hội thoại tạm sau thao tác này. |
| POST agent/chat | message, history? ≤6, conversationId?, Idempotency-Key | Public, Origin tin cậy. SSE meta ghi provider/conversationId; tool_call/tool_result ghi công cụ và tóm tắt thực thi; token, product_cards, citations, memory, done hoặc error. Bedrock Converse tool loop ≤4 vòng, ≤8 calls, deadline 60s; fallback deterministic ghi rõ provider. Chỉ tool lookup_order được đọc đúng mã đơn + owner; không đưa hàng loạt đơn vào prompt. 30 lượt/phút/identity, 4 workers + queue16; quá tải 429. Cùng key đang chạy 409; lượt đã lưu được replay theo owner/key/fingerprint. Lượt consent tắt/guest không lưu. |
| GET admin/products | Không | Toàn bộ sản phẩm, catalog.manage |
| GET categories / admin/categories | Không | Danh mục active public / toàn bộ danh mục cho catalog.manage |
| GET shipping | Không | Phí cơ bản, ngưỡng miễn phí, enabled, revision và pauseMessage nếu đã lưu; public |
| GET cart/summary | Không | CUSTOMER: items, cartToken, subtotal, shippingFee, total, shipping |
| PUT catalog/images/{id}/content | Binary PNG/JPEG ≤5MB | ADMIN; intent từ catalog-image-intent; decode/re-encode PNG |
| GET catalog/images/{id} | Không | Public khi gắn catalog active; còn lại chỉ ADMIN |
| POST auth/register | name ≤100, email ≤150, password | CUSTOMER mới, không tạo đơn mẫu; cookie phiên |
| POST auth/login | email, password | User an toàn và cookie phiên |
| POST auth/logout | {} | Hủy phiên hiện tại |
| GET state | Không | User, các collection theo scope, policy; ADMIN thêm audit và policyVersions |
| GET cart | Không | Giỏ hiện tại, CUSTOMER |
| GET policy | Không | Chính sách DRAFT mới nhất, public |
| POST commerce | action và các trường bên dưới | Transaction/idempotency |
| POST command | action và các trường bên dưới | Hồ sơ/consent/chính sách/đổi trả |
| POST evidence/intents | name ≤120 | FileId caller-owned, UPLOADING |
| PUT evidence/{id}/content | Binary PNG/JPEG ≤5MB | Chỉ intent thuộc người gửi; hoàn tất một lần; private volume, STORED_UNSCANNED |
| GET evidence/{id}/content | Không | Ảnh hiển thị trực tiếp cho owner/ADMIN; no-store/nosniff |
| GET privacy/{id}/export | Không | Snapshot JSON cho owner/ADMIN sau khi hoàn tất ACCESS/EXPORT |

POST commerce/command bắt buộc `Idempotency-Key` 16–80 chữ/số/gạch ngang; cùng actor/key/body trả kết quả trước, khác body trả 409. Các cập nhật hồ sơ/đơn/sản phẩm bắt buộc revision, stale =409. Trình duyệt giữ key khi retry cùng payload. Backend dùng advisory transaction lock để tuần tự hóa các mutation của một cửa hàng; scale-out throughput cần cải tiến lock theo aggregate.

### Commerce actions

| action | Trường | Quy tắc |
| --- | --- | --- |
| cart-set | cartToken, productId UUID, quantity 0..100 | 0 xóa dòng; kiểm tra active của sản phẩm/danh mục và tồn; giá lấy server; một dòng/product/customer |
| cart-clear / cart-refresh | cartToken | Xóa toàn giỏ / chủ động nhận snapshot giá mới; không tự giảm số lượng |
| checkout | cartToken, shippingRevision, recipient ≤100, phone 8..30 ký tự với ít nhất 8 chữ số, address ≤400, paymentMethod tùy chọn COD/VIETQR | Kiểm tra giỏ, giá/tồn và phí; mặc định COD. VietQR demo tạo thông tin thanh toán PENDING, có hạn; giảm tồn và xóa giỏ atomically. Khi đặt thành công, khách thấy hộp thoại VietQR. Đóng hộp thoại giữ nguyên đơn và cho phép mở lại mã từ chi tiết đơn khi phiên còn hiệu lực. COD mở thẳng chi tiết đơn. |

VietQR/IPN là luồng demo. IPN yêu cầu chữ ký và đối chiếu số tiền với tổng đơn. Khách thấy trạng thái VietQR trên thẻ đơn, có thể mở mã còn hạn và sao chép nội dung chuyển khoản. Admin lọc theo trạng thái và xem chứng từ tại chi tiết đơn.

- VietQR yêu cầu `PAID` trước khi đóng gói, xuất giao hoặc ghi nhận đã giao. `order-paid` dành cho COD. Quét hết hạn chỉ tự hủy và trả tồn cho đơn chưa đóng gói (`PLACED` / `CONFIRMED`) có phiên `PENDING`.
- Khoản đầu sai số tiền, đến muộn hoặc đến sau hủy vào `REVIEW`. Admin ghi nhận kết quả bằng `payment-resolve` kèm mã chứng từ, revision và ghi chú. Khoản đến muộn hoặc sai số tiền chỉ cho ghi nhận hoàn. Hoàn khoản chính trước khi giao hủy đơn và trả tồn nếu hàng chưa được xuất giao.
- Các giao dịch bổ sung được lưu trong `payment.extraPayments` theo mã giao dịch, số tiền, thời điểm tiếp nhận và trạng thái đối soát. `EXTRA_REFUNDED` yêu cầu `transactionId` và chỉ ghi nhận hoàn khoản được chọn. Trạng thái thanh toán chính giữ nguyên khi nhận hoặc hoàn khoản bổ sung. Gửi lại thông báo cùng mã giao dịch được bỏ qua.
- Giao thất bại: SHIPPED → DELIVERY_FAILED → SHIPPED hoặc RETURNED. Tiếp tục giao VietQR yêu cầu đã thu tiền; hoàn kho áp dụng khi đủ điều kiện thu hồi.

VietQR/IPN trên giao diện là luồng demo. SePay HMAC được đối chiếu với tài liệu nhà cung cấp và kiểm tra bằng callback mô phỏng có chữ ký; delivery từ dashboard SePay trên domain triển khai còn cần kiểm chứng sau deploy. POST /payments/sepay/webhook đi qua BFF, không cần browser Origin, giữ raw body và X-SePay-Signature/X-SePay-Timestamp. Tài khoản nhận phải khớp snapshot payment.bankAccount. Số tiền VND dạng số nguyên hoặc decimal có phần lẻ bằng 0 được chấp nhận. Transaction ID được chống lặp toàn cục bằng payment-event, có kiểm tra reference ở đơn cũ; một mã giao dịch không ghi nhận cho hai đơn. Body webhook tối đa 64KiB. IPN demo chỉ dùng trực tiếp backend với secret riêng.

| action | Trường | Quy tắc |
| --- | --- | --- |
| order-cancel | id, revision, note ≤2000 | Owner hoặc ADMIN; PLACED/CONFIRMED và chưa PAID/REVIEW; trả tồn đúng một lần |
| order-recipient | id, revision, recipient, phone, address, note | Owner hoặc ADMIN; PLACED/CONFIRMED; không đổi giá/phí/items |
| order-status | id, revision, status, note, reference khi SHIPPED hoặc giao thành công COD chưa thu, collectedAmount khi giao thành công COD chưa thu | ADMIN; COD được xuất giao khi UNPAID. Giao thành công COD ghi nhận giao và thu trong cùng giao dịch, lưu chứng từ và thời gian server. Đơn cũ đã PAID giữ chứng từ ban đầu. |
| order-paid | id, revision, note, reference ≤200, collectedAmount | ADMIN; chỉ bổ sung chứng từ cho đơn COD cũ đã DELIVERED nhưng UNPAID. Số thu phải bằng khoản phải thu hiện hành. Chờ giải quyết hồ sơ điều chỉnh còn mở trước khi ghi nhận. |
| product-save | id/revision khi sửa, name≤150, slug≤120, category≤120, description≤4000, imageId tùy chọn, price 1..10.000.000, stock 0..1.000.000, active boolean | ADMIN; category active, slug duy nhất; imageId READY hoặc rỗng để gỡ ảnh; không nhận URL ảnh mới; sửa stock tuyệt đối có audit |
| category-save / category-delete | id/revision khi sửa/xóa; code/name/description/sortOrder/active/imageId khi lưu | ADMIN; code duy nhất; đổi code cập nhật mapping product; chỉ xóa khi không có product |
| product-delete / catalog-toggle | id/revision; kind/active khi toggle | ADMIN; chỉ xóa product chưa có cart/order tham chiếu; còn lại dùng ẩn |
| shipping-save | revision, baseFee, freeShippingThreshold, enabled, optional pauseMessage (250 characters) | ADMIN catalog.manage+order.manage; không thay phí đơn cũ |
| catalog-image-intent | name≤120 | ADMIN; fileId để upload, idempotency bắt buộc |

Không có voucher, loyalty, phí thanh toán online hay API carrier. Giá đơn hàng là snapshot, không bị đổi theo catalog sau khi đặt.

Chi tiết giới hạn và trạng thái CRUD 1.1 tại [catalog-commerce-crud.md](catalog-commerce-crud.md). `state` bổ sung cartCount. Giỏ cũ hoặc cấu hình phí cũ trả 409, UI hướng dẫn tải lại. Cảnh báo giá đổi/hết hàng/ngừng bán chặn checkout đến khi người dùng xử lý. Danh sách quản trị có tìm kiếm, lọc và phân trang client 8 dòng/trang; chưa có server pagination. Ảnh catalog được decode/re-encode; ảnh evidence vẫn thuộc luồng private riêng, chưa có antivirus.

COD hiển thị khoản phải thu khi giao và thời điểm thu sau khi ghi nhận. Đơn COD đã giao nhưng thiếu chứng từ xuất hiện trong bộ lọc bổ sung chứng từ của admin. Khi hồ sơ `ADJUST_DUE` của đơn COD chưa thu hoàn tất, hệ thống giảm `codDueAmount` theo số tiền duyệt, lưu chứng từ trên hồ sơ và ghi kết quả vào đơn. Giá trị gốc `total` vẫn dùng làm số tiền ban đầu. Đơn cũ chưa điều chỉnh lấy `total` làm khoản phải thu. Hoàn tiền cho đơn đã thu tiếp tục đi theo hồ sơ đổi trả.

### Platform actions

| action | Trường | Quy tắc |
| --- | --- | --- |
| profile | name≤100, phone≤30, address≤400 | CUSTOMER self.manage |
| consent | granted boolean | CUSTOMER; lưu current flag và append lịch sử với policyVersion; không gửi email |
| policy | version≤40, content≤16000 | ADMIN; append phiên bản DRAFT, không publish chính sách có hiệu lực |
| privacy-create | type ACCESS/EXPORT/DELETE/RESTRICT/COMPLAINT, description≤2000 | CUSTOMER |
| privacy-update | id, revision, status, note≤2000 | ADMIN; state machine bên dưới |
| privacy-supplement | id, revision, note | Owner, hồ sơ chưa kết thúc |
| return-create | orderId, lineId (productId snapshot), quantity, reason WRONG_ITEM/MISSING_ITEM/DAMAGED/UNSAFE/QUALITY, resolution REFUND/REPLACEMENT, description, evidenceIds≤5 | CUSTOMER/đơn DELIVERED; kiểm cửa sổ 7 ngày dự thảo, ngoại lệ UNSAFE/QUALITY; tổng quantity của case chưa reject không vượt lượng mua theo line |
| return-update | id, revision, status, note; duyệt thêm approvedQuantity/resolution/returnRequired; kiểm hàng thêm disposition; hoàn tất thêm reference≤200 | ADMIN |
| return-supplement | id, revision, note, evidenceIds tùy chọn | Owner, case chưa kết thúc; ảnh phải thuộc owner/đã upload thành công, không trùng và tổng ảnh của case tối đa 5; EVIDENCE_REQUIRED chuyển lại REVIEWING |

Không nhận số tiền refund/owner/role được browser quyết định. Giá trị duyệt = snapshot đơn giá thực trả × lượng duyệt. Không tự hoàn phí giao hàng. Một Case/một dòng; nhiều dòng có thể tạo các Case riêng. Quantity đã requested được giữ bảo thủ cả khi chỉ duyệt một phần, tránh yêu cầu chồng lặp.

## State machine

Privacy: SUBMITTED→REVIEWING→EVIDENCE_REQUIRED/COMPLETED/REJECTED. EVIDENCE_REQUIRED→REVIEWING. ACCESS/EXPORT tạo snapshot profile/order/cart/consent/return/privacy không lồng export cũ. RESTRICT tắt marketing và phản hồi rõ các xử lý còn lại cần xem xét. DELETE không cho hoàn tất khi còn đơn đang xử lý hoặc Return chưa kết thúc; hủy phiên, đóng login, xóa liên hệ/ảnh/consent/cart, ẩn danh yêu cầu và địa chỉ giao; giữ số liệu giao dịch/identifier/audit theo phạm vi thông báo. Xóa file không thể rollback cùng SQL; cần xử lý thủ công nếu filesystem lỗi.

Return: REQUESTED→REVIEWING→EVIDENCE_REQUIRED/APPROVED/REJECTED. Nếu cần thu hồi: APPROVED→RECEIVED→INSPECTED; nếu miễn thu hồi đi thẳng PROCESSING. Inspection: QUARANTINE/DAMAGED/DISPOSE; không tự restock. PROCESSING→RESOLVED bắt buộc reference chứng từ/vận đơn. Refund chỉ bắt đầu khi đơn PAID. Chưa có provider tự xác minh chứng từ; ADMIN chịu trách nhiệm ghi nhận đúng thực tế. Không có simulated success tự động.

## Giao diện và lỗi

Trang `/account/orders?order={id}` tự mở chi tiết đơn vừa đặt, hiển thị `PaymentPanel` cho VietQR với QR/countdown hoặc PAID/REVIEW/EXPIRED/RESOLVED_PAID/REFUNDED. Nhãn thanh toán dùng phương thức và trạng thái thật của đơn. Bộ lọc gồm UNPAID/PAID/REVIEW/REFUNDED. WebSocket cập nhật trạng thái và dừng hiển thị QR khi có kết quả; người dùng vẫn có thể thu gọn/mở chi tiết.

| Trạng thái | Phản hồi |
| --- | --- |
| Loading | Busy/loading message, disabled mutation buttons |
| Success | Reload server state, notice và timeline |
| Empty | [] và thông báo chưa có dữ liệu |
| 401 | Hiển thị đăng nhập, xóa user state khi phiên hết hạn |
| 403 | Không có quyền/Origin bị từ chối |
| 404 | Không tìm thấy hoặc ngoài scope, không tiết lộ hồ sơ |
| 409 | Phiên bản/key thay đổi; người dùng tải lại |
| 422 | Lỗi điều kiện nghiệp vụ an toàn |
| 503 BFF | Backend chưa kết nối, thông báo thử lại |
| Policy | Dự thảo chờ phê duyệt, không có ngày hiệu lực bịa đặt |
| Evidence | Ảnh private, xem trực tiếp khi click; trả 404 nếu thiếu tệp và giao diện hiển thị trạng thái không có ảnh; chưa có antivirus |

Error từ backend gồm code, message, requestId. BFF có thể trả message riêng khi route/origin/size/upstream lỗi. Không chạy test nghiệp vụ trong lần chuyển khung theo yêu cầu người dùng.

## Address book, password and live order/return updates

| Operation | Success | Error |
| --- | --- | --- |
| CUSTOMER address-save | Save label, recipient, phone, address and optional isDefault. Supply id and revision when editing. Selecting a default clears it on other saved addresses and increments affected revisions; the first address becomes default when none remains. | 401 expired session, 403 wrong role, 404 unknown or other customer's id, 409 stale revision, 422 invalid fields or over 20 addresses. |
| CUSTOMER address-delete | Supply id and revision. If the default is deleted, another remaining address becomes default. Existing order snapshots retain recipient details. | 401/403/404/409 as above. |
| Checkout | Send owned addressId or manual recipient, phone and address. Server snapshots destination. | 404 for unowned or removed address. Existing cart/pricing rules still apply. |
| Password | Send currentPassword and newPassword. Current session survives; other sessions are revoked. | 401 expired session, 403 bad origin, 422 wrong current password or invalid replacement. |
| WebSocket | Connect at same-origin /api/store/live using ws/wss from the page protocol and its public port. Next.js beforeFiles rewrite proxies upgrades to internal API_WEBSOCKET_UPSTREAM. After commit, order and return invalidations reach owner/admin. Fetch GET /state for current data. Server pings every 25s and rechecks sessions. | Upgrade denied for invalid sessions/origins. Revoked sessions close on invalidation or next ping. Clients reconnect and refresh state after opening. |

### Multi-item returns
- CUSTOMER return-submit takes orderId, items (1–50 rows of lineId, quantity, reason, resolution and description), and optional shared evidenceIds. Each product can occur only once per submission (422 otherwise). The submission is atomic and returns id (first row), caseId and items. Legacy return-create remains supported.
- Each row uses its own id and revision for return-update, return-supplement, return-confirm and return-withdraw. Customers can supplement returns only in EVIDENCE_REQUIRED. A successful submission moves the row to REVIEWING; other open states reject the action with 409. A changed resolution moves to CUSTOMER_CONFIRMATION until the customer accepts. CUSTOMER return-withdraw takes a non-blank reason in note (up to 2,000 characters) and is available in REQUESTED, REVIEWING, EVIDENCE_REQUIRED and CUSTOMER_CONFIRMATION. The row moves to WITHDRAWN, the reason goes into history and the reserved quantity is released.
- Approved cases can pause in WAITING_STOCK, PAYMENT_REVIEW or EXCEPTION and resume their previous state. RECEIVED takes receivedQuantity; INSPECTED takes inspectedQuantity and disposition. Multi-item replacement/make-up requires REPLACEMENT_SENT with a reference before RESOLVED.
- For missing or undelivered goods, offer make-up delivery or refund and disallow pickup. For other reasons, offer replacement or refund. Only staff may propose adjustment of the amount due. Stock holds apply to outbound shipments and payment review applies to financial resolutions. A pickup with no units received can be retried after resuming.
- Refund processing and confirmation require confirmed payment. Resuming a refund from PAYMENT_REVIEW, or from EXCEPTION back to INSPECTED or PROCESSING, returns 422 until payment is confirmed. Successful resumes add transition=RESUME to the history entry. Adjustment of amount due requires unpaid status. These are manual records with references.

Trang nhật ký ADMIN hiển thị tối đa 200 sự kiện gần nhất. Có thể lọc theo phân hệ, hành động, tác nhân và ngày. Nếu tìm được bản ghi đối tượng, API trả subjectKind và subjectLabel để giao diện dùng tên hoặc mã nghiệp vụ; chi tiết giữ mã gốc. Nếu không còn bản ghi tác nhân, giao diện hiện dấu gạch ngang. Danh sách rỗng và bộ lọc không có kết quả có thông báo riêng.
