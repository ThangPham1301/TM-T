# Gói Huế

Website bán hàng với Next.js, Spring Boot và PostgreSQL. Giao diện kế thừa phong cách màu nâu, vàng và nền giấy của bản trước. Tài khoản, sản phẩm, giỏ hàng, đơn hàng, quyền dữ liệu cá nhân và đổi trả dùng chung backend và database.

## Chạy chương trình

Hướng dẫn pull đúng nhánh, chạy đồng bộ giao diện và phân biệt dữ liệu local: [PULL_AND_RUN.md](docs/PULL_AND_RUN.md). Font tiếng Việt và ảnh giao diện Stitch đang sử dụng đã được đóng gói trong repository.

Mở Docker Desktop, mở PowerShell tại thư mục có file `compose.yml` rồi chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
docker compose up -d --build
```

Truy cập http://localhost:3000. ADMIN lấy từ `.env` ở thư mục gốc; CUSTOMER tự đăng ký tại `/register`. Không chia sẻ hoặc commit `.env`. Lần khởi tạo đầu có sáu sản phẩm, tồn bằng 0; ADMIN cập nhật giá và tồn thực tế tại `/admin/products` trước khi bán. Không tạo sẵn tài khoản khách hoặc đơn hàng. Mật khẩu chỉ seed một lần, thay `.env` không đổi mật khẩu đã lưu.

`docker compose stop` dừng hệ thống; `docker compose up -d` chạy lại. Không dùng `down -v` nếu muốn giữ dữ liệu. Xem log: `docker compose logs --tail=100 api web`.

## Chức năng hiện có

- Khách vãng lai: giỏ hàng theo trình duyệt, checkout COD hoặc VietQR demo, xác nhận và tra cứu tại `/tra-cuu-don-hang` bằng mã đơn và mã tra cứu riêng. Có thể gộp giỏ vào tài khoản sau khi đăng nhập. Khách gửi yêu cầu và đọc phản hồi tại chi tiết đơn đã xác minh. Admin xử lý yêu cầu trong hộp tiếp nhận `/admin/support`.

- CUSTOMER: đăng ký/đăng nhập, hồ sơ, lựa chọn tiếp thị, giỏ hàng lưu server; sửa số lượng/xóa/cập nhật giá, checkout COD theo phí giao cấu hình, tìm/lọc đơn, sửa người nhận trước đóng gói, hủy đơn khi đủ điều kiện, quyền dữ liệu và đổi trả từng dòng hàng.
- Mua lại: đơn đã giao, đã hủy, giao thất bại hoặc đã trả hàng có thể mở bước kiểm tra sản phẩm, số lượng và giá hiện tại. Món hết hàng/ngừng bán cần được bỏ chọn hoặc điều chỉnh rõ ràng. Xác nhận thay giỏ diễn ra trong một transaction; checkout điền sẵn người nhận cũ để khách chỉnh, không sửa hồ sơ hay sao chép thanh toán của đơn cũ. Đơn đang xử lý tiếp tục dùng nút thanh toán/theo dõi hiện có.
- ADMIN: CRUD sản phẩm và danh mục, upload/gỡ ảnh, ẩn/hiện, giá/tồn; cấu hình phí giao và ngưỡng miễn phí; tìm/lọc đơn, xác nhận/đóng gói/giao hàng, ghi nhận thu tiền với chứng từ, review quyền dữ liệu/đổi trả, kiểm hàng, ghi nhận kết quả đổi/hoàn bằng mã tham chiếu, chính sách có phiên bản và nhật ký.
- Máy chủ kiểm tra quyền sở hữu, số lượng, giá, tồn; sử dụng transaction, khóa chống gửi lặp và revision. Một phiên đăng nhập dùng trên toàn website.

Quy trình bán: sản phẩm → giỏ hàng → checkout → ADMIN xác nhận/đóng gói/giao → khách tạo đổi trả từ đơn đã giao. Quy trình dữ liệu: khách gửi yêu cầu → ADMIN xem xét/bổ sung → thực hiện và phản hồi. Xóa tài khoản chỉ được thực hiện sau khi đơn/yêu cầu đổi trả đang mở đã xử lý xong; phiên bị hủy, liên hệ và ảnh được xóa/ẩn danh, số liệu giao dịch và audit được giữ theo phạm vi thông báo.

Quản trị: `/admin/products`, `/admin/categories`, `/admin/settings`, `/admin/orders`. Sản phẩm có liên kết giỏ/đơn chỉ được ẩn; danh mục còn sản phẩm không xóa được. Phí ban đầu 30.000đ, chưa áp dụng ngưỡng miễn phí; chỉnh tại `/admin/settings`. Thay phí không đổi đơn cũ. Hợp đồng CRUD chi tiết: [catalog-commerce-crud.md](docs/03_api_specs/catalog-commerce-crud.md).

## Tổ chức source

```text
apps/
  web/                 Next.js, route, giao diện, StoreProvider, BFF
  api/                 Spring Boot, PlatformApi, CommerceApi, CatalogService/CatalogApi, Flyway
