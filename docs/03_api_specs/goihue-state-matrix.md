# Hợp đồng API và trạng thái Gói Huế

Hợp đồng của khung thống nhất sau xây dựng lại. Trạng thái DRAFT vì chính sách, SLA và retention còn chờ phê duyệt. BFF `/api/store/*` forward đến Spring `/api/v1/*`. Không dùng Mockoon hoặc Identity cũ. Chức năng hoạt động trên dữ liệu PostgreSQL; các thao tác thanh toán/giao vận là ghi nhận thủ công, không phải simulator/provider API.

## Xác thực và quyền

Opaque session lưu hash trong DB, cookie `goihue_session`, HttpOnly/SameSite Strict, path `/api/store`, 8 giờ. Logout hủy phiên hiện tại; đóng tài khoản hủy toàn bộ phiên. Mật khẩu BCrypt, tối thiểu 12 ký tự/tối đa 72 byte UTF-8; kiểm tra email trùng. Rate limit login theo email trong bộ nhớ, 12 lần/15 phút; reset sau thành công/restart. Local HTTP; triển khai public cần TLS/Secure cookie.

- CUSTOMER: self.manage, cart.manage, order.create, privacy.create, return.create; chỉ hồ sơ/đơn/ảnh của mình.
- ADMIN: catalog.manage, order.manage, policy.manage, privacy.decide, return.decide, audit.read; không mặc định là khách để tạo giỏ/đơn.

Mọi thao tác ghi yêu cầu Origin tin cậy. BFF chỉ chấp nhận same-origin, backend allowlist localhost/127.0.0.1:3000. Mã đơn/hồ sơ không phải thông tin xác thực; API trả 404 chung cho sai ownership.

## API

| Method và path sau prefix | Input | Kết quả/quyền |
| --- | --- | --- |
| GET products | Không | Catalog đang active, public |
| GET products/{slug} | Slug | Chi tiết public hoặc 404 |
| GET admin/products | Không | Toàn bộ sản phẩm, catalog.manage |
| GET categories / admin/categories | Không | Danh mục active public / toàn bộ danh mục cho catalog.manage |
| GET shipping | Không | Phí cơ bản, ngưỡng miễn phí, enabled và revision; public |
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
| checkout | cartToken, shippingRevision, recipient ≤100, phone 8..30, address ≤400, paymentMethod tùy chọn COD/VIETQR | Kiểm tra giỏ, giá/tồn và phí; mặc định COD. VietQR demo tạo thông tin thanh toán PENDING, có hạn; giảm tồn và xóa giỏ atomically. |

VietQR/IPN là luồng demo chưa xác nhận phù hợp giao thức nhà cung cấp; không dùng để xác nhận thanh toán thật. IPN demo bị tắt nếu chưa cấu hình secret riêng; thông báo sai số tiền, đến muộn hoặc đến sau hủy được đưa vào REVIEW. Bộ quét không hoàn tồn lần nữa cho đơn đã hủy/hoàn về/giao thành công. Admin có thể thực hiện payment-resolve (REFUNDED hoặc PAID_RECORDED, có reference, revision và note). Giao thất bại: SHIPPED → DELIVERY_FAILED → SHIPPED hoặc RETURNED; kiểm tra điều kiện thanh toán và hoàn tồn khi RETURNED. Các trạng thái này cần kiểm thử tích hợp.
| order-cancel | id, revision, note ≤2000 | Owner hoặc ADMIN; PLACED/CONFIRMED và chưa PAID; trả tồn đúng một lần |
| order-recipient | id, revision, recipient, phone, address, note | Owner hoặc ADMIN; PLACED/CONFIRMED; không đổi giá/phí/items |
| order-status | id, revision, status, note, reference khi SHIPPED | ADMIN; PLACED→CONFIRMED→PACKED→SHIPPED→DELIVERED; lưu deliveredAt bằng thời gian server |
| order-paid | id, revision, note, reference ≤200 | ADMIN; chưa PAID, không CANCELLED; ghi nhận thực thu thủ công, không chuyển tiền |
| product-save | id/revision khi sửa, name≤150, slug≤120, category≤120, description≤4000, imageId tùy chọn, price 1..10.000.000, stock 0..1.000.000, active boolean | ADMIN; category active, slug duy nhất; imageId READY hoặc rỗng để gỡ ảnh; không nhận URL ảnh mới; sửa stock tuyệt đối có audit |
| category-save / category-delete | id/revision khi sửa/xóa; code/name/description/sortOrder/active/imageId khi lưu | ADMIN; code duy nhất; đổi code cập nhật mapping product; chỉ xóa khi không có product |
| product-delete / catalog-toggle | id/revision; kind/active khi toggle | ADMIN; chỉ xóa product chưa có cart/order tham chiếu; còn lại dùng ẩn |
| shipping-save | revision, baseFee, freeShippingThreshold, enabled | ADMIN catalog.manage+order.manage; không thay phí đơn cũ |
| catalog-image-intent | name≤120 | ADMIN; fileId để upload, idempotency bắt buộc |

