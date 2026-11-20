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

Bedrock nhận schema của chín công cụ `plan_purchase`, `search_products`, `recommend_products`, `compare_products`, `add_to_cart`, `get_shipping`, `lookup_order`, `get_policy` và `get_memory`. Model chọn công cụ và tham số; yêu cầu có ràng buộc số người/ngân sách được backend đưa qua planner trước để bảo đảm có phép tính. Backend xác thực tham số, lấy owner từ session, thực thi, đưa `toolResult` trở lại model và lặp tối đa bốn vòng với tám lần gọi công cụ. Mỗi lượt có deadline 60 giây. Các kết quả được gửi qua SSE để widget hiển thị các bước kiểm tra dữ liệu. Câu trả lời cuối được gửi bằng các sự kiện `token` sau vòng lặp.

`search_products` phục vụ khám phá danh mục, khác với `recommend_products` dùng điểm bán chạy/mua cùng/cá nhân hóa. Có thể hỏi “Tôi muốn chọn một loại trà”, “Cửa hàng có những loại trà nào?”, “Tôi muốn mua bánh mè xửng”, “me xung”, hoặc tên riêng. Tìm từ khóa có/không dấu, tên/mã nhóm hàng và mô tả; nhận diện nhóm trà/mè xửng để tránh lấy hộp quà chỉ nhắc tới trà trong mô tả. Ngân sách không bắt buộc, chỉ áp dụng khi nêu trong câu hiện tại, không tự giới hạn bằng ngân sách tặng quà cũ. Kết quả gồm mô tả, categoryName, available và số lượng khớp. Hàng đang hiển thị nhưng hết tồn được phân biệt với không tìm thấy; sản phẩm/nhóm hàng ẩn không được trả về.

Nếu tên ngắn như “Trà” khớp nhiều món, so sánh hoặc thêm giỏ trả các lựa chọn `AMBIGUOUS` để khách chọn. Không chọn mặc định món có tên ngắn nhất. Tên đầy đủ hoặc UUID xác định đúng món mới tạo bảng so sánh/đề xuất giỏ; đề xuất vẫn cần xác nhận trên giao diện.

## Instruction tư vấn khách hàng

Prompt đầy đủ nằm tại [`agent-sales-advisor.vi.txt`](../../apps/api/src/main/resources/agent-sales-advisor.vi.txt), mã `GOIHUE_SALES_ADVISOR_V4`. API nạp UTF-8 từ classpath khi khởi tạo, dùng làm system instruction cho từng vòng Bedrock. Sở thích và câu hỏi hiện tại được đánh dấu là dữ liệu riêng, không được dùng để thay đổi chỉ dẫn. Đổi riêng file prompt cần rebuild và triển khai lại API. Phần ngữ cảnh sản phẩm và phương án mua còn thay đổi widget, nên cần rebuild cả API và web khi áp dụng phần đó.

## Tư vấn mua cho nhiều người và nhiều điều kiện

`plan_purchase` nhận điều kiện có cấu trúc: ngân sách tổng hoặc mỗi người, số người nhận, số sản phẩm/người, phí giao có nằm trong ngân sách chưa và yêu cầu cùng/khác loại. Điều kiện lấy từ lời khách và `purchaseContext` đã xác thực; giá/tồn/phí luôn lấy mới từ danh mục/cấu hình. Model tự điền số người hoặc ngân sách khác không ghi đè điều kiện khách. Bộ tính dùng số nguyên VND, giữ đủ số phần quà và tồn kho, kiểm tra cả trần từng người khi ngân sách được nêu theo người. Không tự coi ngân sách cả nhóm là trần giá của từng món.

Trong tối đa tám ứng viên, planner xét lựa chọn đồng loại, phối hai loại và phương án chi phí thấp theo lượng tồn. Khi khách chủ động tìm món khác, tập ứng viên được mở ra các món còn hàng có giá thấp và giữ các điều kiện nhóm; không giữ cứng hai món cũ. Đây là bộ tính có giới hạn, không cam kết tối ưu đầy đủ mọi sở thích hoặc mọi cách chia nhiều loại. Tối đa 100 sản phẩm/phương án; một đơn vẫn tuân thủ trần tiền hàng 100 triệu đồng của checkout. Phí tính theo một đơn giao chung; yêu cầu giao riêng cần làm rõ, không nhân số người thành số địa chỉ giao.

