package vn.goihue;

import org.springframework.beans.factory.annotation.Value;
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

/**
 * Demo payment confirmation for VietQR checkout orders.
 *
 * The QR code itself proves nothing: money is only recorded after an IPN
 * (instant payment notification) arrives and passes gateway-style checks —
 * valid HMAC signature, amount matches the locked order total, attempt still
 * inside its 15-minute window. Duplicates are ignored idempotently; any
 * mismatch or late arrival moves the order to REVIEW for manual
 * reconciliation instead of being silently accepted or dropped.
 *
 * In production the sender of this notification is a real provider
 * (e.g. SePay watching the shop bank account, or a gateway such as VNPAY).
 * For the classroom demo, scripts/demo-ipn.ps1 plays that role; the
 * verification and matching logic is identical either way.
 */
@RestController
@RequestMapping("/api/v1")
public class PaymentApi {
    final PlatformApi app;
    final JdbcTemplate db;
    final CatalogService catalog;
    @Value("${APP_IPN_SECRET:demoipnsecret}") String ipnSecret;

    public PaymentApi(PlatformApi app, JdbcTemplate db, CatalogService catalog) {
        this.app = app;
        this.db = db;
        this.catalog = catalog;
    }

    static String sign(String secret, String orderNumber, long amount, String transactionId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal((orderNumber + "|" + amount + "|" + transactionId).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(raw);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @PostMapping("/payments/ipn") @Transactional
    @SuppressWarnings("unchecked")
    public Object ipn(@RequestBody Map<String, Object> b) {
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
        var rows = db.queryForList("SELECT owner_id, data::text FROM records WHERE kind='order' AND data->>'number'=?", number);
        if (rows.isEmpty()) throw new PlatformApi.Problem(404, "Không tìm thấy đơn hàng.");
        UUID owner = (UUID) rows.getFirst().get("owner_id");
        var order = app.decode((String) rows.getFirst().get("data"));
        var payment = (Map<String, Object>) order.get("payment");
        if (payment == null || !"VIETQR".equals(app.str(order, "paymentMethod")))
            throw new PlatformApi.Problem(422, "Đơn không dùng thanh toán VietQR.");
        String paymentStatus = app.str(order, "paymentStatus");
        if (paymentStatus.equals("PAID") && txn.equals(app.str(payment, "transactionId")))
            return Map.of("orderNumber", number, "result", "DUPLICATE_IGNORED");
        if (paymentStatus.equals("REVIEW"))
            return Map.of("orderNumber", number, "result", "ALREADY_REVIEW");
        if (!paymentStatus.equals("UNPAID"))
            throw new PlatformApi.Problem(422, "Đơn không còn chờ thanh toán.");
        long total = ((Number) order.get("total")).longValue();
        if (amount != total) {
            toReview(order, owner, payment, txn,
                    "IPN sai lệch số tiền: nhận " + amount + "đ, tổng đơn " + total + "đ. Chuyển đối soát thủ công (REVIEW).");
            return Map.of("orderNumber", number, "result", "REVIEW_AMOUNT");
        }
        boolean expired = app.str(payment, "status").equals("EXPIRED")
                || Instant.parse(app.str(payment, "expiresAt")).isBefore(Instant.now());
        if (expired) {
            toReview(order, owner, payment, txn,
                    "Tiền đến sau khi phiên thanh toán đã hết hạn. Chuyển đối soát thủ công (REVIEW).");
            return Map.of("orderNumber", number, "result", "REVIEW_LATE");
        }
        payment.put("status", "PAID");
        payment.put("transactionId", txn);
        payment.put("paidAt", Instant.now().toString());
        order.put("paymentStatus", "PAID");
        order.put("paymentReference", txn);
        order.put("paidAt", Instant.now().toString());
        addHistory(order, "IPN đã xác minh chữ ký và khớp số tiền: ghi nhận thanh toán VietQR thành công.");
        order.put("revision", app.number(order, "revision") + 1);
        app.save("order", owner, order);
        return Map.of("orderNumber", number, "result", "PAID");
    }

    private void toReview(Map<String, Object> order, UUID owner, Map<String, Object> payment, String txn, String note) {
        payment.put("status", "REVIEW");
        payment.put("transactionId", txn);
        order.put("paymentStatus", "REVIEW");
        addHistory(order, note);
        order.put("revision", app.number(order, "revision") + 1);
        app.save("order", owner, order);
    }

    @SuppressWarnings("unchecked")
    private void addHistory(Map<String, Object> order, String note) {
        ((List<Object>) order.get("history")).add(Map.of(
                "at", Instant.now().toString(),
                "status", app.str(order, "status"),
                "note", note,
                "action", "payment-ipn"));
    }

    /**
     * E2 of the checkout design: a VietQR session that reaches its deadline
     * unpaid is cancelled and its stock released exactly once (the order is
     * no longer UNPAID afterwards, so the sweep never touches it again).
     * A payment that still arrives later lands in REVIEW via the IPN path.
     */
    @Scheduled(fixedDelayString = "${APP_PAYMENT_SWEEP_MS:60000}")
    @Transactional
    @SuppressWarnings("unchecked")
    public void expireOverdue() {
        app.lock();
        var rows = db.queryForList(
                "SELECT owner_id, data::text FROM records WHERE kind='order'"
                        + " AND data->>'paymentMethod'='VIETQR' AND data->>'paymentStatus'='UNPAID'"
                        + " AND data#>>'{payment,status}'='PENDING'"
                        + " AND (data#>>'{payment,expiresAt}')::timestamptz < now()");
        for (var row : rows) {
            UUID owner = (UUID) row.get("owner_id");
            var order = app.decode((String) row.get("data"));
            var payment = (Map<String, Object>) order.get("payment");
            payment.put("status", "EXPIRED");
            for (var line : (List<Map<String, Object>>) order.get("items")) {
                var p = catalog.get(app.str(line, "productId"), "product");
                p.put("stock", app.number(p, "stock") + app.number(line, "quantity"));
                p.put("revision", app.number(p, "revision") + 1);
                app.save("product", null, p);
            }
            order.put("status", "CANCELLED");
            ((List<Object>) order.get("history")).add(Map.of(
                    "at", Instant.now().toString(),
                    "status", "CANCELLED",
                    "note", "Hết hạn thanh toán VietQR (E2): hủy phiên, hoàn tồn kho. Tiền đến muộn sẽ vào đối soát REVIEW.",
                    "action", "payment-expire"));
            order.put("revision", app.number(order, "revision") + 1);
            app.save("order", owner, order);
        }
    }

    @ExceptionHandler(Exception.class)
    public org.springframework.http.ResponseEntity<?> error(Exception e) {
        return app.error(e);
    }
}
