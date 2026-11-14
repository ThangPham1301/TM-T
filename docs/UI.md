# Gói Huế — Danh sách giao diện Frontend (UI)

Tài liệu này ghi nhận các trang giao diện người dùng đang có trong frontend tại thời điểm rà soát. Nội dung mô tả theo source code giao diện hiện tại; dữ liệu hiển thị thực tế phụ thuộc API và cơ sở dữ liệu đang chạy.

## 1. Phạm vi và điều hướng chung

Frontend được xây dựng bằng Next.js. Mọi trang được đặt trong `apps/web/src/app`; thành phần khung dùng chung nằm trong `apps/web/src/components`.

Các vai trò giao diện hiện có:

| Nhóm người dùng | Khả năng chính trên giao diện |
| --- | --- |
| Khách chưa đăng nhập | Xem trang chủ, sản phẩm, chính sách; đăng ký, đăng nhập. |
| Khách hàng (`CUSTOMER`) | Dùng giỏ hàng, checkout COD, quản lý tài khoản, đơn hàng, đổi trả và quyền riêng tư. |
| Quản trị viên (`ADMIN`) | Quản lý đơn hàng, hàng hóa, danh mục, cấu hình giao hàng, hồ sơ đổi trả, yêu cầu riêng tư, chính sách và nhật ký. |

### Header và Footer

Header xuất hiện trên các trang, bao gồm:

- Thông điệp “Đặc sản Huế · Gói trọn yêu thương”, hỗ trợ sau bán và thanh toán khi nhận hàng.
- Logo/liên kết về `/`.
- Ô tìm kiếm toàn cục, chuyển đến `/products?q=...`.
- Liên kết Trang chủ, Sản phẩm, câu chuyện thương hiệu trên trang chủ và chính sách đổi trả.
- Với khách hàng đã đăng nhập: nút Đơn hàng, giỏ hàng (kèm số lượng), menu tài khoản, quyền riêng tư, đổi trả và đăng xuất.
- Với quản trị viên: menu có thêm liên kết Khu vực quản trị.

Footer có các liên kết danh mục, Đơn hàng, Đổi trả, Chính sách bảo mật, Chính sách đổi trả và nhãn đầu mối tiếp nhận “Đang cập nhật”.

Nguồn: `apps/web/src/components/site-shell.tsx`, `apps/web/src/app/layout.tsx`.

## 2. Các trang công khai

### `/` — Trang chủ

**Truy cập:** công khai.

**Nội dung hiện có:**

- Hero “Món quà từ Huế — Gửi người thương”, lời giới thiệu về mè rang, trà và bánh đặc sản.
- Nút xem sản phẩm; nếu đã đăng nhập với vai trò khách hàng, có nút đi giỏ hàng hoặc xem đơn hàng tùy tình trạng giỏ.
- Ba điểm giới thiệu: tinh tuyển, đồng hành và minh bạch.
- Một sản phẩm nổi bật lấy từ dữ liệu sản phẩm đang có.
- Khối “Tứ Đại Danh Vị / Danh Mục Di Sản Cố Đô”, hiển thị danh mục từ API và liên kết lọc sản phẩm theo danh mục.
- Khối “Ngự Phẩm Dành Cho Bạn”, hiển thị tối đa bốn sản phẩm phổ biến/đầu danh sách: ảnh, danh mục, tên, mô tả, giá và liên kết chi tiết.
- Câu chuyện thương hiệu tại neo `/#heritage-story`.
- Lời mời tạo tài khoản, cùng liên kết đến tài khoản và chính sách bảo mật.
- Trạng thái tải và thông báo lỗi khi không lấy được sản phẩm hoặc danh mục.

Nguồn: `apps/web/src/app/page.tsx`, `apps/web/src/components/home.tsx`.

### `/products` — Danh sách sản phẩm

**Truy cập:** công khai.

**Nội dung hiện có:**

- Tiêu đề “Bộ sưu tập Gói Huế”, breadcrumb về trang chủ và phần mô tả bộ sưu tập.
- Bộ lọc gồm từ khóa `q` và danh mục `category`; biểu mẫu dùng URL để có thể chia sẻ kết quả lọc.
- Danh sách thẻ sản phẩm: ảnh, tên danh mục, tên, mô tả, giá, số lượng còn lại hoặc trạng thái “Tạm hết hàng”.
- Ô chọn số lượng (từ 1 đến giới hạn theo tồn kho) và nút thêm vào giỏ.
- Khách chưa đăng nhập được đưa đến đăng nhập khi thêm giỏ; sản phẩm hết hàng không thể thêm.
- Trạng thái đang tải, lỗi lấy dữ liệu và không có sản phẩm phù hợp.

