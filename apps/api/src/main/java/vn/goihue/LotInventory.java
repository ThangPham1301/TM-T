package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
class LotInventory {
    private static final ZoneId WAREHOUSE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final String ELIGIBLE = """
            quarantined_at IS NULL AND manufactured_on <= ? AND expires_on > ?
            AND (expires_on - CAST(? AS date)) * 4 >= (expires_on - manufactured_on) * 3
            """;
    private static final String SELLABLE = "product_id = ? AND quantity > 0 AND " + ELIGIBLE;

    private final PlatformApi app;
    private final JdbcTemplate db;

    LotInventory(PlatformApi app, JdbcTemplate db) {
        this.app = app;
        this.db = db;
    }

    int available(UUID productId) {
        LocalDate today = LocalDate.now(WAREHOUSE_ZONE);
        int quantity = db.queryForObject("SELECT COALESCE(sum(quantity), 0) FROM inventory_lots WHERE " + SELLABLE,
                Integer.class, productId, today, today, today);
        return quantity;
    }

    List<Map<String, Object>> reserve(UUID productId, int quantity) {
        LocalDate today = LocalDate.now(WAREHOUSE_ZONE);
        var lots = db.queryForList("""
                SELECT id, code, expires_on, quantity FROM inventory_lots WHERE
                """ + SELLABLE + " ORDER BY expires_on, manufactured_on, id FOR UPDATE",
                productId, today, today, today);
        var allocations = new ArrayList<Map<String, Object>>();
        int remaining = quantity;
        for (var lot : lots) {
            if (remaining == 0) break;
            int used = Math.min(remaining, app.number(lot, "quantity"));
            db.update("UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?", used, lot.get("id"));
            allocations.add(Map.of("lotId", lot.get("id").toString(), "code", lot.get("code"),
                    "expiresOn", lot.get("expires_on").toString(), "quantity", used));
            remaining -= used;
        }
        app.require(remaining == 0, "Không đủ tồn theo lô còn ít nhất 75% hạn sử dụng.");
        return allocations;
    }

    void restore(UUID productId, Map<String, Object> allocation) {
        int updated = db.update("""
                UPDATE inventory_lots SET quantity = quantity + ? WHERE id = ? AND product_id = ?
                """, app.number(allocation, "quantity"), app.uuid(app.str(allocation, "lotId")), productId);
        if (updated != 1) throw new IllegalStateException("Missing reserved inventory lot");
    }

    boolean eligible(UUID productId, UUID lotId) {
        LocalDate today = LocalDate.now(WAREHOUSE_ZONE);
        return Boolean.TRUE.equals(db.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM inventory_lots WHERE product_id = ? AND id = ? AND " + ELIGIBLE + ")",
                Boolean.class, productId, lotId, today, today, today));
    }

    void quarantine(UUID lotId, String reference) {
        db.update("""
                UPDATE inventory_lots SET quarantined_at = now(), quarantine_reference = ?
                WHERE id = ? AND quarantined_at IS NULL
                """, reference, lotId);
    }

    List<Map<String, Object>> list(UUID productId) {
        return db.query("""
                SELECT id, code, manufactured_on, expires_on, quantity, quarantined_at FROM inventory_lots
                WHERE product_id = ? ORDER BY expires_on, manufactured_on, id
                """, (rs, rowNumber) -> Map.of("id", rs.getString("id"), "code", rs.getString("code"),
                "manufacturedOn", rs.getString("manufactured_on"), "expiresOn", rs.getString("expires_on"),
                "quantity", rs.getInt("quantity"), "quarantined", rs.getObject("quarantined_at") != null), productId);
    }

    Map<String, Object> add(UUID productId, Map<String, Object> body) {
        String code = app.text(body, "code", 60);
        LocalDate manufactured = date(body, "manufacturedOn");
        LocalDate expires = date(body, "expiresOn");
        LocalDate today = LocalDate.now(WAREHOUSE_ZONE);
        app.require(!manufactured.isAfter(today) && expires.isAfter(today),
                "Ngày sản xuất không được ở tương lai và hạn sử dụng phải sau hôm nay.");
        int quantity = app.number(body, "quantity");
        app.require(quantity > 0 && quantity <= 1_000_000, "Số lượng lô không hợp lệ.");
        var id = UUID.randomUUID();
        int inserted = db.update("""
                INSERT INTO inventory_lots (id, product_id, code, manufactured_on, expires_on, quantity)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (product_id, code) DO NOTHING
                """, id, productId, code, manufactured, expires, quantity);
        if (inserted == 0) throw new PlatformApi.Problem(409, "Mã lô đã tồn tại cho sản phẩm.");
        return Map.of("id", id.toString(), "code", code, "manufacturedOn", manufactured.toString(),
                "expiresOn", expires.toString(), "quantity", quantity);
    }

    private LocalDate date(Map<String, Object> body, String field) {
        try {
            return LocalDate.parse(app.text(body, field, 10));
        } catch (DateTimeParseException e) {
            throw new PlatformApi.Problem(422, "Ngày của lô hàng phải theo mẫu YYYY-MM-DD.");
        }
    }
}
