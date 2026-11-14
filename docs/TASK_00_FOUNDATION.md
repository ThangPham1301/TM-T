# Task 00 — Shared Design System Foundation

## Kết quả

Nền tảng được bổ sung mà chưa migration màn hình Stitch. Giữ StoreProvider, API client, auth, route, giỏ/checkout và các action nghiệp vụ. Thay đổi chưa commit có trước (UI_Figma và các tài liệu UI) được giữ nguyên.

## File tạo mới

- `apps/web/src/styles/tokens.css`: nguồn token mới duy nhất, namespace `--gh-*`; bảng màu đã duyệt, font và fallback, spacing, radius, shadow, focus và z-index. Không ánh xạ đè token legacy.
- `apps/web/src/shared/ui/ui.module.css`: style scoped cho primitive, không selector global hoặc màu hardcode trong component.
- `apps/web/src/shared/ui/button.tsx`: native button props, primary/secondary/danger, small/medium/large, loading/disabled; mặc định type=button, form submit cần type=submit.
- `apps/web/src/shared/ui/text-field.tsx`: input native, label/hint/error với id ổn định, aria-invalid/describedby, controlled/uncontrolled và autocomplete do caller truyền.
- `apps/web/src/shared/ui/select.tsx`: select native có label/hint/error; giữ keyboard navigation của browser.
- `apps/web/src/shared/ui/status-badge.tsx`: tone trình bày và children; không import nhãn trạng thái nghiệp vụ.
- `apps/web/src/shared/ui/dialog.tsx`: controlled open/onClose, native showModal, Escape, focus containment, inert background và phục hồi focus; caller phải cập nhật open=false khi onClose. Không cung cấp nested dialog workflow.
- `apps/web/src/shared/ui/empty-state.tsx`: title/description/action slot.
- `apps/web/src/shared/ui/index.ts`: public exports.
- `apps/web/src/shared/layout/brand-mark.tsx`: nhận logoSrc gốc; object-fit contain, một ảnh; không tự vẽ hoặc thêm chữ G. Khi chưa có asset hiển thị tên thương hiệu.
- `apps/web/src/shared/layout/store-shell.tsx`: StoreHeader/StoreFooter tách markup từ SiteHeader/SiteFooter, nhận props; giữ class legacy và giao diện hiện tại.
- `apps/web/src/shared/layout/navigation.ts`: nguồn duy nhất của URL/nhãn account và admin đang sử dụng.
- `apps/web/src/shared/layout/account-sidebar.tsx`: presentational navigation, aria-current, dùng danh sách hiện có.
- `apps/web/src/shared/layout/admin-shell.tsx`: brand/headerActions/sidebar/content slots; responsive, chưa mount trên route. Caller phải giữ guard quyền hiện tại và tránh render hai header.
- `apps/web/src/shared/layout/layout.module.css` và `index.ts`: layout scoped và public exports.
- `docs/TASK_00_FOUNDATION.md`: báo cáo này.

## File chỉnh sửa

- `app/layout.tsx`: import tokens.css; không thay provider hoặc shell composition.
- `components/site-shell.tsx`: giữ adapter store/API/callback, chuyển markup sang shared StoreHeader/Footer; chỉ có một header/footer đang mount.
- `components/workspace-nav.tsx`: dùng navigation array chung; giữ URL, class active, Pagination và hành vi hiện tại.

## Quyết định giữ/tách

Giữ ProductImage, Pagination, AddressFields và các controller hiện có; không xây bản trùng. Tách shell presentation để shared không import store, API hay feature. Không đổi token cũ trong heritage.css/store.css. AccountSidebar và AdminShell chỉ sẵn sàng để tích hợp sau; không thay layout account/admin trong Task 00. Logo chữ G legacy vẫn giữ ở shell hiện hành để tránh đổi giao diện ngoài phạm vi; BrandMark mới không sử dụng nó như asset gốc.

Chưa tìm thấy asset logo G gấp gốc riêng trong public hoặc UI_Figma. Cần cung cấp asset đã duyệt trước khi dùng logo ảnh. Font có fallback hệ thống; chưa tải font/CDN hoặc thêm package.

## Kiểm tra

- Typecheck: PASS.
- Production build: PASS, route hiện tại được sinh thành công.
- ESLint phần shared và ba file chỉnh sửa: PASS, không warning.
- ESLint toàn dự án: FAIL do ba lỗi react-hooks/set-state-in-effect có sẵn tại account.tsx:39, cart.tsx:38, lib/store.tsx:159; một warning no-img-element tại account.tsx:733. Các file này không sửa trong Task 00.
- Dependency direction: shared chỉ import React/Next, CSS Module, module nội bộ shared; import trực tiếp tránh vòng phụ thuộc qua barrel. Không import store/API/business feature.
- Token dùng namespace riêng, module selector scoped; exception có chủ đích là StoreHeader/Footer giữ CSS legacy để tương thích markup cũ. Không sửa global legacy selector.
- Chưa kiểm tra bằng trình duyệt; build/typecheck không chứng minh visual regression hoặc focus runtime. Cần smoke header/menu/logout/search và dialog keyboard khi có browser, trước migration thật.

## Sẵn sàng cho Login/Register

Import Button, TextField, Select, StatusBadge, Dialog, EmptyState từ `@/shared/ui`; BrandMark từ `@/shared/layout`. AuthForm tiếp tục sở hữu submit, error, busy và chuyển hướng. Không tạo provider mới. Với form dùng Button type=submit, loading=busy, TextField type=email/password và autoComplete tương ứng. Chưa tích hợp Login/Register trong Task 00.

Rollback: revert ba file ứng dụng đã chỉnh sửa và bỏ các import/component mới trong một commit Task 00; không cần sửa dữ liệu hoặc API. Không dùng reset hard vì workspace có tài liệu và thiết kế chưa commit.
