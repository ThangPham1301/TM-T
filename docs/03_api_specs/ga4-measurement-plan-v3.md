# Gói Huế — Thiết kế GA4 v3 theo hệ thống hiện tại

**Ngày:** 23/11/2026 · **Trạng thái:** đặc tả đề xuất để triển khai, chưa phải biên bản nghiệm thu.

**Code đã khảo sát:** `TM-T-main`, nhánh `main`, commit `691599302d71de9627a370ff72f4eeade9f55909`. Đã pull `origin/main` trước khi khảo sát; working tree sạch tại thời điểm đọc. Các đường dẫn mã nguồn bên dưới tính từ thư mục repo này.

**Phạm vi được thống nhất:** đo nguồn truy cập, quan tâm sản phẩm, phễu đặt đơn mô phỏng, nội dung câu chuyện và ưu đãi. Tài liệu này thay phần thiết kế kỹ thuật của v2; không tự thay code, API, cấu hình GA4 hoặc website live.

**Giới hạn kiểm chứng:** đọc source frontend/backend, hợp đồng API và cấu hình Docker/Compose; chưa chạy web, chưa truy vấn database production và chưa kiểm tra quyền/cấu hình trong tài khoản GA4. Phân biệt rõ **hiện có trong code** và **cần bổ sung** ở mọi mục.

## 1. Mục tiêu và cách hiểu dữ liệu

Web cho phép người thật hoàn tất đơn mô phỏng. Theo phạm vi đồ án, các đơn này không đại diện cho giao hàng hoặc thu tiền thật. GA4 đo hành vi thực tế trong môi trường mô phỏng, không chứng minh nhu cầu mua có trả tiền.

`purchase` trong thiết kế này nghĩa là **backend đã tạo đơn mô phỏng thành công**, áp dụng cho COD và VIETQR; không chờ trạng thái PAID hay DELIVERED. Đặt tên bảng/slide là “đơn mô phỏng”, “giá trị hàng hóa mô phỏng” và “tỷ lệ hoàn tất đơn mô phỏng”. Code hiện vẫn có trạng thái thanh toán và tích hợp thanh toán; việc kiểm soát vận hành mô phỏng cần được người phụ trách triển khai xác nhận riêng, GA4 không thực hiện việc đó.

| Nhóm | Câu hỏi cần trả lời | Kết quả cần có |
|---|---|---|
| Nguồn truy cập | Kênh/bài đăng nào mang người đến, người đến có tiếp tục không? | Sessions, engaged sessions, phiên checkout/purchase theo Session source/medium/campaign |
| Sản phẩm | Món/danh mục nào được thấy, chọn, xem và thêm giỏ? | Người dùng, số lượt và số lượng món theo Item ID/Category; tách các đơn vị |
| Phễu | Người dùng tiếp tục/dừng ở bước nào? | Chuỗi xem món → thêm giỏ → checkout → tạo đơn; đường đi thực tế hỗ trợ |
| Câu chuyện | Nội dung nào được nhìn thấy, CTA nào dẫn sang sản phẩm? | Lượt tiếp xúc câu chuyện, click CTA, so sánh nhóm tiếp xúc/chưa tiếp xúc |
| Ưu đãi | Ưu đãi nào được nhìn thấy/chọn và ưu đãi nào thực sự được áp dụng? | Exposure/click theo offer; đơn có ưu đãi, giá trị giảm và AOV sau giảm |

Không bịa số, không dùng bot để tạo KPI. QA chạy kịch bản là dữ liệu kiểm thử; trải nghiệm có hướng dẫn phải báo cáo riêng với traffic tự nhiên.

## 2. Phát hiện từ code và hệ quả thiết kế

| Hiện trạng xác nhận trong source | Hệ quả cho GA4 |
|---|---|
| Next.js App Router; `apps/web/package.json` khai báo Next 16.4.6, React 19.3.0 | Cần kiểm tra điều hướng SPA, không chỉ page load. Phiên bản ở đây là phiên bản khai báo, chưa xác minh package đã cài |
| Root layout có StoreProvider, PublicOffersProvider, StoreFeaturedOffer và AssistantWidget | Một bộ nạp analytics ở root có điều kiện; không gắn script riêng ở từng trang |
| Không tìm thấy `gtag`, `NEXT_PUBLIC_GA`, GoogleAnalytics hoặc bộ nạp googletagmanager trong source web đã rà | Không kế thừa khẳng định “đã có tracking” của tài liệu cũ. Triển khai tích hợp mới sau khi đối chiếu môi trường deploy |
| Product có UUID `id`, `slug`, `category`, giá và pricing; luồng save/catalog khảo sát chưa có trường SKU chuẩn | Dùng **UUID productId làm `item_id` xuyên suốt**, không giả định chín SKU giấy đã tồn tại trong app |
| Danh mục trong giao diện/story dùng `me-xung-keo-hue`, `banh-cung-dinh`, `tra-cung-dinh`, `qua-bieu` | Không hard-code taxonomy cũ “Mứt/Trà Huế” độc lập với dữ liệu app |
| Home hiện là banner/danh mục/câu chuyện; không có lưới ProductCard như v1 giả định | Không phát `view_item_list` cho home chỉ vì vào trang chủ |
| Collection tải products/categories, lọc ở client, phân trang 9 món; pricing cập nhật riêng | Đo các card thực sự hiển thị; render lại hoặc polling giá không nhân lượt hiển thị |
| ProductCard chỉ dẫn tới chi tiết, không tự thêm giỏ | `select_item` khi click card; không gửi `add_to_cart` ở nút “Chọn mua” này |
| ProductDetail.purchase(buyNow) thêm vào giỏ rồi mới chuyển `/checkout` | “Mua ngay” hiện vẫn có `add_to_cart`; chưa cần tạo nhánh phễu bỏ qua bước thêm giỏ |
| Cart-set nhận **số lượng cuối cùng**, dùng ở detail, giỏ và trợ lý AI; mua lại dùng endpoint xác nhận thay giỏ atomic | Đo phần tăng/giảm so với trạng thái trước; không gửi toàn bộ số lượng mới như lượng vừa thêm |
| Tab câu chuyện ở chi tiết mặc định là tab 0 | Hiển thị câu chuyện không đồng nghĩa chủ động click mở; cần đo visibility và phân biệt ngữ cảnh |
| Ưu đãi tự động và quy tắc giá là hai hệ thống riêng | Không gọi tất cả là coupon; không dùng banner đang xem để suy ra ưu đãi được áp dụng |
| Guest checkout dùng cùng CommerceApi.checkout nhưng receipt được lọc trường | Cần một snapshot an toàn thống nhất cho cả guest/account; không gửi nguyên order sang GA4 |
| Cart summary không có phân bổ giảm theo item; order lưu có điều kiện `netTotal`, guest thiếu discount metadata/pricing/category | Cần bổ sung dữ liệu trước khi đo chính xác giá trị item, offer và nguồn giá tại checkout/purchase |
| StoreProvider.mutate chờ reload state sau POST của account; reload có thể ném lỗi | Ghi nhận thành công POST trước reload, tránh mất `purchase` dù đơn đã được tạo |
| Dockerfile web và compose.coolify.yml chưa có build args GA4 | Chỉ thêm biến runtime trên Coolify chưa đủ; cần truyền biến vào build stage |

Không lấy danh mục seed làm bằng chứng danh mục đang live. Không thay đổi Item ID giữa view và purchase; nếu tương lai bổ sung SKU, giữ UUID và dùng SKU như thuộc tính riêng hoặc lập kế hoạch chuyển dữ liệu có mốc rõ ràng.

## 3. Kiến trúc thu thập đề xuất

```text
Người dùng thao tác / nội dung xuất hiện trong viewport
             │
             ├─ UI exposure/selection → tracker visibility/router
             │
             └─ API mutation thành công
                   → snapshot an toàn + kết quả mutation
                   → dispatcher duy nhất trong StoreProvider
                              │
                     mapping + validation
                     route gate + QA gate
                     chống lặp + làm sạch URL
                              │
                          gtag.js
                              │
                        một GA4 Web stream
                              │
                  Reports / Explore / đối chiếu app
```

### 3.1 Phân công trách nhiệm

