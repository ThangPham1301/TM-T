# Hợp đồng API và trạng thái Gói Huế

Hợp đồng của khung thống nhất sau xây dựng lại. Trạng thái DRAFT vì chính sách, SLA và retention còn chờ phê duyệt. BFF `/api/store/*` forward đến Spring `/api/v1/*`, giữ nguyên query string; đường dẫn `agent/chat` nằm trong danh sách cho phép của BFF và có timeout riêng (180s) phục vụ streaming SSE. Không dùng Mockoon hoặc Identity cũ. Chức năng hoạt động trên dữ liệu PostgreSQL; các thao tác thanh toán/giao vận là ghi nhận thủ công, không phải simulator/provider API.

## Xác thực và quyền

Opaque session lưu hash trong DB, cookie `goihue_session`, HttpOnly/SameSite Strict, path `/api/store`, 8 giờ. APP_COOKIE_SECURE=true bật Secure cookie cho HTTPS; compose.coolify.yml bật sẵn. Logout hủy phiên hiện tại; đóng tài khoản hủy toàn bộ phiên. Mật khẩu BCrypt, tối thiểu 12 ký tự/tối đa 72 byte UTF-8; kiểm tra email trùng. Rate limit login theo email trong bộ nhớ, 12 lần/15 phút; reset sau thành công/restart.

- CUSTOMER: self.manage, cart.manage, order.create, privacy.create, return.create; chỉ hồ sơ/đơn/ảnh của mình.
- ADMIN: catalog.manage, discount.manage, pricing.manage, order.manage, policy.manage, privacy.decide, return.decide, audit.read; không mặc định là khách để tạo giỏ/đơn.

Các thao tác ghi của trình duyệt yêu cầu Origin tin cậy và same-origin tại BFF. APP_PUBLIC_ORIGINS được truyền tới cả web và API trong cấu hình Coolify. Webhook SePay có route POST riêng, giữ raw body và hai header HMAC, xác thực chữ ký thay cho Origin/cookie. Mã đơn/hồ sơ không phải thông tin xác thực; API trả 404 chung cho sai ownership.

## API

### Mua không cần tài khoản

| Method và path sau prefix | Trạng thái và cách xử lý |
| --- | --- |
| GET guest/cart/summary | 200 trả cùng cấu trúc báo giá CUSTOMER. Phiên chưa có hoặc hết hạn trả giỏ trống. |
| POST guest/commerce | cart-set, cart-refresh, cart-clear và checkout dùng Origin BFF, cookie giỏ khách và `Idempotency-Key`. Lần thêm đầu tạo phiên. Nếu giá, ưu đãi, giỏ hoặc phí đổi, 409 và tải báo giá mới. Tồn thiếu/cửa hàng ngừng nhận đơn trả 422. COD và VietQR dùng cùng transaction chốt đơn và cập nhật tồn. |
| POST guest/cart/merge | CUSTOMER xác nhận gộp giỏ, gửi token của cả hai giỏ. Thao tác cùng transaction và khóa gửi lặp. Giỏ đã đổi trả 409, hết tồn trả 422, dữ liệu hai giỏ được giữ lại khi lỗi. |
| GET guest/orders/latest | Trả mã đơn mới nhất thuộc cookie giỏ hiện tại, hoặc đối tượng rỗng. |
| POST guest/orders/lookup | Cần mã đơn và mã tra cứu. Trả 404 chung khi không có quyền; giới hạn số lần thử, vượt giới hạn trả 429. Thành công cấp cookie riêng, giới hạn đúng một đơn và có hiệu lực 30 phút. |
| GET guest/orders/{number} | Cookie giỏ ban đầu hoặc quyền tra cứu của đúng đơn. Chỉ trả sản phẩm, số tiền, trạng thái và mã vận đơn. Mã QR chỉ trả khi còn chờ thanh toán và còn hạn. Phản hồi bỏ địa chỉ, điện thoại, ghi chú nội bộ và thông tin đối soát. |

