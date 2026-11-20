package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
public class DiscountService {
    private static final Comparator<Offer> DISPLAY_ORDER = Comparator
            .comparingInt(Offer::priority).reversed()
            .thenComparing(Offer::startsAt).thenComparing(Offer::id);
    private static final String OFFER_DATES = """
            WITH offer_dates AS (
                SELECT data,
                       CASE WHEN data->>'startsAt' ~ '^[2-9][0-9]{3}-.*Z$'
                                  AND pg_input_is_valid(data->>'startsAt', 'timestamptz')
                            THEN (data->>'startsAt')::timestamptz END AS starts_at,
                       CASE WHEN data->>'endsAt' ~ '^[2-9][0-9]{3}-.*Z$'
                                  AND pg_input_is_valid(data->>'endsAt', 'timestamptz')
                            THEN (data->>'endsAt')::timestamptz END AS ends_at
                FROM records WHERE kind='discount' AND data->>'enabled'='true'
            )
            """;
    private final PlatformApi app;
    private final CatalogService catalog;
    private final JdbcTemplate db;

    public DiscountService(PlatformApi app, CatalogService catalog, JdbcTemplate db) {
        this.app = app;
        this.catalog = catalog;
        this.db = db;
    }

    record Offer(String id, int revision, String name, String scope, String productId, List<String> productIds,
                 String productName, String productSlug, String condition, int minimum,
                 String method, int value, Instant startsAt, Instant endsAt,
                 boolean featured, int priority, String message) {
        boolean includes(Line line) {
            return scope.equals("CART") || productIds.contains(line.productId());
        }
    }

    record Line(String productId, long price, int quantity, boolean discountEligible, int floor) {
        long subtotal() { return price * quantity; }
        long discountCapacity() { return Math.max(0, price - floor) * quantity; }
    }

    record OfferHint(Offer offer, int remainingQuantity, long remainingAmount) {}
    record Quote(long subtotal, long discountAmount, Offer discount, OfferHint offerHint,
                 Map<String, Long> lineDiscounts) {
        long netSubtotal() { return subtotal - discountAmount; }

        Map<String, Object> breakdown() {
            var fields = new LinkedHashMap<String, Object>();
            fields.put("subtotal", subtotal);
            fields.put("discountAmount", discountAmount);
            fields.put("netSubtotal", netSubtotal());
            if (discount != null) fields.put("discount", Map.of(
                    "id", discount.id(), "revision", discount.revision(), "name", discount.name()));
            return fields;
        }
    }

    Map<String, Object> publicFeed() {
        Instant now = Instant.now();
        var active = activeOffers(now);
        var next = new LinkedHashMap<String, Object>();
        next.put("offers", active);
        next.put("asOf", now);
        java.sql.Timestamp start = db.queryForObject(OFFER_DATES + """
                SELECT min(starts_at) FROM offer_dates
                WHERE starts_at > ? AND ends_at > starts_at
                """, java.sql.Timestamp.class, java.sql.Timestamp.from(now));
        Instant boundary = start == null ? null : start.toInstant();
        for (Offer offer : active) {
            if (boundary == null || offer.endsAt().isBefore(boundary)) boundary = offer.endsAt();
        }
        if (boundary != null) next.put("nextChangeAt", boundary);
        return next;
    }

    List<Offer> activeOffers(Instant now) {
        return db.query(OFFER_DATES + """
                SELECT d.data::text, COALESCE(targets.ids, ARRAY[]::text[]),
                       COALESCE(targets.name, ''), COALESCE(targets.slug, ''),
                       d.starts_at, d.ends_at
                FROM offer_dates d
                LEFT JOIN LATERAL (
                    SELECT array_agg(p.id::text ORDER BY p.id) AS ids,
                           min(p.data->>'name') AS name, min(p.data->>'slug') AS slug
                    FROM records p
                    WHERE p.kind='product' AND (
                        (d.data->>'scope'='PRODUCT' AND p.id::text=d.data->>'productId') OR
                        (d.data->>'scope'='PRODUCTS' AND jsonb_exists(d.data->'productIds', p.id::text))
                    ) AND p.data->>'active'='true' AND (p.data->>'stock')::integer > 0 AND EXISTS (
                        SELECT 1 FROM records c WHERE c.kind='category'
                          AND c.data->>'code'=p.data->>'category' AND c.data->>'active'='true'
                    )
                ) targets ON d.data->>'scope' <> 'CART'
                WHERE d.starts_at <= ? AND d.ends_at > ?
                  AND (d.data->>'scope'='CART' OR targets.ids IS NOT NULL)
                """, (rs, index) -> {
            var row = app.decode(rs.getString(1));
            String scope = app.str(row, "scope");
            boolean single = scope.equals("PRODUCT");
            return new Offer(app.str(row, "id"), app.number(row, "revision"), app.str(row, "name"), scope,
                    app.str(row, "productId"), List.of((String[]) rs.getArray(2).getArray()),
                    single ? rs.getString(3) : "", single ? rs.getString(4) : "",
                    app.str(row, "condition"), app.number(row, "minimum"), app.str(row, "method"),
                    app.number(row, "value"), rs.getTimestamp(5).toInstant(),
                    rs.getTimestamp(6).toInstant(), Boolean.TRUE.equals(row.get("featured")),
                    app.number(row, "priority"), app.str(row, "message"));
        }, java.sql.Timestamp.from(now), java.sql.Timestamp.from(now)).stream().sorted(DISPLAY_ORDER).toList();
    }

