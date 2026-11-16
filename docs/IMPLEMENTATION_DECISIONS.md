# Quyết định triển khai Gói Huế

Mốc 16/11/2026, nền `feat/account@6271fbc`, nhánh triển khai `integration/goi-hue-completion`.

| Quyết định | Hành vi thực hiện |
|---|---|
| D01 · Hủy và hết hạn | Đơn VietQR chưa đóng gói có thể hết hạn. Hủy thủ công đóng phiên PENDING cùng transaction với hoàn tồn. Tiền đến sau hủy chuyển REVIEW. Dùng khóa transaction chung hiện có để tuần tự hóa mutation, webhook và sweep. |
| D02 · Vào kho vận | VietQR cần PAID trước PACKED/SHIPPED. COD giữ bước đóng gói/giao trước khi thu. ADMIN ghi nhận thu VietQR qua đối soát có chứng từ. |
| D03 · Hàng giao thất bại | Nhận hàng về ở trạng thái QUARANTINED. Tồn bán giữ nguyên cho đến khi có kết luận QC theo D09. |
| D04 · Mua lại và E2 | Mua lại thay toàn bộ giỏ sau khi mọi dòng hợp lệ. Hết hạn VietQR phục hồi các dòng còn thiếu theo giá snapshot để khách xác nhận chênh lệch. Giữ lựa chọn hiện có của khách nếu cùng sản phẩm đã có trong giỏ. |
| D05 · Địa chỉ | Checkout ưu tiên địa chỉ mặc định, sau đó địa chỉ duy nhất. Chọn nhập tay có hiệu lực trong phiên checkout hiện tại. |
| D06 · Cấu hình demo | Seed khách mẫu và IPN mô phỏng mặc định tắt. Môi trường HTTPS bật cờ Secure cho cookie. Cơ sở dữ liệu đã seed cần rà tài khoản mẫu trước khi triển khai. |
| D07 · Đối soát | Lưu giao dịch đã xác thực theo nguồn và mã giao dịch kể cả khi đơn đang REVIEW hoặc đã hoàn. Phát lại cùng mã được bỏ qua. Hai mã đã ghi trong snapshot cũ được nhận diện khi phát lại sau migration. |
| D08 · COD 24 giờ | Đơn COD mới chờ khách xác nhận trong trang Đơn hàng. ADMIN đóng gói sau xác nhận. Đơn quá hạn tự hủy, hoàn tồn và khôi phục các dòng thiếu trong giỏ. Chính sách mới áp dụng cho đơn có hạn xác nhận. |
| D09 · QC hàng hoàn E5 | Kiểm bao bì và chất lượng trước khi nhập lại. Admin nhập biên bản và số lượng đạt riêng từng dòng, mặc định 0. Chỉ cộng số lượng đạt một lần. Nhận hàng về độc lập với trạng thái tiền; admin ghi nhận hoàn tiền bên ngoài theo chứng từ. Đơn RETURNED cũ thiếu dấu cách ly giữ nguyên để tránh nhập tồn hai lần. |
| D10 · Tồn kho FEFO | Sau khi bật quản lý theo lô ở một sản phẩm, tồn bán được tính từ lô đủ điều kiện theo ngày Việt Nam. Còn đúng 75% hạn dùng được cấp. Khi nhập lô, nhân viên ghi riêng phần đã tính trong tồn cũ; số cũ chưa đối chiếu nằm ngoài tồn bán. Đơn giữ phân bổ theo lô, hủy hoặc hết hạn trả đúng lô. QC hàng hoàn ghi số lượng đạt theo từng lô; lô dưới ngưỡng vẫn nằm ngoài tồn bán. Sản phẩm chưa bật theo lô và đơn cũ giữ tương thích với dữ liệu tồn trước đây. |