Cookie giỏ HttpOnly/SameSite Strict, thời hạn 7 ngày kể từ lần cập nhật giỏ cuối. Bật Secure theo cấu hình HTTPS hiện tại. Mã tra cứu lưu dạng hash và cấp lại chỉ cho trình duyệt có phiên giỏ ban đầu. Tác vụ dọn phiên xóa giỏ hết hạn và quyền truy cập tạm thời. Đơn hàng và dữ liệu giao hàng được giữ theo chính sách lưu trữ giao dịch của cửa hàng. Luồng quản trị nhận đơn khách với `customerType=GUEST`. Khách có thể xem đơn gần nhất hoặc mở đơn bằng mã tại `/tra-cuu-don-hang`. VietQR trên luồng này là demo.

### API của cửa hàng và tài khoản

| Method và path sau prefix | Input | Kết quả/quyền |
| --- | --- | --- |
| GET products | Không | Catalog đang active, public |
| GET products/{slug} | Slug | Chi tiết public hoặc 404 |
| GET products/recommended | surface=home\|product\|cart, productId?, budget?, limit=1..8 | BOUGHT_TOGETHER → PERSONALIZED khi có consent riêng → POPULAR. Điểm chỉ từ đơn DELIVERED. Chỉ budget > 0 mới lọc giá; bỏ qua giá trị 0/âm như không truyền ngân sách. budgetApplied trả số dương hoặc null. rankingBasis=CATALOG nghĩa là chưa có dữ liệu bán chạy; từng item có description/deliveredQuantity, không gọi món có số đã giao bằng 0 là bán chạy. Lọc tồn/active/danh mục trước khi xếp hạng; loại sản phẩm trong ngữ cảnh. Cart cần cart.manage. 200 items=[] khi trống, 401 phiên thiếu/hết hạn, 403 sai quyền, 422 tham số sai. Rail có loading/empty/error và nút thử lại. |
| GET/PUT recommendations/consent | granted, revision; PUT cần Idempotency-Key | self.manage, owner-only. Mặc định false, consent tiếp thị cũ không áp dụng. Revision dùng chung với agent/consent, stale hoặc key dùng sai nội dung trả 409. |
| GET/PUT agent/consent | historyUse, memoryUse, revision; PUT cần Idempotency-Key | self.manage, hai lựa chọn riêng mặc định false. Rút đồng ý xóa chat hoặc ai_memory trong cùng transaction. Revision chặn lượt đang chạy lưu lại dữ liệu sau khi rút đồng ý. 401/403/409/422 dùng Error envelope. |
| GET agent/history | conversationId? | self.manage; chủ sở hữu và consent được kiểm tra ở server. Trả hội thoại gần nhất hoặc UUID chỉ định, messages tối đa 40, memory và revision. Consent tắt trả danh sách/memory rỗng. Không lấy dữ liệu tài khoản khác. |
| DELETE agent/history | Idempotency-Key | self.manage; xóa toàn bộ chat và ai_memory của chính khách, tăng revision; giữ lựa chọn đồng ý. Gửi lại cùng key trả kết quả cũ. UI xóa hội thoại tạm sau thao tác này. |
| POST agent/chat | message, history? ≤6, conversationId?, Idempotency-Key | Public, Origin tin cậy. SSE meta ghi provider/conversationId; tool_call/tool_result ghi công cụ và tóm tắt thực thi; token, comparison (hai sản phẩm + chênh lệch giá từ công cụ compare_products), cart_proposal (đề xuất thêm giỏ từ công cụ add_to_cart — giao diện hiện hộp xác nhận, backend trợ lý không tự ghi giỏ), product_cards, citations, memory, done hoặc error. Bedrock Converse tool loop ≤4 vòng, ≤8 calls, deadline 60s; fallback deterministic ghi rõ provider. Chỉ tool lookup_order được đọc đúng mã đơn + owner; không đưa hàng loạt đơn vào prompt. 30 lượt/phút/identity, 4 workers + queue16; quá tải 429. Cùng key đang chạy 409; lượt đã lưu được replay theo owner/key/fingerprint. Lượt consent tắt/guest không lưu. |
| GET admin/products | Không | Toàn bộ sản phẩm, catalog.manage |
| GET categories / admin/categories | Không | Danh mục active public / toàn bộ danh mục cho catalog.manage |
| GET shipping | Không | Phí cơ bản, ngưỡng miễn phí, enabled, revision và pauseMessage nếu đã lưu; public |
| GET discounts | Không | Công khai. Trả ưu đãi đang chạy, ưu tiên quảng bá, thời điểm máy chủ và mốc lịch kế tiếp nếu có. Thẻ nổi chọn chương trình được ưu tiên trước, tự chuyển sang ưu đãi còn chạy và cho khách chuyển qua các chương trình khác. Danh mục và chi tiết có nhãn theo sản phẩm. |
| GET admin/discounts | Không | ADMIN discount.manage. Danh sách chương trình gồm bản nháp chưa bật, đã lên lịch, đang chạy, tạm dừng và đã hết hạn. |
| GET pricing | Không | Công khai. Giá đang bán, giá thường, nguồn giá theo sản phẩm, thời điểm báo giá và mốc đổi tiếp theo. Dải Home và danh mục dùng cùng bộ giá. |
| GET admin/pricing | Không | ADMIN pricing.manage. Danh sách quy tắc, sản phẩm, giá và revision. |
| GET cart/summary | Không | CUSTOMER: items, cartToken, priceToken, quoteToken, nextPriceChangeAt, pricedAt, subtotal, discountAmount, netSubtotal, shippingFee, total, shipping, tùy chọn discount/offerHint. Các giá trị dùng cùng một ảnh chụp dữ liệu chỉ đọc. |
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
| cart-set | cartToken, productId UUID, quantity 0..100, expectedUnitPrice/expectedPriceSource khi thêm từ chi tiết | 0 xóa dòng; kiểm tra active của sản phẩm/danh mục và tồn; giá lấy server; một dòng/product/customer |
| cart-clear / cart-refresh | cartToken | Xóa toàn giỏ / chủ động nhận snapshot giá mới; không tự giảm số lượng |
| pricing-save / pricing-toggle | name, type, targets, threshold hoặc startsAt/endsAt, enabled; id/revision khi sửa hoặc bật tắt | ADMIN pricing.manage. Lịch theo giờ Việt Nam hiển thị trong UI và gửi UTC. Hai lịch giao nhau cùng sản phẩm trả 409. Mỗi sản phẩm có tối đa một quy tắc tồn kho và một quy tắc sức mua đang bật. |
| pricing-floor | id sản phẩm, revision, floor | ADMIN pricing.manage. Sàn từ 1 đ đến giá thường và không vượt qua giá của quy tắc đang bật hoặc đã lên lịch. |
| checkout | cartToken, quoteToken, shippingRevision, recipient ≤100, phone 8..30 ký tự với ít nhất 8 chữ số, address ≤400, paymentMethod tùy chọn COD/VIETQR | Kiểm tra giỏ, giá/tồn, ưu đãi và phí; Giá đã xem hoặc quoteToken thay đổi trả 409 để khách xem và xác nhận tổng mới ngay tại checkout. Đổi giá trước khi xác nhận giỏ cũng trả 409 nếu priceToken không còn đúng. Bản ghi đơn giữ tổng giảm và giảm theo dòng. Mặc định COD. VietQR demo tạo thông tin thanh toán PENDING, có hạn; giảm tồn và xóa giỏ atomically. Khi đặt thành công, khách thấy hộp thoại VietQR. Đóng hộp thoại giữ nguyên đơn và cho phép mở lại mã từ chi tiết đơn khi phiên còn hiệu lực. COD mở thẳng chi tiết đơn. |

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
| discount-save | name, scope (PRODUCT/PRODUCTS/CART), productId cho PRODUCT hoặc productIds gồm 1–100 UUID riêng biệt cho PRODUCTS, condition (QUANTITY/SUBTOTAL), minimum, method (PERCENT/FIXED), value, startsAt, endsAt, enabled, featured, priority; message tùy chọn; id/revision khi sửa | ADMIN discount.manage. Lịch bắt đầu bao gồm mốc, kết thúc loại trừ mốc. Ngày UTC phải thuộc năm 2000–9999. Nháp hoặc tạm dừng dùng enabled=false. Lịch cũ không hợp lệ bị bỏ qua khi tính ưu đãi. |
| discount-toggle | id, revision, enabled | ADMIN discount.manage. Bật hoặc tạm dừng không xóa dữ liệu. Phiên bản cũ trả 409. |
| shipping-save | revision, baseFee, freeShippingThreshold, enabled, optional pauseMessage (250 characters) | ADMIN catalog.manage+order.manage; không thay phí đơn cũ |
| catalog-image-intent | name≤120 | ADMIN; fileId để upload, idempotency bắt buộc |

