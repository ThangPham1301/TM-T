# Recommendation và trợ lý Gói Huế

Bản demo có ba chiến lược BOUGHT_TOGETHER, PERSONALIZED và POPULAR. Thứ tự ưu tiên áp dụng sau khi lọc sản phẩm, danh mục, tồn kho, ngân sách và các món đang xem hoặc có trong giỏ. Điểm mua cùng và độ phổ biến dùng đơn DELIVERED. Cá nhân hóa dùng danh mục từng mua của chính khách, sau khi khách bật lựa chọn riêng.

## Chạy trên dữ liệu của máy hiện tại

```powershell
docker compose up -d --build api web
```

Mở [website local](http://localhost:3000). Các lựa chọn cá nhân hóa, lưu lịch sử và ghi nhớ sở thích nằm trong widget chat và trang `/account/privacy`. Mỗi lựa chọn mặc định tắt và độc lập với tiếp thị. Đăng nhập một tài khoản có đơn DELIVERED để trình diễn PERSONALIZED. Tài khoản mới dùng POPULAR đến khi có dữ liệu mua hàng phù hợp.

Trong `.env`, `APP_AGENT_PROVIDER=auto` dùng Bedrock khi có credentials và chuyển về công cụ theo luật khi model không khả dụng. `APP_AGENT_PROVIDER=deterministic` dùng chế độ theo luật. `APP_AGENT_PROVIDER=bedrock` ưu tiên Bedrock và vẫn có đường dự phòng khi lỗi. Đổi provider rồi chạy `docker compose up -d api`. Credentials AWS chỉ cấu hình local qua `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` và `AWS_SESSION_TOKEN` nếu có. Region/model dùng `APP_BEDROCK_REGION` và `APP_BEDROCK_MODEL`.

Hai cờ `NEXT_PUBLIC_RECOMMENDATIONS_ENABLED` và `NEXT_PUBLIC_AI_CHAT_ENABLED` mặc định true. Đổi cờ rồi rebuild web vì Next.js đưa các giá trị này vào bundle lúc build.

## Công cụ và vòng lặp

Bedrock nhận schema của bảy công cụ `recommend_products`, `compare_products`, `add_to_cart`, `get_shipping`, `lookup_order`, `get_policy` và `get_memory`. Model chọn công cụ và tham số. Backend xác thực tham số, lấy owner từ session, thực thi, đưa `toolResult` trở lại model và lặp tối đa bốn vòng với tám lần gọi công cụ. Mỗi lượt có deadline 60 giây. Các kết quả được gửi qua SSE để widget hiển thị các bước kiểm tra dữ liệu. Câu trả lời cuối được gửi bằng các sự kiện `token` sau vòng lặp.

Ngân sách chỉ áp dụng khi dương. API coi 0/âm là chưa đặt giới hạn; dispatcher dùng số tiền đọc từ lời khách hoặc memory đã đồng ý, không dùng ngân sách model tự điền. Vì vậy model gửi 0, âm hoặc sai đơn vị không ghi đè ngân sách khách đã nêu. Không có ngân sách vẫn tìm sản phẩm; kết quả rỗng chỉ nhắc ngân sách nếu thực sự đã áp dụng giới hạn. Công cụ nhận thêm `query` để tìm tên không phân biệt dấu, trả mô tả và số lượng đã giao. Tên bị model điền nhầm vào `productId` được chuyển sang tìm tên thay vì trả lỗi hồ sơ. `rankingBasis=CATALOG` là hàng đang có, chưa chứng minh bán chạy; chỉ dùng nhận xét bán chạy khi số lượng đã giao lớn hơn 0.

Nếu model định trả lời câu hỏi sản phẩm mà chưa gọi công cụ trong lượt hiện tại, dispatcher bổ sung lookup và đưa toolResult lại vào vòng lặp; lịch sử không thay cho kiểm tra giá/tồn mới. So sánh hai sản phẩm dựng từ tên, mô tả, giá, tồn và chênh lệch giá trong các kết quả vừa tra. Nếu chưa có hai món với số đã giao dương, trả rõ chưa đủ dữ liệu xác nhận hai món bán chạy và so sánh hàng đang có.

Công cụ `compare_products` là đường so sánh có cấu trúc: khách nêu hai sản phẩm (tên ngắn hoặc UUID), backend đối chiếu với danh mục đang bán được và phát sự kiện SSE `comparison` chứa thẻ của hai sản phẩm kèm chênh lệch giá để widget vẽ bảng so sánh; đoạn so sánh dạng chữ ở trên chỉ còn là đường dự phòng khi model không gọi công cụ này. Công cụ `add_to_cart` chỉ **đề xuất**: backend kiểm tra sản phẩm và số lượng theo tồn kho rồi phát sự kiện `cart_proposal`; widget hiện hộp xác nhận và chỉ khi khách bấm “Thêm vào giỏ” thì giao diện mới gọi API giỏ hàng thật (cart-set qua commerce). Backend của trợ lý không bao giờ tự ghi giỏ. Chế độ theo luật định tuyến được cả hai tình huống: câu chứa “so sánh” kèm đủ hai tên sản phẩm nhận diện được sẽ gọi `compare_products`; câu “thêm/bỏ … vào giỏ” kèm một tên sản phẩm và số lượng (dạng “2 hộp”, “x2”) sẽ gọi `add_to_cart`.

Chế độ theo luật dùng cùng dispatcher và trả `provider=deterministic`. Có thể trình diễn gợi ý, phí ship, tra đơn và bộ nhớ khi mất kết nối tới model. Trình diễn việc model tự chọn công cụ cần một model Bedrock hoạt động. Mẫu vòng lặp theo Converse API được đối chiếu với ví dụ AWS. [Ví dụ Java của AWS](https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/java_bedrock-runtime_code_examples.html)

## Kịch bản trình diễn

1. Mở trang chủ khi chưa bật cá nhân hóa và xem gợi ý POPULAR.
2. Đăng nhập, bật “Gợi ý theo danh mục tôi từng mua” trong widget. Với tài khoản có đơn đã giao, trang chủ chuyển sang PERSONALIZED.
3. Mở chi tiết sản phẩm đã từng được mua cùng trong một đơn DELIVERED. Thêm món vào giỏ, mở giỏ và xem gợi ý mua cùng. Các món trong giỏ được loại khỏi kết quả.
4. Bật lưu lịch sử và ghi nhớ. Hỏi “Tư vấn quà cho mẹ dịp sinh nhật dưới 200k và phí ship”. Mở phần “bước kiểm tra dữ liệu” để xem công cụ tìm sản phẩm và kiểm tra giao hàng. Provider hiện trên đầu widget.
5. Tải lại trang để xem hội thoại được khôi phục. Bấm dấu cộng để bắt đầu cuộc trò chuyện mới rồi hỏi “Gợi ý quà như lần trước”. Ngân sách đã đồng ý ghi nhớ được dùng lại.
6. Gửi mã đơn GH-XXXXXXXX thuộc tài khoản đang đăng nhập. Trợ lý tra chính xác mã và owner. Mã của khách khác trả thông báo không tìm thấy trong tài khoản.
7. Rút đồng ý lưu lịch sử hoặc ghi nhớ, rồi tải lại trang. Dữ liệu tương ứng đã được xóa. Nút “Xóa lịch sử và ghi nhớ” xóa cả hai nhưng giữ các lựa chọn đồng ý.
8. Hỏi “So sánh Mè Xửng Gừng với Hộp Quà Hương Huế”. Widget hiện bảng so sánh hai cột (giá, còn hàng, đã giao, chênh lệch giá) từ sự kiện `comparison`.
9. Hỏi “Thêm 2 hộp Mè Xửng Gừng vào giỏ giúp mình”. Hộp xác nhận hiện lên; bấm “Thêm vào giỏ” thì số lượng trên biểu tượng giỏ mới tăng, bấm “Hủy” thì giỏ không đổi.

Bộ nhớ lưu ba trường ngân sách, người nhận và dịp tặng được nhận diện từ câu khách nhập. Lịch sử lưu tối đa 20 lượt hỏi đáp mỗi tài khoản. Khách vãng lai và lượt chưa đồng ý chỉ giữ ngữ cảnh tạm trong tab. Khi đổi tài khoản, widget hủy request và khởi tạo lại trạng thái. Export dữ liệu cá nhân bao gồm chat và memory. RESTRICT/DELETE thu hồi hoặc xóa dữ liệu AI. Thay đổi revision khi rút đồng ý/xóa dữ liệu chặn lượt đang chạy ghi lại dữ liệu.

## Dữ liệu mô phỏng và kiểm tra lặp lại

Script sau tạo database, tài khoản và đơn hàng mô phỏng trong một Compose project riêng, mở web ở cổng 13097 và dùng phản hồi mô phỏng đúng giao thức Bedrock để kiểm tra tool calling. Script tự dọn project khi kết thúc. Thêm `--keep` để giữ dữ liệu demo và dùng chế độ theo luật trên cổng này. Tài khoản mô phỏng và lệnh dọn được in sau khi chạy thành công.

```powershell
docker build -t goihue-api:agent-demo-review apps/api
docker build -t goihue-web:agent-demo-review apps/web
python scripts/test-agent-demo.py
# Giữ stack mô phỏng để trình diễn giao diện
python scripts/test-agent-demo.py --keep
```

Kiểm tra bao gồm ba chiến lược, rail giỏ, tồn kho, quyền chủ sở hữu, consent độc lập, export, khôi phục hội thoại, bộ nhớ, idempotency, giới hạn lịch sử, phản hồi công cụ đưa lại model, chuyển provider khi lỗi và rút đồng ý trong lúc model đang chạy.

```powershell
cd apps/web
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
cd ../..
npx.cmd @redocly/cli lint docs/03_api_specs/goihue.openapi.yaml
```

OpenAPI đang chạy của Gói Huế là `goihue.openapi.yaml` phiên bản `1.3.2-draft`. Bốn contract customer/admin cũ vẫn giữ trong repository. Hai file stable cũ có tổng 32 lỗi lint sẵn có về security/schema và cần xử lý theo hợp đồng của hệ thống tương ứng.