Câu trả lời ưu tiên phương án cụ thể, số lượng × đơn giá, tổng tiền, tiền còn lại và một phương án không vừa kèm mức vượt. Chưa rõ bao gồm ship thì ghi tiền hàng chưa gồm ship và tổng có ship từ cấu hình thật. Phần phép tính cuối dùng trực tiếp kết quả backend; model không được thay số lượng hoặc bỏ tổng tiền. Thẻ sản phẩm chỉ hiện các món dùng trong phương án khả thi, còn ID ứng viên vẫn được giữ để câu sau tăng ngân sách không làm mất các món còn lại.

`purchase_context` và `purchase_plan` được gửi qua SSE; widget gửi lại điều kiện ở lượt tiếp theo. Thay ngân sách 160k thành 190k giữ số người và số món/người; chuyển sang khám phá loại hàng mới hoặc mở cuộc trò chuyện mới xóa điều kiện cũ. Chỉ lưu điều kiện/phương án cùng chat khi có historyUse, rút consent xóa cả hai. Ngân sách nhóm không ghi đè budget trong preference memory vì khác ý nghĩa ngân sách chọn một món. Planner chỉ tư vấn, không ghi giỏ/đặt đơn; giá và tồn vẫn được kiểm tra lại khi khách thực hiện mua.

Với dữ liệu ví dụ 74.998đ và 90.000đ, tặng hai người mỗi người một sản phẩm: hai món loại đầu có tiền hàng 149.996đ, còn 10.004đ dưới trần 160.000đ; phối mỗi loại một món hết 164.998đ, vượt 4.998đ. Phí một đơn 30.000đ đưa phương án đầu lên 179.996đ, nên không vừa nếu 160.000đ bao gồm cả giao hàng. Nâng tổng lên 190.000đ bao gồm ship sẽ vừa và còn 10.004đ. Các số này là dữ liệu ca kiểm tra, không phải giá hay chính sách cố định trong prompt.

Kiểm tra đợt planner ngày 20/11/2026: 127 kiểm tra API/AI đạt, 18 kiểm tra trình duyệt đạt; build API/web, lint/typecheck frontend và lint contract runtime đạt (7 cảnh báo hiện có). Kiểm tra có tổng ngân sách so với mỗi người, số lượng mỗi người, tồn thực tế, cùng/khác loại, ngưỡng miễn phí, ngân sách thiếu, model tự điền sai điều kiện, đề xuất giỏ không được yêu cầu, quote retry, lịch sử/consent và mở tập món khi khách tìm lựa chọn khác. Chuỗi chín lượt Bedrock thật trên local 3001 đã đi qua tìm mè → so sánh → quà đối tác → tổng 160k/hai người → bao gồm ship → tăng lên 190k → 80k mỗi người chưa ship → đổi sang trà → 500k/hai người, mỗi người hai sản phẩm. Các lượt tính số lượng/tổng tiền giữ đúng dữ kiện và điều kiện vừa cập nhật. Đây là kiểm tra các ca đã nêu, không bảo đảm hiểu mọi cách diễn đạt hoặc tối ưu mọi phối hợp nhiều loại. Stack kiểm tra riêng đã dọn; local 3001 giữ để thử tiếp, không triển khai VPS trong đợt này.

Widget gửi ID của các món ở bộ thẻ/bảng so sánh vừa xem. Với “1 trong 2 món”, backend giới hạn tra cứu trong đúng tập đó và đối chiếu lại dữ kiện hiện tại. Với “mè xửng động phộng kia”, chỉ đối chiếu từ phân biệt khớp duy nhất trong tập vừa xem, không tìm gần đúng toàn danh mục. Tên mơ hồ phải hỏi lại, kể cả model đã tự điền một ID để thêm giỏ. Đổi sang trà bỏ tập mè xửng cũ. Đây là ngữ cảnh hội thoại, độc lập với bộ nhớ sở thích ngân sách/người nhận/dịp tặng. Chỉ lưu ID vào lịch sử nếu bật historyUse; guest hoặc consent tắt giữ tạm theo request/tab. Lịch sử cũ chỉ có chữ vẫn được đối chiếu tên public, không tin giá/tồn từ câu trả lời cũ.