    Map<String, Object> mutate(Map<String, Object> actor, Map<String, Object> input) {
        app.permission(actor, "discount.manage");
        String id = optionalText(input, "id", 36);
        boolean edit = !id.isEmpty();
        var row = edit ? app.record(id, "discount", actor) : new LinkedHashMap<String, Object>();
        if (edit) catalog.revision(row, input);
        if (app.str(input, "action").equals("discount-toggle")) {
            app.require(edit, "Chọn ưu đãi cần cập nhật.");
            boolean enabled = flag(input, "enabled");
            if (enabled) {
                Instant starts = date(row, "startsAt"), ends = date(row, "endsAt");
                app.require(ends.isAfter(starts) && ends.isAfter(Instant.now()),
                        "Hãy cập nhật thời gian cho ưu đãi đã kết thúc.");
                String scope = app.str(row, "scope");
                checkProducts(scope, app.str(row, "productId"), selectedIds(scope, row), false, true);
            }
            row.put("enabled", enabled);
        } else {
            String name = app.text(input, "name", 90).strip();
            app.require(!name.isBlank(), "Nhập tên ưu đãi.");
            String scope = choice(input, "scope", "PRODUCT", "PRODUCTS", "CART");
            String condition = choice(input, "condition", "QUANTITY", "SUBTOTAL");
            String method = choice(input, "method", "PERCENT", "FIXED");
            String productId = scope.equals("PRODUCT") ? app.text(input, "productId", 36) : "";
            var productIds = selectedIds(scope, input);
            boolean enabled = flag(input, "enabled");
            if (scope.equals("PRODUCT") && !enabled) app.uuid(productId);
            if (enabled || scope.equals("PRODUCTS")) checkProducts(scope, productId, productIds, true, enabled);
            Instant starts = date(input, "startsAt"), ends = date(input, "endsAt");
            app.require(ends.isAfter(starts), "Thời gian kết thúc phải sau thời gian bắt đầu.");
            app.require(!enabled || ends.isAfter(Instant.now()), "Thời gian kết thúc phải ở tương lai khi bật ưu đãi.");
            row.put("name", name);
            row.put("scope", scope);
            row.put("productId", productId);
            if (scope.equals("PRODUCTS")) row.put("productIds", productIds);
            else row.remove("productIds");
            row.put("condition", condition);
            row.put("minimum", integer(input, "minimum", 1,
                    condition.equals("QUANTITY") ? (scope.equals("PRODUCT") ? 100 : 10_000) : 100_000_000,
                    "Điều kiện tối thiểu"));
            row.put("method", method);
            row.put("value", integer(input, "value", 1, method.equals("PERCENT") ? 100 : 100_000_000, "Mức giảm"));
            row.put("startsAt", starts.toString());
            row.put("endsAt", ends.toString());
            row.put("enabled", enabled);
            row.put("featured", flag(input, "featured"));
            row.put("priority", integer(input, "priority", 0, 999, "Độ ưu tiên"));
            row.put("message", optionalText(input, "message", 120));
        }
        if (edit) row.put("revision", app.number(row, "revision") + 1);
        app.save("discount", null, row);
        return row;
    }

    private List<String> selectedIds(String scope, Map<String, Object> input) {
        if (!scope.equals("PRODUCTS")) return List.of();
        if (!(input.get("productIds") instanceof List<?> ids) || ids.isEmpty() || ids.size() > 100)
            throw new PlatformApi.Problem(422, "Chọn từ 1 đến 100 sản phẩm cho ưu đãi.");
        var selected = new LinkedHashSet<String>();
        for (Object id : ids) {
            if (!(id instanceof String value) || !value.matches("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"))
                throw new PlatformApi.Problem(422, "Mã sản phẩm không hợp lệ.");
            app.require(selected.add(value.toLowerCase(Locale.ROOT)), "Danh sách có sản phẩm trùng.");
        }
        return List.copyOf(selected);
    }

    private void checkProducts(String scope, String id, List<String> ids, boolean saving, boolean enabled) {
        if (scope.equals("PRODUCT")) {
            app.require(catalog.visible(catalog.get(id, "product")), "Chọn sản phẩm đang bán.");
        } else if (scope.equals("PRODUCTS")) {
            boolean visible = false;
            for (String target : ids) {
                try {
                    visible |= catalog.visible(catalog.get(target, "product"));
                } catch (PlatformApi.Problem error) {
                    if (error.status != 404) throw error;
                    if (saving) throw new PlatformApi.Problem(422, "Bỏ chọn các sản phẩm đã bị xóa trước khi lưu.");
                }
            }
            app.require(!enabled || visible, "Nhóm ưu đãi cần ít nhất một sản phẩm đang bán.");
        }
    }

