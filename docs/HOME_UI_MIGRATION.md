# Home — tích hợp bản Trang_chu từ UI_Figma

## Nguồn

Đối chiếu trực tiếp code.html và screen.png tại UI_Figma/01_Cua_hang/Man_hinh/Trang_chu. Giữ Header/Footer dùng chung đã tích hợp trước đó.

## File

- Sửa apps/web/src/components/home.tsx.
- Thêm apps/web/src/components/home.module.css: CSS Module, không tác động selector giao diện khác.
- Thêm apps/web/src/components/home-content.ts: nội dung thương hiệu và URL ảnh đúng bản Stitch.
- Không xóa home-identity.module.css hoặc tài nguyên preview cũ; Home mới không import stylesheet preview.

## Sáu section đã tích hợp

1. Hero Phong vị Huế: khung viền, họa tiết kiến trúc, bảng giấy góc gấp, ảnh mè xửng/trà và badge.
2. Bốn giá trị thương hiệu đúng nội dung nguồn.
3. Sidebar danh mục và lưới sản phẩm ba cột desktop, bộ lọc thực tế, trạng thái loading/error/empty và retry.
4. Hai thẻ set quà, ảnh và nội dung gợi ý thiết kế.
5. Thư viện ba ảnh theo tỷ lệ 5–4–3 và caption nguồn.
6. Câu chuyện Nếp Nhà Trầm Mặc, văn bản gốc, họa tiết nền, CTA và chữ ký.

## Dữ liệu và khác biệt có chủ đích

Sản phẩm/danh mục lấy products/categories qua API hiện tại. Có năm sản phẩm ở môi trường kiểm tra; không thêm lại sáu sản phẩm mẫu hoặc sửa database. Ảnh sản phẩm còn thiếu được ProductImage thay bằng placeholder hiện hành.

Tiêu đề dùng Sản phẩm tuyển chọn thay Sản phẩm bán chạy vì chưa có nguồn xếp hạng doanh số. Không hardcode giá, khối lượng hoặc mô tả của sáu sản phẩm trong HTML vào dữ liệu bán hàng.

Hai set thiết kế được tìm theo tên sản phẩm tương ứng. Chỉ hiển thị giá và dẫn chi tiết khi có bản ghi khớp; khi chưa có, ghi Mẫu gợi ý từ bộ sưu tập thiết kế, không công bố giá mẫu và dẫn sang bộ sưu tập. Không ghép sản phẩm quà khác tùy tiện vào set mẫu.

Dùng token màu/font chung đã duyệt nên palette có chênh lệch nhỏ so với palette Tailwind riêng của export. Các icon được chuyển thành SVG inline thay font Material Symbols/CDN. URL ảnh biên tập giữ đúng nguồn Stitch, có fallback; một số ảnh gốc chứa chi tiết chữ/UI trong ảnh, không tự chỉnh sửa nội dung ảnh.

## Kiểm tra đã thực hiện

- Typecheck PASS; ESLint hai file TSX/TS thay đổi PASS; production build PASS.
- Chrome headless: xem ảnh desktop 1440px và toàn trang; xem mobile với device metrics đúng 390px.
- Kiểm tra DOM tại viewport 390/768/1440: scrollWidth không vượt innerWidth. Họa tiết SVG cố ý nằm ngoài section nhưng bị clip trong section.
- API thực tế hiển thị năm sản phẩm; bấm bộ lọc Mè xửng Huế còn hai sản phẩm, aria-pressed cập nhật đúng; quay lại Tất cả.
- Chưa kiểm tra luồng đặt hàng hoặc toàn bộ tương tác bàn phím; không thay đổi action/API/auth/cart/checkout.
- Sau kiểm tra đầu tiên có sửa việc ghép set quà theo tên thay vì thứ tự; typecheck/lint/build đã chạy lại sau sửa. Chưa chụp lại toàn trang sau chỉnh này.

URL: /. Trang sử dụng dữ liệu động nên không khẳng định khớp pixel hoặc số thẻ như bản sáu sản phẩm mẫu.
