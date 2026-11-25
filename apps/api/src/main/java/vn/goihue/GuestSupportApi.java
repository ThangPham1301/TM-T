package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class GuestSupportApi {
    private static final Set<String> TOPICS = Set.of("DELIVERY", "RETURNS", "PRIVACY", "OTHER");
    private static final List<String> STATUSES = List.of("SUBMITTED", "IN_REVIEW", "RESOLVED");
    private static final int PAGE_SIZE = 30;
    private static final String FIELDS = """
            s.id, s.topic, s.message, s.status, s.reply, s.revision,
            s.created_at AS "createdAt", s.updated_at AS "updatedAt"
            """;

    private final PlatformApi app;
    private final GuestCommerceApi commerce;
    private final GuestRateLimiter limiter;
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;

    public GuestSupportApi(PlatformApi app, GuestCommerceApi commerce, GuestRateLimiter limiter,
                           JdbcTemplate db, PlatformTransactionManager transactionManager) {
        this.app = app;
        this.commerce = commerce;
        this.limiter = limiter;
        this.db = db;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @GetMapping("/guest/orders/{number}/support")
    public Object list(@PathVariable String number, HttpServletRequest request) {
        UUID order = orderId(number, request);
        return db.queryForList("SELECT " + FIELDS + """
                FROM guest_support s WHERE s.order_id=?
                ORDER BY s.created_at DESC, s.id DESC LIMIT 30
                """, order);
    }

    @PostMapping("/guest/orders/{number}/support")
    public Object create(@PathVariable String number, @RequestBody Map<String,Object> input,
                         @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) {
        app.origin(request);
        UUID order = orderId(number, request);
        if (!limiter.allow("guest-support", 150))
            throw new PlatformApi.Problem(429, "Có quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.");
        String topic = requiredText(input, "topic", 20);
        app.require(TOPICS.contains(topic), "Chọn chủ đề hỗ trợ hợp lệ.");
        String message = requiredText(input, "message", 2000);
        app.require(key.matches("[A-Za-z0-9-]{16,80}"), "Khóa gửi lặp không hợp lệ.");
        return transactions.execute(transaction -> storeRequest(order, key, topic, message));
    }

    private Map<String,Object> storeRequest(UUID order, String key, String topic, String message) {
        // Serialize submissions for the same order, including retries using a different key.
        db.queryForObject("SELECT id FROM records WHERE id=? FOR UPDATE", UUID.class, order);
        var previous = db.queryForList("SELECT " + FIELDS +
                "FROM guest_support s WHERE s.order_id=? AND s.request_key=?", order, key);
        if (!previous.isEmpty()) {
            var stored = previous.getFirst();
            if (!topic.equals(stored.get("topic")) || !message.equals(stored.get("message")))
                throw new PlatformApi.Problem(409, "Khóa đã dùng cho nội dung khác.");
            return stored;
        }
        if (Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM guest_support WHERE order_id=? AND topic=? AND status<>'RESOLVED')
                """, Boolean.class, order, topic)))
            throw new PlatformApi.Problem(409, "Đơn này đã có yêu cầu đang mở cho chủ đề bạn chọn.");
        if (db.queryForObject("""
                SELECT count(*) FROM guest_support WHERE order_id=? AND created_at > now() - interval '1 day'
                """, Integer.class, order) >= 8)
            throw new PlatformApi.Problem(429, "Đơn này đã gửi nhiều yêu cầu trong hôm nay. Vui lòng theo dõi hồ sơ đã gửi.");

        UUID id = UUID.randomUUID();
        db.update("INSERT INTO guest_support(id, order_id, request_key, topic, message) VALUES(?,?,?,?,?)",
                id, order, key, topic, message);
        return db.queryForMap("SELECT " + FIELDS + "FROM guest_support s WHERE s.id=?", id);
    }

    @GetMapping("/admin/support")
    public Object inbox(@RequestParam(defaultValue = "SUBMITTED") String status,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "") String number, HttpServletRequest request) {
        app.permission(app.actor(request), "order.manage");
        app.require(page >= 0 && page <= 10000, "Trang không hợp lệ.");
        app.require(status.equals("ALL") || STATUSES.contains(status), "Trạng thái không hợp lệ.");
        String order = number.trim().toUpperCase(Locale.ROOT);
        app.require(order.isEmpty() || order.matches("GH-[A-Z0-9]{8}"), "Mã đơn không hợp lệ.");
        var rows = db.queryForList("SELECT " + FIELDS + """
                , r.data->>'number' AS "orderNumber"
                FROM guest_support s JOIN records r ON r.id=s.order_id
                WHERE (?='ALL' OR s.status=?) AND (?='' OR r.data->>'number'=?)
                ORDER BY s.updated_at DESC, s.id DESC LIMIT ? OFFSET ?
                """, status, status, order, order, PAGE_SIZE + 1, page * PAGE_SIZE);
        return Map.of("items", rows.subList(0, Math.min(rows.size(), PAGE_SIZE)), "hasMore", rows.size() > PAGE_SIZE);
    }

    @PutMapping("/admin/support/{id}")
    @Transactional
    public Object respond(@PathVariable UUID id, @RequestBody Map<String,Object> input, HttpServletRequest request) {
        app.origin(request);
        var actor = app.actor(request);
        app.permission(actor, "order.manage");
        String status = requiredText(input, "status", 20);
        String reply = requiredText(input, "reply", 2000);
        int revision = app.number(input, "revision");
        var rows = db.queryForList("SELECT " + FIELDS + "FROM guest_support s WHERE s.id=? FOR UPDATE", id);
        if (rows.isEmpty()) throw new PlatformApi.Problem(404, "Không tìm thấy yêu cầu hỗ trợ.");
        var row = rows.getFirst();
        if (app.number(row, "revision") != revision)
            throw new PlatformApi.Problem(409, "Hồ sơ đã thay đổi. Tải lại trước khi phản hồi.");
        String current = app.str(row, "status");
        app.require(!current.equals("RESOLVED") && Set.of("IN_REVIEW", "RESOLVED").contains(status),
                "Không thể chuyển sang trạng thái này.");
        db.update("UPDATE guest_support SET status=?, reply=?, revision=revision+1, updated_at=now() WHERE id=?",
                status, reply, id);
        app.audit(actor, id.toString(), "guest-support-" + status.toLowerCase(Locale.ROOT));
        return db.queryForMap("SELECT " + FIELDS + "FROM guest_support s WHERE s.id=?", id);
    }

    private UUID orderId(String number, HttpServletRequest request) {
        return app.uuid(app.str(commerce.verifiedOrder(number, request), "id"));
    }

    private String requiredText(Map<String,Object> input, String key, int max) {
        app.require(input.get(key) instanceof String, "Nội dung yêu cầu không hợp lệ.");
        return app.text(input, key, max);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> error(Exception error) { return app.error(error); }
}