| Lớp | Trách nhiệm |
|---|---|
| Backend | Quyết định giá/ưu đãi/đơn đã thành công; cấp dữ liệu snapshot sau phân bổ giảm giá; không gửi GA4 trong giai đoạn này |
| StoreProvider/mutation dispatcher | Sau POST thành công, tạo event từ dữ liệu an toàn đúng action; xử lý một lần, trước reload và điều hướng |
| Component | Báo visibility/click; cấp `source_surface`; không gửi lại event commerce mà dispatcher đã phụ trách |
| Helper analytics | Allowlist tên/trường, schema, làm sạch URL, không PII, chống lặp, fail-open cho chức năng bán hàng |
| GA4 | Tính phiên, engagement, ecommerce và báo cáo; không thay backend tính tiền hoặc quyết định ưu đãi |

Gắn gtag trực tiếp; chưa cần GTM, Measurement Protocol hoặc server-side tagging. Không gửi purchase từ cả backend lẫn frontend. GA4 là lớp phân tích có thể bị chặn hoặc mất hit, app là nguồn sự thật của đơn hàng.

### 3.2 Module dự kiến, chưa tồn tại

- `apps/web/src/components/analytics.tsx`: nạp script, initial config và pageview SPA.
- `apps/web/src/lib/analytics.ts`: API `trackEvent`, kiểm tra payload, URL/referrer và chống lặp.
- `apps/web/src/lib/analytics-commerce.ts`: map snapshot thành ecommerce events, xử lý phân bổ trên đơn vị.
- `apps/web/src/lib/analytics-visibility.ts`: hook visibility dùng chung cho card/story/offer.
- Backend có thể tách `CommerceMeasurement` mapper; đây là đề xuất cấu trúc, không yêu cầu đưa logic GA4 vào nghiệp vụ tính giá.

Helper tuyệt đối không ném lỗi làm hỏng checkout. Khi không có ID, không được phép đo hoặc tag bị chặn, chức năng website vẫn chạy. Không đưa lỗi analytics lên luồng mua hàng.

## 4. Property, môi trường và deployment

Thông tin kế thừa từ v2 do nhóm cung cấp, **chưa kiểm chứng qua tài khoản**:

| Tầng | Giá trị |
|---|---|
| Account | `Nhom De Tai 2 - OCOP`, ID `412475789` |
| Property | `Goi Hue — Web`, ID `565253409` |
| Stream | Web `https://goihue.io.vn`, stream ID `16378804114` |
| Measurement ID | `G-06239FHPPM` |
| Cấu hình cần xác nhận | Múi giờ Việt Nam UTC+7; currency VND; retention sự kiện 14 tháng; Google Signals tắt; quyền theo từng email |

Không tạo account/property mới chỉ vì tài liệu dùng tên khác. Xác nhận ID/property đúng trước deploy; không lấy trạng thái “chưa nhận dữ liệu” ghi ngày 20/11 làm trạng thái ngày 23/11.

Biến đề xuất:

| Biến | Ý nghĩa |
|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | ID Web stream; mặc định G-06239FHPPM; đây là định danh công khai, không phải API secret |
| `NEXT_PUBLIC_GA_ENABLED` | Bật/tắt integration tại build; mặc định true theo yêu cầu triển khai; đặt false để tắt rõ ràng |

Integration mặc định bật cho stream của dự án, nhất quán giữa Next trực tiếp, Docker và Compose. QA dùng capture để không gửi Google hoặc `debug_mode` cho thiết bị QA; không bật debug cho toàn bộ khách production. Sau kiểm chứng filter có thể dùng cùng property; môi trường test riêng là phương án thay thế nếu nhóm chưa thể bảo đảm tách dữ liệu, không phải yêu cầu bắt buộc.

**Các file deployment cần sửa khi triển khai:** Dockerfile web khai báo ARG/ENV trước `npm run build`; `compose.coolify.yml` truyền `build.args`; cập nhật `.env.example`, tài liệu deploy và compose khác nếu dùng chúng. Chỉ đổi Environment runtime không làm thay đổi public env đã đóng vào bundle. Xây dựng lại image và kiểm tra request thực tế sau deploy.

## 5. Dữ liệu nền và snapshot cần bổ sung

### 5.1 Định danh và giá

| Trường GA4 | Nguồn chuẩn |
|---|---|
| `item_id` | Product UUID: product.id ở view; productId ở cart/order |
| `item_name` | Tên app tại lúc hành động; order dùng snapshot lúc tạo đơn |
| `item_category` | Category **code** của app, ví dụ `tra-cung-dinh`; dùng code ổn định, tránh đổi label làm tách lịch sử |
| `item_list_id` | `catalog`, `product_related`, `cart_recommendations`; các vị trí khác chỉ thêm nếu thật sự có ProductCard |
| `item_list_name` | Nhãn danh sách tương ứng; không dùng từ khóa người dùng làm ID |
| `index` | Vị trí 0-based trên danh sách đang trình bày; giữ cùng quy ước khi view/select |
| `price_source` | `BASE`, `SCHEDULE`, `STOCK`, `DEMAND`; custom item parameter |
| `price` | Giá bán hiện hành ở view/add; giá sau phân bổ ưu đãi ở begin_checkout/purchase |

`pricing.basePrice` là giá thường; `pricing.amount` là giá được resolve. Chênh lệch giá thường/giá theo quy tắc không được cộng tiếp như ưu đãi tự động. Giá theo quy tắc cũng không mặc định luôn thấp hơn giá thường.

### 5.2 Khoảng thiếu dữ liệu hiện tại

1. Cart line thiếu category trong snapshot; summary chưa trả giảm/net theo từng dòng.
2. Order item có `productId`, tên, giá, số lượng, pricing; chỉ có `discountAmount`/`netTotal` khi có giảm. Chưa có category snapshot thống nhất.
3. Guest receipt giữ số đơn, tổng tiền giảm và các dòng giá/netTotal, nhưng bỏ `discount`, `netSubtotal`, pricing và category. Không có đủ dữ liệu nhận diện chương trình được áp dụng.
4. Cart-set là set quantity, chưa trả before/after quantity cùng dữ liệu measurement thống nhất.

Không chữa bằng cách tải catalog mới sau tạo đơn để suy ra category/giá cũ. Không gắn chín SKU trong bảng v2 vào UUID bằng phỏng đoán.

### 5.3 Đề xuất contract `measurement` v1

Thêm object chỉ chứa dữ liệu thương mại an toàn vào summary và kết quả mutation. Các trường nghiệp vụ hiện có vẫn giữ nguyên. Đây là **đề xuất thay đổi API**, chưa implement.

**Summary/checkout snapshot:**

```json
{
  "measurement": {
    "schemaVersion": 1,
    "transactionId": "GH-DEMO0001",
    "currency": "VND",
    "subtotal": 100000,
    "discountAmount": 10000,
    "netSubtotal": 90000,
    "shippingFee": 20000,
    "total": 110000,
    "paymentMethod": "COD",
    "discount": {
      "id": "offer-demo-01",
      "revision": 1,
      "name": "Ưu đãi minh họa"
    },
    "items": [
      {
        "productId": "11111111-1111-4111-8111-111111111111",
        "name": "Sản phẩm minh họa",
        "categoryCode": "me-xung-keo-hue",
        "quantity": 2,
        "unitPrice": 50000,
        "priceSource": "BASE",
        "lineDiscountAmount": 10000,
        "lineNetTotal": 90000
      }
    ]
  }
}
```

Đây là fixture minh họa, không phải dữ liệu người dùng hoặc giá live. Summary không có `transactionId`/`paymentMethod` khi chưa tạo đơn. Order bắt buộc có hai trường đó, transactionId dùng **order.number cho cả guest/account**, không dùng UUID ở account nhưng number ở guest.

Các trường bắt buộc:

- `schemaVersion`, `currency`, năm tổng tiền, `items[]` như mẫu. `discount` có thể null khi không áp dụng; không tự điền ưu đãi đang quảng bá.
- Mỗi item bắt buộc đủ định danh, category, số lượng, unitPrice, priceSource và hai giá trị dòng. Dòng không giảm: `lineDiscountAmount = 0`, `lineNetTotal = unitPrice × quantity`.
- Snapshot summary tính trong cùng transaction/read snapshot với quote. Snapshot order được tạo và lưu khi checkout commit, giữ nguyên khi catalog/offer đổi hoặc retry.
- `discount.id/revision/name` là chương trình thắng theo backend; revision giúp đối chiếu app, không cần đăng ký thành dimension GA4.
- Không có recipient, phone, address, email, userId, guest token, lookupCode, QR payload, tài khoản ngân hàng, cartToken, quoteToken hoặc Idempotency-Key trong object này.