| D11 · Soạn và QC trước đóng gói | Phiếu soạn hiển thị theo đơn. QC gồm kết cấu, mùi, bao bì và đủ hàng; QC không đạt có thể cách ly lô đã xác định. Cấp lại chỉ thay lô bị cách ly hoặc dưới ngưỡng theo FEFO rồi xóa QC cũ. Đơn mới và đơn có phân bổ lô cần QC đạt mới được đóng gói. Cổng PACKED/SHIPPED kiểm tra lại hạn dùng và trạng thái cách ly. Có thể mở lại PACKED chưa bàn giao để soạn lại. |

| D12 · Đóng gói xanh và live-packing | Đơn mới cần checklist 6 bước và một ảnh hợp lệ để chuyển PACKED. 180 giây là mục tiêu thao tác. Ảnh được chuẩn hóa PNG, gắn đúng revision và chỉ hiển thị sau khi kết thúc đóng gói cho chủ đơn và admin. Mở lại đơn hoặc xóa dữ liệu tài khoản xử lý ảnh cũ. Đơn cũ giữ luồng trước đây. Hiện nhân viên tải ảnh thủ công, Zalo ZNS và camera AI cần tích hợp riêng. |
| D13 · Ghép giao diện | Nhánh thử `qa/goi-hue-lan-integration` lấy trang chủ, bộ sưu tập, chi tiết sản phẩm, admin sản phẩm và admin danh mục của Lân. Giữ StoreProvider, header/footer dùng chung, font đã đóng gói, thanh toán và luồng kho. Trên admin sản phẩm/danh mục dùng thanh quản trị của Lân và bổ sung đường dẫn đến kho. Sản phẩm quản lý theo lô hiển thị tồn chỉ đọc trong form danh mục sản phẩm. |

## Hạng mục còn phải nghiệm thu

- Chạy đầy đủ kịch bản hậu mãi, SePay Test mode và nâng cơ sở dữ liệu đang có từ V2 lên V3.
- Nghiệm thu kho, phiếu soạn, QC và đóng gói trên trình duyệt. Tiếp tục thiết bị bàn giao, tự động hóa live-packing/ZNS và kết nối trạng thái nhà vận chuyển.
- Đưa kết quả ghép giao diện từ worktree thử vào nhánh hoàn thiện khi các bước nghiệm thu còn lại đã đạt.
- Chốt catalog sản phẩm và quy cách quà, sau đó triển khai các tích hợp carrier, hoàn tiền, liên lạc và đo lường theo hợp đồng vận hành. Hợp đồng và thông tin xác thực cho dịch vụ thật cần được cung cấp trước khi nghiệm thu tích hợp.

## Kết quả kiểm tra ngày 16/11/2026

