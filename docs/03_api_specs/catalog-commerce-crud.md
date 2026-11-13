# Catalog và luồng mua hàng 1.1

Hợp đồng bổ sung goihue.openapi.yaml, DRAFT; triển khai chức năng trên database chính. Không chạy test nghiệp vụ theo yêu cầu người dùng.

## Sản phẩm, danh mục và ảnh

- GET categories public chỉ active, sortOrder/name. GET admin/categories dùng catalog.manage, trả cả ẩn. Storefront/products/detail chỉ hiển thị sản phẩm active thuộc danh mục active.
- POST commerce/category-save: id/revision khi sửa; code lowercase/số/hyphen≤120 duy nhất; name≤150, description≤2000, sortOrder 0..10000, active. Đổi code cập nhật mapping và revision sản phẩm trong cùng transaction.
- product-save: category code active, name/slug/description/price/stock theo hợp đồng gốc. imageId tùy chọn: thiếu giữ ảnh, rỗng gỡ ảnh, UUID phải là catalog-image READY. Không nhận binary/arbitrary upload URL trong business command.
- catalog-toggle: kind product/category, id/revision/active. Ẩn danh mục ẩn sản phẩm của nó khỏi storefront và chặn checkout; snapshot đơn giữ nguyên.
- product-delete chỉ khi chưa có cart/order tham chiếu. category-delete chỉ khi không có product, kể cả product ẩn. Có liên kết trả 422, hướng dẫn ẩn/chuyển dữ liệu. Không tái seed sản phẩm đã xóa sau restart nhờ marker catalog-initialized.
- catalog-image-intent qua POST commerce, name≤120, Idempotency-Key bắt buộc. ADMIN upload binary bằng PUT catalog/images/{id}/content: JPEG/PNG≤5MB, ≤6000 mỗi chiều, ≤16 triệu pixel. Decode/re-encode PNG, bỏ metadata và nội dung đính kèm. Cùng input replay, khác input sau READY=409. GET catalog/images/{id} public chỉ khi gắn catalog active; ảnh chưa gắn chỉ ADMIN xem. No-store/nosniff. Không có antivirus/auto cleanup; volume tách khỏi frontend.
- ADMIN tìm tên/mã, lọc danh mục/trạng thái, phân trang client (8/trang). Đây chưa phải server pagination. Xóa/ẩn có bước xác nhận. Ảnh không dùng không tự xóa trong phiên bản này.

## Phí giao, giỏ hàng, checkout

- GET shipping public: id/code/baseFee/freeShippingThreshold/enabled/revision. shipping-save yêu cầu ADMIN catalog.manage+order.manage, revision, baseFee 0..1 triệu, threshold 0..100 triệu (0 tắt miễn phí), enabled boolean. Không sửa phí của đơn đã tạo. Mọi thay đổi có audit.
- GET cart vẫn trả array, bổ sung currentPrice/stock/available/priceChanged. Không âm thầm chấp nhận giá mới.
- GET cart/summary trả snapshot items/cartToken/subtotal/shippingFee/total/shipping trong transaction lock. Token hash raw cart records theo ID; mỗi lần ghi có version UUID chống stale/ABA.
- cart-set, cart-clear, cart-refresh, checkout bắt buộc cartToken. Cùng key/body replay kiểm tra trước token; token stale=409. Refresh cập nhật snapshot tên/ảnh/giá, không tự giảm số lượng hoặc bỏ sản phẩm hết hàng. Header đếm lượng bằng state.cartCount.
- Checkout còn yêu cầu shippingRevision; kiểm enabled, giá, stock và visibility. Fee miễn khi threshold>0 và subtotal đủ ngưỡng; ngược lại baseFee. Lưu fee/revision vào đơn, không tin tổng tiền browser. Config đổi giữa lúc xem và gửi trả 409 để tải lại.
- FE hiển thị cảnh báo giá đổi/hết hàng/ngừng bán; cho cập nhật giá, giảm/xóa và xóa toàn giỏ có xác nhận. Chặn checkout đến khi xử lý; có nút tải lại giỏ và phí giao.

## Đơn hàng

- Tìm mã/người nhận/điện thoại, lọc order/payment status, phân trang client trong scope; ADMIN tất cả, CUSTOMER chỉ của mình. Query ?order chọn chi tiết sau checkout.
- order-recipient: owner/ADMIN, id/revision/recipient≤100/phone 8..30 gồm số,+,ngoặc,dấu cách,gạch nối/address≤400/note≤2000. Chỉ PLACED/CONFIRMED, không đổi items/tiền/phí. Tăng revision, ghi timeline.
- UI xác nhận hủy, chuyển trạng thái và ghi nhận thu tiền. Chỉ hiển thị next status hợp lệ. SHIPPED/thu tiền bắt buộc reference. Hiển thị vận đơn, chứng từ và thời gian giao/thu tiền. Không xóa đơn, không sửa lịch sử; không gọi provider bên ngoài.

Error/state: loading, empty, error, success; 401 đăng nhập, 403 sai quyền/Origin, 404 ngoài scope, 409 revision/token/idempotency conflict, 422 điều kiện không đạt, 503 BFF mất upstream. Các command dùng idempotency, revision và transaction advisory lock chung. Bản này không thay đổi xác thực/tài khoản hoặc quy trình quyền dữ liệu/đổi trả ngoài việc sử dụng catalog/đơn hiện hành.
