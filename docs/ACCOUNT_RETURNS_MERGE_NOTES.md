# Merge tài khoản và vận hành đổi trả

Nhánh feat/an-returns-operations chứa lịch sử feat/account. Bản gộp giữ giao diện Home/catalog của Lân, checkout demo của Bảo, tài khoản của Trung và đổi trả/vận hành của Ân. Store success notice tự ẩn được giữ lại.

Khi xử lý xung đột, quản trị sản phẩm/danh mục tiếp tục dùng LanAdminShell; cấu hình bán hàng dùng OperationsWorkspace với thông báo tạm ngừng. Header/Footer dùng chung được ẩn tại màn quản trị có shell riêng; footer được ẩn trong khu vực tài khoản và quản trị theo nhánh tài khoản.

Không đưa vào đoạn seed tự tạo tài khoản khách, địa chỉ, đồng ý tiếp thị và yêu cầu riêng tư mẫu từ PlatformApi. Không sửa database hoặc chạy migration. Chi tiết đơn dùng nhãn chưa có thông tin thay vì hiển thị tên/địa chỉ/số điện thoại mẫu. Không tự chuyển đổi toàn bộ nội dung API trong store. Khi địa chỉ khác bị đổi mặc định, revision được tăng để bảo vệ cập nhật đồng thời.

Chức năng mới phụ thuộc API: quản lý địa chỉ mặc định, yêu cầu đổi trả, ảnh bằng chứng, xử lý yêu cầu, nhật ký, chính sách và thông báo ngừng nhận đơn. API draft và state matrix đã cập nhật thông tin địa chỉ mặc định và thay đổi của nhánh Ân.

Kiểm tra: typecheck, production build frontend, Docker build backend PASS; Dockerfile backend bỏ qua test. ESLint toàn frontend FAIL với 7 lỗi/7 cảnh báo, gồm hook/purity tại account, cart, return-request-form, store và cảnh báo icon font/ảnh. Chưa chạy test nghiệp vụ với database hoặc kiểm tra responsive trên trình duyệt. Luồng refund, evidence, địa chỉ mặc định, concurrent revision, checkout/cancel, audit và role cần được kiểm tra trong môi trường dữ liệu thử trước khi sử dụng thật.

Lưu ý nhánh tài khoản nạp Material Symbols từ Google Fonts cho icon; font chữ chính vẫn đóng gói local. Nếu không có mạng, cần bổ sung icon local trong công việc tiếp theo. Luồng VietQR vẫn là demo, IPN bị tắt khi chưa cấu hình secret riêng; không chuyển tiền thật.
