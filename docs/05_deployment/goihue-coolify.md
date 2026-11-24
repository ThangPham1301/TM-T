# Triển khai Gói Huế bằng Coolify

Ứng dụng dùng Docker Compose với ba service `web`, `api`, `db`. Repository đã có `compose.coolify.yml` chứa cấu hình HTTPS, WebSocket, chatbot và dữ liệu bền vững. Domain dự kiến là `https://goihue.io.vn`.

## 1. Tạo ứng dụng trên Coolify

1. Đưa commit đã kiểm tra lên Git và chọn đúng repository/branch trong Coolify.
2. Trong project/environment, tạo Application từ Git và chọn Build strategy **Docker Compose**. Một số phiên bản giao diện gọi mục này là Build Pack.
3. Đặt Base Directory thành `/` và Docker Compose Location thành `/compose.coolify.yml`.
4. Lưu và kiểm tra phần Compose đã phân tích có đủ `web`, `api`, `db` cùng hai volume `database`, `evidence`.

Đường dẫn build được tính từ Base Directory. Cấu hình này đã khai báo toàn bộ environment của từng service trong cùng file. [Hướng dẫn Compose của Coolify](https://coolify.io/docs/applications/builds/docker-compose)

## 2. Domain, HTTPS và WebSocket

Trong DNS của `goihue.io.vn`, tạo bản ghi A cho `@` trỏ tới IPv4 của VPS chạy ứng dụng. Trong phần Domains của Coolify, thêm HTTPS, hostname `goihue.io.vn`, service **web**, internal port **3000**. Với giao diện dùng một ô URL, nhập `https://goihue.io.vn:3000`. Khách truy cập bằng `https://goihue.io.vn`.

Cho phép TCP 80/443 đến proxy của Coolify và bật chuyển HTTP sang HTTPS. Coolify sử dụng domain/service/port để tạo route đến container. [Cấu hình domain của Coolify](https://coolify.io/docs/core/networking/domains), [Cấu hình port nội bộ](https://coolify.io/docs/applications/configuration/general)

Kiểm tra ngày 19/11/2026 lúc 16:22 (GMT+7): DNS đã phân giải qua Cloudflare nhưng HTTPS trả 530 với body `error code: 1033`. Cloudflare giải thích mã 1033 là không tìm thấy connector tunnel khỏe để nhận request. Khi chuyển sang VPS/Coolify dùng route trực tiếp, thay bản ghi `@` đang phục vụ tunnel bằng A trỏ IPv4 VPS. Nếu giữ tunnel, cần connector chạy trên VPS và route tới proxy/service đúng cổng. Trạng thái này là quan sát trước deploy, cần kiểm tra lại sau mỗi lần đổi DNS. [Cloudflare error 1033](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/common-errors/#i-see-an-error-1033-when-attempting-to-run-a-tunnel)

Trình duyệt kết nối `wss://goihue.io.vn/api/store/live`. Next.js chuyển WebSocket vào `http://api:8088/api/store/live`, giữ cookie và Origin. Backend gửi ping định kỳ để giữ kết nối qua proxy và đóng phiên đã bị thu hồi. Cookie có `Secure`, `HttpOnly`, `SameSite=Strict`, path `/api/store`.

Public service là `web`. API và PostgreSQL được các container truy cập bằng DNS nội bộ `api`/`db`. Volume `database` giữ PostgreSQL và `evidence` giữ ảnh upload qua các lần redeploy.

## 3. Nhập Environment Variables của Application

Các giá trị dưới đây là tên biến và mẫu cấu hình. Nhập giá trị thật vào Environment Variables của ứng dụng trên Coolify.

| Biến | Giá trị/cách lấy |
| --- | --- |
| `DB_PASSWORD` | Mật khẩu riêng cho database của deployment này, tạo ngẫu nhiên ít nhất 32 ký tự |
| `ADMIN_EMAIL` | Email tài khoản quản trị bạn muốn tạo lần đầu |
| `ADMIN_PASSWORD` | Mật khẩu quản trị ban đầu, tối thiểu 12 ký tự |
| `APP_PUBLIC_ORIGINS` | `https://goihue.io.vn` |
| `APP_BANK_BIN` | BIN ngân hàng của tài khoản thử nghiệm, ví dụ MB là `970422`; kiểm tra lại theo tài khoản đã chọn |
| `APP_BANK_ACCOUNT` | Số tài khoản nhận đã chọn trong SePay Test mode, giữ cả số 0 đầu |
| `APP_BANK_NAME` | Tên chủ tài khoản hiển thị trong QR, ví dụ `GOI HUE` |
| `APP_SEPAY_SECRET` | Secret Key của webhook **HMAC-SHA256** trong SePay |
| `APP_AGENT_PROVIDER` | `auto` để dùng Bedrock và có fallback; `deterministic` để dùng công cụ theo luật |
| `APP_BEDROCK_REGION` | `ap-southeast-2` theo cấu hình model hiện tại |
| `APP_BEDROCK_MODEL` | `amazon.nova-lite-v1:0` |
| `AWS_ACCESS_KEY_ID` | Access key ID của IAM identity được cấp quyền gọi model |
| `AWS_SECRET_ACCESS_KEY` | Secret access key đi cùng access key ID trên cùng một cặp credentials |
| `AWS_SESSION_TOKEN` | Bắt buộc nếu dùng credentials tạm thời; để trống nếu dùng cặp IAM access key dài hạn |
| `NEXT_PUBLIC_RECOMMENDATIONS_ENABLED` | `true` |
| `NEXT_PUBLIC_AI_CHAT_ENABLED` | `true` |
| `APP_PAYMENT_TTL_MINUTES` | `15` |
| `APP_PAYMENT_SWEEP_MS` | `60000` |

`compose.coolify.yml` bật `APP_COOKIE_SECURE=true`. Các biến AWS và SePay nằm trong environment của API. Hai biến `NEXT_PUBLIC_*` được truyền bằng build args, nên cần rebuild web khi thay đổi. [Environment của Application Compose](https://coolify.io/docs/applications/builds/docker-compose#environment-variables)

Database mới khởi tạo admin một lần. Khi database đã tồn tại, đổi `ADMIN_PASSWORD` trong Coolify giữ nguyên mật khẩu đang lưu. Dùng chức năng đổi mật khẩu của tài khoản. Tương tự, PostgreSQL dùng mật khẩu tạo volume ban đầu, việc đổi biến môi trường cần phối hợp đổi mật khẩu trong database.

Database mới seed admin và sáu sản phẩm với tồn bằng 0. Vào `/admin/products` để chuẩn bị tồn/giá, rồi tạo đơn phục vụ demo. Việc mang dữ liệu local sang VPS thực hiện bằng backup/restore PostgreSQL và volume ảnh.

## 4. AWS access key và secret access key

Nếu VPS dùng IAM role/credentials tạm thời, ưu tiên cách đó. Nếu nhập cặp key vào Coolify, dùng IAM user riêng cho ứng dụng. Trên AWS Console mở IAM → Users → chọn user → Security credentials → Create access key, rồi lưu **Access key ID** và **Secret access key** vào hai biến tương ứng. Secret chỉ có thể lấy lúc tạo. Credentials tạm thời còn cần session token và có thời hạn. [AWS IAM access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

Code dùng Bedrock Converse API qua AWS SDK. Quyền gọi model là `bedrock:InvokeModel`. Với cấu hình Nova Lite hiện tại có thể giới hạn policy vào đúng model/region sau.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:ap-southeast-2::foundation-model/amazon.nova-lite-v1:0"
  }]
}
```

Nếu thay sang inference profile/model khác, điều chỉnh resource theo target thực tế. Quyền này áp dụng cho Converse đang dùng. [Quyền inference của Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/inference.html)

Sau deploy, hỏi trợ lý “Tìm quà cho mẹ dưới 200k và phí ship”. Đầu widget hiện **Bedrock · Gọi công cụ** khi model hoạt động. **Chế độ theo luật** cho biết request đã dùng đường dự phòng. Kiểm tra region/model, quyền IAM và thời hạn session token nếu đang cần trình diễn model tự chọn công cụ.

## 5. Secret webhook SePay

Trong SePay chọn **Test mode**, tạo/chọn tài khoản ngân hàng thử nghiệm rồi tạo webhook với URL sau.

```text
https://goihue.io.vn/api/store/payments/sepay/webhook
```

Chọn payload JSON, giao dịch tiền vào và đúng tài khoản đã đưa vào `APP_BANK_ACCOUNT`. Tại bước bảo mật chọn **HMAC-SHA256**, tạo một Secret Key và nhập cùng giá trị đó vào `APP_SEPAY_SECRET` trên Coolify. Redeploy API sau khi lưu biến.

SePay gửi `X-SePay-Signature: sha256=...` và `X-SePay-Timestamp`. Server tính HMAC trên chuỗi `timestamp.raw_body` và kiểm tra cửa sổ 5 phút. Route BFF chuyển nguyên bytes body cùng hai header này. Phương thức API Key của SePay dùng header Authorization riêng, còn triển khai này dùng HMAC. [Xác thực webhook SePay](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc)

Backend kiểm tra số tiền và tài khoản nhận theo snapshot của đơn. Một transaction ID được dùng cho một đơn, kể cả reference trong giao dịch bổ sung cũ. Khoản đầu sai tiền hoặc đến muộn chuyển đối soát và chỉ cho ghi nhận hoàn. Nếu đã thu đủ tiền rồi nhận thêm, đơn giữ `PAID`, khoản bổ sung vào `payment.extraPayments` với trạng thái `REVIEW`; nhân viên ghi nhận hoàn đúng khoản bằng `EXTRA_REFUNDED`. Phản hồi HTTP 200 có `success=true` xác nhận đã xử lý delivery, trạng thái đơn vẫn phải được kiểm tra riêng. Sau deploy, mô phỏng giao dịch trong SePay và xác nhận delivery log lẫn trạng thái đơn trên website. [Tạo webhook Test mode](https://developer.sepay.vn/vi/tien-ich-khac/test-mode/tao-webhook), [Quy tắc tích hợp webhook](https://docs.sepay.vn/tich-hop-webhooks.html)

VietQR trên giao diện đang mang nhãn demo. Các kiểm tra tự động dùng giao dịch mô phỏng có chữ ký. Giao vận, thu COD và hoàn tiền được quản trị viên ghi nhận theo chứng từ.

## 6. Kiểm tra sau deploy

1. Mở trang chủ bằng HTTPS. Đăng ký một tài khoản CUSTOMER và tải lại trang để kiểm tra phiên đăng nhập.
2. Trong Developer Tools → Network → WS, xác nhận `/api/store/live` trả 101 và URL bắt đầu bằng `wss://goihue.io.vn/`.
3. Đặt đơn COD và xác nhận đơn xuất hiện ở tài khoản khách lẫn trang quản trị.
4. Đặt đơn VietQR, mô phỏng giao dịch SePay đúng số tiền/tài khoản/nội dung. Xác nhận webhook thành công và giao diện tự đổi trạng thái thanh toán.
5. Chat với model, bật consent, tải lại trang và kiểm tra hội thoại/memory. Rút đồng ý rồi kiểm tra dữ liệu tương ứng đã xóa.
6. Redeploy thử và xác nhận đơn/ảnh vẫn tồn tại trong hai volume. Cấu hình backup database/volume trong công cụ vận hành đang dùng.

Nếu domain chưa truy cập được, kiểm tra DNS và chứng chỉ HTTPS trước. Nếu WSS bị đóng, kiểm tra domain port 3000, Origin, cookie và cấu hình Upgrade của proxy. Nếu chatbot trả theo luật, kiểm tra provider và AWS credentials. Nếu SePay trả 401, đối chiếu secret, timestamp và raw body trong delivery log.

## 7. Chạy kiểm tra trước khi merge

### GA4 build configuration

`NEXT_PUBLIC_GA_ENABLED=false` by default. After the GA4 property and QA filters are verified, set `NEXT_PUBLIC_GA_ENABLED=true` and `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-06239FHPPM` as build variables and rebuild the web image. Dockerfile, local Compose override and Coolify Compose pass these values to `next build`; runtime-only changes are insufficient.

Before enabling Google requests, disable Enhanced Measurement for the stream (including automatic history pageviews, site search and form interactions), register custom definitions from the measurement plan and verify the Developer traffic Exclude filter. `?ga_debug=1` enables per-browser debug for QA; it does not itself exclude events. Never enable debug for all production visitors. Google Signals and ad personalization are not used.

Local automated QA can use `?ga_capture=1` on localhost with GA enabled and a synthetic measurement ID. It records only allowlisted events in `window.__goiHueAnalytics`, does not load the Google script and persists capture mode for that tab. Clearing `goihue:ga4:capture` in sessionStorage ends capture after reload. This is local evidence, not DebugView verification. GA also honors Do Not Track and a denied `goihue:analytics-consent` preference; this does not claim a complete consent-management UI.

Run `npm run test:analytics` and `npm run test:analytics:browser` in `apps/web`. The browser suite starts its own ephemeral localhost server, intercepts all API calls with synthetic fixtures and closes its owned processes. Install Playwright Chromium first if absent; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing local headless Chromium. Backend checks: `python scripts/test-ga4-backend.py` uses the existing Maven cache after the normal API package build. See `docs/04_testing/ga4/acceptance.md` for real-database and Google acceptance gates.

```powershell
docker build -t goihue-api:system-review apps/api
docker build -t goihue-web:system-review apps/web
docker pull nginx:alpine
python scripts/test-system-demo.py
```

Script dựng một reverse proxy HTTPS và database riêng với dữ liệu mô phỏng, kiểm tra WSS và luồng mua hàng/thanh toán qua BFF. `--keep` giữ stack để kiểm tra bằng trình duyệt. OpenSSL và Python 3.11+ cần có trên máy chạy script. Bộ kiểm tra chuyên biệt cho AI và consent nằm trong `scripts/test-agent-demo.py`.

Kiểm tra checkout bằng trình duyệt: giữ fixture với `python scripts/test-system-demo.py --keep`, mở Playwright CLI vào `https://127.0.0.1:13443/register` bằng context chỉ bỏ kiểm chứng chứng chỉ cho fixture tự ký này, rồi chạy `npx @playwright/cli -s=system-https run-code --filename=scripts/test-checkout-browser.js`. Script chỉ hoạt động ở fixture localhost, tự đăng ký tài khoản mô phỏng, đặt VietQR từ UI, kiểm QR tự mở và callback cập nhật PAID qua WSS mà không tải lại trang. Ảnh kết quả nằm tại `output/playwright/checkout-paid-https.png` và không đưa vào Git. Kết thúc, dùng lệnh cleanup in bởi fixture để xóa stack kiểm thử riêng.