Nguồn: `apps/web/src/app/products/page.tsx`, `apps/web/src/components/commerce.tsx`.

### `/products/[slug]` — Chi tiết sản phẩm

**Truy cập:** công khai.

**Nội dung hiện có:**

- Hiển thị thông tin của sản phẩm có `slug` trên URL: ảnh, danh mục, tên, mô tả, giá và tồn kho.
- Cho chọn số lượng và thêm vào giỏ như trang danh sách.
- Có ghi chú thanh toán khi nhận hàng (COD) và liên kết xem điều kiện đổi trả.
- Nếu slug không hợp lệ hoặc API không trả sản phẩm, giao diện hiển thị trạng thái không tìm thấy/lỗi tương ứng.

Nguồn: `apps/web/src/app/products/[slug]/page.tsx`, `apps/web/src/components/commerce.tsx`.

### `/privacy-policy` — Chính sách bảo mật

**Truy cập:** công khai.

**Nội dung hiện có:**

- Nhãn rõ ràng rằng đây là nội dung **dự thảo**, chưa được công bố hiệu lực chính thức.
- Hiển thị phiên bản và nội dung chính sách bảo mật lấy từ dữ liệu chính sách đang được chọn.
- Có trạng thái đang tải và lỗi khi chưa lấy được nội dung.
- Đây là nơi trình bày nội dung về thu thập, sử dụng, chia sẻ, bảo vệ dữ liệu và quyền chủ thể dữ liệu nếu nội dung chính sách đã được quản trị viên nhập/công bố trong hệ thống.

Nguồn: `apps/web/src/app/privacy-policy/page.tsx`, `apps/web/src/components/policies.tsx`.

### `/return-policy` — Chính sách đổi trả

**Truy cập:** công khai.

**Nội dung hiện có:**

- Nhãn chính sách dự thảo phục vụ demo học thuật.
- Bảy nhóm nội dung: phạm vi; thời hạn và bằng chứng; phương án xử lý; thu hồi hàng/an toàn thực phẩm; thực hiện và chi phí; thời gian phản hồi/khiếu nại; liên hệ.
- Các điều khoản mô tả nguyên tắc đổi, hoàn tiền, giao bù và bằng chứng; đây không được thể hiện là cam kết đã có hiệu lực.

Nguồn: `apps/web/src/app/return-policy/page.tsx`, `apps/web/src/components/policies.tsx`.

### `/login` — Đăng nhập

**Truy cập:** công khai; người đã đăng nhập sẽ không cần dùng lại trang này trong luồng bình thường.

**Nội dung hiện có:**

- Biểu mẫu email và mật khẩu.
- Mật khẩu được kiểm tra độ dài từ 12 đến 72 ký tự ở phía giao diện.
- Liên kết đến đăng ký, chính sách bảo mật và phần giới thiệu thương hiệu.
- Sau khi đăng nhập: khách hàng được chuyển đến `/account`, quản trị viên được chuyển đến `/admin`.
- Hiển thị lỗi xác thực hoặc trạng thái đang gửi yêu cầu.

Nguồn: `apps/web/src/app/login/page.tsx`, `apps/web/src/components/auth-form.tsx`.

### `/register` — Đăng ký tài khoản

**Truy cập:** công khai.

**Nội dung hiện có:**

- Biểu mẫu họ tên, email và mật khẩu.
- Liên kết chuyển sang đăng nhập và liên kết chính sách bảo mật.
- Đăng ký hướng đến tài khoản khách hàng; giao diện không cung cấp cơ chế tự đăng ký quản trị viên.
- Có kiểm tra trạng thái gửi, thông báo lỗi và chuyển hướng sau khi đăng ký thành công.

Nguồn: `apps/web/src/app/register/page.tsx`, `apps/web/src/components/auth-form.tsx`.

### `/cart` — Giỏ hàng

**Truy cập:** khách hàng đã đăng nhập. Khách chưa đăng nhập được dẫn đến `/login`; quản trị viên không dùng luồng giỏ hàng.

**Nội dung hiện có:**

- Danh sách dòng hàng: ảnh, tên sản phẩm, giá, số lượng, thành tiền và thao tác xóa.
- Điều chỉnh số lượng, làm mới giỏ, cập nhật giá và xóa toàn bộ giỏ.
- Hiển thị cảnh báo khi giá thay đổi, sản phẩm không còn khả dụng hoặc số lượng yêu cầu vượt tồn kho.
- Phần tổng kết gồm tạm tính, phí giao hàng và tổng thanh toán.
- Nút chuyển đến checkout; giao diện trống có hướng dẫn quay lại chọn sản phẩm.