Không có voucher, loyalty, phí thanh toán online hay API carrier. Giá đơn hàng là snapshot, không bị đổi theo catalog sau khi đặt.

Với PRODUCTS, cộng số lượng hoặc tiền hàng của các sản phẩm thuộc nhóm trong giỏ, và phân bổ khoản giảm chỉ trên các dòng thuộc nhóm. Nhóm có thể chứa một hoặc nhiều sản phẩm. Sản phẩm đã ẩn, hết hàng hoặc bị xóa không xuất hiện trong nhóm công khai. Các ưu đãi PRODUCT hiện có tiếp tục dùng productId.

Định giá ưu tiên lịch → tồn kho → sức mua → giá thường. Ngưỡng tồn kho so với tồn bán được hiện tại. Sức mua cộng số lượng của đơn đã xác nhận trong 3 ngày lịch trọn vẹn trước đó, bỏ các đơn đã hủy hoặc hoàn về trước mốc 00:00 giờ Việt Nam. Tiến trình nền công bố ảnh chụp theo ngày trong PostgreSQL. Trong lúc chờ ảnh chụp ngày mới, dùng ảnh chụp ngày liền trước nếu có. Khi cả hai chưa có, tạm bỏ qua quy tắc sức mua.

Chỉ các dòng giá thường tham gia điều kiện và nhận Dynamic Discount. Giá sàn bảo vệ tiền hàng trên từng đơn vị sau giảm. Nếu chưa thiết lập sàn, hệ thống dùng giá thường làm sàn. Giảm phần trăm được giới hạn riêng trên từng dòng. Giảm cố định được phân bổ trong phần chênh còn lại của các dòng đủ điều kiện. Giỏ hàng và checkout cùng chọn ưu đãi có tổng mức giảm thực tế cao nhất. Khi tổng tiền đổi trên màn hình thanh toán, khách phải xác nhận tổng mới trước khi gửi đơn. Backend tiếp tục trả 409 nếu báo giá gửi lên đã cũ. Đơn giữ đơn giá, nguồn giá và khoản giảm đã chốt theo từng dòng phục vụ thanh toán và đổi trả.

