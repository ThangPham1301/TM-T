package vn.goihue;

import com.fasterxml.jackson.annotation.JsonIgnore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
public class PricingService {
    private static final ZoneId STORE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PRICE = 10_000_000;
    private static final Set<String> TYPES = Set.of("SCHEDULE", "STOCK", "DEMAND");

    private final PlatformApi app;
    private final CatalogService catalog;
    private final JdbcTemplate db;

    public PricingService(PlatformApi app, CatalogService catalog, JdbcTemplate db) {
        this.app = app;
        this.catalog = catalog;
        this.db = db;
    }

    record Target(String productId, int price) {}
    record Rule(String id, int revision, String name, String type, boolean enabled,
                Instant startsAt, Instant endsAt, int threshold, List<Target> targets) {
        boolean activeAt(Instant now) {
            return enabled && (!type.equals("SCHEDULE") || (!now.isBefore(startsAt) && now.isBefore(endsAt)));
        }
    }
    record Price(int amount, int basePrice, String source, String ruleId, String name, Instant endsAt,
                 @JsonIgnore int floor) {
        boolean discountEligible() { return source.equals("BASE"); }
    }
    record Book(Instant asOf, Instant nextChangeAt, List<Rule> rules, Map<String, Long> sales) {}

    Book book(Instant now) {
        var enabled = rules().stream().filter(Rule::enabled).toList();
        var active = enabled.stream().filter(rule -> rule.activeAt(now)).toList();
        var day = now.atZone(STORE_ZONE).toLocalDate();
        boolean hasDemand = active.stream().anyMatch(rule -> rule.type().equals("DEMAND"));
        Instant next = hasDemand ? day.plusDays(1).atStartOfDay(STORE_ZONE).toInstant() : null;
        for (var rule : enabled) {
            if (!rule.type().equals("SCHEDULE")) continue;
            for (var time : List.of(rule.startsAt(), rule.endsAt())) {
                if (time.isAfter(now) && (next == null || time.isBefore(next))) next = time;
            }
        }
        var sales = hasDemand ? publishedSales(day) : Map.<String, Long>of();
        if (sales == null) {
            active = active.stream().filter(rule -> !rule.type().equals("DEMAND")).toList();
            sales = Map.of();
        }
        return new Book(now, next, active, sales);
    }

    private Map<String, Long> publishedSales(LocalDate day) {
        var rows = db.query("""
                SELECT units::text FROM pricing_sales_snapshot
                WHERE day BETWEEN ? AND ? ORDER BY day DESC LIMIT 1
                """, (rs, index) -> app.decode(rs.getString(1)), day.minusDays(1), day);
        if (rows.isEmpty()) return null;
        var units = new HashMap<String, Long>();
        rows.getFirst().forEach((id, count) -> units.put(id, ((Number) count).longValue()));
        return units;
    }

