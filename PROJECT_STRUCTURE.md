# Cấu trúc Gói Huế sau xây dựng lại

Hai ứng dụng đang hoạt động: `apps/web` và `apps/api`. Mọi route bán hàng, tài khoản, dữ liệu cá nhân và đổi trả dùng cùng cookie `goihue_session` và PostgreSQL `goihue`.

| Thành phần | Vị trí | Trách nhiệm |
| --- | --- | --- |
| Route và layout | apps/web/src/app | Trang chủ, sản phẩm, giỏ, checkout, login/register, account/admin, chính sách |
| API trung gian | apps/web/src/app/api/store | Same-origin proxy; no-store; chỉ forward các path allowlist |
| State dùng chung | apps/web/src/lib/store.tsx | Phiên tài khoản, dữ liệu, trạng thái thao tác, idempotency key |
| Giao diện | apps/web/src/components | Header/footer, home, catalog/cart, account/admin, form xác thực, chính sách |
| Style | apps/web/src/styles | heritage.css tái sử dụng hệ màu/layout; store.css bố cục các trang tích hợp |
| Tài khoản và sau bán | apps/api/src/main/java/vn/goihue/PlatformApi.java | Session, quyền, hồ sơ, consent, yêu cầu dữ liệu, Return Case, evidence, audit |
| Bán hàng | apps/api/src/main/java/vn/goihue/CommerceApi.java | Catalog, giỏ server, checkout, tồn, hủy, giao/thu tiền thủ công |
| Quản lý catalog và phí giao | apps/api/src/main/java/vn/goihue/CatalogService.java | CRUD sản phẩm/danh mục, phụ thuộc khi xóa, visibility và phí giao |
| Ảnh catalog và cấu hình public | apps/api/src/main/java/vn/goihue/CatalogApi.java | Upload PNG/JPEG được decode/re-encode, quyền đọc ảnh, category/shipping endpoints |
| Database | apps/api/src/main/resources/db/migration | Flyway, accounts/sessions, JSONB records, idempotency ledger, append-only audit |
| Catalog ban đầu | apps/api/src/main/resources/catalog-images.json | Tham chiếu ảnh giao diện cũ cho sản phẩm seed |
| Hạ tầng | compose.yml | Web loopback 3000, API loopback 8088, PostgreSQL nội bộ 5432/loopback 5433 để xem bằng DBeaver, volumes riêng |

`records` lưu các aggregate có kind: product, category, catalog-image, settings, system, cart, order, privacy, return, evidence, consent, policy. Phạm vi một cửa hàng/đồng VND. Order chứa snapshot nhiều dòng và phí giao; mỗi Return Case xử lý một dòng/số lượng. Thay giá catalog/phí cấu hình không đổi snapshot đơn. Stock trừ tại checkout, hoàn đúng một lần khi hủy ở PLACED/CONFIRMED và chưa thu tiền. Không nhập hàng trả về tồn bán tự động.

Frontend CRUD: `catalog-admin.tsx` cho products/categories/settings; `cart.tsx` cho giỏ/checkout; `account.tsx` cho đơn và sau bán; `workspace-nav.tsx` cho điều hướng/phân trang. Ảnh catalog ở `/data/catalog` trong volume evidence dùng chung mount `/data`, tách namespace với ảnh bằng chứng; được giữ khi restart. Flyway V2 bổ sung danh mục/phí giao và marker ngăn tái seed sản phẩm đã xóa.

## Đã đưa ra khỏi luồng chạy

- services/: Identity, Catalog, Order, Inventory, Shipping, Fulfillment, Care cùng các service cũ → archive/legacy/services.
- infra/, mocks/, packages/, scripts/, .github/ cũ → archive/legacy tương ứng.
- Flutter → archive/legacy/mobile-app, vì yêu cầu hiện tại là web.
- Source và script Next cũ → archive/legacy/web-src và web-scripts.
- .next cũ, component reviews/test và cấu hình standalone cũ → archive/legacy.
- Tài liệu gốc README/project_bible/task và workspace cũ → archive/legacy/root-docs.
- Bản source ban đầu của backend Chương 1–2 → archive/legacy/policy-return-original-src.

Đã giữ lại giao diện: tokens màu, header/footer/card, typography, home hero/section, component ProductImage, ảnh ngoài và placeholder. Đã viết lại logic xác thực, state và các trang giao dịch; không import source từ archive. node_modules/.next là cache local, không thuộc source version control.

Không xóa dữ liệu cũ. Archive chỉ phục vụ phục hồi, không được tham gia Docker context, TypeScript hoặc pipeline. Báo cáo audit và đặc tả trước lần viết lại là tài liệu lịch sử, các đường dẫn/bằng chứng cũ phản ánh phiên bản lúc lập báo cáo.
