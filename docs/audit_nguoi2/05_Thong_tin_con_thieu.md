# Thông tin cần hỏi nhóm để hoàn thiện chính sách

Toàn bộ mục dưới đây được phân loại **CHƯA TÌM THẤY** câu trả lời đủ tin cậy trong repository và cần nhóm xác nhận. Các câu hỏi không phải bằng chứng rằng chính sách hay quy trình không tồn tại; hành động hình thành sau khi chốt câu trả lời sẽ là **ĐỀ XUẤT**.

## 1. Phạm vi sản phẩm và trách nhiệm

1. Tên thương hiệu/chủ thể pháp lý chính thức là Gói Huế hay Ô Mạ; đơn vị nào là data controller và đơn vị nào là processor?
2. Môi trường nào đang vận hành thật: local, staging, pilot hay production? Service/provider nào đã được owner sign-off?
3. Ai là owner của Identity, Profile, Order, Inventory, Fulfillment, Shipping, Care/Return, Finance và Security Incident?
4. Vai trò chính thức cần có là gì; mapping role–permission–scope nào đã được duyệt? Hiện migration chỉ seed ADMIN và một số permission (`services/identity-service/src/main/resources/db/migration/V7__seed_identity_roles_and_permissions.sql:1`, `services/identity-service/src/main/resources/db/migration/V8__seed_catalog_permissions.sql:2`).
5. `care-service`, analytics và notification có source ở repository khác không? Nếu có cần đưa vào audit bổ sung.

## 2. Chính sách bảo mật và quyền riêng tư

1. Mục đích pháp lý/consent cho từng loại dữ liệu: tài khoản, địa chỉ, hành vi, payment, packing video, support, return evidence và chatbot là gì?
2. Thời hạn lưu từng loại dữ liệu là bao lâu? Cần chốt riêng Profile/contact, địa chỉ đã xóa, Identity audit, login event, Order/item/snapshot, receipt/refund, tracking, packing video, Return/Support message, backup và log.
3. Căn cứ nào yêu cầu legal hold; ai được đặt/gỡ hold; quy trình xóa/anonymize sau hold?
4. Người dùng có quyền xem, sửa, xuất, xóa hoặc hạn chế xử lý dữ liệu bằng quy trình nào? Dữ liệu ledger nào chỉ có thể pseudonymize thay vì xóa?
5. Dữ liệu có chuyển ra ngoài Việt Nam không? Nhà cung cấp cloud, Keycloak hosting, SePay, GHN, object storage, email/SMS và AI provider là ai?
6. DPA/điều khoản bảo mật với từng processor đã có chưa? Có cho phép provider dùng dữ liệu để huấn luyện hay analytics không?
7. Profile và Shipping dùng encryption at rest nào? Có field/envelope encryption cho phone/email/address/recipient không? KMS/Vault, rotation, backup key và access audit được vận hành ra sao?
8. Keycloak production dùng password hashing policy nào, MFA cho staff/admin, brute-force protection, session idle/max, refresh rotation và revoke SLA nào? Code chỉ chứng minh credential được giao cho Keycloak (`services/identity-service/src/main/java/com/hvduong/identity/infrastructure/keycloak/KeycloakAdminClient.java:44`).
9. Token/permission thay đổi có hiệu lực sau bao lâu? Có token version, back-channel logout hoặc introspection cho action rủi ro cao không?
10. Endpoint actuator/Swagger nào được public trong production? Ai có quyền xem metrics, logs, traces và audit?
11. Chuẩn redaction là gì? Email, phone, address, bank account, token, cookie, request/response body và query string phải được che thế nào?
12. Secret manager nào được dùng? Credential đã từng commit/default có được rotate chưa? Có secret scanning và pre-commit/CI gate không?
13. DB production có per-service account/least privilege, TLS, network policy, backup encryption và restore test không?
14. Incident response: kênh báo động, on-call, thời hạn triage/thông báo, forensic retention và người phê duyệt truyền thông là ai?

## 3. Chatbot/AI

1. Chatbot có thực sự nằm trong scope Đề tài 3 hay chỉ là roadmap? Source/runtime nằm ở đâu?
2. Chatbot được phép nhận dữ liệu nào: nội dung catalog công khai, order của chính khách, profile, support history hay payment/return?
3. Có bắt buộc đăng nhập trước khi hỏi về đơn? Cách chống IDOR/prompt injection/data exfiltration là gì?
4. Provider/model nào, vùng xử lý dữ liệu nào, có DPA/no-training không, và retention prompt/response bao lâu?
5. Có lọc PII trước khi gửi provider, allowlist tool/action, human handoff, audit model/version và cơ chế người dùng phản đối quyết định tự động không?

## 4. Chính sách hủy đơn

1. Customer được tự hủy tới trạng thái/mốc thời gian nào cho VIETQR và COD?
2. Paid cancellation cần ai phê duyệt; ngưỡng tiền và segregation of duties ra sao?
3. Nếu Inventory đã commit, Fulfillment đang đóng gói hoặc carrier đã nhận thì quy trình compensation nào được phép?
4. Phí hủy, voucher/điểm, shipping fee và promotion được hoàn/thu hồi theo công thức nào?
5. SLA xử lý hủy và hoàn tiền là bao lâu; lúc dependency timeout hiển thị trạng thái gì cho khách?

## 5. Chính sách đổi trả

