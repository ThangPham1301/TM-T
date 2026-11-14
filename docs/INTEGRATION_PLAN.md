# Integration Plan

Rà soát source frontend và HTML thiết kế ngày 14/11/2026. Đây là phân tích tĩnh; chưa chạy kiểm thử trình duyệt hay xác nhận bảo mật backend. ĐÃ CÓ = có mã triển khai; ĐỀ XUẤT = công việc tích hợp tương lai; không coi HTML tĩnh là bằng chứng nghiệp vụ đã hoạt động.

## Tích hợp HTML/CSS và tài nguyên

Đọc code.html như đặc tả presentation. Chuyển từng section thành JSX: class → className, for → htmlFor, style thành object/CSS Module, input có label, key ổn định, button có type, liên kết nội bộ dùng Link. Bỏ document/head/body lồng và script/config runtime; không dùng dangerouslySetInnerHTML để nhúng nguyên trang. Các class utility trong HTML phải được chuyển thành CSS đang có/CSS Module; package hiện không có Tailwind, không giả định CDN sẽ có trong production.

Lắp component hiển thị vào controller hiện tại; nối lại giá/tồn/đơn/ảnh qua props, giữ event handler, action, revision, cartToken và Idempotency-Key. Không lấy giá, phí, trạng thái, mã đơn hoặc email demo trong HTML làm dữ liệu thật. Giữ tất cả nhánh loading/empty/error/401/403; thiết kế thường chỉ thể hiện trạng thái thành công.

Đề xuất public/images/brand và public/images/decorations cho tài nguyên tĩnh đã duyệt; sản phẩm/evidence tiếp tục dùng URL có quyền truy cập từ API. Không copy chứng cứ khách vào public. Lập manifest asset gồm nguồn, quyền sử dụng, tên đích, kích thước, alt, màn hình sử dụng. Giữ UI_Figma nguyên bản tham chiếu. Kiểm tra ảnh ngoài, SVG và font trước khi đưa vào runtime; tải/lưu chỉ khi có quyền và cần thiết trong giai đoạn triển khai sau. Next image remotePatterns trong next.config.mjs cần đối chiếu nếu dùng next/image; giữ resolver/fallback hiện có. Khai báo kích thước/aspect-ratio chống nhảy layout, lazy-load dưới màn hình đầu, trang trí alt rỗng.

## Kế hoạch theo đợt

| Đợt | Công việc đề xuất | Cửa kiểm tra trước chuyển đợt | Rollback |
|---|---|---|---|
| 0 | Chốt 23 mapping, baseline ảnh/UI và network trong môi trường có dữ liệu thử; ghi commit SHA | Có baseline mọi vai trò và trạng thái | Chưa thay ứng dụng |
| 1 | Token, Field/Button/Badge, shell tái sử dụng; thử một trang ít rủi ro | Không ảnh hưởng route khác, focus/mobile đạt | Revert commit primitive/skin |
| 2 | Home, privacy-policy, return-policy | Link, API policy, nhãn dự thảo, ảnh fallback | Trả import view cũ |
| 3 | Catalog list/detail | Query URL, tồn kho, số lượng, login khi thêm giỏ | Revert view catalog |
| 4 | Login/register, profile/addresses/security | Cookie, 401/role, đổi mật khẩu/consent và revision | Revert view; giữ dữ liệu backend |
| 5 | Cart/checkout | Giá/tồn đổi, giỏ trống, cartToken hết hiệu lực, double submit, COD | Revert view checkout, không tạo lại đơn |
| 6 | Customer orders/returns/privacy | Hủy/sửa đủ điều kiện, nhiều dòng, ảnh/bổ sung/export | Revert presentation theo feature |
| 7 | Admin catalog/settings/orders | Role, revision conflict, upload, chuyển trạng thái/chứng từ | Revert từng màn hình |
| 8 | Admin returns/privacy/policies/audit; rà soát toàn bộ | State machine, dữ liệu riêng tư, lịch sử và hồi quy | Revert từng commit đã xác định |