**Cart mutation measurement:** kết quả `cart-set` cần thêm `measurementMutation` gồm `schemaVersion`, `operationId` ngẫu nhiên không gắn danh tính, product metadata an toàn, `previousQuantity`, `newQuantity`, `effectiveUnitPrice`, `priceSource`. Khi xóa dòng vẫn trả metadata trước xóa. `cart-clear` trả danh sách dòng vừa xóa. `operationId` phải được giữ nguyên khi replay cùng Idempotency-Key; không gửi raw Idempotency-Key vào GA4.

Khi tăng số lượng trên dòng có giá snapshot cũ, `effectiveUnitPrice` cho event phải phản ánh giá đã được backend chấp nhận cho dòng đó, không tự lấy pricing feed mới nếu người dùng chưa xác nhận giá.

Guest receipt, replay, latest/detail có quyền truy cập phù hợp và account checkout đều phải trả snapshot an toàn theo cùng schema. Chỉ checkout success/recovery đủ điều kiện mới dùng để phát purchase; việc đọc lịch sử đơn không tự tạo purchase.

### 5.4 Contract và tương thích

Hợp đồng hiện tại của app khảo sát nằm ở `docs/03_api_specs/goihue.openapi.yaml` và state matrix tương ứng. Khi implement, cập nhật schema/response của `/cart/summary`, `/guest/cart/summary`, `/commerce`, `/guest/commerce` và receipt đọc lại nếu có thêm measurement. Kiểm tra cả các contract stable khác đang bao phủ operation đó theo AGENTS.md; không sửa generated artifacts thay cho nguồn contract.

Thay đổi đề xuất là thêm trường, giữ envelope cũ. Cần đủ ví dụ account/guest, không giảm/có giảm, replay và lỗi. Không thêm endpoint analytics công khai nhận mã đơn bất kỳ. Không mở rộng quyền truy cập đơn để phục vụ GA4.

Đơn lịch sử chưa có snapshot: giữ nguyên trạng thái thiếu và không phát purchase hồi tố; không dùng catalog hiện tại để tạo dữ liệu lịch sử như thể đã được ghi lúc mua.

## 6. Đo nguồn truy cập và pageview SPA

### 6.1 UTM và phạm vi thời gian

Chọn campaign có mốc lịch rõ, ví dụ `goihue_20261123_20261129`; không dùng “tuần 1” mà thiếu bảng ngày bắt đầu/kết thúc. Giữ cùng campaign cho các kênh trong kỳ.

```text
TikTok:   ?utm_source=tiktok&utm_medium=social&utm_campaign=goihue_20261123_20261129&utm_content=bio
Facebook: ?utm_source=facebook&utm_medium=social&utm_campaign=goihue_20261123_20261129&utm_content=reel_01
```

Gia giữ bảng link: ngày đăng, nền tảng, vị trí CTA, URL, campaign/content. Có thể gộp kỳ đo khác nếu nhóm đã chốt; không tự thay link đã phát hành mà thiếu nhật ký. Không gắn UTM vào link nội bộ. Kiểm tra redirect giữ UTM. Không có UTM không nhất thiết thành direct, nhưng campaign khó xác định chính xác.

### 6.2 Một cơ chế pageview

- Nạp một gtag; đặt `send_page_view: false` bằng global `gtag('set', ...)` **trước** `gtag('js', ...)`, đồng thời giữ trong initial config; tắt Enhanced Measurement pageview theo history. Privacy defaults và QA debug cũng phải có trước khởi tạo. Kiểm tra F3 ngày 24/11/2026 cho thấy chỉ đặt ở config vẫn có pageview tự động thừa trên app thật; xem `docs/04_testing/ga4/README.md`.
- Router tracker gửi trang đầu và navigation hợp lệ, Back/Forward; không dùng render hoặc mọi thay đổi searchParams làm một pageview.
- Page key: pathname + category/discount/pricing có trong URL khi chúng tạo trang đích khác; loại `q`, `don`, `order`, `xac-nhan`, UTM và hash khỏi khóa chống lặp. UTM vẫn được giữ trong **initial sanitized page_location** để attribution, không bị bỏ trước config.
- Filter/search/pagination tại Collection đổi state client: phát list/search, không tự tạo pageview. `replaceState` để reset bộ lọc không tự phát thêm pageview trên cùng pathname. Nếu sau này chuyển filter sang điều hướng route thực, phải chốt lại quy tắc.
- Khi rời A sang B rồi quay lại A được tính lượt xem mới; không dùng một Set URL cho cả phiên để chặn tất cả lượt trở lại.
- `page_title` phải là tiêu đề đã ổn định của trang; root metadata hiện có thể không phân biệt đủ product. Đề xuất pageview ban đầu dùng nhãn route an toàn, phân tích từng sản phẩm dựa `view_item`, không phát pageview thứ hai chỉ vì API product vừa tải xong.

### 6.3 URL và phạm vi thu thập

Chỉ đo storefront `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/cau-chuyen-hue` và trang nội dung công khai được allowlist. Không gắn ecommerce khi admin/staff thao tác.

Mặc định không đo `/admin/**`, account/orders, login/register, tra cứu đơn, trace/evidence/privacy export hoặc trang chứa thông tin người nhận. Purchase phát tại checkout success trước chuyển trang nên không phụ thuộc trang xác nhận.

**Ngoại lệ mua lại trong account:** không nạp GA4 hoặc gửi pageview tại trang lịch sử. Xác nhận Mua lại thành công qua `POST /orders/{id}/reorder` trả measurementMutation với chênh lệch ròng trước/sau thay giỏ và operationId lưu cùng kết quả idempotent; preview và xác nhận thất bại không tạo event. Payload thương mại an toàn được lưu trong hàng đợi cục bộ; gửi khi điều hướng về `/checkout` hoặc storefront được phép đo. Giữ source_surface=reorder, TTL 30 phút và dedup operationId; không kèm đường dẫn đơn cũ hay thông tin tài khoản. Nếu người dùng ở lại vùng riêng tư và không quay về trước TTL, bỏ payload và ghi nhận giới hạn thiếu hit; không mở tracking trang lịch sử để bù. Thời điểm GA4 nhận event là lúc quay về storefront, không giả định hỗ trợ backdate tùy ý qua gtag.

Làm sạch `page_location`/`page_referrer` trong initial config và mọi event: bỏ hash và query ngoài allowlist; bỏ `q`, `don`, `order`, mã tra cứu và các tham số nhạy cảm. UTM chỉ nhận giá trị campaign/source/content do nhóm quy định, không chép arbitrary query vào analytics. Referrer giữ origin/path an toàn, bỏ query nhạy cảm.

**Enhanced Measurement giai đoạn đầu tắt**, tránh auto form/search/outbound gửi trường ngoài kiểm soát; `session_start`, first_visit, user_engagement do GA4 quản lý, không tự phát. Đặc biệt kiểm tra request tự động chứ không chỉ event do helper gửi.

Để việc không đo trang riêng tư có hiệu lực cả khi gtag đã được nạp trên storefront: thiết kế ranh giới điều hướng full-document khi chuyển từ vùng đo sang vùng không đo; tài liệu triển khai phải kiểm kê các link/router.push liên quan. Trang đích không khởi tạo GA4. Chỉ unmount React component analytics không đủ bảo đảm script/global listeners đã biến mất. Khi người dùng Back về storefront, tracker được khởi tạo lại với URL sạch. Nếu không làm được ranh giới này, không được nghiệm thu tuyên bố “không đo vùng riêng tư” trước khi kiểm tra toàn bộ automatic requests và chọn giải pháp tương đương.

Nguồn: [Google — Measure pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views), [SPA](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).

## 7. Taxonomy sự kiện

Tất cả event thương mại do client gửi chỉ sau API success; bảng là yêu cầu của dự án, không phải danh sách trường bắt buộc chung của GA4.