Nguồn: `apps/web/src/app/cart/page.tsx`, `apps/web/src/components/cart.tsx`.

### `/checkout` — Đặt hàng

**Truy cập:** khách hàng đã đăng nhập và có giỏ hàng hợp lệ.

**Nội dung hiện có:**

- Tóm tắt các mặt hàng, số lượng, giá, phí giao và tổng tiền.
- Khu vực giao đến/thông tin người nhận, sử dụng thông tin hoặc địa chỉ đã lưu khi có.
- Xác nhận thông tin nhận hàng và thanh toán COD trong phạm vi giao diện hiện tại.
- Liên kết đến chính sách bảo mật, đổi trả và ghi chú kiểm tra lại giá/tồn kho trước khi tạo đơn.
- Trạng thái lỗi khi dữ liệu giỏ hoặc thông tin giao hàng chưa hợp lệ.

Nguồn: `apps/web/src/app/checkout/page.tsx`, `apps/web/src/components/cart.tsx`.

## 3. Khu vực tài khoản khách hàng

### `/account` — Tài khoản

**Truy cập:** khách hàng đã đăng nhập.

Đây là điểm vào mặc định của không gian tài khoản; giao diện chuyển tới phần hồ sơ. Thanh điều hướng tài khoản gồm Hồ sơ, Sổ địa chỉ, Bảo mật, Đơn hàng, Đổi trả và Quyền riêng tư.

Nguồn: `apps/web/src/app/account/page.tsx`, `apps/web/src/components/account.tsx`, `apps/web/src/components/workspace-nav.tsx`.

### `/account/profile` — Hồ sơ cá nhân

**Nội dung hiện có:** ảnh đại diện dạng chữ cái, email, họ tên, số điện thoại, địa chỉ liên hệ và tùy chọn nhận ưu đãi/marketing. Người dùng có thể cập nhật thông tin và xem ghi nhận liên quan đến lựa chọn marketing.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/account/addresses` — Sổ địa chỉ

**Nội dung hiện có:** liệt kê địa chỉ đã lưu; thêm, sửa và xóa địa chỉ. Biểu mẫu gồm nhãn địa chỉ, người nhận, số điện thoại và địa chỉ giao hàng. Danh sách được dùng hỗ trợ luồng checkout.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account-settings.tsx`.

### `/account/security` — Bảo mật tài khoản

**Nội dung hiện có:** biểu mẫu đổi mật khẩu gồm mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới; có giới hạn 12–72 ký tự ở UI. Giao diện nêu thông tin các phiên khác sẽ được kết thúc sau khi đổi mật khẩu thành công.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account-settings.tsx`.

### `/account/orders` — Đơn hàng của tôi

**Nội dung hiện có:**

- Tìm theo mã đơn/người nhận/số điện thoại; lọc theo trạng thái đơn và thanh toán.
- Danh sách phân trang, hiển thị mã đơn, ngày tạo, tổng tiền, trạng thái đơn và thanh toán.
- Mở chi tiết: thông tin người nhận, địa chỉ, dòng hàng, tạm tính/phí giao/tổng tiền, trạng thái COD, mã vận đơn/chứng từ thanh toán và lịch sử xử lý nếu đã có.
- Khách hàng có thể sửa thông tin nhận hàng ở trạng thái cho phép, với lý do sửa bắt buộc.
- Khách hàng có thể hủy đơn khi đơn chưa ở trạng thái giao/hoàn tất và chưa thanh toán; giao diện yêu cầu xác nhận/lý do theo luồng xử lý.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/account/returns` — Yêu cầu đổi trả

**Nội dung hiện có:**