Ưu đãi dùng đơn vị đồng nguyên; mỗi giỏ chọn khoản giảm cao nhất, hòa thì theo thứ tự ưu tiên quảng bá, thời gian bắt đầu, ID. Giảm giá giới hạn để mỗi đơn vị hàng giữ tối thiểu 1 đ cho luồng COD/VietQR. Phí giao được xét sau giảm. Đổi trả lấy phần tiền đã chốt theo đơn vị trong dòng hàng, bao gồm phần sai khác do làm tròn; các đơn cũ dùng đơn giá đã lưu.

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

### Agent catalog search

Instruction tư vấn nằm trong resource `agent-sales-advisor.vi.txt` (GOIHUE_SALES_ADVISOR_V4), được đóng gói trong API và đọc UTF-8 khi khởi tạo. Phân biệt dữ kiện của đúng sản phẩm/cửa hàng cần xác minh, kiến thức chung và nhận xét có điều kiện. Câu hỏi tiêu chí chọn quà chung không ép tra danh mục; giá/tồn/thành phần/chứng nhận vẫn phải dựa trên dữ kiện phù hợp. Thiếu thuộc tính chỉ giới hạn phần chưa xác nhận, không suy ra không có thuộc tính đó. Không mặc nhiên đồng ý với tiền đề "không hợp để tặng"; không bảo đảm an toàn dị ứng/chế độ ăn từ tên hoặc description thiếu thông tin. Phản hồi trả lời chính trước, giải thích ngắn và tối đa một câu hỏi cần thiết, không báo cáo database/tool cho khách.