    private String optionalText(Map<String, Object> input, String field, int max) {
        String value = app.str(input, field).strip();
        app.require(value.length() <= max, "Thông tin không hợp lệ: " + field);
        return value;
    }

    private String choice(Map<String, Object> input, String field, String... choices) {
        String value = app.text(input, field, 20);
        app.require(List.of(choices).contains(value), "Loại điều kiện hoặc mức giảm không hợp lệ.");
        return value;
    }

    private boolean flag(Map<String, Object> input, String field) {
        app.require(input.get(field) instanceof Boolean, "Trạng thái ưu đãi không hợp lệ.");
        return Boolean.TRUE.equals(input.get(field));
    }

    private int integer(Map<String, Object> input, String field, int min, int max, String label) {
        try {
            int value = new BigDecimal(String.valueOf(input.get(field))).intValueExact();
            app.require(value >= min && value <= max, label + " phải từ " + min + " đến " + max + ".");
            return value;
        } catch (NumberFormatException | ArithmeticException error) {
            throw new PlatformApi.Problem(422, label + " phải là số nguyên.");
        }
    }

    private Instant date(Map<String, Object> input, String field) {
        try {
            var parsed = Instant.parse(app.text(input, field, 40));
            int year = parsed.atOffset(java.time.ZoneOffset.UTC).getYear();
            app.require(year >= 2000 && year <= 9999, "Năm áp dụng ưu đãi phải từ 2000 đến 9999.");
            return parsed;
        } catch (java.time.DateTimeException error) {
            throw new PlatformApi.Problem(422, "Thời gian ưu đãi không hợp lệ.");
        }
    }

    static Quote calculate(List<Line> lines, List<Offer> offers) {
        long subtotal = lines.stream().mapToLong(Line::subtotal).sum();
        long best = 0;
        Offer winner = null;
        OfferHint hint = null;
        List<Line> winningLines = List.of();
        Map<String, Long> allocation = Map.of();
        for (Offer offer : offers) {
            var eligible = lines.stream().filter(Line::discountEligible).filter(offer::includes).toList();
            if (eligible.isEmpty()) continue;
            long amount = eligible.stream().mapToLong(Line::subtotal).sum();
            int quantity = eligible.stream().mapToInt(Line::quantity).sum();
            boolean percentage = offer.method().equals("PERCENT");
            var percentageDiscounts = percentage ? percentageDiscounts(eligible, offer.value()) : Map.<String, Long>of();
            long saving = percentage
                    ? percentageDiscounts.values().stream().mapToLong(Long::longValue).sum()
                    : Math.min(discountCapacity(eligible), offer.value());
            boolean quantityRule = offer.condition().equals("QUANTITY");
            if ((quantityRule ? quantity : amount) < offer.minimum()) {
                if (hint == null && saving > 0) hint = new OfferHint(offer,
                        quantityRule ? offer.minimum() - quantity : 0,
                        quantityRule ? 0 : offer.minimum() - amount);
            } else if (saving > best) {
                best = saving;
                winner = offer;
                winningLines = eligible;
                allocation = percentageDiscounts;
            }
        }
        if (winner != null && winner.method().equals("FIXED")) allocation = allocateFixed(winningLines, best);
        return new Quote(subtotal, best, winner, winner == null ? hint : null, allocation);
    }

    private static long discountCapacity(List<Line> lines) {
        return lines.stream().mapToLong(Line::discountCapacity).sum();
    }

    private static Map<String, Long> percentageDiscounts(List<Line> lines, int percent) {
        var allocation = new LinkedHashMap<String, Long>();
        long cumulativeSubtotal = 0, previousDiscount = 0;
        for (Line line : lines) {
            cumulativeSubtotal += line.subtotal();
            // Carry rounding across lines without moving a floor-limited reduction to another line.
            long discount = cumulativeSubtotal * percent / 100;
            allocation.put(line.productId(), Math.min(discount - previousDiscount, line.discountCapacity()));
            previousDiscount = discount;
        }
        return allocation;
    }

    private static Map<String, Long> allocateFixed(List<Line> lines, long discount) {
        var allocation = new LinkedHashMap<String, Long>();
        long capacity = discountCapacity(lines);
        long cumulativeCapacity = 0, allocated = 0;
        for (Line line : lines) {
            cumulativeCapacity += line.discountCapacity();
            // Integer arithmetic conserves the total, including when the discount has a remainder.
            long next = BigDecimal.valueOf(discount).multiply(BigDecimal.valueOf(cumulativeCapacity))
                    .divideToIntegralValue(BigDecimal.valueOf(capacity)).longValueExact();
            allocation.put(line.productId(), next - allocated);
            allocated = next;
        }
        return allocation;
    }
}