- Liệt kê các hồ sơ đổi trả thuộc tài khoản, trạng thái, sản phẩm liên quan và kết quả xử lý khi có.
- Tạo yêu cầu từ đơn đã giao: chọn một hoặc nhiều dòng hàng đủ điều kiện, số lượng, lý do, phương án mong muốn, mô tả và chứng cứ ảnh.
- Lý do có các nhóm như hư hỏng, sai hàng, thiếu hàng, không an toàn, chất lượng, không nhận được hàng hoặc đổi ý; tùy tình huống giao diện gợi ý giao bù/đổi/hoàn tiền.
- Mỗi hồ sơ có chi tiết yêu cầu, số lượng đề nghị/được duyệt, hoàn tiền, hàng trả, mã theo dõi/chứng từ nghiệp vụ và lịch sử xử lý.
- Có tải ảnh bằng chứng PNG/JPEG giới hạn dung lượng; thư viện ảnh hiển thị ảnh thu nhỏ và có thể bấm để mở xem ảnh trực tiếp ở tab mới.
- Khách có thể bổ sung mô tả và ảnh khi hồ sơ đang ở trạng thái yêu cầu bổ sung; có thể xác nhận/đồng ý kết quả hoặc rút yêu cầu khi giao diện cho phép.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/account/privacy` — Quyền riêng tư và yêu cầu dữ liệu

**Nội dung hiện có:**

- Tạo yêu cầu: xem dữ liệu, xuất dữ liệu, xóa, hạn chế xử lý hoặc khiếu nại.
- Có ô mô tả yêu cầu và cảnh báo riêng đối với yêu cầu xóa.
- Danh sách hồ sơ theo trạng thái; mở chi tiết để xem lịch sử xử lý và kết quả.
- Khi dữ liệu xuất đã được xử lý, giao diện cung cấp thao tác tải tệp xuất dữ liệu; khách có thể bổ sung thông tin trong hồ sơ còn mở khi được yêu cầu.

Nguồn: `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

## 4. Khu vực quản trị

### `/admin` — Trang quản trị mặc định

**Truy cập:** chỉ `ADMIN`.

Trang mặc định mở phần xử lý đơn hàng. Thanh điều hướng quản trị gồm Đơn hàng, Sản phẩm, Danh mục, Cấu hình, Đổi trả, Quyền riêng tư, Chính sách và Nhật ký.

Nguồn: `apps/web/src/app/admin/page.tsx`, `apps/web/src/components/account.tsx`, `apps/web/src/components/workspace-nav.tsx`.

### `/admin/orders` — Xử lý đơn hàng

**Nội dung hiện có:**

- Tìm kiếm/lọc và xem danh sách đơn của toàn hệ thống.
- Mở chi tiết người nhận, hàng hóa, giá, thanh toán, giao hàng và lịch sử.
- Chuyển tuần tự trạng thái đơn: mới đặt, đã xác nhận, đang đóng gói, đang giao và hoàn tất (tùy trạng thái hiện tại).
- Nhập mã vận đơn khi chuyển sang đang giao; ghi nhận thanh toán COD cần mã chứng từ/tham chiếu.
- Cho phép hủy đơn đủ điều kiện, sửa thông tin giao hàng có lý do và ghi chú xử lý.
- Giao diện nêu việc giao vận và thu tiền đang được ghi nhận thủ công trong demo nếu chưa tích hợp đối tác.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/admin/products` — Quản lý sản phẩm

**Nội dung hiện có:**

- Tìm kiếm theo tên/slug, lọc theo danh mục/trạng thái và phân trang.
- Thêm, sửa, ẩn/hiện và xóa sản phẩm (có xác nhận trước thao tác quan trọng).
- Biểu mẫu gồm tên, slug, danh mục, giá, tồn kho, mô tả, trạng thái hiển thị và ảnh sản phẩm.
- Hỗ trợ tải ảnh PNG/JPEG có giới hạn dung lượng, thay ảnh hoặc bỏ ảnh hiện tại.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/catalog-admin.tsx`.

### `/admin/categories` — Quản lý danh mục

**Nội dung hiện có:**

- Liệt kê, tìm kiếm/lọc, thêm, sửa, ẩn/hiện và xóa danh mục.
- Biểu mẫu có tên, mã danh mục, thứ tự hiển thị, mô tả, trạng thái và ảnh minh họa.
- Có cảnh báo/xác nhận khi thực hiện thao tác xóa hoặc thay đổi trạng thái.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/catalog-admin.tsx`.

### `/admin/settings` — Cấu hình bán hàng/giao hàng

**Nội dung hiện có:**

- Cấu hình phí giao hàng cơ bản, ngưỡng miễn phí giao hàng và cho phép/tạm dừng nhận đơn mới.
- Xem phiên bản cấu hình và xác nhận trước khi lưu.
- Giao diện lưu ý phí của đơn đã tạo vẫn được giữ theo dữ liệu đơn đó.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/catalog-admin.tsx`.

### `/admin/returns` — Xử lý hồ sơ đổi trả

**Nội dung hiện có:**