Không có voucher, loyalty, phí thanh toán online hay API carrier. Giá đơn hàng là snapshot, không bị đổi theo catalog sau khi đặt.

Chi tiết giới hạn và trạng thái CRUD 1.1 tại [catalog-commerce-crud.md](catalog-commerce-crud.md). `state` bổ sung cartCount. Giỏ cũ hoặc cấu hình phí cũ trả 409, UI hướng dẫn tải lại. Cảnh báo giá đổi/hết hàng/ngừng bán chặn checkout đến khi người dùng xử lý. Danh sách quản trị có tìm kiếm, lọc và phân trang client 8 dòng/trang; chưa có server pagination. Ảnh catalog được decode/re-encode; ảnh evidence vẫn thuộc luồng private riêng, chưa có antivirus.

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
| Evidence | Ảnh private, xem trực tiếp khi click; chưa có antivirus |

Error từ backend gồm code, message, requestId. BFF có thể trả message riêng khi route/origin/size/upstream lỗi. Không chạy test nghiệp vụ trong lần chuyển khung theo yêu cầu người dùng.

## Address book, password and live order/return updates

| Operation | Success | Error |
| --- | --- | --- |
| CUSTOMER address-save | Save label, recipient, phone and address. Supply id and revision when editing. | 401 expired session, 403 wrong role, 404 unknown or other customer's id, 409 stale revision, 422 invalid fields or over 20 addresses. |
| CUSTOMER address-delete | Supply id and revision. Existing order snapshots retain recipient details. | 401/403/404/409 as above. |
| Checkout | Send owned addressId or manual recipient, phone and address. Server snapshots destination. | 404 for unowned or removed address. Existing cart/pricing rules still apply. |
| Password | Send currentPassword and newPassword. Current session survives; other sessions are revoked. | 401 expired session, 403 bad origin, 422 wrong current password or invalid replacement. |
| WebSocket | Connect at :8088/api/store/live with valid session cookie and a configured storefront Origin. After commit, order and return invalidations reach the owner and admins. Fetch GET /state for the latest records. | Upgrade denied for invalid sessions/origins. Clients reconnect and refresh state after opening. |

### Multi-item returns
- CUSTOMER return-submit takes orderId, items (1–50 rows of lineId, quantity, reason, resolution and description), and optional shared evidenceIds. Each product can occur only once per submission (422 otherwise). The submission is atomic and returns id (first row), caseId and items. Legacy return-create remains supported.
- Each row uses its own id and revision for return-update, return-supplement, return-confirm and return-withdraw. Customers can supplement returns only in EVIDENCE_REQUIRED. A successful submission moves the row to REVIEWING; other open states reject the action with 409. A changed resolution moves to CUSTOMER_CONFIRMATION until the customer accepts. Withdrawal before approval releases the reserved quantity.
- Approved cases can pause in WAITING_STOCK, PAYMENT_REVIEW or EXCEPTION and resume their previous state. RECEIVED takes receivedQuantity; INSPECTED takes inspectedQuantity and disposition. Multi-item replacement/make-up requires REPLACEMENT_SENT with a reference before RESOLVED.
- For missing or undelivered goods, offer make-up delivery or refund and disallow pickup. For other reasons, offer replacement or refund. Only staff may propose adjustment of the amount due. Stock holds apply to outbound shipments and payment review applies to financial resolutions. A pickup with no units received can be retried after resuming.
- Refund processing and confirmation require confirmed payment. Adjustment of amount due requires unpaid status. These are manual records with references.
