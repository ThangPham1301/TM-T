# Component Map

Rà soát source frontend và HTML thiết kế ngày 14/11/2026. Đây là phân tích tĩnh; chưa chạy kiểm thử trình duyệt hay xác nhận bảo mật backend. ĐÃ CÓ = có mã triển khai; ĐỀ XUẤT = công việc tích hợp tương lai; không coi HTML tĩnh là bằng chứng nghiệp vụ đã hoạt động.

## Mapping màn hình

| Route | Thiết kế Stitch | Điểm tích hợp hiện tại | Khối tái sử dụng đề xuất |
|---|---|---|---|
| / | Trang_chu | components/home.tsx | SiteShell, Button, Field |
| /products | Danh_sach_san_pham | components/commerce.tsx | ProductCard, ProductImage, QuantityInput |
| /products/[slug] | Chi_tiet_san_pham | components/commerce.tsx | ProductCard, ProductImage, QuantityInput |
| /cart | Gio_hang | components/cart.tsx | CartLine, OrderTotals, AddressFields |
| /checkout | Thanh_toan | components/cart.tsx | CartLine, OrderTotals, AddressFields |
| /login | Dang_nhap | components/auth-form.tsx | SiteShell, Button, Field |
| /register | Dang_ky | components/auth-form.tsx | SiteShell, Button, Field |
| /privacy-policy | Chinh_sach_bao_mat | components/policies.tsx | PolicyArticle, DraftNotice |
| /return-policy | Chinh_sach_doi_tra | components/policies.tsx | PolicyArticle, DraftNotice |
| /account/profile | Ho_so_ca_nhan | components/account.tsx | WorkspaceShell, Field, Feedback |
| /account/addresses | So_dia_chi | components/account-settings.tsx | WorkspaceShell, Field, Feedback |
| /account/security | Bao_mat_tai_khoan | components/account-settings.tsx | WorkspaceShell, Field, Feedback |
| /account/orders | Don_hang_cua_toi | components/account.tsx | OrderList, OrderSummary, StatusBadge, Timeline |
| /account/returns | Yeu_cau_doi_tra | components/account.tsx | EvidenceGallery, Timeline, ReturnLine, CaseSummary |
| /account/privacy | Quyen_rieng_tu | components/account.tsx | WorkspaceShell, Field, Feedback |
| /admin/orders | Quan_ly_don_hang | components/account.tsx | OrderList, OrderSummary, StatusBadge, Timeline |
| /admin/products | Quan_ly_san_pham | components/catalog-admin.tsx | WorkspaceShell, FilterBar, Pagination, Field |
| /admin/categories | Quan_ly_danh_muc | components/catalog-admin.tsx | WorkspaceShell, FilterBar, Pagination, Field |
| /admin/settings | Cau_hinh_ban_hang | components/catalog-admin.tsx | WorkspaceShell, FilterBar, Pagination, Field |
| /admin/returns | Xu_ly_yeu_cau_doi_tra | components/account.tsx | EvidenceGallery, Timeline, ReturnLine, CaseSummary |
| /admin/privacy | Xu_ly_quyen_rieng_tu | components/account.tsx | WorkspaceShell, FilterBar, Pagination, Field |
| /admin/policies | Quan_ly_chinh_sach | components/account.tsx | WorkspaceShell, FilterBar, Pagination, Field |
| /admin/audit | Nhat_ky_hoat_dong | components/account.tsx | WorkspaceShell, FilterBar, Pagination, Field |

## Ranh giới tái sử dụng

| Có sẵn | Giữ/tách dần | Điều kiện bảo toàn |
|---|---|---|
| SiteHeader/Footer/StatusMessages | shared/layout | Không nhân đôi header/footer từ 23 HTML |
| ProductImage/resolver | shared hoặc public catalog export | Giữ fallback, nguồn API và hành vi lỗi ảnh |
| WorkspaceNav/Pagination | shared/layout và shared/ui | Giữ URL, active section, reset/clamp trang khi lọc |
| AddressFields/Book | account feature; checkout dùng public export | Giữ field name, validation, id/revision |
| PasswordSettings/AuthForm | auth/account feature | Giữ autocomplete, giới hạn, xác nhận và cookie flow |
| money/date/label | shared/lib khi tách | Giữ định dạng VND, tiếng Việt và mã domain |
| api/run/mutate | lib/store trước mắt | Giữ retry key, 401, reload và thông báo |
| Account | orders/returns/privacy/policies views | Tách theo section trước; controller/action sau |
| CatalogAdmin | catalog view + shipping view | Không tạo hai hệ mutation khác nhau cho cùng thực thể |
| Cart | CartView và CheckoutView | Giữ cartToken, warning, address và redirect đơn |

## Trùng lặp và mức ưu tiên

P1: form label/input/error/button và thẻ trạng thái lặp nhiều màn hình; tạo primitive nhỏ, tránh cấu hình form tổng quát quá sớm. P1: ảnh/sản phẩm xuất hiện tại home và Catalog; tái sử dụng presentation nhưng home không cần toàn bộ điều khiển mua. P1: upload evidence trong account và ảnh catalog trong CatalogAdmin có quy trình tương tự nhưng endpoint/ownership khác; chỉ chia sẻ picker/validation UI, không hợp nhất service tùy tiện. P2: danh sách/chi tiết/lịch sử đơn, riêng tư, đổi trả trong Account có cấu trúc gần nhau nhưng state machine khác; tái sử dụng Timeline/DetailPanel, giữ action theo domain. P2: CSS global và override qua nhiều block làm khó xác định nguồn; migrate theo module và kiểm tra computed style.

## Chức năng thật và ý tưởng thiết kế

ĐÃ CÓ: 23 URL tương ứng, CRUD catalog/địa chỉ, xác thực, COD, xử lý đơn và hồ sơ theo dữ liệu hiện tại (xem UI_INVENTORY.md). HTML Stitch cung cấp bố cục và dữ liệu minh họa, không chứng minh request thành công.

Các control như biến thể/quy cách, review/rating, wishlist, mã ưu đãi, đăng nhập xã hội, OTP/2FA, thanh toán online, biểu đồ/KPI hoặc xuất báo cáo nếu xuất hiện trong thiết kế phải được đánh dấu CHƯA XÁC NHẬN TÍCH HỢP. Chưa tìm thấy handler tương ứng trong các component được rà soát không phải khẳng định toàn dự án không có. Không bật chúng bằng dữ liệu giả; lập ticket riêng đối chiếu API trước.

Nguồn đối chiếu: apps/web/src/components/*.tsx, lib/store.tsx; UI_Figma/**/code.html. Bảng chỉ ánh xạ screen-level, không cam kết mọi control trong Stitch có backend.

