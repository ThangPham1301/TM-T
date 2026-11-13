# Bàn giao khung Gói Huế thống nhất

## Những thay đổi đã thực hiện

1. Chuyển frontend sang apps/web; backend đang dùng sang apps/api. Giữ assets, hình ảnh, tokens, typography và bố cục heritage của web cũ; viết lại state, auth và các trang giao dịch theo một API chung.
2. Đưa các service microservice, gateway, hạ tầng cũ, mock, shared contracts/scripts cũ, mobile và source Next cũ vào archive/legacy. Không xóa vĩnh viễn, không xóa Docker volume cũ. Archive bị loại khỏi version control/build mới; đây là bản sao lưu local.
3. Bỏ route /academic và phiên riêng. CUSTOMER/ADMIN dùng /login, /register, /account và /admin. Privacy/Return thuộc hệ thống tài khoản và đơn hàng chính.
4. Catalog khởi tạo có sáu sản phẩm kế thừa tên/ảnh từ giao diện. Tồn ban đầu 0; ADMIN xác nhận giá/tồn trước khi bán. Khách tự đăng ký; đơn được tạo từ checkout, không seed đơn giả lập.
5. Checkout snapshot nhiều dòng, kiểm tra giá/tồn, trừ stock trong transaction và clear cart. Hủy khi đủ điều kiện trả tồn một lần. Order có trạng thái giao và trạng thái thu tiền riêng.
6. Return theo line đã mua và lượng còn lại; kiểm cửa sổ dự thảo, duyệt/thu hồi/inspection, xử lý thủ công có reference. Không tự tạo hoàn tiền thành công hay auto-restock hàng trả.
7. Quyền dữ liệu, export, consent history, anonymization/account closure, private evidence và policy version cùng database/session với phần bán hàng. Chặn đóng tài khoản khi còn đơn hoặc Return đang xử lý.
8. Một compose.yml chạy web + API + PostgreSQL. Setup tạo secret ngẫu nhiên tại máy, chỉ ADMIN seed từ .env root. Root README/PROJECT_STRUCTURE/HUONG_DAN_CHAY đã viết lại; CI mới chỉ build frontend/backend.

## Kiểm tra đã thực hiện

- Biên dịch TypeScript frontend mới: đạt.
- Maven package với Java21, test bị bỏ qua: đạt.
- Build frontend production trong Docker: đạt.
- Khởi tạo database riêng goihue và migration V1 store: log khởi động xác nhận thành công.
- API/Web container khởi động: đã ghi nhận log Started/Ready.
- npm audit --omit=dev sau cập nhật: 0 cảnh báo được registry báo cáo tại thời điểm bàn giao. Development toolchain còn 7 cảnh báo moderate sau audit fix; chưa ép nâng major để tránh thay đổi không cần thiết.
- Không chạy bộ test, không đăng ký tài khoản, không tạo đơn/refund hoặc diễn tập nghiệp vụ thay người dùng. Thành công build/khởi động không phải nghiệm thu chức năng hoặc bảo mật production.

## Giới hạn cần biết

Thanh toán COD, vận chuyển và refund được ADMIN ghi nhận thủ công với reference, chưa có cổng thanh toán/3PL/email tự động. Policy chưa được phê duyệt; retention/SLA còn cần quyết định. Chưa có antivirus/auto cleanup ảnh. Cookies dành cho local HTTP, cần cấu hình bảo mật trước khi public. Chưa có password recovery/change, verification email, voucher/loyalty/reviews/B2B/multi-warehouse.

Đơn cũ trong volume goi-hue-academic là dữ liệu của bản riêng trước đây, không tự nhập vào website mới. Tài liệu audit cũ trong docs giữ nguyên như bằng chứng lịch sử; hợp đồng runtime hiện tại là docs/03_api_specs/goihue.openapi.yaml và goihue-state-matrix.md.