Mỗi commit chỉ một feature hoặc một lớp presentation; không trộn đổi tên hàng loạt và đổi behavior. Có thể giữ view cũ qua adapter trong thời gian chuyển tiếp, dùng công tắc build nội bộ nếu cần; không bắt buộc dựng thêm route demo. Không xóa view cũ trước khi feature mới qua kiểm tra. Rollback dùng revert commit trên nhánh tích hợp, không reset hard và không đụng dữ liệu. Request nghiệp vụ đã thành công vẫn tồn tại sau rollback UI; không dùng rollback giao diện để đảo đơn/hoàn tiền.

## Ma trận kiểm tra đề xuất

- Static: npm.cmd run typecheck, npm.cmd run lint, npm.cmd run build tại apps/web, dùng package đã cài. Ghi baseline lỗi có sẵn riêng, không gán lỗi cũ cho migration.
- Trình duyệt: 360/390/768/1024/1440px; bàn phím, tab/focus, zoom, tiếng Việt dài, ảnh lỗi và reduced-motion.
- Session: guest/CUSTOMER/ADMIN; truy cập URL trực tiếp, hết phiên trong form, 401/403; không chớp nội dung quản trị cho khách.
- Commerce: thêm/cập nhật/xóa giỏ, hết hàng/đổi giá, phí giao, địa chỉ mới/cũ, COD một đơn dù click lặp/retry, redirect mở đúng đơn.
- Đơn/đổi trả: trạng thái không hợp lệ, revision cũ, mã vận đơn/chứng từ bắt buộc, nhiều dòng, ảnh sai loại/quá dung lượng, bổ sung evidence và mở ảnh trực tiếp; quyền xem evidence/export.
- Mạng: mất kết nối/503/timeout; WebSocket mất và reconnect; lỗi không làm mất nội dung form. Đối chiếu request payload trước/sau, không chỉ chụp ảnh giao diện.
- Contract: nếu thay đổi trạng thái UI, cập nhật state matrix liên quan theo AGENTS.md khi triển khai; thay đổi API phải có contract riêng. Kế hoạch hiện tại không cần thay API.

## Rủi ro và thứ tự xử lý

| Ưu tiên | Rủi ro/bằng chứng | Cách xử lý khi triển khai |
|---|---|---|
| P0 | Mất action/revision/cartToken khi thay markup: account.tsx, cart.tsx | Inventory handler, tách view trước, smoke nghiệp vụ |
| P0 | Role guard FE bị hiểu là bảo vệ thật: account.tsx, catalog-admin.tsx | Giữ backend authorization; kiểm tra cả URL trực tiếp/API trong môi trường test |
| P0 trước deploy khác localhost | Proxy write allowlist HTTP: app/api/store/[...path]/route.ts | Xác nhận domain/HTTPS, xử lý trong task cấu hình được duyệt |
| P1 | WebSocket cố định 8088: lib/store.tsx | Xác định topology trước deploy, kiểm tra realtime/fallback |
| P1 | Global CSS ghi đè rộng: heritage.css/store.css, module :global | Namespace/module, token một nguồn, visual regression |
| P1 | Row unknown và state snapshot lớn: lib/store.tsx | DTO hẹp theo feature, adapter tăng dần, không đổi schema |
| P1 | Upload catalog/evidence khác quyền và endpoint | Shared picker, service riêng; không public hóa evidence |
| P1 | Data demo/control tĩnh Stitch bị coi đã triển khai | Map từng control với handler/API, giữ backlog rõ |
| P2 | Font/CDN/ảnh ngoài, layout nhảy và accessibility | Manifest, fallback, kích thước, đo contrast thực tế |

## Điều kiện hoàn thành migration

23 màn hình dùng cùng shell/token/primitive đã thống nhất, URL giữ nguyên; dữ liệu thật và nghiệp vụ cũ hoạt động qua ma trận trên; không có CTA giả; desktop/mobile đạt review; mỗi đợt có commit rollback và kết quả kiểm tra. Đây là tiêu chí đề xuất cho công việc tiếp theo, chưa phải kết quả kiểm thử đã chạy.

