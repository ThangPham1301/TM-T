# Gói Huế — kiểm tra trước deploy

Ngày kiểm tra: 19/11/2026. Mục tiêu: demo trên Coolify với domain dự kiến `goihue.io.vn`. Đã tích hợp với `main` tại `6d15715`, giữ nghiệp vụ COD/VietQR và giao diện heritage của main cùng AI/consent và các kiểm tra webhook từ nhánh demo. Cần push merge commit để Coolify lấy đúng phiên bản.

## Kết luận

Các luồng demo chính đã chạy thành công trên container build từ source hiện tại, qua reverse proxy HTTPS, frontend BFF và database riêng. Đã chuẩn bị `compose.coolify.yml` với web/API/PostgreSQL, cookie Secure, WSS và volume dữ liệu/ảnh.

Domain đang trả Cloudflare 530 với body `error code: 1033` tại 16:22 GMT+7. DNS đã phân giải qua Cloudflare; cần xử lý route tunnel hoặc chuyển DNS sang VPS trước khi kiểm tra deployment công khai. Theo [Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/common-errors/#i-see-an-error-1033-when-attempting-to-run-a-tunnel), 1033 là không tìm thấy connector tunnel khỏe để nhận traffic.

## Thay đổi từ lần rà soát này

| Vấn đề | Xử lý |
| --- | --- |
| Browser ép cổng WebSocket thành 8088 | Dùng protocol/host/public port của trang; Next rewrite chuyển upgrade tới API nội bộ |
| Kết nối WS nhàn rỗi/phiên bị thu hồi | Ping định kỳ và kiểm tra lại session; thu hồi thì đóng socket |
| Cookie thiếu Secure trên deployment HTTPS | Thêm APP_COOKIE_SECURE; bật trong compose dành cho Coolify |
| Webhook SePay chưa đi được qua BFF công khai | Thêm exact route POST, giữ raw body và header HMAC, giới hạn 64KiB; không yêu cầu browser Origin/session |
| Thông báo ngân hàng cần kiểm tra tài khoản/transaction | Đối chiếu tài khoản snapshot, đọc VND integer hoặc decimal .0, ledger chống dùng transaction ID cho hai đơn, kiểm cả reference cũ |
| Ghi nhận thủ công có thể bỏ qua luồng VietQR | order-paid chỉ bổ sung chứng từ COD đã giao; VietQR dùng webhook hoặc payment-resolve. Đối soát khoản chính cũ hợp lệ hoàn tất payment.status=RESOLVED_PAID |
| Tiền chuyển thêm làm cả đơn PAID bị chuyển REVIEW | Giữ PAID của khoản chính; đối soát và hoàn từng khoản trong payment.extraPayments. Chống dùng lại transaction ID cả với extraPayments cũ |
| Giao COD và ghi nhận thu tách rời | Giao COD thành công ghi nhận đúng số tiền phải thu và chứng từ trong cùng transaction; sai tiền rollback cả hai |
| VietQR chưa thu tiền vẫn có thể vào giao vận | Chặn PACKED/SHIPPED/DELIVERED đến khi PAID |
| Số điện thoại toàn dấu vẫn được chấp nhận | Yêu cầu ít nhất tám chữ số; lỗi checkout rollback tồn kho |
| Trang đơn hàng luôn ghi COD, thiếu QR và không tự mở đơn | Nhãn theo phương thức/trạng thái thật; thêm PaymentPanel; deep link tự mở, hỗ trợ thu gọn/mở lại; thêm lọc REVIEW/REFUNDED |

## Bằng chứng kiểm thử

| Bộ kiểm tra | Kết quả và phạm vi |
| --- | --- |
| Docker build API/web | PASS; biên dịch Java và Next production build. API hiện không có src/test, Dockerfile bỏ bước Maven unit test |
| npm run lint; npm run typecheck | PASS |
| docker compose -f compose.coolify.yml config --quiet | PASS với biến cấu hình mô phỏng |
| scripts/test-system-demo.py | **50/50 PASS** trên TLS nginx → Next → API → PostgreSQL riêng |
| scripts/test-checkout-browser.js | **11 kiểm tra PASS** bằng browser sau merge: signup, phiên sau reload, URL WSS, thêm giỏ/checkout, hộp thoại QR và thanh toán sau, QR trong chi tiết sau reload, mở lại hộp thoại QR, thu gọn/mở chi tiết, nhãn đúng, callback đổi PAID không reload và không có pageerror |
| scripts/test-agent-demo.py | **38 kiểm tra PASS**; deterministic tools và model fixture nói giao thức Bedrock qua AWS SDK |
| goihue.openapi.yaml | PASS, 7 lint warnings; gồm cảnh báo lint yêu cầu 2xx cho WebSocket trong khi upgrade trả 101 |
| customer-draft-planned.openapi.yaml | PASS, 2 warnings |
| admin-draft-planned.openapi.yaml | PASS |
| Hai contract stable cũ | customer-stable: 11 errors/22 warnings; admin-stable: 21 errors/15 warnings. Các file này không đổi trong đợt sửa; lỗi gồm nullable trong OpenAPI 3.1 và khai báo security thiếu. Cần xử lý riêng nếu pipeline bắt buộc lint tất cả contract |

50 kiểm tra hệ thống bao phủ đăng ký/đăng nhập/logout, phân quyền và Origin, cookie, WSS owner/admin, hồ sơ/địa chỉ/revision, CRUD catalog/category/ảnh, giỏ cũ/giá đổi/phí ship/tạm dừng, checkout idempotency và giao tranh sản phẩm cuối, COD/VietQR, callback đúng/sai/trùng/khác tài khoản/khác tiền/đến muộn, hết hạn hoàn tồn một lần, đối soát khoản chính/bổ sung, refund riêng khoản thừa vẫn giữ PAID, chống dùng lại extraPayments cũ, rollback COD khi sai số thu, chứng từ COD cũ, upload evidence có quyền sở hữu, giao hàng và đổi trả/refund có chứng từ, SSE chatbot, consent/memory/PERSONALIZED và thu hồi session khi đổi mật khẩu.

38 kiểm tra AI bao phủ POPULAR/BOUGHT_TOGETHER/PERSONALIZED, loại sản phẩm trong giỏ/hết hàng, consent cá nhân hóa tách marketing, parse ngân sách tiếng Việt, nhiều công cụ trong một lượt, lịch sử tối đa 20 lượt, memory qua hội thoại mới, export/forget/revoke, xóa dữ liệu trong export cũ, owner scope, model tự chọn công cụ và nhận kết quả qua vòng lặp, lọc reasoning markup, fallback và revoke trong khi model đang chạy. Một lượt Bedrock thật đã được xác nhận hoạt động trên cấu hình local trước đó; cấu hình AWS trên VPS vẫn cần kiểm tra sau deploy.

Các fixture dùng tài khoản, secret và callback mô phỏng. Stack và database kiểm thử đã được dọn; database local chính giữ nguyên. Container API/web local đã chuyển sang image được kiểm tra.

## Phần còn cần xác nhận trên deployment thật

1. Commit/push source và chọn đúng branch/commit trên Coolify. Hướng dẫn chi tiết nằm tại [goihue-coolify.md](../05_deployment/goihue-coolify.md).
2. Route domain tới VPS hoặc connector tunnel đang hoạt động; HTTPS và `/api/store/live` phải upgrade 101 trên chính domain.
3. Nhập credentials trong Coolify rồi kiểm tra Bedrock hoạt động thay vì fallback. Access key ID và secret access key là một cặp AWS IAM; session token cần nếu dùng credentials tạm thời.
4. Chọn SePay Test mode và HMAC-SHA256, cấu hình secret/tài khoản nhận trùng backend, URL `https://goihue.io.vn/api/store/payments/sepay/webhook`. Xem delivery log dashboard và đơn trên UI. Chưa gửi giao dịch thật hoặc xác nhận callback từ dashboard vào VPS.
5. Kiểm tra dữ liệu/ảnh sau redeploy và quy trình backup/restore volume. Database mới seed sản phẩm tồn 0; phải chuẩn bị catalog/tồn demo.

Đây là kiểm thử chức năng demo, chưa phải chứng nhận khả năng chịu tải hay thanh toán production. QR đang ghi rõ demo; giao vận/COD/refund do nhân viên ghi nhận theo chứng từ, chưa có provider tự thu/hoàn tiền hoặc carrier. Đăng ký tạo tài khoản và session ngay, chưa có bước xác minh email.