| Event | Loại/ưu tiên | Trigger chính xác | Payload chính | Chống lặp |
|---|---|---|---|---|
| `page_view` | Chuẩn, P0 | Theo §6, sau route hợp lệ | URL/title/referrer sạch | Navigation instance |
| `session_start`, `first_visit`, `user_engagement` | Tự động | GA4 quản lý | Không tự chế tham số định danh | Không gắn tay |
| `view_item_list` | Recommended, P0 | ProductCard thực sự visible sau load thành công | list id/name, items, index | Mỗi card/list instance, không theo polling |
| `select_item` | Recommended, P0 | Click link ảnh/tên/Chọn mua ở card | Một item, list id/name/index | Một click handler cho một activation |
| `view_item` | Recommended, P0 | Detail đã tải đúng sản phẩm và render thành công | currency/value/items quantity 1 | Một product/navigation instance |
| `add_to_cart` | Recommended, P0 | Cart-set success có newQuantity > previousQuantity | Chỉ quantity delta; giá accepted; source_surface | operationId |
| `remove_from_cart` | Recommended, P1 | Cart-set success giảm/xóa hoặc clear | Chỉ phần vừa bỏ; giá snapshot | operationId; không tính merge/reprice |
| `view_cart` | Recommended, P1 | CartView đã hiển thị summary thành công | currency/value/items theo snapshot net | Một lần vào cart, không theo refresh 15 giây |
| `begin_checkout` | Recommended, P0 | CheckoutView thật sự hiển thị form với ít nhất một dòng và quote hiện hành, không phải Payment view | currency/value/items net; checkout_type; has_auto_discount; offer metadata nếu có | Một lần vào checkout, không theo refresh quote |
| `purchase` | Recommended/key event, P0 | Checkout POST success, có snapshot đơn đã lưu | transaction_id/currency/value/shipping/items; payment_method; checkout_type; offer metadata | transactionId, trước reload/navigation |
| `view_story` | Custom, P0 | Story block đạt tiêu chí visibility §9 | story_id, story_surface, story_mode | story + surface + instance |
| `story_cta_click` | Custom, P0 | Click CTA từ nội dung câu chuyện sang catalog/detail | story_id, story_surface, target_type | Một activation |
| `view_offer` | Custom, P0 | Offer được hiển thị đủ điều kiện §10 | offer_id/name, offer_surface | Offer/surface/instance |
| `select_offer` | Custom, P0 | Click CTA mua thêm/xem sản phẩm của offer | offer_id/name, offer_surface | Một activation |
| `search` | Recommended, P1 | Kết quả tìm kiếm ổn định sau debounce 800ms; xem §11 | search_term sạch, results_count, search_surface | Query/filter context, không theo polling |
| `select_content` | Recommended, P1 | Người chọn danh mục ở menu, home hoặc filter | content_type=category, content_id=category code, source_surface | Một activation |

P0 hoàn thành đủ năm mục tiêu; P1 giúp giải thích sâu hơn, không phải điều kiện bắt buộc để bắt đầu đo P0. Chưa đo add_shipping_info/add_payment_info, chat transcript, lifecycle thanh toán/hoàn tiền hoặc dự đoán người mua trong giai đoạn này.

**Làm rõ sau QA:** navigation instance là một lượt vào trang; reload toàn bộ document tạo instance mới. Cùng card thực sự hiển thị trên trang mới được ghi lại một lượt `view_item_list`. Chống trùng ở đây ngăn render lại, polling, focus refresh hoặc remount nội dung trong cùng instance tạo thêm lượt. Không đổi event impression thành chỉ số “mỗi sản phẩm một lần trong cả phiên”; nếu cần chỉ số duy nhất thì phân tích riêng. Checklist nghiệm thu cũ ghi “no refresh duplicates” quá ngắn nên đã được làm rõ ở `docs/04_testing/ga4/acceptance.md`.

`begin_checkout` ghi “đã bắt đầu trải nghiệm checkout”, không hứa giỏ chắc chắn mua được: giỏ có thay đổi giá có thể vẫn hiện form cùng cảnh báo. Giỏ rỗng, load lỗi, form không hiển thị thì không gửi. Nếu quote đổi sau lúc bắt đầu, purchase dùng giá cuối từ order; không gửi lại begin_checkout chỉ để cập nhật tiền.

Chọn custom `view_offer`/`select_offer` vì một chương trình có thể áp cho CART hoặc nhóm sản phẩm, không có một promoted item cố định; chưa dùng báo cáo item promotion chuẩn và không tạo item giả. Đây là quyết định phạm vi có chủ ý. Nếu sau này dùng `view_promotion`/`select_promotion`, lập mapping theo sản phẩm thật và tránh gửi song song hai bộ sự kiện cho cùng KPI.

## 8. Quy tắc thương mại và phát sự kiện mutation

### 8.1 Giá và giảm giá

Phân biệt hai tầng:

1. **PricingService** resolve giá theo ưu tiên SCHEDULE → STOCK → DEMAND → BASE, có kiểm tra giá sàn. STOCK xét tồn kho >= threshold; DEMAND xét sales snapshot <= threshold. Snapshot sức mua được lập từ các ngày lịch hoàn tất, không lấy số GA4 để đổi giá.
2. **DiscountService** chỉ xét dòng `priceSource = BASE`. Phạm vi PRODUCT/PRODUCTS/CART; điều kiện QUANTITY hoặc SUBTOTAL trên tập dòng đủ điều kiện; cách giảm PERCENT/FIXED. Chọn **một** chương trình cho mức giảm thực tế cao nhất, không cộng dồn. Giảm bị chặn bởi giá sàn; mặc định sàn bằng giá thường nên nếu chưa hạ sàn, cấu hình offer có thể chưa tạo ra khoản giảm.

Nếu hai offer giảm bằng nhau, code giữ offer được duyệt trước trong danh sách active đã sắp theo priority, startsAt, id. `featured` chủ yếu phục vụ hiển thị, không có nghĩa luôn được áp vào đơn. Giá quy tắc của một món và ưu đãi trên món BASE khác có thể cùng xuất hiện trong một đơn, nhưng cùng một món non-BASE không được cộng thêm offer.

### 8.2 Mapping tiền sang GA4

```text
purchase.value       = measurement.netSubtotal
purchase.shipping    = measurement.shippingFee
transaction_id       = measurement.transactionId = order.number
has_auto_discount    = discountAmount > 0 ? "yes" : "no"
offer_id/offer_name   = measurement.discount (chỉ khi thực sự có giảm)
sum(item.price * quantity) = value
value + shipping = measurement.total
```

App hiện không có tax field riêng trong tổng tiền khảo sát: không tự tạo `tax`; nếu nghiệp vụ thuế đổi phải cập nhật contract và phép đối chiếu. Không gửi `total` gồm ship làm `value`.

`items[].discount` chỉ biểu diễn **ưu đãi tự động đã phân bổ trên đơn vị**, không cộng cả chênh lệch basePrice/amount. Với non-BASE: price bằng giá resolve, discount = 0; phân tích nguồn giá bằng `price_source`. Vì vậy tổng Item discount amount trong thiết kế này có nghĩa “giảm do offer”, không phải tất cả chênh lệch so với giá niêm yết.

Đối với view_item/add_to_cart, ưu đãi có thể còn phụ thuộc giỏ nên không tự tính discount từ banner. Dùng giá bán accepted; begin_checkout/purchase mới dùng allocation của quote/order.

### 8.3 Làm tròn chính xác theo VND

Backend phân bổ giảm theo dòng và có thể có số dư không chia hết quantity. Không làm tròn độc lập đơn giá rồi khiến tổng GA4 lệch đơn.

Với dòng q món, đơn giá u, giảm cả dòng D:

```text
b = floor(D / q)
r = D % q
q-r món: discount=b,   price=u-b
r món:   discount=b+1, price=u-b-1
```

Bỏ nhóm quantity=0; hai nhóm giữ cùng item_id/name/category/price_source. Ví dụ 3 món × 50.000đ, giảm 10.000đ: hai món giá 46.667đ, giảm 3.333đ/món; một món giá 46.666đ, giảm 3.334đ. Tổng sau giảm đúng 140.000đ. Hai entry cùng item_id không phải hai sản phẩm khác; item metrics cộng quantity.

Giữ số tiền dạng số, không dùng chuỗi `50.000đ`, không gửi tỷ lệ 10 như số tiền giảm 10%. Giới hạn items/event theo GA4 phải được validator kiểm tra sau split; nếu vượt, log QA và thiết kế lại batching/snapshot, không âm thầm cắt bớt dòng purchase.

### 8.4 Điểm dispatch và idempotency