1. Cửa sổ đổi/trả chính thức bao nhiêu ngày và tính từ mốc nào? Con số 7 ngày hiện chỉ xuất hiện trong mock (`docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:21`, `docs/ui_web/RETURN_REFUND_DATA_API_MATRIX.md:23`).
2. Sản phẩm nào không được đổi/trả: thực phẩm đã mở, cận/hết hạn, hàng cá nhân hóa, quà tặng/combo, khuyến mãi, B2B?
3. Danh mục reason/resolution chính thức là gì? Khi nào đổi cùng loại, đổi khác loại, hoàn một phần/toàn phần hoặc không cần nhận lại hàng?
4. Evidence bắt buộc theo từng reason là gì; giới hạn file, thời lượng video, quyền xem và retention bao lâu?
5. Ai chịu phí lấy hàng/return shipping/phí ngân hàng trong từng trường hợp lỗi cửa hàng, carrier và khách?
6. SLA cho tiếp nhận, yêu cầu bổ sung, review, pickup, inspection, quyết định, đổi hàng và refund là bao lâu? Ngày làm việc và ngày nghỉ tính thế nào?
7. Ai được approve/reject; có threshold theo giá trị và four-eyes principle không?
8. Hàng trả về được phân loại sellable/damaged/quarantine thế nào; ai xác nhận batch/HSD và khi nào được restock?
9. Nếu chỉ một phần combo/bundle hỏng, cách tính giá hoàn, discount, voucher, shipping và loyalty ra sao?
10. Return Shipment dùng carrier nào; ai theo dõi mất/hỏng khi hoàn; liability chuyển tại mốc nào?
11. Case bị từ chối có appeal/reopen không? Thời hạn và cấp phê duyệt là gì?
12. Thông báo nào gửi cho khách ở từng state; Support Ticket và Return Case có liên kết nhưng tách ownership thế nào?

## 6. Hoàn tiền và tài chính

1. Refund phải về phương thức thanh toán gốc hay cho phép tài khoản ngân hàng do khách nhập? Ai xác minh chủ tài khoản?
2. Thời hạn hoàn tiền theo từng phương thức là bao lâu? SLA nội bộ và thời gian provider được trình bày ra sao?
3. Phí hoàn tiền do bên nào chịu; phí có được khấu trừ không và hiển thị/consent thế nào?
4. Có cho partial refund, nhiều refund trên một Order và refund vượt kỳ đối soát không? Công thức chống over-refund là gì?
5. Ngưỡng nào cần manager/Finance dual approval? Ai không được vừa approve vừa execute?
6. Trạng thái `UNKNOWN`/timeout được reconcile qua provider ra sao; bao lâu thì escalation/manual review?
7. Bank evidence và reconciliation data lưu bao lâu; ai được xem raw payload và tài khoản đầy đủ?
8. COD refund và COD settlement dùng nguồn sự thật nào? Carrier remittance, fee, failed delivery và discrepancy được đối soát thế nào?

## 7. Giao hàng và SLA

1. Phạm vi giao hàng, carrier production, service code và cutoff time chính thức là gì?
2. SLA pickup/delivery theo tỉnh/phường, ngày lễ, hàng dễ vỡ và mùa cao điểm là bao lâu?
3. Khi nào Order chuyển `SHIPPED`, `DELIVERED`, `DELIVERY_FAILED`, `COMPLETED`? Ai là completion authority?
4. Webhook stale/mất thì polling/reconciliation tần suất nào; stale tracking bao lâu thì alert?
5. Chính sách giao lại, đổi địa chỉ/số điện thoại, từ chối nhận, thất lạc và bồi thường là gì?
6. COD: hạn mức, blacklist/risk score, OTP/xác minh, số lần giao và phí hoàn hàng thế nào?
7. Packing video/seal/weight được chia sẻ cho carrier/khách/CSKH trong tình huống nào?

## 8. Vận hành và quản trị rủi ro

1. SLO uptime/p95/p99 cho Web, Login, Checkout, Payment và Tracking là gì?
2. RTO/RPO cho PostgreSQL, Redis, Kafka, object storage và Keycloak là gì? Lần restore/failover gần nhất có bằng chứng không?
3. Có load test peak, chaos test dependency, Kafka lag alert, dead-letter/quarantine runbook và manual repair audit chưa?
4. Ai theo dõi risk register, tần suất review và ngưỡng chấp nhận/chuyển giao/giảm thiểu rủi ro?
5. Dữ liệu thực để hiệu chỉnh xác suất gồm bao nhiêu tháng và ai cung cấp: incident, uptime, fraud, variance, delayed/damaged delivery, return/refund?
6. Bằng chứng nào được phép gọi là production acceptance? Contract/mock/unit/integration/staging/live phải được gắn nhãn và owner sign-off ra sao?

## 9. Tài liệu/artefact cần nhóm cung cấp

- Data inventory và data-flow diagram đã phê duyệt.
- Privacy notice, terms, return/refund/cancellation policy hiện hành.
- Role-permission-scope matrix chính thức.
- Production deployment/network diagram, secret/KMS architecture và DB grants.
- Provider contracts/DPA/SLA với payment, carrier, storage, messaging, email/SMS và AI.
- Retention/deletion/legal-hold schedule và backup lifecycle.
- Incident response, DR/BCP, restore test, pentest/vulnerability report.
- E2E acceptance evidence có environment, commit/version, timestamp, synthetic/real-data label và owner sign-off.
