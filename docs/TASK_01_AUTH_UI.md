# Task 01 — Login/Register UI migration

## File và tái sử dụng

- Sửa `apps/web/src/components/auth-form.tsx`: bố cục theo Stitch, giữ controller submit, thêm hiện/ẩn password và ảnh fallback.
- Thêm `apps/web/src/components/auth-form.module.css`: style scoped, token --gh-*, desktop hai cột; tablet/mobile một cột; button có chi tiết góc gấp.
- Thêm báo cáo này. Không sửa các file Task 00 chưa commit; không sửa page route, store, API, backend hoặc các màn hình khác.
- Dùng Button, TextField từ shared/ui và BrandMark từ shared/layout. Không tạo primitive hoặc store mới.

## Nghiệp vụ bảo toàn qua đối chiếu code

Payload login vẫn email/password; register vẫn name/email/password qua fields(FormData), POST auth/login hoặc auth/register; await reload rồi chuyển ADMIN về /admin, vai trò còn lại về /account như cũ. StoreProvider, credentials/cookie và run xử lý lỗi/thông báo toàn cục giữ nguyên. Native required/email, tên tối đa 100, email tối đa 150, password minLength=12/maxLength=72 giữ nguyên. Ghi chú byte phản ánh giới hạn server trước đây; trình duyệt vẫn kiểm tra ký tự, server quyết định hợp lệ cuối cùng.

Nút hiện/ẩn type=button không thêm trường payload; aria-pressed/controls liên kết input. Nút submit có loading/disabled; chặn submit khi busy. Người đã có session truy cập login vẫn thấy form như source cũ, chưa tự thêm redirect mới.

## Kiểm tra thực hiện

- npm.cmd run typecheck: PASS.
- npm.cmd run build: PASS.
- npm.cmd run lint: FAIL do ba lỗi có sẵn ở account.tsx:39, cart.tsx:38, lib/store.tsx:159; một warning ảnh account.tsx:733. Không sửa các file ngoài phạm vi.
- ESLint riêng auth-form.tsx: PASS.
- git diff --check: PASS.
- Đã xem hai screen.png và đối chiếu code.html; chưa kiểm tra visual trên trình duyệt.

## Chưa kiểm chứng runtime

Chưa chạy login hợp lệ CUSTOMER/ADMIN, sai thông tin, tài khoản đã login; register hợp lệ/email trùng; lỗi API; loading thực tế; thao tác hiện/ẩn và native validation trên browser. Chưa tạo tài khoản thử hoặc thay đổi dữ liệu để test. Chưa đo overflow tại 1440/768/390px, focus/keyboard, tải ảnh fallback hoặc smoke hồi quy Home/Products/Cart/Checkout/Admin. Build không thay thế các kiểm tra này.

## Khác biệt với Stitch

- Giữ Header/Footer chung hiện hành, không sao chép header/footer thiết kế.
- Chưa có logo G gấp gốc được xác nhận; dùng fallback chữ Gói Huế của BrandMark, không tự vẽ glyph trong HTML Stitch. URL ảnh logo ngoài trong HTML chưa được xác nhận là asset gốc.
- Chỉ nhận email, không tên tài khoản. Không thêm terms checkbox, quên mật khẩu, email kích hoạt hoặc thông báo thành công giả.
- Không dùng strength meter với lời khẳng định an toàn tuyệt đối. Dùng hướng dẫn độ dài hiện có.
- Nút hiện/ẩn dùng chữ rõ nghĩa bên dưới trường để dễ sử dụng trên mobile, thay icon mắt trong input.
- Font dùng token với fallback hệ thống, chưa tải Google font. Ảnh thương hiệu dùng URL tham chiếu Stitch với fallback local product-placeholder.svg khi lỗi; register cũng có khối ảnh thay thumbnail nhỏ của thiết kế.
- Palette dùng token đã duyệt, không dùng toàn bộ palette khác nhau trong Tailwind export. Form dùng surface token hiện có thay trắng tuyệt đối.

URL: /login và /register. Hoàn thành phạm vi triển khai Task 01; chưa thực hiện Task 02.
