# Bàn giao bản tích hợp Gói Huế

Nhánh `review/goi-hue-integration` dùng để rà soát trước khi đưa vào `main`. Bản mã đã kiểm thử là `14ecacc`. Bản này ghép năm màn hình của Lân với nhánh tài khoản, VietQR và phần vận hành kho.

## Phần đã làm

- Ghép trang chủ, bộ sưu tập, chi tiết sản phẩm, admin sản phẩm và admin danh mục. Giữ phiên đăng nhập, giỏ hàng và điều hướng vào kho theo lô.
- Cập nhật COD xác nhận trong 24 giờ, VietQR hết hạn/đối soát, chọn địa chỉ mặc định và mua lại có kiểm tra tồn trước khi thay giỏ.
- Thêm nhập lô và cấp hàng FEFO, QC trước đóng gói, checklist sáu bước, ảnh live-packing riêng tư và QC hàng giao thất bại.
- Bổ sung migration V3–V6, hợp đồng API, ma trận trạng thái và kiểm thử hồi quy.

## File để review

| Tệp | Nội dung |
|---|---|
| [IMPLEMENTATION_DECISIONS.md](IMPLEMENTATION_DECISIONS.md) | Quyết định nghiệp vụ, đối chiếu kiến trúc, kết quả và phần còn thiếu |
| [README.md](../README.md) | Cách dựng hệ thống và cấu hình môi trường |
| [OpenAPI](03_api_specs/goihue.openapi.yaml) và [ma trận trạng thái](03_api_specs/goihue-state-matrix.md) | Endpoint, dữ liệu và điều kiện chuyển trạng thái |
| [Kiểm thử giao diện](../apps/web/tests/lan-ui.mjs) và [kiểm thử với backend thật](../apps/web/tests/storefront-integration.mjs) | Cách kiểm tra năm màn hình và luồng checkout–kho–bàn giao |

## Cách xem và đánh giá

1. So sánh nhánh này với `main`. Đọc quyết định D01–D13 trước khi rà các phần tiền, tồn, quyền đọc ảnh và tương thích dữ liệu cũ.
2. Từ bản clone, checkout nhánh, mở Docker Desktop, chạy `setup.ps1` theo README rồi chạy `docker compose up -d --build`. Dùng cơ sở dữ liệu thử và mở `http://localhost:3000`.
3. Kiểm tra trang chủ, bộ sưu tập, chi tiết sản phẩm và hai trang admin. Tạo lô đủ hạn tại `/admin/inventory`, đặt COD, xác nhận trong Đơn hàng, ghi QC đạt, hoàn tất checklist và tải ảnh, rồi nhập mã vận đơn để bàn giao. Kiểm tra ảnh bằng phiên chủ đơn và phiên khách khác.
4. Xem bằng chứng đã đạt trong báo cáo. 13 ca Maven và production build web đạt. Edge với Spring Boot/PostgreSQL đã qua luồng trên, kiểm tra hiển thị QR VietQR và các thao tác lưu dữ liệu. Nâng V2 → V6 đã thử với dữ liệu mô phỏng đơn cũ và tồn kho.

## Trước khi phát hành

Kiểm tra lại CI của nhánh và nghiệm thu trên staging. Các phần còn chờ gồm kết nối nhà vận chuyển thật, SePay Test mode, Zalo ZNS, QC hàng hoàn trên trình duyệt và diễn tập migration với bản sao dữ liệu triển khai. Ghi nhận nhận xét theo **màn hình hoặc API, bước thực hiện, kết quả mong đợi, kết quả thực tế** để nhóm xử lý.