- Maven test đạt 13/13 ca. Bốn ca VietQR phủ thông báo đến sau hủy, đến sau hạn trước sweep, đến đúng hạn và sự kiện trùng. Ba ca COD phủ xác nhận trước hạn, đúng lúc hết hạn và đơn cũ. Ba ca QC hàng hoàn phủ nhập lại một phần, từ chối số lượng vượt và loại toàn bộ. Hai ca soạn hàng phủ gộp phân bổ khi cấp lại cùng lô và cổng QC/hạn dùng trước đóng gói. Một ca SOP kiểm đủ bước và ảnh đúng revision. Các ca này sử dụng JDBC mô phỏng.
- Next.js production build, kiểm tra kiểu, Docker Compose config và git diff --check đạt. ESLint còn 4 lỗi React từ nền cũ.
- PostgreSQL 16.15 trong Compose project riêng `goihue-cod-qa` và Spring Boot tại cổng 8098 đã chạy. Flyway áp dụng V1–V3 trên database mới.
- Trên HTTP và PostgreSQL thật, xác nhận COD đã chặn quản trị tiến trạng thái trước xác nhận, cho đóng gói sau xác nhận và hết hạn tự hủy, khôi phục giỏ, hoàn tồn đúng một lần qua nhiều lượt sweep. Hạn được đẩy về quá khứ trên dữ liệu thử để kiểm tra mà không chờ 24 giờ.
- VietQR IPN mô phỏng trên PostgreSQL thật đạt hủy đơn, nhận tiền muộn về REVIEW và bỏ qua phát lại. Đơn vẫn CANCELLED và tồn giữ đúng số lượng. Ca này dùng IPN local, SePay Test mode còn chờ.
- E5 qua HTTP và PostgreSQL thật đạt ca VietQR đã trả tiền: xác nhận giao thất bại, nhận về và cách ly, chặn khách làm QC, từ chối số lượng vượt, nhập lại 1/2 sản phẩm, từ chối xử lý lại và ghi nhận chứng từ hoàn tiền ngoài hệ thống. Tồn kiểm tra theo chuỗi 10 → 8 → 8 → 9 → 9. Giao diện admin đạt production build, luồng QC trong trình duyệt còn chờ nghiệm thu.
- Mở lại PostgreSQL đang ở V3 và khởi động Spring Boot đã áp dụng thành công V4. Ca FEFO qua HTTP tạo ba lô; lô dưới ngưỡng có 6 đơn vị vẫn nằm ngoài tồn bán. Đặt 4 đơn vị lấy 2 từ lô gần hạn rồi 2 từ lô kế; hủy trả về đúng lượng từng lô. Đơn khác qua giao thất bại và QC, chỉ 1 đơn vị đúng lô được cộng lại. API danh sách lô từ chối phiên khách. Trang kho và form QC theo lô đạt production build.
- PostgreSQL áp dụng V5 trên database thử V4. Ca HTTP chặn đóng gói trước QC, cách ly lô lỗi khi QC không đạt, kiểm tra rollback cả tồn và phân bổ khi thiếu hàng cấp lại. Sau khi bổ sung lô và QC đạt, đơn đóng gói được. Giả lập lô xuống dưới ngưỡng ở dữ liệu thử chặn bàn giao; mở lại, cấp lô mới và QC lần nữa thì bàn giao thành công. Form QC và phiếu soạn đạt production build; thao tác qua trình duyệt còn chờ nghiệm thu.
- PostgreSQL áp dụng V6 trên database thử V5. Ca HTTP dùng ảnh PNG tổng hợp, từ chối khách tải ảnh, ảnh không hợp lệ, revision cũ và thiếu bước; chủ đơn/admin đọc được ảnh sau khi đóng gói, khách khác không đọc được. Mở lại đơn làm ảnh cũ hết hiệu lực; tải ảnh mới và đóng gói lại đạt. Build Next.js đạt; chưa thử thao tác tải ảnh qua trình duyệt và chưa gửi ZNS thật.
- Bản ghép dùng snapshot `29ed381` và đầu nhánh Lân `26c95a0`. Build production và 13 ca Maven đạt. Bộ Playwright của Lân đạt với API giả lập. Ca trình duyệt nối Spring Boot/PostgreSQL đạt trang chủ, lọc bộ sưu tập, chi tiết thêm giỏ đúng số lượng, cập nhật giá và thứ tự danh mục lưu thật, chặn khách vào quản trị và điều hướng Kho theo lô. Trang Đơn hàng đã nối lại panel VietQR và kiểm tra mã QR trên liên kết từ đơn.
- Chạy lại kiểm thử trình duyệt trên database local thử với Next.js ở cổng 3000. Cài Playwright trong môi trường QA và cung cấp `ADMIN_EMAIL`, `ADMIN_PASSWORD`; từ `apps/web` chạy `node tests/lan-ui.mjs` và `node tests/storefront-integration.mjs`. Bài thứ hai tạo khách, danh mục, sản phẩm và đơn mới trong database thử.
- Maven package gặp lỗi reset kết nối khi tải phụ thuộc plugin đóng gói. API thử nghiệm được chạy từ các lớp Maven đã biên dịch.