Lượt được nhận diện là câu hỏi tiêu chí quà tặng chung không gửi schema công cụ cho model. Câu hỏi có tham chiếu sản phẩm, dữ kiện giá/tồn/chính sách, ngân sách hoặc ý định tìm/gợi ý món vẫn giữ công cụ; "gia đình" không phải từ khóa giá. Các thẻ bọc response/answer được loại trước khi hiển thị/lưu, cùng với markup reasoning đã bị loại.

Model tự chèn mức phí giao hàng/miễn phí khi chưa có phí đã xác minh từ get_shipping hoặc plan_purchase trong lượt hiện tại sẽ bị thay bằng nội dung từ các kết quả công cụ đã kiểm tra. Lời khuyên chung "cân nhắc phí giao hàng" không có mức phí/cam kết vẫn được giữ. Trên điện thoại, panel chat nằm trên nút nổi để nút gửi không bị che; hộp xác nhận thêm giỏ vẫn nằm trên panel.

`search_products` tìm theo query hoặc tên/mã category, không cần budget. Chỉ dùng budget dương trong câu khách hiện tại; không áp ngân sách trong memory cho yêu cầu khám phá loại hàng mới. Success trả items với description/categoryName/available, categories, totalMatches, outOfStockMatches và budgetApplied. Empty dùng NO_MATCH/UNKNOWN_CATEGORY; inStockOnly lọc hết hàng nhưng OUT_OF_STOCK vẫn phân biệt món tồn tại. Không trả sản phẩm hoặc nhóm hàng ẩn. Widget hiển thị bước tìm tên/loại sản phẩm và thẻ kết quả; tra cứu khách chưa đăng nhập vẫn được dùng, còn thêm giỏ thật cần CUSTOMER và xác nhận. Nhập tên mơ hồ vào compare_products/add_to_cart trả AMBIGUOUS cùng các lựa chọn, không phát comparison/cart_proposal. Công cụ đã tra danh mục hợp lệ được tính là dữ kiện mới, không gọi thêm recommendation chỉ để vượt điều kiện kiểm tra dữ liệu.

### Conversational product context

Widget gửi `contextProductIds` (tối đa tám UUID) lấy từ thẻ/bảng so sánh gần nhất hoặc `productIds` đã khôi phục. Backend ưu tiên lịch sử đã lưu đúng owner; client chỉ gửi tham chiếu, không được quyết định giá/tồn hay quyền. Lịch sử cũ chỉ có chữ được đối chiếu lại tên sản phẩm public. Mỗi lượt lấy lại tên, mô tả, giá, tồn và tình trạng hiển thị; không tin dữ kiện do assistant/client nêu trước đó. Các công cụ sản phẩm bị giới hạn trong tập đã xác định cho câu hỏi nối tiếp, không rơi về POPULAR. Khi đổi loại/tên sản phẩm rõ ràng, tập cũ được bỏ. Nội dung `productIds` chỉ lưu cùng chat khi có historyUse; không thêm vào preference memory, không tạo cache hội thoại của khách vãng lai trên server.

Nếu câu trả lời cuối nhắc tên sản phẩm public được nhận diện nằm ngoài tập đã giải quyết, thay câu trả lời bằng nội dung dựa trên mô tả của đúng tập đó. Từ chung như “hương vị” không tự được coi là đang nhắc tên Hộp Quà Hương Huế. Đây là chặn đổi món ngoài phạm vi, không phải bộ xác minh mọi khẳng định ngữ nghĩa của model.