Đợt sửa ngữ cảnh ngày 20/11/2026: 99 kiểm tra API/AI đạt; 15 kiểm tra trình duyệt đạt, bao gồm gửi ID từ bảng so sánh, giữ đúng tập khi hỏi tiếp và xóa ngữ cảnh khi bắt đầu hội thoại mới. Build API/web, lint/typecheck frontend và lint contract runtime đạt (7 cảnh báo hiện có). Đã thử chuỗi năm lượt bằng Bedrock thật trên bản local 3001: tìm món liên quan mè → chọn một trong hai để tặng bạn bè → hỏi lại “động phộng kia” → hỏi lượng đường của “món này” → đổi sang trà. Tập sản phẩm lần lượt là hai món mè xửng → giữ hai món → riêng món đậu phộng → giữ món đậu phộng → loại trà mới. Khi model tự nhắc một món khác ngoài tập đã giải quyết, backend thay bằng tư vấn từ mô tả đã đối chiếu. Câu trả lời vẫn có lượt dài hơn mục tiêu; các kiểm tra này không chứng minh mọi câu model đều đúng. Dữ liệu local được giữ để thử tiếp; stack kiểm tra riêng đã dọn.

Instruction phân biệt ba loại nội dung: dữ kiện của đúng sản phẩm/cửa hàng cần được xác minh; kiến thức chung được dùng dù mô tả không ghi; nhận định phù hợp phải có điều kiện dựa trên nhu cầu khách. Thiếu thuộc tính trong mô tả có nghĩa là chưa xác nhận, không có nghĩa thuộc tính ấy không tồn tại. Khách hỏi lượng đường/chứng nhận thì trả lời đúng phần đó; không chuyển sang tiêu chí chọn quà, đọc giá/tồn để né câu hỏi, hoặc gọi lặp tìm tên khi nguồn không có thuộc tính cần hỏi.

Các nhánh tư vấn được quy định riêng:

- Tiền đề chưa có căn cứ như “tại sao mè xửng đậu phộng không hợp tặng gia đình”: không tự tìm lý do để đồng ý; giải thích vẫn có thể cân nhắc theo khẩu vị và thành phần cần tránh.
- Kết luận trước của bot quá mức: nhận và sửa ngắn gọn, không củng cố câu sai từ lịch sử.
- Thiếu lượng đường, thành phần, chứng nhận hoặc hạn dùng: nêu đúng phần chưa xác nhận và thông tin nhãn/nhà sản xuất cần đối chiếu, không báo cáo database/description/tool với khách.
- Dị ứng/chế độ ăn đặc biệt: không biến thông tin còn thiếu thành cam kết an toàn; món thay thế cũng cần xác minh. Không dùng lưu ý y tế cho mọi câu hỏi tặng quà.
- Tiêu chí chọn quà chung: được tư vấn mà không bắt buộc tìm sản phẩm, ngân sách hoặc đưa đề xuất giỏ. Có thể nhắc cân nhắc phí giao hàng mà không nêu số tiền.

Mặc định trả lời hai đến bốn câu, khoảng 40–90 từ và tối đa một câu hỏi hữu ích. Trả lời chính trước, chỉ bổ sung một hoặc hai lý do/điều kiện cần thiết; đủ thông tin thì dừng. Prompt có ví dụ đúng/sai và checklist không hiển thị. Tám công cụ vẫn tuân thủ kiểm tra tham số/quyền/consent ở backend; instruction không thay thế những kiểm tra này. Chế độ deterministic không chạy model và không có khả năng tư vấn tự nhiên tương đương.

Với câu hỏi tiêu chí quà tặng chung được nhận diện, API không gửi schema công cụ cho lượt đó và không ép tra danh mục. Câu có sản phẩm cụ thể, hỏi giá/tồn, ngân sách rõ ràng hoặc yêu cầu gợi ý mua vẫn giữ công cụ và kiểm tra dữ liệu mới. Cụm “gia đình” không được nhầm thành câu hỏi “giá”. Bộ lọc đầu ra bỏ thẻ reasoning và các thẻ bọc response/answer, giữ lại nội dung trả lời; kiểm tra phí chỉ chặn khẳng định mức phí/miễn phí chưa được tra thay vì chặn mọi lời nhắc chung tới giao hàng.

