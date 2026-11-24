package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import vn.goihue.CommerceApi.CartOwner;

@RestController
@RequestMapping("/api/v1/guest")
public class GuestCommerceApi {
    private static final String CART_COOKIE = "goihue_guest";
    private static final String ORDER_COOKIE = "goihue_order_access";
    private static final Duration CART_LIFETIME = Duration.ofDays(7);
    private static final Duration ORDER_ACCESS_LIFETIME = Duration.ofMinutes(30);
    private static final Set<String> CART_ACTIONS = Set.of("cart-set", "cart-clear", "cart-refresh");

    private final PlatformApi app;
    private final CommerceApi commerce;
    private final JdbcTemplate db;
    private final GuestRateLimiter limiter;
    private final TransactionTemplate transactions;

    GuestCommerceApi(PlatformApi app, CommerceApi commerce, JdbcTemplate db,
                     GuestRateLimiter limiter, PlatformTransactionManager transactionManager) {
        this.app = app;
        this.commerce = commerce;
        this.db = db;
        this.limiter = limiter;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    private record Guest(UUID id, String token) {
        CartOwner cart() { return new CartOwner(id, true); }
    }

    @GetMapping("/cart/summary")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Object summary(HttpServletRequest request) {
        var guest = guest(request);
        return commerce.cartSummary(guest == null ? new CartOwner(null, true) : guest.cart());
    }

    @PostMapping("/commerce")
    public Object mutate(@RequestBody Map<String,Object> body, @RequestHeader("Idempotency-Key") String key,
                         HttpServletRequest request, HttpServletResponse response) {
        app.origin(request);
        String action = app.text(body, "action", 30);
        app.require(CART_ACTIONS.contains(action) || action.equals("checkout"), "Thao tác khách không được hỗ trợ.");
        requireGuestBuyer(request);
        rateLimit("cart", 600);
        if (action.equals("checkout")) rateLimit("checkout", 40);
        String fingerprint = fingerprint(body, key);
        return transactions.execute(status -> mutateCartOrOrder(body, key, fingerprint, action, request, response));
    }

    private Object mutateCartOrOrder(Map<String,Object> body, String key, String fingerprint, String action,
                                     HttpServletRequest request, HttpServletResponse response) {
        app.lock();
        var guest = guest(request);
        if (guest == null) {
            if (!action.equals("cart-set"))
                throw new PlatformApi.Problem(409, "Phiên giỏ đã hết hạn. Vui lòng tải lại giỏ.");
            guest = startSession();
        }
        var previous = previous(guest.id(), key, fingerprint);
        if (previous != null) {
            return action.equals("checkout")
                    ? receipt(ownedOrder(app.str(previous, "number"), guest), guest)
                    : previous;
        }
        Map<String,Object> result;
        if (action.equals("checkout")) {
            app.require(app.str(body, "addressId").isEmpty(), "Vui lòng nhập địa chỉ nhận hàng cho đơn này.");
            app.require(app.text(body, "quoteToken", 64).matches("[a-f0-9]{64}"), "Vui lòng tải lại báo giá trước khi đặt hàng.");
            commerce.checkCart(guest.cart(), body);
            checkCheckoutLimits(guest, body);
            var order = commerce.checkout(guest.cart(), body, body);
            String code = lookupCode(guest, order);
            db.update("UPDATE records SET guest_lookup_hash=? WHERE id=? AND guest_owner_id=? AND kind='order'",
                    app.hash(code), app.uuid(app.str(order, "id")), guest.id());
            remember(guest.id(), key, fingerprint, Map.of("number", order.get("number")));
            db.update("INSERT INTO audit(actor_id,subject,action) VALUES(?,?,?)",
                    guest.id(), app.str(order, "id"), "guest-checkout");
            result = receipt(order, guest);
        } else {
            result = commerce.mutateCart(guest.cart(), action, body);
            remember(guest.id(), key, fingerprint, result);
        }
        renewSession(guest, response);
        return result;
    }

    @PostMapping("/cart/merge")
    @Transactional
    public Object merge(@RequestBody Map<String,Object> body, @RequestHeader("Idempotency-Key") String key,
                        HttpServletRequest request) {
        app.origin(request);
        app.lock();
        var user = app.actor(request);
        app.permission(user, "cart.manage");
        var guest = guest(request);
        if (guest == null) throw new PlatformApi.Problem(409, "Phiên giỏ đã hết hạn. Vui lòng tải lại giỏ.");
        var customer = new CartOwner((UUID) user.get("id"), false);
        var input = new LinkedHashMap<>(body);
        input.put("action", "guest-cart-merge");
        input.put("guestId", guest.id());
        String fingerprint = fingerprint(input, key);
        var previous = previous(customer.id(), key, fingerprint);
        if (previous != null) return previous;
        commerce.checkCart(guest.cart(), body);
        if (!commerce.cartToken(customer).equals(app.text(body, "customerCartToken", 100)))
            throw new PlatformApi.Problem(409, "Giỏ tài khoản đã thay đổi. Vui lòng tải lại trước khi gộp.");
        commerce.mergeGuestCart(guest.cart(), customer);
        var result = Map.<String,Object>of("ok", true);
        remember(customer.id(), key, fingerprint, result);
        app.audit(user, "cart", "guest-cart-merge");
        return result;
    }

    @PostMapping("/orders/lookup")
    public Object lookup(@RequestBody Map<String,Object> input, HttpServletRequest request, HttpServletResponse response) {
        app.origin(request);
        rateLimit("order-lookup", 300);
        String number = orderNumber(app.str(input, "number"));
        String code = app.str(input, "lookupCode");
        if (code.length() > 48) throw missingOrder();
        code = code.replace("-", "").toUpperCase(Locale.ROOT);
        if (!code.matches("[A-F0-9]{32}")) throw missingOrder();
        var rows = db.query("""
                SELECT data::text FROM records WHERE kind='order' AND guest_owner_id IS NOT NULL
                    AND data->>'number'=? AND guest_lookup_hash=?
                """, (row, index) -> app.decode(row.getString(1)), number, app.hash(code));
        if (rows.isEmpty()) throw missingOrder();
        var order = rows.getFirst();
        String access = app.token();
        db.update("INSERT INTO guest_order_grants(token_hash,order_id,expires_at) VALUES(?,?,now() + ? * interval '1 second')",
                app.hash(access), app.uuid(app.str(order, "id")), ORDER_ACCESS_LIFETIME.toSeconds());
        cookie(response, ORDER_COOKIE, access, orderPath(number), ORDER_ACCESS_LIFETIME);
        return publicOrder(order);
    }

    @GetMapping("/orders/latest")
    public Object latestOrder(HttpServletRequest request) {
        var guest = guest(request);
        if (guest == null) return Map.of();
        return db.query("""
                SELECT data->>'number' FROM records WHERE kind='order' AND guest_owner_id=?
                    ORDER BY created_at DESC LIMIT 1
                """, (row, index) -> Map.of("number", row.getString(1)), guest.id())
                .stream().findFirst().orElseGet(Map::of);
    }

    @GetMapping("/orders/{number}")
    public Object order(@PathVariable String number, HttpServletRequest request) {
        number = orderNumber(number);
        var guest = guest(request);
        var order = guest == null ? null : findOwnedOrder(number, guest);
        if (order != null) return receipt(order, guest);
        for (var value : cookieValues(request, ORDER_COOKIE)) {
            if (!value.matches("[a-f0-9]{64}")) continue;
            var rows = db.query("""
                    SELECT r.data::text FROM guest_order_grants g JOIN records r ON r.id=g.order_id
                    WHERE g.token_hash=? AND g.expires_at>now() AND r.kind='order' AND r.guest_owner_id IS NOT NULL
                        AND r.data->>'number'=?
                    """, (row, index) -> app.decode(row.getString(1)), app.hash(value), number);
            if (!rows.isEmpty()) return publicOrder(rows.getFirst());
        }
        throw missingOrder();
    }

    private List<String> cookieValues(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return List.of();
        return Arrays.stream(request.getCookies()).filter(cookie -> cookie.getName().equals(name))
                .map(cookie -> cookie.getValue()).toList();
    }

    private Guest guest(HttpServletRequest request) {
        var values = cookieValues(request, CART_COOKIE);
        if (values.isEmpty() || !values.getFirst().matches("[a-f0-9]{64}")) return null;
        String token = values.getFirst();
        return db.query("SELECT id FROM guest_sessions WHERE token_hash=? AND expires_at>now()",
                (row, index) -> new Guest(row.getObject(1, UUID.class), token), app.hash(token))
                .stream().findFirst().orElse(null);
    }

    private Guest startSession() {
        var guest = new Guest(UUID.randomUUID(), app.token());
        db.update("INSERT INTO guest_sessions(id,token_hash,expires_at) VALUES(?,?,now() + ? * interval '1 second')",
                guest.id(), app.hash(guest.token()), CART_LIFETIME.toSeconds());
        return guest;
    }

    private void renewSession(Guest guest, HttpServletResponse response) {
        db.update("UPDATE guest_sessions SET expires_at=now() + ? * interval '1 second' WHERE id=?",
                CART_LIFETIME.toSeconds(), guest.id());
        cookie(response, CART_COOKIE, guest.token(), "/api/store/guest", CART_LIFETIME);
    }

    private void cookie(HttpServletResponse response, String name, String value, String path, Duration maxAge) {
        response.addHeader("Set-Cookie", ResponseCookie.from(name, value).httpOnly(true)
                .secure(app.secureCookie).sameSite("Strict").path(path).maxAge(maxAge).build().toString());
    }

    private void requireGuestBuyer(HttpServletRequest request) {
        String session = app.sessionToken(request);
        if (session.isEmpty()) return;
        try {
            app.sessionActor(session);
        } catch (PlatformApi.Problem invalid) {
            if (invalid.status == 401) return;
            throw invalid;
        }
        throw new PlatformApi.Problem(403, "Vui lòng dùng giỏ của tài khoản đang đăng nhập.");
    }

    private void rateLimit(String scope, int limit) {
        if (!limiter.allow(scope, limit))
            throw new PlatformApi.Problem(429, "Có quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.");
    }

    private void checkCheckoutLimits(Guest guest, Map<String,Object> body) {
        String phone = app.text(body, "phone", 30).replaceAll("[^0-9]", "");
        int recent = db.queryForObject("""
                SELECT count(*) FROM records WHERE kind='order' AND guest_owner_id IS NOT NULL
                    AND created_at>now()-interval '1 hour'
                    AND (guest_owner_id=? OR regexp_replace(data->>'phone', '[^0-9]', '', 'g')=?)
                """, Integer.class, guest.id(), phone);
        if (recent >= 5)
            throw new PlatformApi.Problem(429, "Bạn đã đặt nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau.");
    }

    private String fingerprint(Map<String,Object> body, String key) {
        app.require(key.matches("[a-zA-Z0-9-]{16,80}"), "Khóa gửi lặp không hợp lệ.");
        return app.hash(app.encode(new TreeMap<>(body)));
    }

    private Map<String,Object> previous(UUID actor, String key, String fingerprint) {
        var rows = db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?", actor, key);
        if (rows.isEmpty()) return null;
        var row = rows.getFirst();
        if (!fingerprint.equals(row.get("fingerprint")))
            throw new PlatformApi.Problem(409, "Khóa đã dùng cho thao tác khác.");
        return app.decode((String) row.get("result"));
    }

    private void remember(UUID actor, String key, String fingerprint, Map<String,Object> result) {
        db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)", actor, key, fingerprint, app.encode(result));
    }