- Dispatcher đặt trong mutation success path của StoreProvider, **ngay sau `api(...POST...)` trả về**, trước clear pending/reload. Chỉ allowlist commerce actions, không gửi raw body/result.
- Với `checkout`: map snapshot và enqueue `purchase` trước router.push, trước setPlacedVietQrOrder; không chờ reload state hay trang QR. Kiểm tra cả guest và account.
- Với `cart-set`: delta > 0 gửi add; delta < 0 gửi remove; delta = 0 không gửi hai event này. Mua lại nhiều dòng tạo mutation tương ứng; gộp giỏ hoặc xác nhận giá không tự tạo add hàng loạt.
- Truyền `source_surface` ngoài request nghiệp vụ cho dispatcher: `product_detail`, `cart`, `assistant`, `reorder`; helper không tự đoán dựa duy nhất pathname. Không gửi text hội thoại.
- purchase dedup theo transactionId; cart dedup theo operationId; lưu bộ nhớ và storage có giới hạn/TTL để chặn reload/tab/replay. Không coi `event_id` tùy ý là cơ chế GA4 tự khử trùng mọi event.
- Khóa dedup phân biệt **queued** và **submitted**: gọi gtag chỉ chứng minh đã đưa vào hàng gửi, không chứng minh GA4 đã nhận. Không hứa exactly-once giữa mọi trình duyệt/tab hoặc khi người dùng xóa storage; đối chiếu app là cần thiết.
- Đề xuất pending purchase trong sessionStorage chỉ chứa payload an toàn, TTL 30 phút, phục hồi khi trở lại vùng đo. Không lưu PII/token. Không replay sau khi bị từ chối đo hoặc hết TTL; không backfill hàng loạt đơn cũ.
- Hàng đợi cục bộ cũng hỗ trợ các mutation mua lại từ account theo ngoại lệ §6.3; chỉ nhận allowlist sự kiện thương mại, không nhận pageview hoặc lịch sử duyệt vùng riêng tư. Kiểm tra lại quyền đo trước khi flush.
- Khi storage hỏng: fallback in-memory; QA ghi giới hạn. Không dùng mã đơn từ query string làm bằng chứng tạo đơn thành công.

**Không gắn add/purchase sau `await run(...)`**: run hiện bắt lỗi rồi kết thúc, nên chỗ đó có thể chạy dù nghiệp vụ thất bại. Dùng success result trong mutate như trên. Nếu request thất bại/409/422, không gửi success event. Nếu backend đã tạo đơn nhưng client mất response, chỉ phát qua retry/recovery có kết quả xác thực và cùng transactionId.