| Trạng thái / câu hỏi | Phản hồi bắt buộc |
| --- | --- |
| “1 trong 2 món này” | Giữ đúng tập món vừa xem, đối chiếu dữ kiện mới; tư vấn theo khẩu vị/mô tả, không lấy số đã giao làm bằng chứng phù hợp người nhận. |
| “mè xửng động phộng kia” | Chỉ hiểu thành món đậu phộng khi từ phân biệt khớp duy nhất trong tập trước; không sửa chính tả toàn danh mục hoặc khẳng định món không tồn tại. |
| “món kia” khớp nhiều món | AMBIGUOUS, hỏi rõ món, hiển thị lựa chọn; không tự so sánh/chọn món/thêm giỏ theo ID model đoán. |
| Món hết hàng hoặc bị ẩn | Hết tồn vẫn có available=false nếu còn public; món bị ẩn/ID không có trả UNAVAILABLE, không lộ dữ kiện và không mở rộng sang toàn danh mục. |
| “còn trà thì sao?” | Tra loại trà mới, không giữ bộ lọc mè xửng cũ. |
| Reload có historyUse | Khôi phục ID món từ lịch sử đúng owner, lấy lại dữ kiện hiện tại; memoryUse có thể vẫn tắt. |
| Guest/consent tắt/rút consent | Ngữ cảnh tạm theo request/tab; không lưu khi chưa đồng ý, rút historyUse xóa cả ID trong chat. |

### Purchase planning

`plan_purchase` là công cụ đọc, không ghi giỏ. Widget gửi lại `purchaseContext` sau sự kiện SSE tương ứng; assistant message trong lịch sử cũng trả trường này. Dữ liệu có budget, budgetScope, recipientCount, unitsPerRecipient, shippingInBudget và selectionMode; không nhận giá/tồn/phí do client/model quyết định. Backend ưu tiên lịch sử đúng owner rồi áp thay đổi rõ ràng trong tin mới. Ngân sách nhóm không ghi đè preference budget; điều kiện và báo giá chỉ lưu cùng chat khi historyUse bật. Retry cùng key/body phát lại purchase_context và purchase_plan đã lưu.

| Trạng thái | Phản hồi |
| --- | --- |
| PLANNED | Tối đa ba phương án đủ số lượng/tồn/ngân sách, có lines, subtotal, shippingFee, total và remainingBudget. Câu trả lời dùng phép tính backend; product_cards chỉ có món trong phương án khả thi, contextProductIds vẫn giữ ứng viên. |
| NO_FEASIBLE_PLAN | Không âm thầm bớt số quà hay tăng tiền. Nêu phương án thấp nhất đang xét và mức thiếu; nếu trần mỗi người chưa bảo đảm thì làm rõ cách chia. |
| INSUFFICIENT_STOCK | Không đề xuất lượng vượt tồn; SAME không bị nới thành phối loại khác, DIFFERENT phải đủ loại khác nhau. |
| NEED_BUDGET / NEED_RECIPIENT_COUNT | Hỏi một điều kiện còn thiếu, không tự tạo ngân sách hoặc số người từ tham số model. |
| NEED_DISTRIBUTION / NEED_DELIVERY_DETAILS | Làm rõ cách phối bộ quà/giao riêng; không giả định mỗi người là một địa chỉ giao. |
| STORE_PAUSED / ORDER_LIMIT / QUANTITY_LIMIT | Nêu giới hạn hiện tại; một đơn không vượt 100 triệu tiền hàng, bộ tính giới hạn 100 sản phẩm/phương án. |
| Chưa rõ bao gồm ship | Ghi tiền hàng chưa gồm ship và tổng một đơn có ship. Giá trị ngưỡng 0 không tạo miễn phí. |
| Đổi sang 190k / mỗi người 80k | Giữ số người và lượng mỗi người; cập nhật phạm vi ngân sách theo câu khách nói, kiểm tra cả trần từng người. |
| Tìm món khác | Mở tập ứng viên theo yêu cầu rõ, giữ số quà/ngân sách/ship; không giữ cứng tập cũ khi khách muốn thay. |
| Chủ đề mới / cuộc trò chuyện mới | Xóa điều kiện phương án cũ, không tự áp ngân sách nhóm vào khám phá loại hàng mới. |
| 422 | purchaseContext sai kiểu, enum, số lượng hoặc ngân sách ngoài giới hạn bị từ chối trước khi chạy model. |

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