docs/
  03_api_specs/        API hợp nhất và tài liệu hợp đồng lịch sử
  audit_nguoi2/        Báo cáo audit tại thời điểm trước khi xây dựng lại
archive/legacy/        Source và cấu hình cũ, không tham gia build
compose.yml            Web + API + PostgreSQL + volume ảnh
setup.ps1              Tạo .env/mật khẩu ngẫu nhiên tại máy
HUONG_DAN_CHAY.txt     Hướng dẫn ngắn
```

Chi tiết: `PROJECT_STRUCTURE.md`; hợp đồng đang dùng: `docs/03_api_specs/goihue.openapi.yaml` và `goihue-state-matrix.md`. Hợp đồng cũ vẫn giữ để truy vết báo cáo, không đại diện cho API đang chạy.

## Phát triển frontend trên máy

```powershell
docker compose up -d --build db api
cd apps\web
npm.cmd ci
npm.cmd run dev
```

Nếu container web đang chiếm cổng 3000, chạy `docker compose stop web` trước. Frontend local mặc định gọi API loopback cổng 8088; tùy chỉnh bằng `apps/web/.env.local` theo `.env.example`. Build: `npm.cmd run build`; kiểm tra kiểu: `npm.cmd run typecheck`. Backend dùng Java 21/Maven trong Docker; build cấu hình bỏ qua test theo yêu cầu.

## Trạng thái tích hợp

Đây là chức năng của dự án chính, không còn module `/academic` hoặc Mockoon. Thanh toán gồm COD và VietQR demo. ADMIN cập nhật thu COD, hoàn tiền và giao vận thủ công dựa trên chứng từ. Website không tự chuyển tiền, gửi email/SMS hoặc tạo vận đơn với carrier. Không đánh dấu giao/thu/hoàn thành công khi chưa có chứng cứ thực tế.

Admin soạn, xem trước và công bố chính sách tại `/admin/policies`. Website và trợ lý mua sắm đọc cùng phiên bản đang công bố. Flyway V5 tạo hộp hỗ trợ khách vãng lai và nạp phiên bản 1.0 cho ba chính sách hiện có. Bản nháp quyền riêng tư cũ được giữ trong lịch sử Admin. Thời hạn lưu dữ liệu, SLA vận hành và nhà cung cấp chưa được xác nhận.

Ảnh catalog PNG/JPEG tối đa 5 MB được decode/re-encode PNG (tối đa 6000px mỗi chiều và 16 triệu pixel), lưu volume; ảnh chưa gắn catalog active chỉ ADMIN truy cập. Ảnh bằng chứng đổi trả được kiểm tra signature và tải theo quyền riêng. Chưa có antivirus/cleanup tự động. Chưa có quên mật khẩu/email verification, đánh giá sản phẩm, voucher/loyalty, B2B hay nhiều kho.

Cookie hiện dành cho localhost HTTP. Trước triển khai public cần HTTPS/Secure cookie, secret manager, backup, kiểm thử bảo mật và duyệt chính sách. Không chạy test nghiệp vụ trong lần xây dựng này theo yêu cầu người dùng; kết quả build được ghi trong bàn giao.

## Phục hồi bản cũ

Các thư mục cũ được chuyển vào `archive/legacy`, không xóa vĩnh viễn. Database/ảnh của Compose cũ `goi-hue-academic` giữ nguyên trong Docker volumes và đang dừng, tách khỏi volume `goihue` mới. Không tự nhập tài khoản/đơn giả lập cũ vào database mới. File cấu hình chứa secret được giữ local trong archive, vẫn bị `.gitignore` loại trừ.

## Kiểm tra luồng mua lại

Bộ kiểm tra dùng cơ sở dữ liệu Docker tách biệt, không sửa dữ liệu local/VPS. Không cần migration mới cho tính năng này; cần rebuild cả API và web.

```powershell
docker build -t goihue-api:reorder-review apps/api
docker build -t goihue-web:reorder-review apps/web
python scripts/test-reorder-demo.py --keep
npx @playwright/cli -s=reorder-qa open http://127.0.0.1:13098
npx @playwright/cli -s=reorder-qa run-code --filename=scripts/test-reorder-browser.js
```

Lệnh Python in tài khoản thử nghiệm và lệnh dọn stack khi chạy thành công. Chạy không có `--keep` để tự dọn dữ liệu sau kiểm tra API. Bộ kiểm tra bao gồm rollback khi lỗi giữa chừng, quyền sở hữu, trạng thái đơn, giá/tồn/ưu đãi/phí thay đổi, giỏ sửa từ tab khác, idempotency, xác nhận đồng thời và checkout tạo đơn mới với thanh toán riêng.

Kiểm chứng ngày 24/11/2026: build API/web và typecheck đạt; 36 kiểm tra API mua lại, 39 kiểm tra trình duyệt và 136 kiểm tra hồi quy agent đạt. Contract `goihue.openapi.yaml` hợp lệ với 11 cảnh báo. Lint frontend có 4 cảnh báo cũ, không có lỗi. Hai contract `customer-stable`/`admin-stable` không thay đổi trong tính năng này và vẫn còn 11/21 lỗi lint có sẵn; hai contract `draft-planned` hợp lệ.