Nguồn quy tắc price/discount: [Google — Apply a discount](https://developers.google.com/analytics/devguides/collection/ga4/apply-discount).

## 9. Câu chuyện: đo tiếp xúc, không mặc định đã đọc

Các nội dung hiện có:

| story_id | Nguồn |
|---|---|
| `hue_general` | Trang `/cau-chuyen-hue` |
| `me-xung-keo-hue` | heritageStories theo category |
| `banh-cung-dinh` | heritageStories theo category |
| `tra-cung-dinh` | heritageStories theo category |
| `qua-bieu` | heritageStories theo category |
| `product_fallback` | Nội dung product.story/description khi chưa có heritage mapping |

`story_surface`: `home`, `product_detail`, `story_page`. `story_mode`: `default`, `expanded`, `page`. Chỉ đăng ký dimension cần báo cáo, không dùng tiêu đề dài làm ID.

**Trigger view_story:** một vùng đầu bài có ý nghĩa (heading + lead/summary) visible >=50% liên tục >=1 giây, document đang visible. Không áp threshold lên toàn bài dài vượt viewport vì có thể không bao giờ đạt. Timer reset khi không đạt điều kiện. Một lần/story/surface/navigation instance; mở lại cùng tab trong instance không nhân view.

Home có ba câu chuyện hiển thị sẵn, Quà biếu nằm trong disclosure: không gửi khi block đang aria-hidden/inert, chỉ đếm sau mở và đủ visibility. CTA ở home dẫn sang catalog category, không phải mở bài mới; gửi `story_cta_click`, không gửi thêm `view_story` chỉ vì click CTA.

Detail mặc định tab 0 chứa câu chuyện: có thể phát view_story với mode default khi người dùng cuộn tới phần nội dung. Keyboard switching phải được hỗ trợ tương tự chuột; không chỉ gắn onClick tab. Trang câu chuyện tổng dùng client tracker nhỏ, không biến toàn bộ server page thành client nếu không cần.

Chưa đo “đọc hết” hoặc hiểu nội dung. So sánh nhóm có view_story và chưa có chỉ là liên hệ quan sát. Khi báo cáo “sau tiếp xúc có thêm giỏ”, cần sequence trong cùng phiên/thời hạn, không chỉ lọc người từng có hai event ở các thời điểm bất kỳ. Nếu thiếu mẫu thì chỉ báo cáo lượt tiếp xúc và CTA.

## 10. Ưu đãi: tách hiển thị, chọn và áp dụng

- `view_offer`: phần offer card mở có điều kiện/nội dung chính visible >=50% trong >=1 giây. Banner thu gọn chỉ hiện “Giảm đến...” không được tính exposure nội dung đầy đủ của KPI này. `offer_surface` = `floating_offer`, `product_badge`, `cart_hint`, `checkout_summary`.
- Product badge ngắn được đo khi badge visible; cart_hint là lời gợi ý chưa đủ điều kiện. Checkout summary chỉ có tên/khoản giảm, không phải view campaign banner; tách surface để không gộp CTR sai.
- `select_offer`: click CTA đi xem nhóm/sản phẩm hoặc mua thêm. Thu gọn/mở, xem ưu đãi kế tiếp không phải select; khi offer kế tiếp hiển thị đủ điều kiện mới ghi view_offer mới.
- Chống lặp theo offer.id + revision + surface + navigation instance. Countdown tick, feed refresh và rerender không tạo lượt xem mới.
- `purchase.offer_id` lấy từ order snapshot thắng thực tế, không từ offer vừa click. Nếu offer đã hết hạn hoặc offer khác có lợi hơn thắng, dữ liệu phải phản ánh như backend.
- Không dùng `coupon` hoặc tự sinh GOIHUE10. Không cấu hình Order coupon như thể app có nhập mã.

Chỉ tính CTR trên surface có CTA tương ứng: số activation select_offer / số exposure view_offer cùng offer/surface/kỳ đo. Người dùng có thể click nhiều lần nên tỷ lệ theo lượt có thể >100%; báo cáo thêm số người/phiên có click nếu cần. “Đơn áp ưu đãi” dựa discountAmount>0, không suy từ click.

## 11. Các phép đo bổ sung P1

### 11.1 Tìm kiếm

Header desktop/mobile submit form GET `/products?q=...`; Collection đọc q rồi lọc client. Filter Collection hiện chạy theo từng onChange. Đề xuất gửi `search` sau debounce 800ms, query dài >=2, kết quả đã render, kể cả results_count=0. Giữ nguyên hành vi UI, không bắt người dùng bấm nút mới chỉ để phục vụ tracking.

`search_surface = catalog_results`; query đến từ header cũng ghi tại kết quả, không gửi lần nữa ở submit. Debounce reset khi unmount/đổi query; pricing poll không phát lại. Kết quả phụ thuộc cả filter nên lưu filter category/số lượng kết quả nếu cần phân tích; không khẳng định không tìm được đồng nghĩa catalog thiếu món.

Không gửi query có email, số điện thoại hoặc mẫu dữ liệu cá nhân; bỏ trường/tắt event nếu không làm sạch tin cậy. URL q luôn bị loại khỏi page_location. Tắt site search Enhanced Measurement để không tự gửi view_search_results song song.

### 11.2 Giỏ hàng, danh mục và lỗi

view_cart/remove_from_cart bổ sung để phân biệt tăng, bỏ và chuyển checkout; không nhầm cart-refresh với thêm hàng. select_content đo category code ở header, home và filter; không coi lựa chọn mặc định khi load là click.

Nếu cần đo lỗi checkout sau này, dùng custom event với mã lỗi nhóm hữu hạn (`quote_changed`, `stock_unavailable`, `request_failed`) và status, không gửi message, request body hoặc địa chỉ. Code hiện nhiều lỗi dùng message, chưa đủ structured error code để suy nguyên nhân an toàn; phải bổ sung contract trước nếu muốn phân loại sâu.

## 12. Custom definitions và cấu hình GA4

| Tên hiển thị | Scope | Parameter | Áp dụng |
|---|---|---|---|
| Story ID | Event | `story_id` | view_story/story_cta_click |
| Story surface | Event | `story_surface` | Câu chuyện ở đâu |
| Story mode | Event | `story_mode` | Mặc định/mở thêm/trang riêng |
| Offer ID | Event | `offer_id` | view/select offer và purchase/begin_checkout |
| Offer name | Event | `offer_name` | Nhãn hỗ trợ, không thay ID |
| Offer surface | Event | `offer_surface` | Tách exposure/click theo vị trí |
| Has auto discount | Event | `has_auto_discount` | yes/no trên purchase/begin_checkout |
| Checkout type | Event | `checkout_type` | guest/account; không là danh tính |
| Payment method | Event | `payment_method` | COD/VIETQR của đơn tạo thành công |
| Source surface | Event | `source_surface` | Điểm phát sinh mutation/selection |
| Price source | Item | `price_source` | BASE/SCHEDULE/STOCK/DEMAND |
| Results count | Event custom metric, P1 | `results_count` | Unit Standard; tổng hợp phải hiểu là số kết quả được báo ở mỗi lần search, không phải số sản phẩm duy nhất |

Item ID/Name/Category, Item discount amount, Item revenue và Transaction ID dùng trường có sẵn. Không đăng ký order number, operationId, URL tự do thành custom dimension; operationId chỉ phục vụ dedup local. Không tạo custom “sessions”/“purchase count”. Custom definitions đăng ký trước kỳ đo và chờ xử lý; không hứa khôi phục đầy đủ lịch sử chưa đăng ký.

`purchase` là key event cuối của đồ án; kiểm tra trạng thái có sẵn trước khi tạo. begin_checkout/add_to_cart chưa đánh dấu key event. Các quy tắc lọc/debug xem §15.

## 13. Báo cáo và công thức cụ thể

| Báo cáo | Dimension/filter | Metric/công thức | Ý nghĩa/giới hạn |
|---|---|---|---|
| B1 — Kênh mang người về | Session source/medium/campaign; kỳ đo UTC+7 | Sessions, engaged sessions, phiên có begin_checkout/purchase | Tách clicks nền tảng và sessions web |
| B2 — Quan tâm sản phẩm | Item ID/Name/Category; list riêng khi cần | Items viewed in list, Items clicked in list, Items viewed, Items added to cart; số người hỗ trợ | Quantity món khác Event count và Users; không trộn làm tỷ lệ người |
| B3 — Phễu | Chuỗi §14; breakdown device/source nếu tương thích | Người dùng từng bước, tỷ lệ tiếp tục, thời gian | Không thay CVR theo phiên |
| B4 — Câu chuyện | view_story/story_cta_click theo Story ID/surface/mode | Event count và Total users; tỷ lệ CTA cùng ngữ cảnh | Không gọi là tỷ lệ đọc hết |
| B5 — Ưu đãi | view_offer/select_offer theo offer/surface; purchase riêng | Exposure, click, đơn có giảm, tiền giảm, AOV net | Banner exposure không chứng minh áp dụng; giá trị mô phỏng |
| B6 — Chất lượng dữ liệu | Kỳ đo và cùng bộ lọc QA | Số đơn app vs transaction GA4; đối chiếu mã/giá | App là nguồn chuẩn, GA4 có thể thiếu hit |

Các công thức chính:

```text
Tỷ lệ bắt đầu checkout = Sessions có begin_checkout / tổng Sessions
CVR mô phỏng          = Sessions có purchase / tổng Sessions
AOV mô phỏng          = Tổng purchase.value / số transaction hợp lệ
Tỷ lệ đơn có ưu đãi   = Số transaction có has_auto_discount=yes / tổng transaction
Tiền giảm do offer    = Tổng (items.discount × items.quantity) trên purchase
```

KPI theo phiên dùng session segment chứa event, không event count/sessions; CVR có thể dùng Session key event rate chọn riêng purchase. Tử/mẫu cùng campaign, ngày và QA filter. Số giao dịch lấy metric transaction/ecommerce purchases phù hợp đã đối chiếu theo transaction_id; không lấy tổng số món hoặc Event count có duplicate làm số đơn.

Tiền giảm do offer đối chiếu tổng discountAmount trong app; dùng Item discount amount nếu báo cáo hỗ trợ bộ dimension tương thích. Không cộng discount ở begin_checkout và purchase vào một tổng “tiền giảm”.

Không có đơn thì AOV không tính được; mẫu số 0 ghi “không tính được”, không ghi 0%. Chưa nghiệm thu thẻ ghi “chưa đo được”. Với 30 phiên, một phiên có đơn làm CVR thay đổi 3,33 điểm phần trăm: luôn trình bày n/N cùng %, chưa dùng khoảng 2,5–3,8% như điều kiện đạt/trượt cứng.

Mốc ≥30 phiên, checkout ≥8%, AOV >120.000đ từ v2 chỉ là tham khảo cho đến khi nhóm chốt lại campaign/ngày. **Bỏ KPI GOIHUE10 và tỷ lệ hoàn hàng thật** khỏi bộ KPI này; KPI mới “đơn có ưu đãi tự động” chưa tự đặt mục tiêu ≥5 hay tái sử dụng hạn 23/11.

Có thể xem Path exploration để tìm đường đi trước/sau trang/sự kiện, và so sánh device/browser bằng dữ liệu GA4 sẵn có khi đủ mẫu. Chưa cần thêm tracking cho retention, AI chat chi tiết hoặc quảng cáo; số người quay lại có thể quan sát sau một kỳ đủ dài, không là tiêu chí nghiệm thu P0.

## 14. Cấu hình phễu khớp luồng hiện tại

```text
view_item → add_to_cart → begin_checkout → purchase
```

- Phễu chính **closed**, bước indirectly followed by, đề xuất tối đa 30 phút giữa hai bước liền kề. Tài liệu báo cáo ghi rõ các thiết lập; 30 phút giữa bước không bảo đảm toàn chuỗi nằm cùng session.
- Không đưa Sessions hoặc view_item_list thành bước bắt buộc. Vào thẳng product detail vẫn hợp lệ.
- “Mua ngay” hiện vẫn thêm giỏ rồi vào checkout nên đi được phễu chính. Không phát add hai lần cho nút này.
- Trợ lý AI hoặc mua lại có thể thêm giỏ không qua detail; có thể trở lại checkout với giỏ cũ. Tạo **phễu phụ open** `add_to_cart → begin_checkout → purchase`, cho phép bắt đầu ở checkout; trình bày tách với phễu chính.
- Funnel tổng thể không bảo đảm xem/thêm/mua cùng SKU; báo cáo sản phẩm phân tích riêng. Nếu cần cùng sản phẩm cần thiết kế sequence theo item, chưa thuộc P0.
- Phân tích theo phiên ở B1/KPI tính riêng; không dùng số người Funnel chia Sessions để gọi CVR.
- Rớt bước là quan sát, nguyên nhân chỉ là giả thuyết. Đối chiếu lỗi app và kiểm thử thao tác trước khi kết luận do giá/form/ảnh.

## 15. Dữ liệu test, riêng tư và vận hành

- Developer traffic filter dùng debug_mode, Exclude; thử ở trạng thái Testing trước khi Active. Testing chỉ gắn nhãn, chưa loại dữ liệu. DebugView không tự tách test.
- Không bật Internal filter theo cả mạng trường hoặc IP động nếu có thể loại nhầm người trải nghiệm. Danh sách IP và thời điểm áp dụng lưu ngoài GA4 trong nhật ký QA.
- Filter không làm sạch ngược dữ liệu cũ; dữ liệu bị loại khi Active không phục hồi bằng cách tắt filter. Chốt ngày bắt đầu kỳ đo sau nghiệm thu.
- Không dùng user_id, email hash, user_properties chứa danh tính, mã guest, lookupCode hay thông tin người nhận. GA4 quản lý định danh kỹ thuật trình duyệt theo cấu hình được phép; không hứa đo chính xác từng cá nhân qua nhiều thiết bị.
- Raw order/state/checkout body tuyệt đối không spread sang gtag. Helper chỉ map allowlist từ measurement. QA kiểm tra tất cả request analytics, kể cả tự động, trước khi cho traffic thật.
- Tôn trọng lựa chọn analytics của người dùng nếu hệ thống có hoặc bổ sung cơ chế đó; consent cá nhân hóa gợi ý/AI hiện tại không tự đồng nghĩa consent analytics. Không tự ghi nhận đồng ý hoặc gửi lại lịch sử hành vi lúc chưa được phép đo.
- Ghi rõ GA4 không phải công cụ quay màn hình/heatmap hoặc log lỗi đầy đủ. Không thêm bộ SDK khác chỉ để phục vụ các câu hỏi đã có trong phạm vi này.
- Realtime/DebugView phục vụ QA; báo cáo chính có thể cần 24–48h xử lý. Đọc hàng tuần, lưu khoảng ngày, timezone, filters, kích thước mẫu và ngày export.

Nguồn: [Google — Developer traffic](https://support.google.com/analytics/answer/13296662), [Data filters](https://support.google.com/analytics/answer/13296761).

## 16. Bản đồ thay đổi để người triển khai làm đúng

| File/vùng | Việc cần làm | Ưu tiên |
|---|---|---|
| `app/layout.tsx` + analytics component mới | Một bộ nạp có route/env gate, initial config và pageview | P0 |
| `lib/store.tsx` | Dispatcher sau POST success trước reload; measurement context riêng request; dedup | P0 |
| `components/product/product-detail.tsx` | view_item; cung cấp surface cho add/Mua ngay; story visibility; related list | P0 |
| `components/product/lan-primitives.tsx` | Card visibility/select_item, truyền list context; hiện card chỉ có link | P0 |
| `components/commerce.tsx` | Catalog list instance, pagination/filter context; search/category P1 | P0/P1 |
| `components/recommendation-rail.tsx` | Truyền list context/visible items; guest cart hiện có surface=home trong request nhưng GA4 vị trí vẫn là cart_recommendations | P0 |
| `components/cart.tsx`/`checkout-view.tsx` | begin_checkout ở form view; purchase qua dispatcher; không đo lại khi summary poll | P0 |
| `components/cart-view.tsx` | View_cart/remove qua dispatcher; không ghi mutation ở click trước success | P1 |
| `components/assistant-widget.tsx` | Chuyển source_surface=assistant cho confirmProposal; không gửi chat | P0 |
| `components/reorder-dialog.tsx` + `ReorderApi.java` | Xác nhận atomic trả net delta, cung cấp surface=reorder, chỉ đo thay đổi thành công; không tự purchase khi xem đơn cũ | P0 |
| `components/home-heritage-stories.tsx` | Visibility vùng tóm tắt, disclosure, story CTA | P0 |
| `app/cau-chuyen-hue/page.tsx` | Client boundary nhỏ đo view_story/CTA | P0 |
| `components/discounts/offer-display.tsx` | View/select offer theo visibility và CTA; không theo countdown | P0 |
| `shared/layout/store-shell.tsx`, category links/home | Link UTM ngoài web; category P1; kiểm kê ranh giới sang trang không đo | P0/P1 |
| Backend `CommerceApi.java` | Measurement snapshot quote/order, category snapshot và mutation delta | P0 |
| Backend `GuestCommerceApi.java` | Receipt/replay trả measurement an toàn, không làm lộ dữ liệu đã được ẩn | P0 |
| `DiscountService.java` | Tái sử dụng Quote.lineDiscounts; không viết thuật toán giảm giá thứ hai cho analytics | P0 |
| Contract + state matrix | Schema/examples snapshot account/guest/mutation và recovery | P0 |
| Dockerfile/Compose/env/docs deploy | Build args GA4 và nghiệm thu bundle | P0 |

Không cần đổi thuật toán tính ưu đãi hoặc pricing để đo GA4. Nếu bổ sung DTO mapper, ưu tiên gọi kết quả đã tính thay vì tính lại ở client.

## 17. Fixture GA4 và các điều kiện bất biến

Payload purchase từ fixture §5.3 sau mapping; có bổ sung transaction_id và event parameters:

```json
{
  "event": "purchase",
  "params": {
    "transaction_id": "GH-DEMO0001",
    "currency": "VND",
    "value": 90000,
    "shipping": 20000,
    "payment_method": "COD",
    "checkout_type": "guest",
    "has_auto_discount": "yes",
    "offer_id": "offer-demo-01",
    "offer_name": "Ưu đãi minh họa",
    "items": [
      {
        "item_id": "11111111-1111-4111-8111-111111111111",
        "item_name": "Sản phẩm minh họa",
        "item_category": "me-xung-keo-hue",
        "price": 45000,
        "discount": 5000,
        "quantity": 2,
        "price_source": "BASE"
      }
    ]
  }
}
```

Fixture này dùng kiểm tra mapping, không được gửi lên property production như dữ liệu chiến dịch. `event`/`params` là dạng mô tả để gọi gtag, không yêu cầu thêm `dataLayer`/GTM.

Validator và kiểm thử phải kiểm tra:

1. `subtotal - discountAmount = netSubtotal`; `netSubtotal + shippingFee = total`.
2. `sum(lineNetTotal) = netSubtotal`; `sum(lineDiscountAmount) = discountAmount`.
3. `sum(GA4 price × quantity) = value`; `sum(GA4 discount × quantity) = discountAmount` với định nghĩa discount của thiết kế này.
4. `item_id` thống nhất giữa catalog/detail/cart/purchase; productId không thay bằng order line id.
5. q phải nguyên dương; tiền không âm; tổng lượng sau split bằng lượng app. Schema mismatch không được tự gửi payload sai.
6. Có discountAmount>0 thì có metadata chương trình; thiếu metadata là lỗi chất lượng dữ liệu, không lấy feed hiện tại điền bù.
7. Không có khóa hoặc giá trị PII/token trong payload và request tự động.

Nếu schema không hợp lệ, không gửi success event hỏng; ghi chẩn đoán cục bộ an toàn cho QA và giữ luồng mua hoạt động. Sau sửa phải công khai khoảng dữ liệu bị thiếu, không diễn giải số 0 như không có hành vi.

## 18. Ma trận nghiệm thu bắt buộc

| Tình huống | Kết quả cần thấy |
|---|---|
| Vào landing có UTM → SPA → Back/Forward | Pageviews đúng lượt điều hướng, không trùng trang đầu; nguồn phiên đúng sau xử lý |
| Collection load/filter/page 2 | Chỉ card thật visible có list impression; polling không nhân event; list có ngữ cảnh |
| Click ảnh/tên/Chọn mua của cùng card | Mỗi activation một select_item; chưa add_to_cart |
| Detail API 404/lỗi | Không view_item thành công |
| Giỏ có 2, thêm 3 từ detail | Add quantity=3, không phải 5 |
| Mua ngay | Một add success rồi begin_checkout khi form hiện; không purchase ở nút |
| Thêm từ trợ lý AI | Một add với source_surface=assistant; không chat text |
| Tăng/giảm/xóa/clear cart | Delta đúng; reprice/merge không giả thêm hàng |
| Mua lại từ đơn cũ | Không nạp/gửi GA4 tại lịch sử; add các dòng thành công được queue an toàn rồi gửi khi về checkout, giữ source=reorder; xem lịch sử không tạo purchase |
| Checkout summary refresh 15 giây | begin_checkout không tăng theo polling |
| COD/VIETQR × guest/account | Một purchase khi đơn tạo xong, kể cả chưa PAID; mapping cùng transactionId convention |
| Order POST success, reload state lỗi | Purchase vẫn được enqueue đúng một lần trước lỗi reload |
| Retry cùng idempotency key | Đơn/operation cũ, không duplicate purchase/add |
| Tải lại trang QR/xác nhận/tra cứu | Không purchase mới; URL đơn/token không lọt vào analytics |
| Giảm %/cố định, có giá sàn | Tổng GA4 khớp snapshot; không lấy mức giảm quảng cáo làm tiền giảm thực tế |
| q=3, D=10.000đ | Split hai nhóm cho tổng net 140.000đ chính xác |
| Đơn có BASE và SCHEDULE | Offer chỉ giảm dòng BASE; price_source đúng trên từng dòng |
| Chương trình hết hạn/đổi sau xem banner | Backend quyết định offer cuối; 409 không phát purchase; xác nhận mới dùng quote mới |
| Ưu đãi ngang nhau/không giảm vì floor | ID thắng khớp backend; discountAmount=0 không gọi là đơn áp ưu đãi |
| Story default/offscreen/disclosure/keyboard | Chỉ visible đủ điều kiện mới view; mode đúng; hidden không đếm |
| Banner countdown, collapse/reopen/chuyển offer | Không tăng exposure mỗi giây; CTA mới select, không dùng collapse làm click mua |
| Search 0 kết quả (P1) | Một search sau debounce, không mỗi ký tự; từ khóa nhạy cảm bị chặn |
| Chuyển storefront → admin/account/tra cứu | Ranh giới không đo có hiệu lực, kiểm tra cả auto hits và referrer |
| Tag bị chặn/thiếu env/storage lỗi | Web vẫn đặt đơn; không lỗi UI do analytics; ghi giới hạn về mất hit |
| Debug/filter | QA vào DebugView; Testing/Active đúng; số QA không dùng làm kết quả chiến dịch |

Evidence cần lưu: commit/image build, thời gian UTC+7, case, screenshot DebugView hoặc request đã làm sạch, transactionId/operation tham chiếu trong nhật ký QA, so tổng tiền app. Không lưu screenshot có PII trong file báo cáo dùng chung.

Khi implement mới chạy `npm run typecheck`, `npm run lint`, `npm run build` trong apps/web theo script repo; kiểm thử mapper, mutation success/replay và backend snapshot/contract. Lần soạn tài liệu này không thay code nên chưa chạy các kiểm thử ứng dụng và không ghi PASS giả.

## 19. Thứ tự triển khai và điều kiện hoàn thành

1. **Chốt snapshot/contract:** thống nhất UUID, category code, order.number, allocation, guest/account và replay. Đây là điều kiện tiên quyết để đo ecommerce chính xác.
2. **Backend dữ liệu:** quote/order/mutation snapshot, tests cho giá/sàn/split/replay; không gửi event từ backend.
3. **Hạ tầng analytics:** helper/schema/gate/router, build args, GA4 definitions và bộ lọc QA.
4. **Commerce và nguồn:** list/select/detail/mutation/checkout/purchase, UTM; nghiệm thu trước khi lấy số campaign.
5. **Câu chuyện và ưu đãi:** visibility/CTA, custom definitions, báo cáo riêng exposure vs applied.
6. **Báo cáo và đối chiếu:** tạo B1–B6, lưu cấu hình phễu, chốt ngày bắt đầu đo. P1 triển khai khi có thời gian hoặc cần phân tích thêm.

Thiết kế được coi là triển khai đạt khi: cả guest/account có dữ liệu đúng; tất cả điểm thêm giỏ đã bao phủ; số tiền và mã giao dịch khớp; không duplicate do polling/replay; không PII; UTM hoạt động; QA tách được; các báo cáo P0 đọc được. “Có 1 user trong Realtime” chỉ chứng minh một phần đường gửi dữ liệu.

Không có traffic hợp lệ thì báo cáo phương pháp và trạng thái dữ liệu; không chạy bot hoặc lặp đơn QA để hoàn thành KPI.

## 20. Khác biệt quan trọng so với v2

| V2 | V3 và lý do |
|---|---|
| Dùng chín SKU từ tài liệu | Dùng UUID thật của app; không thiết kế dựa trường dữ liệu chưa có |
| Home có lưới sản phẩm | Không giả định; bám component hiện tại và vị trí card thật |
| Mua ngay có thể bỏ qua thêm giỏ | Code hiện vẫn cart-set trước checkout; phễu chính giữ add_to_cart |
| view_story như bấm mở | Visibility theo story mode/surface vì tab mặc định và home tóm tắt khác nhau |
| Coupon/GOIHUE10 | Bỏ khỏi phạm vi, thay offer tự động và khoản giảm backend thực áp |
| Chỉ cần bổ sung event vào component | Cần snapshot chuẩn, guest receipt, dispatcher trước reload và contract |
| Giá trị đơn mô tả chung | Quy định netSubtotal, ship riêng, integer split, price_source và discount scope |
| QA/local chưa bám build thực tế | Chỉ rõ thiếu build args trong Dockerfile/Compose, filter và route privacy boundary |
| Các trạng thái property chưa phân biệt nguồn | Ghi rõ thông tin nhóm cung cấp, code xác minh và cấu hình live chưa kiểm tra |

## 21. Hồ sơ mã nguồn đã đối chiếu

Các mốc line để tra tại commit khảo sát, có thể dịch chuyển sau khi code đổi:

- `apps/web/src/app/layout.tsx`: root providers/layout, chưa có GA4.
- `apps/web/src/components/commerce.tsx`: Collection load/filter (khoảng 35–104), input search (178–191), card list/pagination (270–294).
- `apps/web/src/components/product/product-detail.tsx`: load product (134–181), purchase/Mua ngay (183–211), tabs/story (385–451).
- `apps/web/src/components/product/lan-primitives.tsx`: ProductCard (8–54), CollectionStory CTA.
- `apps/web/src/components/cart.tsx`: quote polling, form/Payment switch và checkout POST (khoảng 170–220).
- `apps/web/src/lib/store.tsx`: api (157 trở đi), run (290), mutate (305–330).
- `apps/web/src/components/assistant-widget.tsx`: confirmProposal/cart-set (236–282).
- `apps/web/src/components/reorder-dialog.tsx` và `apps/api/src/main/java/vn/goihue/ReorderApi.java`: preview/confirm mua lại atomic trên main `26e1418`; dữ liệu đo chỉ phát sau confirm thành công.
- `apps/web/src/components/home.tsx`, `home-heritage-stories.tsx`, `lib/heritage-stories.ts`, `app/cau-chuyen-hue/page.tsx`: cấu trúc nội dung và CTA.
- `apps/web/src/components/discounts/offer-display.tsx`: floating offer, badge, summary và hint.
- `apps/api/src/main/java/vn/goihue/CommerceApi.java`: cartSummary (140), cart-set (303), checkout (329 trở đi).
- `apps/api/src/main/java/vn/goihue/GuestCommerceApi.java`: checkout/receipt (86–100), publicOrder (315 trở đi).
- `apps/api/src/main/java/vn/goihue/DiscountService.java`: calculate (240), allocation (277–303).
- `apps/api/src/main/java/vn/goihue/PricingService.java`: Price.discountEligible (36–38), resolve (111), sales snapshot (khoảng 62–108).
- `apps/api/src/main/java/vn/goihue/CatalogService.java`: publicProducts, saveProduct, shippingFee.
- `apps/web/src/app/api/store/[...path]/route.ts`, `docs/03_api_specs/goihue.openapi.yaml`, `goihue-state-matrix.md`: proxy và hợp đồng hiện hành.
- `apps/web/Dockerfile`, `compose.coolify.yml`, `apps/web/package.json`: build và phiên bản khai báo.

## 22. Nguồn kỹ thuật

Đối chiếu tài liệu chính thức ngày 23/11/2026; các quyết định visibility, ID, payload snapshot, P0/P1 và dedup trong tài liệu là thiết kế riêng cho Gói Huế, không phải mặc định của GA4.

- [Google — Recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events): schema event/item.
- [Google — Measure ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce): gắn ecommerce theo hành động.
- [Google — Apply a discount](https://developers.google.com/analytics/devguides/collection/ga4/apply-discount): price sau giảm, discount trên đơn vị và phân bổ.
- [Google — Measure pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views): tránh pageview tự động/thủ công trùng nhau.
- [Google — Single-page applications](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications): navigation SPA.
- [Google — Traffic acquisition](https://support.google.com/analytics/answer/12923437): scope nguồn phiên và session key event rate.
- [Google — Funnel exploration](https://support.google.com/analytics/answer/9327974): phễu người dùng, open/closed và điều kiện bước.
- [Google — Path exploration](https://support.google.com/analytics/answer/9317498): khám phá đường đi.
- [Google — Custom definitions](https://support.google.com/analytics/answer/14240153): scope tham số tùy chỉnh.
- [Google — Item-scoped custom dimensions](https://support.google.com/analytics/answer/14239695): thuộc tính item như price_source.
- [Google — Developer traffic filter](https://support.google.com/analytics/answer/13296662): tách QA debug.
- [Google — Data filters](https://support.google.com/analytics/answer/13296761): trạng thái và giới hạn lọc.

**Kết quả bàn giao:** thiết kế đủ để chia việc backend, frontend, GA4 và QA; các thay đổi contract/code/config nêu trong tài liệu vẫn là công việc triển khai tiếp theo, không phải đã hoàn thành.
