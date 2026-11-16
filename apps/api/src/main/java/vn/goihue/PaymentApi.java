package vn.goihue;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Demo payment confirmation for VietQR checkout orders.
 *
 * The QR code itself proves nothing: money is only recorded after a payment
 * notification arrives and passes gateway-style checks (GW3) — valid HMAC
 * signature, amount matches the locked order total, attempt still inside its
 * 15-minute window. Duplicates are ignored idempotently; any mismatch, late
 * arrival, or second payment for an already-paid order moves the order to
 * REVIEW for manual reconciliation instead of being silently dropped.
 *
 * Two senders share the same matching logic ({@link #processPayment}):
 *  - scripts/demo-ipn.ps1, a classroom stand-in for a payment gateway IPN
 *    (POST /api/v1/payments/ipn, signature inside the JSON body);
 *  - SePay (POST /api/v1/payments/sepay/webhook), which watches the shop's
 *    bank account — in Test mode its "Mo phong giao dich" simulator fires the
 *    same signed webhooks without real money. SePay signs the raw body with
 *    HMAC-SHA256 and sends X-SePay-Signature / X-SePay-Timestamp headers;
 *    see developer.sepay.vn (SePay Webhooks -> Authentication / Integrate).
 */
@RestController
@RequestMapping("/api/v1")
public class PaymentApi {
    final PlatformApi app;
    final JdbcTemplate db;
    final CatalogService catalog;
    final CommerceApi commerce;
    @Value("${APP_IPN_SECRET:}") String ipnSecret;
    @Value("${APP_SEPAY_SECRET:}") String sepaySecret;

    private static final Pattern ORDER_NUMBER = Pattern.compile("GH-[A-Z0-9]{8}");

    public PaymentApi(PlatformApi app, JdbcTemplate db, CatalogService catalog, CommerceApi commerce) {
        this.app = app;
        this.db = db;
        this.catalog = catalog;
        this.commerce = commerce;
    }

    static String hmacHex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String sign(String secret, String orderNumber, long amount, String transactionId) {
        return hmacHex(secret, orderNumber + "|" + amount + "|" + transactionId);
    }

    @PostMapping("/payments/ipn") @Transactional
    public Object ipn(@RequestBody Map<String, Object> b) {
        if (ipnSecret == null || ipnSecret.isBlank())
            throw new PlatformApi.Problem(404, "IPN mô phỏng chưa được bật.");
        app.lock();
        String number = app.text(b, "orderNumber", 20);
        long amount;
        try {
            amount = Long.parseLong(app.str(b, "amount"));
        } catch (Exception e) {
            throw new PlatformApi.Problem(400, "Số tiền IPN không hợp lệ.");
        }
        String txn = app.text(b, "transactionId", 100);
        String expected = sign(ipnSecret, number, amount, txn);
        String given = app.str(b, "signature").toLowerCase(Locale.ROOT);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8)))
            throw new PlatformApi.Problem(401, "Chữ ký IPN không hợp lệ.");
        String result = processPayment(number, amount, txn, "IPN", "payment-ipn");
        return Map.of("orderNumber", number, "result", result);
    }

    /**
     * SePay webhook receiver (developer.sepay.vn contract): HMAC-SHA256 over
     * "{timestamp}.{rawBody}", anti-replay window of 5 minutes, and SePay
     * only counts the delivery as successful on HTTP 200/201 with the exact
     * body {"success": true} — every business outcome (PAID, REVIEW, ignored
     * foreign transaction) is therefore acknowledged with that body; only
     * authentication failures are rejected, so SePay retries those.
     */
    @PostMapping(value = "/payments/sepay/webhook", produces = MediaType.APPLICATION_JSON_VALUE)
    @Transactional
    public ResponseEntity<String> sepayWebhook(@RequestBody String rawBody,
            @RequestHeader(value = "X-SePay-Signature", required = false) String signature,
            @RequestHeader(value = "X-SePay-Timestamp", required = false) String timestamp) {
        if (sepaySecret == null || sepaySecret.isBlank())
            throw new PlatformApi.Problem(503, "Webhook SePay chưa được cấu hình (APP_SEPAY_SECRET).");
        long ts;
        try {
            ts = Long.parseLong(timestamp == null ? "" : timestamp.trim());
        } catch (Exception e) {
            throw new PlatformApi.Problem(401, "Thiếu hoặc sai X-SePay-Timestamp.");
        }
        if (Math.abs(Instant.now().getEpochSecond() - ts) > 300)
            throw new PlatformApi.Problem(401, "Webhook SePay ngoài cửa sổ 5 phút (timestamp).");
        String expected = "sha256=" + hmacHex(sepaySecret, ts + "." + rawBody);
        String given = signature == null ? "" : signature.trim();
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8)))
            throw new PlatformApi.Problem(401, "Chữ ký SePay không hợp lệ.");
        var payload = app.decode(rawBody);
        if (!"in".equals(app.str(payload, "transferType")))
            return sepayOk();
        String number = extractOrderNumber(app.str(payload, "content"));
        if (number == null) number = extractOrderNumber(app.str(payload, "code"));
        if (number == null)
            return sepayOk(); // a transfer that is not one of our orders: acknowledge and ignore
        long amount;
        try {
            amount = Long.parseLong(app.str(payload, "transferAmount"));
        } catch (Exception e) {
            return sepayOk();
        }
        String providerId = app.str(payload, "id");
        if (amount <= 0 || providerId.isBlank() || providerId.length() > 100) return sepayOk();
        String txn = "SEPAY-" + providerId;
        app.lock();
        try {
            processPayment(number, amount, txn, "SePay", "payment-sepay");
        } catch (PlatformApi.Problem p) {
            // Unknown order, non-VietQR order, or an order in a terminal state:
            // the outcome is permanent, so acknowledge instead of letting SePay retry.
            if (p.status != 404 && p.status != 422) throw p;
        }
        return sepayOk();
    }

    private ResponseEntity<String> sepayOk() {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body("{\"success\": true}");
    }

    private String extractOrderNumber(String text) {
        if (text == null) return null;
        var m = ORDER_NUMBER.matcher(text.toUpperCase(Locale.ROOT));
        return m.find() ? m.group() : null;
    }

    /**
     * GW3 matching, shared by every notification sender. Returns the outcome
     * code; throws 404 for an unknown order and 422 for a non-VietQR order
     * or a nonpositive amount.
     */
    @SuppressWarnings("unchecked")
    String processPayment(String number, long amount, String txn, String source, String historyAction) {
        app.require(amount > 0, "Số tiền thanh toán phải lớn hơn 0.");
        var rows = db.queryForList("SELECT owner_id, data::text FROM records WHERE kind='order' AND data->>'number'=?", number);
        if (rows.isEmpty()) throw new PlatformApi.Problem(404, "Không tìm thấy đơn hàng.");
        UUID owner = (UUID) rows.getFirst().get("owner_id");
        var order = app.decode((String) rows.getFirst().get("data"));
        var payment = (Map<String, Object>) order.get("payment");
        if (payment == null || !"VIETQR".equals(app.str(order, "paymentMethod")))
            throw new PlatformApi.Problem(422, "Đơn không dùng thanh toán VietQR.");
        boolean knownBeforeMigration = txn.equals(app.str(payment, "transactionId"))
                || txn.equals(app.str(payment, "extraTransactionId"));
        int inserted = db.update("""
                INSERT INTO payment_notifications (source, transaction_id, order_id, amount)
                VALUES (?, ?, ?, ?) ON CONFLICT (source, transaction_id) DO NOTHING
                """, source, txn, app.uuid(app.str(order, "id")), amount);
        if (inserted == 0 || knownBeforeMigration) return "DUPLICATE_IGNORED";

        String paymentStatus = app.str(order, "paymentStatus");
        if (paymentStatus.equals("PAID")) {
            // A second, distinct payment for an already-paid order: the extra
            // money exists and must be reconciled (refund), never dropped.
            String firstTxn = app.str(payment, "transactionId");
            payment.put("status", "REVIEW");
            payment.put("extraTransactionId", txn);
            order.put("paymentStatus", "REVIEW");
            addHistory(order, "Phát hiện giao dịch thứ hai (" + txn + ") qua " + source
                    + " cho đơn đã thanh toán bởi giao dịch " + firstTxn
                    + ": tiền thừa chuyển đối soát (REVIEW) để xử lý hoàn.", historyAction);
            order.put("revision", app.number(order, "revision") + 1);
            app.save("order", owner, order);
            return "REVIEW_DOUBLE";
        }
        if (paymentStatus.equals("REVIEW")) {
            addHistory(order, "Nhận thêm giao dịch " + txn + " (" + amount + "đ) trong lúc đối soát.", historyAction);
            order.put("revision", app.number(order, "revision") + 1);
            app.save("order", owner, order);
            return "ALREADY_REVIEW";
        }
        if (paymentStatus.equals("REFUNDED")) {
            toReview(order, owner, payment, txn,
                    "Nhận giao dịch mới sau khi đã hoàn tiền. Chuyển đối soát thủ công.", historyAction);
            return "REVIEW_LATE";
        }
        if (!paymentStatus.equals("UNPAID"))
            throw new PlatformApi.Problem(422, "Đơn không còn chờ thanh toán.");
        if (Set.of("CANCELLED", "RETURNED").contains(app.str(order, "status"))) {
            toReview(order, owner, payment, txn,
                    "Tiền đến qua " + source + " sau khi đơn đã hủy hoặc hoàn về. Chuyển đối soát thủ công.",
                    historyAction);
            return "REVIEW_LATE";
        }
        if (canExpire(order, payment) && deadlineReached(payment)) {
            markExpired(owner, order, payment);
        }
        long total = ((Number) order.get("total")).longValue();
        if (amount != total) {
            toReview(order, owner, payment, txn,
                    source + " sai lệch số tiền: nhận " + amount + "đ, tổng đơn " + total + "đ. Chuyển đối soát thủ công (REVIEW).",
                    historyAction);
            return "REVIEW_AMOUNT";
        }
        boolean expired = app.str(payment, "status").equals("EXPIRED")
                || deadlineReached(payment);
        if (expired) {
            toReview(order, owner, payment, txn,
                    "Tiền đến qua " + source + " sau khi phiên thanh toán đã hết hạn. Chuyển đối soát thủ công (REVIEW).",
                    historyAction);
            return "REVIEW_LATE";
        }
        payment.put("status", "PAID");
        payment.put("transactionId", txn);
        payment.put("paidAt", Instant.now().toString());
        order.put("paymentStatus", "PAID");
        order.put("paymentReference", txn);
        order.put("paidAt", Instant.now().toString());
        addHistory(order, source + " đã xác minh chữ ký và khớp số tiền: ghi nhận thanh toán VietQR thành công.", historyAction);
        order.put("revision", app.number(order, "revision") + 1);
        app.save("order", owner, order);
        return "PAID";
    }

    private void toReview(Map<String, Object> order, UUID owner, Map<String, Object> payment, String txn, String note, String historyAction) {
        payment.put("status", "REVIEW");
        payment.put("transactionId", txn);
        order.put("paymentStatus", "REVIEW");
        addHistory(order, note, historyAction);
        order.put("revision", app.number(order, "revision") + 1);
        app.save("order", owner, order);
    }

    @SuppressWarnings("unchecked")
    private void addHistory(Map<String, Object> order, String note, String action) {
        ((List<Object>) order.get("history")).add(Map.of(
                "at", Instant.now().toString(),
                "status", app.str(order, "status"),
                "note", note,
                "action", action));
    }

    private boolean deadlineReached(Map<String, Object> payment) {
        return !Instant.parse(app.str(payment, "expiresAt")).isAfter(Instant.now());
    }

    private boolean canExpire(Map<String, Object> order, Map<String, Object> payment) {
        return Set.of("PLACED", "CONFIRMED").contains(app.str(order, "status"))
                && "PENDING".equals(app.str(payment, "status"));
    }

    private void markExpired(UUID owner, Map<String, Object> order, Map<String, Object> payment) {
        catalog.releaseReservedStock(order);
        commerce.restoreExpiredCart(owner, order);
        payment.put("status", "EXPIRED");
        order.put("status", "CANCELLED");
        addHistory(order, "Hết hạn thanh toán VietQR. Đã hủy đơn và hoàn tồn kho.", "payment-expire");
    }

    /** Expire only unpaid reservations that have not reached packing. */
    @Scheduled(fixedDelayString = "${APP_PAYMENT_SWEEP_MS:60000}")
    @Transactional
    @SuppressWarnings("unchecked")
    public void expireOverdue() {
        app.lock();
        var rows = db.queryForList(
                "SELECT owner_id, data::text FROM records WHERE kind='order'"
                        + " AND data->>'paymentMethod'='VIETQR' AND data->>'paymentStatus'='UNPAID'"
                        + " AND data->>'status' IN ('PLACED','CONFIRMED')"
                        + " AND data#>>'{payment,status}'='PENDING'"
                        + " AND (data#>>'{payment,expiresAt}')::timestamptz < now()");
        for (var row : rows) {
            UUID owner = (UUID) row.get("owner_id");
            var order = app.decode((String) row.get("data"));
            var payment = (Map<String, Object>) order.get("payment");
            markExpired(owner, order, payment);
            order.put("revision", app.number(order, "revision") + 1);
            app.save("order", owner, order);
        }
    }

    @ExceptionHandler(Exception.class)
    public org.springframework.http.ResponseEntity<?> error(Exception e) {
        return app.error(e);
    }
}
