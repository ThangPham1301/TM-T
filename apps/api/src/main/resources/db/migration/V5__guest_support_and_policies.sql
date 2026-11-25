CREATE TABLE guest_support (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    request_key varchar(80) NOT NULL,
    topic text NOT NULL CHECK (topic IN ('DELIVERY', 'RETURNS', 'PRIVACY', 'OTHER')),
    message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'RESOLVED')),
    reply text NOT NULL DEFAULT '' CHECK (char_length(reply) <= 2000),
    revision integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (order_id, request_key)
);
CREATE INDEX guest_support_order ON guest_support(order_id, created_at DESC);
CREATE INDEX guest_support_inbox ON guest_support(status, updated_at DESC);
CREATE UNIQUE INDEX guest_support_open_topic ON guest_support(order_id, topic) WHERE status <> 'RESOLVED';

-- Legacy privacy drafts remain available in the Admin history.
CREATE UNIQUE INDEX records_policy_version ON records ((data->>'topic'), (data->>'version'))
    WHERE kind='policy' AND data ? 'topic';
CREATE UNIQUE INDEX records_policy_published ON records ((data->>'topic'))
    WHERE kind='policy' AND data->>'status'='PUBLISHED';

WITH policies(topic, content) AS (VALUES
    ('privacy', $policy$
### Thông tin Gói Huế xử lý
- **Tài khoản:** Họ tên, email, hồ sơ, địa chỉ đã lưu và lựa chọn nhận ưu đãi. Hệ thống lưu bản băm mật khẩu.
- **Đặt hàng:** Họ tên người nhận, số điện thoại, địa chỉ giao hàng, mặt hàng, số lượng, số tiền, trạng thái đơn và thanh toán. Khách vãng lai cung cấp thông tin nhận hàng mà không cần tạo tài khoản.
- **Hỗ trợ:** Nội dung yêu cầu, lịch sử xử lý và ảnh bằng chứng do bạn gửi khi đổi trả.
- **Trợ lý mua sắm:** Câu hỏi và ngữ cảnh cần thiết để trả lời. Việc lưu lịch sử và ghi nhớ sở thích được quản lý bằng các lựa chọn riêng.

### Mục đích sử dụng và lựa chọn của bạn
Gói Huế dùng thông tin để quản lý tài khoản, xử lý và tra cứu đơn, chuẩn bị giao hàng, ghi nhận thanh toán và giải quyết yêu cầu hỗ trợ.
Lựa chọn nhận ưu đãi được quản lý trong tài khoản. Cá nhân hóa gợi ý, lưu lịch sử chat và ghi nhớ sở thích là ba lựa chọn riêng cho khách đã đăng nhập, mặc định tắt. Nếu dịch vụ AI bên ngoài được bật cho bản chạy, nội dung cần thiết để trả lời có thể được gửi tới dịch vụ đó. Tránh nhập mật khẩu, mã tra cứu hoặc thông tin thanh toán vào chat.

### Cookie và mã tra cứu
Website dùng cookie để duy trì phiên đăng nhập, nhận diện giỏ hàng vãng lai theo trình duyệt và cấp quyền xem đơn sau khi tra cứu.
Khách vãng lai dùng mã đơn kèm mã tra cứu riêng để xem tiến trình. Hãy lưu hai mã sau khi đặt và giữ kín mã tra cứu. Thời gian của phiên tra cứu tách biệt với thời gian lưu hồ sơ đơn.

### Ai có thể tiếp cận thông tin
Khách truy cập hồ sơ của mình. Quản trị viên được cấp quyền truy cập dữ liệu cần thiết để xử lý đơn, yêu cầu đổi trả và yêu cầu về dữ liệu cá nhân.
Khi cần giao hàng, Gói Huế có thể cung cấp tên người nhận, số điện thoại, địa chỉ giao và thông tin thu hộ cần thiết cho đơn vị vận chuyển phụ trách đơn.

### Bảo vệ và lưu trữ
Hệ thống dùng cookie phiên có thuộc tính HttpOnly, kiểm tra quyền và quyền sở hữu hồ sơ, đồng thời kiểm soát truy cập ảnh bằng chứng.
Thời gian lưu dữ liệu tùy mục đích sử dụng. Một số thông tin giao dịch có thể cần giữ để đối soát hoặc xử lý hồ sơ đang mở. Khi phản hồi yêu cầu về dữ liệu, Gói Huế sẽ giải thích phạm vi thông tin cần giữ lại.

### Quyền và yêu cầu về dữ liệu
Bạn có thể chỉnh sửa thông tin hồ sơ và thay đổi lựa chọn nhận ưu đãi trong tài khoản. Tại [Trung tâm quyền riêng tư](/account/privacy), bạn có thể gửi yêu cầu xem, xuất, xóa, hạn chế xử lý hoặc khiếu nại, rồi theo dõi phản hồi.
Với yêu cầu đóng tài khoản, hệ thống kiểm tra các đơn hàng hoặc hồ sơ đổi trả đang mở trước khi xử lý.

### Đầu mối tiếp nhận
Đăng nhập và mở [Trung tâm quyền riêng tư](/account/privacy) để gửi yêu cầu về dữ liệu tài khoản và theo dõi phản hồi.
Nếu mua không cần tài khoản, hãy [tra cứu và mở mục hỗ trợ](/tra-cuu-don-hang#ho-tro-don-hang). Sau khi xác minh đơn, chọn **Quyền riêng tư và dữ liệu**. Gói Huế có thể cần thêm thông tin để xác minh danh tính trước khi xử lý yêu cầu về dữ liệu.
$policy$),
    ('shipping', $policy$
### Đặt hàng và xác nhận thông tin
Bạn có thể mua bằng tài khoản hoặc mua vãng lai. Chọn sản phẩm, xem giỏ hàng rồi nhập hoặc chọn thông tin người nhận tại bước thanh toán. Kiểm tra tên, số điện thoại và địa chỉ trước khi gửi đơn.
Trang xác nhận hiển thị mã đơn sau khi hệ thống tiếp nhận. Bạn có thể xem trạng thái xác nhận và giao hàng trong phần theo dõi đơn.

### Giá, ưu đãi và phí giao hàng
Checkout hiển thị tiền hàng, khoản giảm nếu đủ điều kiện, phí giao và tổng thanh toán. Nếu cửa hàng có ngưỡng miễn phí giao, ngưỡng được tính trên tiền hàng sau ưu đãi.
Khi giá, ưu đãi hoặc phí giao thay đổi trước khi đặt, hãy kiểm tra và xác nhận lại tổng mới. Đơn đã tạo lưu giá, ưu đãi và phí giao tại thời điểm đặt.

### Phương thức thanh toán
**Tiền mặt khi nhận hàng (COD).** Trả số tiền hiển thị trong chi tiết đơn cho người giao khi nhận hàng.
**Chuyển khoản VietQR.** Gói Huế chưa tiếp nhận chuyển khoản qua mã VietQR trên website. Vui lòng chọn COD để thanh toán khi nhận hàng.

### Theo dõi giao hàng
Gói Huế cập nhật tiến trình xử lý và giao nhận trong chi tiết đơn. Mã vận đơn xuất hiện khi quản trị viên đã nhập thông tin theo dõi.
Kiểm tra lại thông tin người nhận trước khi xác nhận đơn để tránh chậm trễ khi giao.

### Tra cứu đơn hàng
- **Khách có tài khoản:** Mở [Đơn hàng của tôi](/account/orders) để xem chi tiết.
- **Khách vãng lai:** Lưu mã đơn và mã tra cứu ở trang xác nhận. Dùng cả hai tại [Tra cứu đơn hàng](/tra-cuu-don-hang) nếu xem từ thiết bị khác. Hãy giữ kín mã tra cứu.

### Hỗ trợ sau khi đặt hàng
Khách vãng lai có thể [gửi yêu cầu hỗ trợ](/tra-cuu-don-hang#ho-tro-don-hang) sau khi tra cứu và xác minh đơn. Phản hồi được cập nhật tại chi tiết đơn.
Khi đơn đã giao và sản phẩm có vấn đề, xem [Chính sách đổi trả và hoàn tiền](/return-policy) để biết thời hạn và cách gửi yêu cầu.
$policy$),
    ('returns', $policy$
### Thời hạn tiếp nhận
Với hàng giao sai, giao thiếu hoặc hư hỏng, hãy gửi yêu cầu trong vòng **7 ngày kể từ khi hệ thống ghi nhận đã giao**.
**Chất lượng hoặc nghi mất an toàn thực phẩm**
Yêu cầu vẫn được tiếp nhận để xem xét sau 7 ngày. Hãy ngừng sử dụng sản phẩm và giữ lại bao bì, nhãn lô hoặc hạn dùng nếu còn.

### Các tình huống được xem xét
- **Sai hàng, hư hỏng, bao bì hở hoặc chất lượng bất thường:** Xem xét đổi hàng hoặc hoàn tiền cho phần được duyệt.
- **Thiếu hoặc chưa nhận được món trong đơn đã ghi nhận giao:** Xem xét gửi bù hoặc hoàn tiền cho phần hàng liên quan. Món chưa nhận không cần thu hồi.
- **Lý do thỏa thuận khác:** Được xem xét theo từng hồ sơ. Nếu đơn vẫn đang giao hoặc giao thất bại, hãy kiểm tra tiến trình trong chi tiết đơn.

### Cách gửi yêu cầu
Khách có tài khoản mở [Đơn hàng của tôi](/account/orders), chọn đơn đã giao, sau đó chọn sản phẩm, số lượng và lý do. Mô tả tình trạng và đính kèm ảnh nếu có, chẳng hạn ảnh bao bì, hàng nhận được hoặc nhãn sản phẩm. Video mở hộp không phải điều kiện mặc định.
Khách vãng lai [tra cứu và mở mục hỗ trợ](/tra-cuu-don-hang#ho-tro-don-hang) bằng hai mã đã lưu, chọn **Đổi trả và hoàn tiền**, rồi mô tả sản phẩm, số lượng và vấn đề gặp phải. Gói Huế xem xét thủ công và phản hồi ngay trong chi tiết đơn.

### Xem xét, thu hồi và gửi lại hàng
Quản trị viên xem xét yêu cầu, có thể đề nghị bổ sung thông tin hoặc gửi phương án để bạn xác nhận. Nếu cần thu hồi, chờ hướng dẫn trước khi gửi hàng. Thực phẩm trả về được kiểm tra và xử lý riêng, không tự động nhập lại tồn bán.

### Cách tính tiền hoàn và chi phí
Tiền hoàn cho sản phẩm tính theo **giá thực trả sau ưu đãi** và số lượng được duyệt. Phí giao lượt đầu được xem xét riêng theo từng hồ sơ.
Gói Huế chịu chi phí thu hồi hoặc gửi bù khi xác nhận lỗi thuộc cửa hàng hoặc khâu giao nhận. Khoản hoàn được ghi nhận sau khi xác nhận đơn đã thanh toán.

### Thời gian phản hồi và theo dõi
Gói Huế hướng tới phản hồi tiếp nhận trong **1 ngày làm việc** và thông báo phương án trong **3 ngày làm việc kể từ khi đủ thông tin**. Thời điểm gửi hàng thay thế hoặc hoàn tiền được thông báo theo từng hồ sơ. Khách có tài khoản theo dõi tại [Yêu cầu đổi trả](/account/returns). Khách vãng lai xem phản hồi trong mục hỗ trợ của [chi tiết đơn](/tra-cuu-don-hang#ho-tro-don-hang).
$policy$)
), prepared AS (
    SELECT gen_random_uuid() AS id, topic, trim(both chr(10) from content) AS content FROM policies
)
INSERT INTO records (id, kind, data)
SELECT id, 'policy', jsonb_build_object(
    'id', id, 'topic', topic, 'version', '1.0', 'status', 'PUBLISHED',
    'createdAt', now(), 'publishedAt', now(), 'revision', 1, 'content', content,
    'title', CASE topic
        WHEN 'privacy' THEN 'Chính sách quyền riêng tư'
        WHEN 'shipping' THEN 'Chính sách đặt hàng, thanh toán và giao hàng'
        WHEN 'returns' THEN 'Chính sách đổi trả và hoàn tiền'
    END
)
FROM prepared;
