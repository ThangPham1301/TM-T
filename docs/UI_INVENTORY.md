# UI Inventory

Rà soát source frontend và HTML thiết kế ngày 14/11/2026. Đây là phân tích tĩnh; chưa chạy kiểm thử trình duyệt hay xác nhận bảo mật backend. ĐÃ CÓ = có mã triển khai; ĐỀ XUẤT = công việc tích hợp tương lai; không coi HTML tĩnh là bằng chứng nghiệp vụ đã hoạt động.

## Nền tảng và cấu trúc

- apps/web/package.json: Next 16.4.6, React/React DOM 19.3.0; TypeScript 5.9.2 strict, ESLint 9.39.5. Không có Tailwind, thư viện UI hay thư viện quản lý query trong dependencies.
- apps/web/tsconfig.json: alias @/* → src/*; App Router với params/searchParams dạng Promise trong route động.
- apps/web/next.config.mjs: standalone, strict mode, cấu hình remote image domains. Allowlist không đồng nghĩa mọi ảnh thực tế đều dùng next/image.
- app: route mỏng, một root layout; components: màn hình và nghiệp vụ; lib/store.tsx: HTTP/context/formatter; styles: CSS toàn cục.
- app/layout.tsx: html lang=vi → StoreProvider → SiteHeader, StatusMessages, children, SiteFooter; import heritage.css trước store.css. Chưa thấy nested layout riêng cho account/admin, loading.tsx, error.tsx hoặc middleware trong src được rà soát.

## Toàn bộ route và đối chiếu 23 màn hình

Các file màn hình nằm trong UI_Figma/{01_Cua_hang,02_Tai_khoan,03_Quan_tri}/Man_hinh/<tên>/code.html. Các component bên dưới thuộc apps/web/src/components.

| URL | Folder Stitch | Component hiện tại | Chức năng ĐÃ CÓ |
|---|---|---|---|
| / | Trang_chu | home.tsx | Sản phẩm, danh mục, hero, câu chuyện, CTA |
| /products | Danh_sach_san_pham | commerce.tsx | Tìm q/category; giá/tồn; chọn lượng; thêm giỏ |
| /products/[slug] | Chi_tiet_san_pham | commerce.tsx | Chi tiết, ảnh dự phòng, lượng, thêm giỏ |
| /cart | Gio_hang | cart.tsx | Sửa/xóa giỏ, token, cảnh báo giá/tồn, tổng tiền |
| /checkout | Thanh_toan | cart.tsx | Địa chỉ đã lưu/nhập mới, COD, xác nhận và tạo đơn |
| /login | Dang_nhap | auth-form.tsx | Email/mật khẩu, chuyển hướng theo role |
| /register | Dang_ky | auth-form.tsx | Tên/email/mật khẩu, tạo khách hàng |
| /privacy-policy | Chinh_sach_bao_mat | policies.tsx | Chính sách động, phiên bản, nhãn dự thảo |
| /return-policy | Chinh_sach_doi_tra | policies.tsx | Nội dung đổi trả dự thảo |
| /account/profile | Ho_so_ca_nhan | account.tsx | Thông tin cá nhân, consent marketing và lịch sử |
| /account/addresses | So_dia_chi | account-settings.tsx | CRUD địa chỉ, revision |
| /account/security | Bao_mat_tai_khoan | account-settings.tsx | Đổi mật khẩu cũ/mới/xác nhận |
| /account/orders | Don_hang_cua_toi | account.tsx | Tìm/lọc/phân trang, chi tiết, sửa người nhận, hủy đủ điều kiện |
| /account/returns | Yeu_cau_doi_tra | account.tsx | Nhiều dòng đổi trả, ảnh, bổ sung, xác nhận/rút, lịch sử |
| /account/privacy | Quyen_rieng_tu | account.tsx | Yêu cầu ACCESS/EXPORT/DELETE/RESTRICT/COMPLAINT, tải export |
| /admin/orders | Quan_ly_don_hang | account.tsx | Chuyển trạng thái, mã vận đơn, ghi nhận COD/chứng từ |
| /admin/products | Quan_ly_san_pham | catalog-admin.tsx | CRUD, lọc/phân trang, ảnh, giá/tồn, ẩn/hiện |
| /admin/categories | Quan_ly_danh_muc | catalog-admin.tsx | CRUD, ảnh, mã, thứ tự, ẩn/hiện |
| /admin/settings | Cau_hinh_ban_hang | catalog-admin.tsx | Phí giao, ngưỡng miễn phí, nhận đơn, revision |
| /admin/returns | Xu_ly_yeu_cau_doi_tra | account.tsx | Duyệt/bổ sung/thu hồi/kiểm tra/thực hiện, ảnh và lịch sử |
| /admin/privacy | Xu_ly_quyen_rieng_tu | account.tsx | Xử lý yêu cầu dữ liệu, kết quả và lịch sử |
| /admin/policies | Quan_ly_chinh_sach | account.tsx | Phiên bản, nội dung, lịch sử |
| /admin/audit | Nhat_ky_hoat_dong | account.tsx | Nhật ký chỉ đọc |

Ngoài 23 màn hình: /account mở hồ sơ; /admin mở đơn hàng; not-found.tsx xử lý URL sai. account/[section] chỉ nhận profile/orders/returns/privacy/addresses/security. admin/[section] chỉ nhận orders/products/categories/settings/returns/privacy/policies/audit. /api/store/[...path] là proxy GET/POST/PUT, không phải màn hình.

## Component và CSS đang sử dụng

| File | Trách nhiệm |
|---|---|
| site-shell.tsx | SiteHeader, SiteFooter, StatusMessages; tìm kiếm, menu theo người dùng, logout, danh mục footer |
| home.tsx | HomeExperience; sản phẩm/danh mục, nội dung thương hiệu, trang trí preview |
| commerce.tsx | Catalog dùng chung danh sách và chi tiết |
| cart.tsx | Cart dùng chung giỏ và checkout |
| auth-form.tsx | AuthForm dùng chung login/register |
| account.tsx | Account, danh sách/chi tiết/form và điều phối đơn, đổi trả, riêng tư, policy, audit |
| account-settings.tsx | AddressFields, AddressBook, PasswordSettings |
| catalog-admin.tsx | CatalogAdmin dùng chung sản phẩm/danh mục/cấu hình |
| workspace-nav.tsx | WorkspaceNav, Pagination |
| product/product-image.tsx | ProductImage, resolveProductImageSource, fallback |
| policies.tsx | Policies dùng chung hai chính sách |
| styles/heritage.css | Token màu/font, reset/khung và nhiều selector giao diện; breakpoint 1050/760/520 |
| styles/store.css | Bổ sung/ghi đè commerce, form, account/admin; breakpoint 680/1180/760 |
| components/home-identity.module.css | Trang trí home scoped, có :global, breakpoint và reduced-motion |

## API, trạng thái và bảo toàn nghiệp vụ

Nguồn chính: lib/store.tsx; app/api/store/[...path]/route.ts; các lời gọi api/mutate trong component.

| Miền | Phụ thuộc đang dùng |
|---|---|
| Session | auth/login/register/logout, GET state, POST password |
| Catalog | products[/slug], categories, admin/products, admin/categories, catalog/images/... |
| Giỏ/checkout | cart/summary, commerce với action cart-set và checkout; cartToken; các action cập nhật giỏ |
| Địa chỉ/hồ sơ | command: profile, consent, address-save/delete |
| Đơn | commerce: order-recipient/order-cancel và action xử lý theo trạng thái |
| Đổi trả | command: return-submit/confirm/withdraw và các action xử lý/bổ sung; evidence/intents, PUT evidence/id/content |
| Riêng tư/chính sách | command privacy-create và xử lý hồ sơ; privacy/id/export; policy và command policy |
| Giao hàng | shipping và commerce shipping-save |

StoreState chứa user, addresses, orders, privacy, returns, consents, policy, policyVersions/audit tùy chọn và cartCount. Row dùng unknown theo key, nhiều ép kiểu tại render: linh hoạt nhưng dễ sai tên trường khi thay UI. run quản lý busy/error/notice dùng chung; mutate gửi Idempotency-Key, giữ key cho cùng payload khi retry và reload state sau thành công. Không tự bỏ revision/cartToken hoặc thay action bằng handler giả.

Xác thực dùng cookie same-origin qua proxy, không thấy FE lưu JWT vào localStorage. Không suy ra Keycloak từ frontend hiện tại. GET state gặp 401 xóa state; ADMIN guard trong Account/CatalogAdmin; giỏ dành CUSTOMER; đây là guard hiển thị, quyền thật phải do backend kiểm soát. Không coi ẩn nút là bảo vệ API. Login chuyển /admin hoặc /account theo role.

Proxy giới hạn đường dẫn, chuyển cookie/content-type/idempotency-key và set-cookie, no-store, timeout 20 giây, giới hạn body, kiểm tra Origin/Host cho write. Origin hiện chỉ localhost/127.0.0.1:3000 và http sameHost: có thể chặn môi trường HTTPS/domain demo khác. WebSocket trong store tự nối cổng 8088, refresh khi message/reconnect/focus; có rủi ro qua reverse proxy/HTTPS. Chỉ ghi nhận để xử lý trước triển khai, không sửa trong nhiệm vụ tài liệu.

Giỏ/checkout dùng tổng kết server, cảnh báo giá/tồn, COD, chọn/lưu địa chỉ. Đơn và đổi trả có điều kiện trạng thái, revision, chứng từ, evidence và lịch sử. Không thay bằng số tiền/trạng thái hardcode trong Stitch. Lựa chọn marketing đã có ghi nhận; nguồn account.tsx ghi dịch vụ gửi email đang chờ kết nối.