Kiểm tra ngày 20/11/2026: build API đạt; 80 kiểm tra API/AI với Bedrock protocol fixture đạt, bao gồm nạp đúng prompt UTF-8, tư vấn chung không bị ép lookup, câu hỏi giá và yêu cầu gợi ý có ngân sách vẫn tra dữ liệu, giữ nội dung khi bỏ thẻ bọc. Contract runtime lint hợp lệ với 7 cảnh báo hiện có. Tám kịch bản Bedrock thật đã chạy trên dữ liệu mô phỏng riêng: tiền đề sai, sửa kết luận cũ, thiếu lượng đường, thiếu thông tin dị ứng, tiêu chí chung, tìm trà, giá/tồn và chứng nhận chưa xác minh. Các nhánh tư vấn đã thể hiện cách trả lời có điều kiện và không coi dữ liệu thiếu là bằng chứng an toàn. Vẫn quan sát được lượt hỏi giá/tồn bị chuyển sang phí giao hàng và một số câu dài hơn mục tiêu; không coi toàn bộ kiểm tra ngữ nghĩa live là đạt. Cần kiểm soát thêm việc chọn công cụ và bám câu hỏi nếu yêu cầu độ ổn định cao khi demo. Toàn bộ stack kiểm tra đã dọn; đợt này không triển khai lên VPS.

## Kiểm thử tìm kiếm và giỏ hàng

Trước bổ sung search, 59 kiểm tra cũ vẫn đạt nhưng bốn câu “chọn một loại trà”, “mua bánh mè xửng”, “me xung”, “cửa hàng có những loại trà nào” không gọi công cụ trong fallback. Bộ kiểm tra mở rộng kiểm tra tìm theo loại/tên không dấu, ngân sách hiện tại thay vì memory cũ, nhóm hàng ẩn, món hết kho, tên thêm giỏ mơ hồ và dữ kiện phí giao hàng. Trình duyệt kiểm tra khách xem/hủy đề xuất, CUSTOMER xác nhận mới ghi giỏ, thêm tiếp cộng dồn số lượng, bảng so sánh và gửi tin nhắn trên màn hình điện thoại.

```powershell
docker build -t goihue-tools-api:review apps/api
docker build -t goihue-tools-web:review apps/web
python scripts/test-agent-demo.py --keep --api-image goihue-tools-api:review --web-image goihue-tools-web:review
npx @playwright/cli -s=tools-qa open http://127.0.0.1:13097
npx @playwright/cli -s=tools-qa run-code --filename=scripts/test-agent-shopping-browser.js
```

Các thao tác này dùng database riêng và dữ liệu mô phỏng; script trình duyệt chỉ cho chạy ở fixture localhost. Dọn bằng lệnh cleanup do script API in sau khi hoàn tất. Ảnh kiểm tra được lưu ở `output/playwright/agent-shopping-tools-mobile.png` và không đưa vào Git. Bật `--keep` chiếm cổng 13097 đến khi cleanup, nên dọn fixture trước khi chạy lại toàn bộ script.

Kết quả ngày 19/11/2026: 76 kiểm tra API/AI đạt, 12 kiểm tra trình duyệt đạt, build API/web và lint/typecheck frontend đạt. Năm kịch bản dùng Bedrock thật trên database fixture đã chọn đúng search/compare/proposal; kiểm tra thêm bản cuối xác nhận câu tìm trà không chèn phí giao hàng chưa tra. Stack mô phỏng đã dọn, không kiểm tra hay triển khai bản VPS trong đợt này. Contract runtime `goihue.openapi.yaml` lint hợp lệ với 7 cảnh báo hiện có.

Kiểm tra bốn contract handoff: hai file draft-planned hợp lệ; `customer-stable.openapi.yaml` còn 11 lỗi/22 cảnh báo và `admin-stable.openapi.yaml` còn 21 lỗi/15 cảnh báo có sẵn (nullable/security và ví dụ), như báo cáo deploy trước. Các file stable này không thay đổi trong phần bổ sung search.

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

OpenAPI đang chạy của Gói Huế là `goihue.openapi.yaml` phiên bản `1.6.0-draft`. Bốn contract customer/admin cũ vẫn giữ trong repository. Hai file stable cũ có tổng 32 lỗi lint sẵn có về security/schema và cần xử lý theo hợp đồng của hệ thống tương ứng.
