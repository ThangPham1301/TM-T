# Checkout VietQR demo — merge notes

Nhánh feat/checkout-vietqr-demo được gộp vào codex/home-decoration-preview. Thay đổi gồm giao diện giỏ, checkout, đơn hàng, VietQR thử nghiệm, webhook demo và chuyển trạng thái giao thất bại. Nhánh thêm thư viện qrcode và ảnh sản phẩm tĩnh; không thêm migration mới.

Để tránh ghi nhận tiền giả với secret đã công khai, IPN demo trả 503 nếu APP_IPN_SECRET rỗng. Cấu hình secret ngẫu nhiên trong .env cá nhân nếu cần thử và truyền đúng secret vào scripts/demo-ipn.ps1; không chia sẻ secret. Secret SePay để trống theo mặc định. Cấu hình domain tunnel không được bật mặc định. Ngân hàng mặc định trong nhánh gốc chỉ là giá trị ví dụ; giao diện ghi rõ VietQR là demo và không chuyển tiền thật.

Sửa kiểm tra đơn đã hủy/hoàn về: thanh toán đến sau chuyển REVIEW thay vì PAID. Bộ quét hết hạn bỏ qua đơn đã hủy/hoàn về/giao, tránh hoàn tồn hai lần. Đây là xử lý mã nguồn chưa được kiểm thử tích hợp với cơ sở dữ liệu, bao gồm các tình huống cạnh tranh đồng thời.

Typecheck và Next build thành công; Docker build backend thành công, Dockerfile bỏ qua test. ESLint toàn frontend: bốn lỗi hook tại account.tsx, cart.tsx (hai lỗi) và store.tsx; hai cảnh báo img tại account.tsx và payment-panel.tsx. Chưa chạy kiểm thử luồng COD/VietQR, duplicate, hết hạn, sai tiền, hủy và webhook với backend/database cách ly; chưa xác minh tương thích webhook SePay. Không thực hiện giao dịch hay thay đổi cơ sở dữ liệu.

Trước khi demo: cấu hình APP_IPN_SECRET local, khởi chạy lại web/api có ý thức về dữ liệu đang lưu; không dùng tài khoản ngân hàng thật. Trước khi vận hành thật: xác minh hợp đồng nhà cung cấp, bảo mật webhook/idempotency, đồng thời và đối soát; kiểm thử hồi quy checkout/tồn kho/hoàn tiền trên dữ liệu thử riêng. Không xem QR demo là xác nhận thanh toán sản xuất.