    @Scheduled(fixedDelayString = "${APP_PRICING_REFRESH_MS:30000}")
    @Transactional(timeout = 20)
    public void refreshSalesSnapshot() {
        var day = LocalDate.now(STORE_ZONE);
        // A separate non-blocking lock lets one instance publish without queuing checkout.
        if (!Boolean.TRUE.equals(db.queryForObject("SELECT pg_try_advisory_xact_lock(728125)", Boolean.class))) return;
        if (Boolean.TRUE.equals(db.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM pricing_sales_snapshot WHERE day=?)", Boolean.class, day))) return;
        var start = Timestamp.from(day.minusDays(3).atStartOfDay(STORE_ZONE).toInstant());
        var end = Timestamp.from(day.atStartOfDay(STORE_ZONE).toInstant());
        var units = new HashMap<String, Long>();
        // Use completed calendar days and the state at the daily cutoff, so new sales do not change today's price.
        db.query("""
                SELECT item->>'productId', sum((item->>'quantity')::integer)
                FROM records o
                CROSS JOIN LATERAL jsonb_array_elements(o.data->'items') AS item
                WHERE o.kind='order' AND o.created_at < ?
                  AND COALESCE((o.data->>'confirmedAt')::timestamptz, (
                      SELECT min((event->>'at')::timestamptz)
                      FROM jsonb_array_elements(o.data->'history') AS event
                      WHERE event->>'status'='CONFIRMED'
                  )) >= ?
                  AND COALESCE((o.data->>'confirmedAt')::timestamptz, (
                      SELECT min((event->>'at')::timestamptz)
                      FROM jsonb_array_elements(o.data->'history') AS event
                      WHERE event->>'status'='CONFIRMED'
                  )) < ?
                  AND NOT EXISTS (
                      SELECT 1 FROM jsonb_array_elements(o.data->'history') AS event
                      WHERE event->>'status' IN ('CANCELLED','RETURNED') AND (event->>'at')::timestamptz < ?
                  )
                  AND COALESCE((o.data->>'pricingClosedAt')::timestamptz >= ?, true)
                GROUP BY item->>'productId'
                """, row -> { units.put(row.getString(1), row.getLong(2)); }, end, start, end, end, end);
        db.update("INSERT INTO pricing_sales_snapshot(day, units) VALUES (?, ?::jsonb)", day, app.encode(units));
        db.update("DELETE FROM pricing_sales_snapshot WHERE day < ?", day.minusDays(1));
    }

    Price resolve(Map<String, Object> product, Book book) {
        int base = app.number(product, "price");
        String id = app.str(product, "id");
        int floor = floor(product);
        for (String type : List.of("SCHEDULE", "STOCK", "DEMAND")) {
            for (var rule : book.rules()) {
                if (!rule.type().equals(type)) continue;
                boolean matches = switch (type) {
                    case "STOCK" -> app.number(product, "stock") >= rule.threshold();
                    case "DEMAND" -> book.sales().getOrDefault(id, 0L) <= rule.threshold();
                    default -> true;
                };
                if (!matches) continue;
                for (var target : rule.targets()) {
                    if (target.productId().equals(id) && target.price() >= floor)
                        return new Price(target.price(), base, type, rule.id(), rule.name(), rule.endsAt(), floor);
                }
            }
        }
        return new Price(base, base, "BASE", null, null, null, floor);
    }

    void publish(Map<String, Object> product, Price price) {
        product.put("price", price.amount());
        product.put("basePrice", price.basePrice());
        product.remove("priceFloor");
        product.put("pricing", price);
    }

    private int floor(Map<String, Object> product) {
        return app.number(product, product.containsKey("priceFloor") ? "priceFloor" : "price");
    }

    List<Rule> rules() {
        return db.query("SELECT data::text FROM records WHERE kind='pricing-rule' ORDER BY created_at DESC, id",
                (rs, index) -> decode(app.decode(rs.getString(1))));
    }

    private Rule decode(Map<String, Object> row) {
        return new Rule(app.str(row, "id"), app.number(row, "revision"), app.str(row, "name"),
                app.str(row, "type"), Boolean.TRUE.equals(row.get("enabled")),
                date(row, "startsAt"), date(row, "endsAt"), app.number(row, "threshold"), targets(row));
    }

    Map<String, Object> mutate(Map<String, Object> actor, Map<String, Object> input) {
        app.permission(actor, "pricing.manage");
        String action = app.str(input, "action");
        String id = app.bounded(input, "id", 36);
        Instant now = Instant.now();
        if (action.equals("pricing-floor")) {
            var product = catalog.get(app.text(input, "id", 36), "product");
            catalog.revision(product, input);
            int floor = integer(input, "floor", 1, app.number(product, "price"));
            for (var rule : rules()) {
                if (!rule.enabled() || (rule.endsAt() != null && !rule.endsAt().isAfter(now))) continue;
                app.require(rule.targets().stream().noneMatch(t -> t.productId().equals(id) && t.price() < floor),
                        "Tạm dừng hoặc sửa các quy tắc đang bật dưới giá sàn mới.");
            }
            product.put("priceFloor", floor);
            product.put("revision", app.number(product, "revision") + 1);
            return app.save("product", null, product);
        }

        var row = id.isEmpty() ? new LinkedHashMap<String, Object>() : app.record(id, "pricing-rule", actor);
        if (!id.isEmpty()) catalog.revision(row, input);
        app.require(input.get("enabled") instanceof Boolean, "Trạng thái quy tắc không hợp lệ.");
        row.put("enabled", input.get("enabled"));
        if (action.equals("pricing-save")) {
            String type = app.text(input, "type", 20);
            app.require(TYPES.contains(type), "Chọn loại quy tắc giá.");
            row.put("name", app.text(input, "name", 90));
            row.put("type", type);
            row.put("threshold", type.equals("SCHEDULE") ? 0 : integer(input, "threshold", type.equals("STOCK") ? 1 : 0, 1_000_000));
            row.put("targets", targets(input));
            row.put("startsAt", type.equals("SCHEDULE") ? instant(input, "startsAt").toString() : "");
            row.put("endsAt", type.equals("SCHEDULE") ? instant(input, "endsAt").toString() : "");
        } else {
            app.require(!id.isEmpty(), "Chọn quy tắc cần cập nhật.");
        }

        String type = app.str(row, "type");
        Instant start = date(row, "startsAt"), end = date(row, "endsAt");
        boolean enabled = Boolean.TRUE.equals(row.get("enabled"));
        if (type.equals("SCHEDULE")) {
            app.require(start != null && end != null && start.isBefore(end), "Giờ kết thúc phải sau giờ bắt đầu.");
            app.require(!enabled || end.isAfter(now), "Lịch giá đã hết hạn.");
        }
        var targets = targets(row);
        if (enabled || action.equals("pricing-save")) {
            for (var target : targets) {
                var product = catalog.get(target.productId(), "product");
                app.require(target.price() >= floor(product), "Giá thấp hơn giá sàn của " + app.str(product, "name") + ".");
            }
        }
        if (enabled) {
            var ids = new HashSet<>(targets.stream().map(Target::productId).toList());
            for (var other : rules()) {
                if (!other.enabled() || !other.type().equals(type) || other.id().equals(id)) continue;
                boolean overlaps = !type.equals("SCHEDULE")
                        || (start.isBefore(other.endsAt()) && other.startsAt().isBefore(end));
                if (overlaps && other.targets().stream().anyMatch(target -> ids.contains(target.productId())))
                    throw new PlatformApi.Problem(409, "Trùng quy tắc giá với chương trình “" + other.name() + "”.");
            }
        }
        if (!id.isEmpty()) row.put("revision", app.number(row, "revision") + 1);
        return app.save("pricing-rule", null, row);
    }

    private List<Target> targets(Map<String, Object> input) {
        if (!(input.get("targets") instanceof List<?> list) || list.isEmpty() || list.size() > 100)
            throw new PlatformApi.Problem(422, "Chọn từ 1 đến 100 sản phẩm.");
        var ids = new HashSet<String>();
        var targets = new ArrayList<Target>();
        for (Object entry : list) {
            if (entry instanceof Target target) {
                targets.add(target);
                continue;
            }
            if (!(entry instanceof Map<?, ?> item) || !(item.get("productId") instanceof String id)
                    || !id.matches("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"))
                throw new PlatformApi.Problem(422, "Sản phẩm trong quy tắc giá không hợp lệ.");
            String normalized = id.toLowerCase(Locale.ROOT);
            app.require(ids.add(normalized), "Mỗi sản phẩm chỉ được chọn một lần.");
            targets.add(new Target(normalized, integer(item, "price", 1, MAX_PRICE)));
        }
        return List.copyOf(targets);
    }

    private int integer(Map<?, ?> input, String key, int min, int max) {
        try {
            int value = Integer.parseInt(Objects.toString(input.get(key), ""));
            app.require(value >= min && value <= max, "Giá trị " + key + " phải từ " + min + " đến " + max + ".");
            return value;
        } catch (NumberFormatException error) {
            throw new PlatformApi.Problem(422, "Giá trị " + key + " phải là số nguyên.");
        }
    }

    private Instant date(Map<String, Object> row, String key) {
        String value = app.str(row, key);
        return value.isEmpty() ? null : Instant.parse(value);
    }

    private Instant instant(Map<String, Object> input, String key) {
        try {
            var parsed = Instant.parse(app.text(input, key, 40));
            int year = parsed.atOffset(ZoneOffset.UTC).getYear();
            app.require(year >= 2000 && year <= 9999, "Năm áp dụng không hợp lệ.");
            return parsed;
        } catch (java.time.DateTimeException error) {
            throw new PlatformApi.Problem(422, "Nhập thời gian áp dụng hợp lệ.");
        }
    }
}