    private String orderNumber(String input) {
        if (input.length() > 20) throw missingOrder();
        String number = input.toUpperCase(Locale.ROOT);
        if (!number.matches("GH-[A-Z0-9]{8}")) throw missingOrder();
        return number;
    }

    private PlatformApi.Problem missingOrder() {
        return new PlatformApi.Problem(404, "Không tìm thấy đơn với thông tin tra cứu này.");
    }

    private Map<String,Object> ownedOrder(String number, Guest guest) {
        var order = findOwnedOrder(number, guest);
        if (order == null) throw missingOrder();
        return order;
    }

    private Map<String,Object> findOwnedOrder(String number, Guest guest) {
        return db.query("""
                SELECT data::text FROM records WHERE kind='order' AND guest_owner_id=? AND data->>'number'=?
                """, (row, index) -> app.decode(row.getString(1)), guest.id(), number).stream().findFirst().orElse(null);
    }

    private String orderPath(String number) { return "/api/store/guest/orders/" + number; }

    private String lookupCode(Guest guest, Map<String,Object> order) {
        return hmac(guest.token(), "order-lookup:" + app.str(order, "id")).substring(0, 32);
    }

    private String hmac(String key, String value) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().withUpperCase().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException("Could not sign order access", error);
        }
    }

    private Map<String,Object> receipt(Map<String,Object> order, Guest guest) {
        var result = publicOrder(order);
        result.put("lookupCode", lookupCode(guest, order));
        return result;
    }

    private Map<String,Object> selectFields(Map<?,?> source, String... keys) {
        var result = new LinkedHashMap<String,Object>();
        for (String key : keys) if (source.get(key) != null) result.put(key, source.get(key));
        return result;
    }

    private Map<String,Object> publicOrder(Map<String,Object> order) {
        var result = selectFields(order, "number", "createdAt", "status", "paymentMethod", "paymentStatus",
                "subtotal", "discountAmount", "shippingFee", "total", "codDueAmount", "trackingReference", "measurement");
        if (order.get("items") instanceof List<?> items)
            result.put("items", items.stream().filter(Map.class::isInstance).map(Map.class::cast)
                    .map(item -> selectFields(item, "productId", "name", "image", "slug", "quantity", "price", "netTotal")).toList());
        if (order.get("history") instanceof List<?> history)
            result.put("history", history.stream().filter(Map.class::isInstance).map(Map.class::cast)
                    .map(event -> selectFields(event, "at", "status")).toList());
        if (order.get("payment") instanceof Map<?,?> payment) {
            var visible = selectFields(payment, "status", "expiresAt", "paidAt");
            boolean pending = "PENDING".equals(visible.get("status")) && "UNPAID".equals(order.get("paymentStatus"))
                    && Set.of("PLACED", "CONFIRMED").contains(order.get("status"));
            if (pending && Instant.parse(visible.get("expiresAt").toString()).isAfter(Instant.now()))
                visible.putAll(selectFields(payment, "payload", "bankAccount", "bankName", "amount", "content"));
            result.put("payment", visible);
        }
        return result;
    }

    @Scheduled(fixedDelayString = "${APP_GUEST_CLEANUP_MS:3600000}")
    @Transactional
    public void cleanExpiredCarts() {
        app.lock();
        db.update("DELETE FROM guest_order_grants WHERE expires_at<now()");
        db.update("DELETE FROM records USING guest_sessions WHERE records.kind='cart'"
                + " AND records.guest_owner_id=guest_sessions.id AND guest_sessions.expires_at<now()");
        db.update("DELETE FROM operations USING guest_sessions WHERE operations.actor_id=guest_sessions.id"
                + " AND guest_sessions.expires_at<now()");
        db.update("DELETE FROM guest_sessions WHERE expires_at<now()"
                + " AND NOT EXISTS (SELECT 1 FROM records WHERE guest_owner_id=guest_sessions.id)");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> error(Exception error) { return app.error(error); }
}