### Shopping advice with current pricing

- Contextual product cards and purchase plans refresh effective prices, including schedule, stock and demand rules. Plans apply the same eligible discount, product floors and shipping threshold on net merchandise as checkout.
- Purchase-plan options expose subtotal, discountAmount and netSubtotal. Budget feasibility uses netSubtotal or total according to shipping inclusion. These are estimates for a standalone order with the proposed lines, excluding the current cart. Prices and offers are revalidated at confirmation and checkout.
- Guest cart confirmation preserves guest commerce routing. Chat history and preference memory still require separate authenticated consent.

### Public policy presentation

- Privacy and returns pages share storefront paper, brown/gold colors, typography, policy navigation and responsive article layout. Contents anchors indicate the section currently being read. Draft status remains visible on both pages.
- Privacy version metadata: loading displays a loading message; success displays the API version; a missing version is explicit; a failed request leaves the policy copy readable and provides a retry action. No placeholder version or update date is presented as API data.
- Sidebar links retain authenticated account destinations. On mobile the contents appear above the document in an expandable menu, collapsed initially. Anchor offsets follow the responsive storefront header.


## GA4 safe commerce snapshots (23 November 2026)

Quotes expose identity-free `measurement` and new checkout orders persist the same versioned shape using the order number as transactionId. Both guest/account receipts return this allowlisted object; old orders without a snapshot stay unchanged. Successful cart-set/cart-clear return measurementMutation with stable operationId on replay and before/after quantities. Failed mutations return no success measurement. These fields do not change authorization, totals, payment or discount decisions. See [schema](ga4-measurement.schema.yaml) and [implementation checklist](ga4-implementation-checklist.md).
### Reviewed reorder / buy again

| State | Behavior |
| --- | --- |
| DELIVERED | Show Mua lại. |
| CANCELLED / DELIVERY_FAILED | Show Đặt lại đơn; recipient details must be reviewed. |
| RETURNED | Offer Mua lại as a secondary action. |
| PLACED / CONFIRMED / PACKED / SHIPPED | No prominent reorder action; use existing payment/tracking actions. Server rejects reorder with 409 regardless of payment display status. |
| Loading preview | Read-only request; disable confirmation and show progress. Existing cart stays intact. |
| Preview success | Original quantities selected initially, current prices/discounts/shipping, old recipient labeled explicitly. Every original line remains visible. |
| Unavailable / insufficient quantity | Explain per line; customer explicitly removes or adjusts items. Never silently substitute, drop or reduce a line. |
| Empty selection / store paused | Explain why confirmation is unavailable. |
| Existing cart | Explicit consent to replace it, checked against the preview cartToken; preview/cancel never writes it. |
| Preview error / stale quote | Safe error and retry; 409 refreshes preview and requires review again. No partial cart replacement. |
| 401 / 403 / 404 | Login required / insufficient customer capability or invalid origin / nonexistent or unowned source order. |
| Confirm success | One atomic cart replacement, then checkout with labeled original recipient. Profile and address book stay unchanged. Checkout and cart editing keep the source reference; final checkout creates a new order and fresh payment state only on explicit submission. |
| Idempotent retry | Same key/body replays success without resetting an edited cart; changed body returns 409. |

GA4 integration: successful atomic reorder returns identity-free `measurementMutation` net quantity changes with an operation ID stored in the idempotent result. Preview, rejected confirmations and unchanged quantities emit no cart event. The private account page queues safe `source_surface=reorder` deltas until checkout; source order IDs and recipient details never enter GA.
