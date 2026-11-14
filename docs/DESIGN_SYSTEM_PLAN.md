# Design System Plan

Rà soát source frontend và HTML thiết kế ngày 14/11/2026. Đây là phân tích tĩnh; chưa chạy kiểm thử trình duyệt hay xác nhận bảo mật backend. ĐÃ CÓ = có mã triển khai; ĐỀ XUẤT = công việc tích hợp tương lai; không coi HTML tĩnh là bằng chứng nghiệp vụ đã hoạt động.

## Quyết định kiến trúc

Giữ App Router và route hiện có. Chuyển dần theo Feature-Based + Shared Components, không chuyển toàn bộ thư mục trong một lần. Root layout vẫn giữ một StoreProvider và shell. Trước hết chỉ tách view nhận props/callback, giữ controller/action ở vị trí cũ.

Cấu trúc ĐỀ XUẤT:

```text
src/app/                       # URL, metadata, layout và composition
src/features/auth/             # login/register, controller và view
src/features/catalog/          # list/detail; admin catalog khi cần
src/features/cart/             # quantity, cart summary
src/features/checkout/         # address selection, COD confirmation
src/features/account/          # profile/addresses/security
src/features/orders/           # customer/admin views, order actions
src/features/returns/          # hồ sơ, lines, evidence, processing
src/features/privacy/          # request forms, export, processing
src/features/policies/         # public/admin version views
src/features/admin/            # shipping settings, audit composition
src/shared/ui/                 # Button, Field, Badge, EmptyState, Dialog
src/shared/layout/             # site shell, workspace shell
src/shared/lib/                # formatting; adapters chỉ khi cần
src/lib/store.tsx              # giữ HTTP/context hiện tại trong giai đoạn đầu
src/styles/                    # global reset + token duy nhất
```

Shared không import feature. Feature dùng shared và lib; không import app hoặc component nội bộ của feature khác. Route chỉ compose. Chia sẻ OrderSummary/AddressFields qua public export nhỏ khi thật sự cần; tránh gom mọi domain vào shared. Không tạo một store mới cho mỗi màn hình và không cài query library trong đợt tích hợp này.

## Chuẩn hóa token và stylesheet

Nguồn hiện tại: styles/heritage.css:2–17; styles/store.css; components/home-identity.module.css. Nguồn thiết kế: ba bản 00_Thiet_ke_thuong_hieu/DESIGN.md. Các DESIGN.md có cả palette YAML và mô tả bằng prose khác nhau; lời khẳng định WCAG trong tài liệu thiết kế chưa phải kết quả đo.

| Vai trò | Hiện tại | Hướng tích hợp đề xuất |
|---|---|---|
| Primary | #563a26 | Giữ token --primary; thử #573722 của thiết kế sau duyệt hình ảnh |
| Canvas | #fcf9f4 | Ánh xạ --surface; thử #FBF7F0 |
| Ink | #2f241c | Giữ --ink, đo tương phản thực tế |
| Gold | #d4a24c | Accent, không mặc định dùng cho chữ nhỏ |
| Border | #e7ded4 | Một token border chung |
| Display font | Times New Roman trước Noto Serif | Chọn rõ serif; font tiếng Việt có fallback |

Token màu, spacing, radius, typography và z-index tập trung một nguồn. CSS Module cho từng feature/component; chỉ reset/token/utility thực sự chung ở global. Không chép selector body/h1/button của từng HTML vào global. Module home có :global nên vẫn phải kiểm tra cascade. Chuyển selector từng phần sau khi view mới đã tương đương; chưa xóa stylesheet cũ theo lịch cứng.

Design muốn Noto Serif + Be Vietnam Pro, góc vát, giấy ngà, line art. Đề xuất giữ control dễ đọc, focus rõ, target khoảng 44px, label/error liên kết bằng id, status không chỉ dựa màu. Không cắt outline/focus bởi clip-path góc vát. Font/Material Symbols từ Google trong HTML là phụ thuộc ngoài; chỉ chọn cách cung cấp hợp lệ sau khi kiểm tra tài nguyên, không chèn CDN runtime tùy tiện.

Responsive dùng container fluid và breakpoint theo nội dung; không thay đồng loạt 1050/760/680 bằng breakpoint Stitch 1200/768. Kiểm tra 360/390/768/1024/1440px, zoom 200%, văn bản dài, bảng quản trị và form nhiều dòng. Scroll ngang chỉ trong bảng khi cần; footer/sidebar không che thao tác.

## Quy tắc dữ liệu và tương tác

Mỗi primitive hỗ trợ disabled/busy/error/focus. Empty/loading/error/auth được giữ cho từng màn hình. Badge dùng mã trạng thái/label hiện tại, không tự dịch thành trạng thái mới. Formatter money/date tiếp tục tái sử dụng. Nội dung chính sách giữ nhãn dự thảo và dữ liệu phiên bản. Chỉ đưa CTA có handler/API thật vào bản tích hợp; thành phần ý tưởng ghi riêng trong backlog.