- Danh sách và chi tiết hồ sơ đổi trả của khách hàng.
- Xem sản phẩm, lý do, ảnh bằng chứng, số lượng, lịch sử và đề xuất của khách.
- Ảnh bằng chứng hiển thị dạng thumbnail; bấm vào ảnh sẽ mở xem trực tiếp ở tab mới, không bắt buộc tải tệp.
- Các thao tác xử lý gồm cập nhật bước tiếp theo/trạng thái, yêu cầu bổ sung chứng cứ, đề xuất/duyệt số lượng và phương án xử lý, ghi nhận hàng thu hồi/kiểm tra, mã vận đơn hoặc mã chứng từ, ghi chú nghiệp vụ.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/admin/privacy` — Xử lý yêu cầu dữ liệu cá nhân

**Nội dung hiện có:**

- Xem danh sách yêu cầu quyền riêng tư của khách hàng và lịch sử từng hồ sơ.
- Cập nhật trạng thái, ghi nhận nội dung/kết quả xử lý và phản hồi theo luồng giao diện.
- Có thể xử lý kết quả xuất dữ liệu để khách tải từ khu vực tài khoản khi hoàn tất.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/admin/policies` — Quản lý nội dung chính sách

**Nội dung hiện có:**

- Tạo/lưu phiên bản nội dung chính sách với mã phiên bản và nội dung văn bản.
- Hiển thị cảnh báo về bản dự thảo và xem các phiên bản lịch sử.
- Nội dung tại `/privacy-policy` lấy từ dữ liệu chính sách đang được chọn; việc công bố hiệu lực cần được nhóm dự án xác nhận theo quy trình nghiệp vụ.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

### `/admin/audit` — Nhật ký hoạt động

**Nội dung hiện có:**

- Danh sách nhật ký dạng chỉ đọc: thời điểm, hành động, đối tượng/liên quan và thông tin mô tả hiện có.
- Mục đích là giúp quản trị viên tra cứu hoạt động quản trị/nghiệp vụ trong phạm vi dữ liệu hệ thống trả về.

Nguồn: `apps/web/src/app/admin/[section]/page.tsx`, `apps/web/src/components/account.tsx`.

## 5. Trang trạng thái và hành vi dùng chung

### Trang không tìm thấy

Khi truy cập route không tồn tại hoặc `section` không được hỗ trợ, giao diện hiển thị “Không tìm thấy trang” cùng liên kết quay lại Gói Huế.

Nguồn: `apps/web/src/app/not-found.tsx`, `apps/web/src/app/account/[section]/page.tsx`, `apps/web/src/app/admin/[section]/page.tsx`.

### Thông báo trạng thái

Toàn ứng dụng có khu vực thông báo dùng chung cho thao tác đang xử lý, thành công và lỗi. Dữ liệu trạng thái tài khoản/giỏ/đơn được làm mới từ API khi cần; giao diện cũng có cơ chế nhận cập nhật thời gian thực để làm mới thông tin hiển thị.

Nguồn: `apps/web/src/components/site-shell.tsx`, `apps/web/src/lib/store.tsx`.

### Responsive và hình ảnh

Các khối header, lưới sản phẩm, form, sidebar không gian làm việc và thẻ chi tiết dùng stylesheet chung để co giãn cho màn hình nhỏ và lớn. Ảnh sản phẩm, danh mục và ảnh chứng cứ có trạng thái dự phòng nếu chưa có ảnh.

Nguồn: `apps/web/src/styles/heritage.css`, `apps/web/src/styles/store.css`, `apps/web/src/components/product/product-image.tsx`.

## 6. Route hỗ trợ kỹ thuật, không phải trang người dùng

`/api/store/[...path]` là route trung gian phía Next.js để frontend gọi các API nghiệp vụ cùng nguồn (BFF/proxy). Route này không có giao diện trang để người dùng truy cập như các URL nêu trên.

Nguồn: `apps/web/src/app/api/store/[...path]/route.ts`.

## 7. Ghi chú về dữ liệu và phạm vi hiện tại

- Danh sách sản phẩm, danh mục, đơn hàng, địa chỉ, chính sách và hồ sơ được lấy động từ API; vì vậy nội dung cụ thể có thể thay đổi sau khi người dùng/quản trị viên thao tác.
- Các trang quản trị bị giới hạn theo vai trò trên giao diện và cần API tiếp tục kiểm soát quyền truy cập.
- Các chính sách hiển thị nhãn dự thảo; không nên mô tả chúng như chính sách đã có hiệu lực cho tới khi nhóm dự án xác nhận phiên bản, đầu mối liên hệ và quy trình công bố.
- Không tính các API route là trang frontend. Danh sách trong tài liệu là các URL giao diện có thể điều hướng hoặc trạng thái hiển thị đi kèm.
