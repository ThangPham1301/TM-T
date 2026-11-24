package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

/** Preview is read-only; confirmation replaces the whole cart in one commerce transaction. */
@RestController
@RequestMapping("/api/v1/orders/{id}/reorder")
public class ReorderApi {
    private static final Set<String> ELIGIBLE = Set.of("DELIVERED", "CANCELLED", "DELIVERY_FAILED", "RETURNED");
    private final PlatformApi app;
    private final CommerceApi commerce;
    private final CatalogService catalog;
    private final PricingService pricing;
    private final DiscountService discounts;
    private final JdbcTemplate db;

    public ReorderApi(PlatformApi app, CommerceApi commerce, CatalogService catalog,
                      PricingService pricing, DiscountService discounts, JdbcTemplate db) {
        this.app = app; this.commerce = commerce; this.catalog = catalog;
        this.pricing = pricing; this.discounts = discounts; this.db = db;
    }

    private Map<String,Object> source(String id, Map<String,Object> actor) {
        app.permission(actor, "cart.manage");
        var order = app.record(id, "order", actor);
        if (!ELIGIBLE.contains(app.str(order, "status")))
            throw new PlatformApi.Problem(409, "Đơn này vẫn đang xử lý. Hãy thanh toán hoặc theo dõi đơn hiện tại.");
        return order;
    }

    private void fields(Map<?,?> input, Set<String> allowed) {
        app.require(allowed.containsAll(input.keySet()), "Tham số mua lại không hợp lệ.");
    }

    private LinkedHashMap<String,Map<String,Object>> original(Map<String,Object> order) {
        var result = new LinkedHashMap<String,Map<String,Object>>();
        for (var line : RecommendApi.items(order)) {
            String id = app.str(line, "productId");
            app.uuid(id);
            app.require(!result.containsKey(id), "Đơn cũ có dòng sản phẩm trùng. Vui lòng chọn mua từ danh mục.");
            result.put(id, line);
        }
        app.require(!result.isEmpty() && result.size() <= 50, "Mua lại hỗ trợ từ 1 đến 50 sản phẩm trong đơn cũ.");
        return result;
    }

    private Map<String,Integer> selection(Object value, LinkedHashMap<String,Map<String,Object>> original) {
        if (value == null) {
            var selected = new LinkedHashMap<String,Integer>();
            original.forEach((id, line) -> selected.put(id, app.number(line, "quantity")));
            return selected;
        }
        app.require(value instanceof List<?> && ((List<?>) value).size() <= 50, "Danh sách mua lại không hợp lệ.");
        var selected = new LinkedHashMap<String,Integer>();
        for (var item : (List<?>) value) {
            app.require(item instanceof Map<?,?>, "Sản phẩm mua lại không hợp lệ.");
            var row = (Map<?,?>) item;
            fields(row, Set.of("productId", "quantity"));
            app.require(row.get("productId") instanceof String, "Chọn sản phẩm trong đơn cũ.");
            String id = row.get("productId").toString();
            app.require(original.containsKey(id) && !selected.containsKey(id), "Sản phẩm không thuộc đơn cũ hoặc bị chọn trùng.");
            app.require(row.get("quantity") instanceof Number, "Số lượng mua lại không hợp lệ.");
            var quantity = (Number) row.get("quantity");
            app.require(Double.isFinite(quantity.doubleValue()) && quantity.doubleValue() == quantity.longValue()
                && quantity.longValue() >= 1 && quantity.longValue() <= 100, "Số lượng mỗi món phải từ 1 đến 100.");
            selected.put(id, quantity.intValue());
        }
        return selected;
    }

    @PostMapping("/preview")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Object preview(@PathVariable String id, @RequestBody Map<String,Object> body, HttpServletRequest request) {
        app.origin(request);
        var actor = app.actor(request);
        fields(body, Set.of("items"));
        if (body.containsKey("items")) app.require(body.get("items") != null, "Danh sách mua lại không hợp lệ.");
        return review(source(id, actor), (UUID) actor.get("id"), body.get("items"));
    }

    private Map<String,Object> review(Map<String,Object> order, UUID owner, Object requested) {
        var original = original(order);
        var selected = selection(requested, original);
        var now = Instant.now();
        var book = pricing.book(now);
        var visible = new HashMap<String,Map<String,Object>>();
        for (var product : catalog.publicProducts()) visible.put(app.str(product, "id"), product);
        var lines = new ArrayList<Map<String,Object>>();
        var pricedLines = new ArrayList<Map<String,Object>>();
        var issues = new ArrayList<String>();
        var versions = new ArrayList<Object>();
        for (var entry : original.entrySet()) {
            String id = entry.getKey();
            var historical = entry.getValue();
            var product = visible.get(id);
            int quantity = selected.getOrDefault(id, 0);
            int stock = product == null ? 0 : Math.max(0, app.number(product, "stock"));
            var price = product == null ? null : pricing.resolve(product, book);
            String name = product == null ? app.str(historical, "name") : app.str(product, "name");
            String code = product == null ? "UNAVAILABLE" : stock == 0 ? "OUT_OF_STOCK"
                : quantity > stock || quantity > 100 ? "INSUFFICIENT_STOCK" : "AVAILABLE";
            var line = new LinkedHashMap<String,Object>();
            line.put("productId", id); line.put("name", name);
            line.put("image", product == null ? historical.getOrDefault("image", "/images/product-placeholder.svg") : product.getOrDefault("image", "/images/product-placeholder.svg"));
            line.put("originalQuantity", app.number(historical, "quantity")); line.put("quantity", quantity);
            line.put("previousPrice", app.number(historical, "price"));
            line.put("currentPrice", price == null ? null : price.amount());
            line.put("priceSource", price == null ? null : price.source());
            String previousSource = historical.get("pricing") instanceof Map<?,?> previous ? String.valueOf(previous.getOrDefault("source", null)) : "BASE";
            line.put("priceChanged", price != null && (price.amount() != app.number(historical, "price") || !price.source().equals(previousSource)));
            line.put("available", product != null && stock > 0); line.put("stock", stock); line.put("code", code);
            lines.add(line);
            versions.add(Arrays.asList(id, quantity, code, price, stock));
            if (quantity > 0) {
                if (!code.equals("AVAILABLE")) issues.add(name + (code.equals("UNAVAILABLE") ? ": hiện không còn bán." : stock == 0 ? ": hiện hết hàng." : ": chỉ còn " + Math.min(100, stock) + " sản phẩm; hãy điều chỉnh số lượng."));
                if (quantity > 100) issues.add(name + ": tối đa 100 sản phẩm mỗi dòng.");
                if (price != null) pricedLines.add(Map.of("productId", id, "quantity", quantity, "currentPricing", price));
            }
        }
        if (selected.isEmpty()) issues.add("Chọn ít nhất một sản phẩm để tiếp tục.");
        var shipping = catalog.shipping();
        if (!Boolean.TRUE.equals(shipping.get("enabled"))) issues.add("Cửa hàng đang tạm ngừng nhận đơn.");
        Map<String,Object> quote = null;
        if (!selected.isEmpty() && issues.isEmpty()) {
            // Match cartOf's UUID ordering, including percentage rounding at individual product floors.
            pricedLines.sort(Comparator.comparing(line -> UUID.nameUUIDFromBytes((owner + ":" + app.str(line, "productId"))
                .getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString()));
            var calculated = commerce.quote(pricedLines, discounts.activeOffers(now), "currentPricing");
            quote = calculated.breakdown();
            int fee = catalog.shippingFee(calculated.netSubtotal());
            quote.put("shippingFee", fee); quote.put("total", calculated.netSubtotal() + fee);
            if (calculated.subtotal() > 100_000_000) issues.add("Đơn vượt hạn mức tiền hàng 100 triệu đồng.");
        }
        var recipient = new LinkedHashMap<String,Object>();
        for (String field : List.of("recipient", "phone", "address")) recipient.put(field, app.str(order, field));
        var result = new LinkedHashMap<String,Object>();
        result.put("sourceOrderId", order.get("id")); result.put("sourceOrderNumber", order.get("number"));
        result.put("recipient", recipient); result.put("lines", lines); result.put("ready", issues.isEmpty());
        result.put("issues", issues); result.put("quote", quote);
        result.put("previewToken", app.hash(app.encode(Arrays.asList(order.get("id"), order.get("revision"), order.get("status"), recipient, versions, shipping, quote))));
        var cart = new CommerceApi.CartOwner(owner, false);
        result.put("cartToken", commerce.cartToken(cart)); result.put("cartCount", commerce.cartOf(cart).size());
        return result;
    }

    @PostMapping
    @Transactional
    public Object confirm(@PathVariable String id, @RequestBody Map<String,Object> body,
                          @RequestHeader("Idempotency-Key") String key, HttpServletRequest request) {
        app.origin(request);
        app.lock();
        var actor = app.actor(request);
        app.permission(actor, "cart.manage");
        fields(body, Set.of("action", "items", "previewToken", "cartToken"));
        app.require(!body.containsKey("action") || app.str(body, "action").equals("reorder"), "Thao tác mua lại không hợp lệ.");
        app.require(key.matches("[a-zA-Z0-9-]{16,80}"), "Khóa gửi lặp không hợp lệ.");
        UUID owner = (UUID) actor.get("id");
        // The route participates in the fingerprint so a key cannot be replayed for a different source.
        String fingerprint = app.hash(app.encode(List.of("reorder", id, new TreeMap<>(body))));
        var previous = db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?", owner, key);
        if (!previous.isEmpty()) {
            if (!fingerprint.equals(previous.getFirst().get("fingerprint")))
                throw new PlatformApi.Problem(409, "Khóa đã dùng cho thao tác khác.");
            return app.decode((String) previous.getFirst().get("result"));
        }
        var order = source(id, actor);
        app.require(body.get("items") instanceof List<?>, "Chọn các sản phẩm cần mua lại.");
        app.require(app.str(body, "previewToken").matches("[a-f0-9]{64}"), "Vui lòng kiểm tra lại phương án mua lại.");
        var reviewed = review(order, owner, body.get("items"));
        if (!app.str(reviewed, "previewToken").equals(app.str(body, "previewToken")))
            throw new PlatformApi.Problem(409, "Giá, số lượng hoặc thông tin đơn đã thay đổi. Vui lòng kiểm tra lại trước khi mua.");
        app.require(Boolean.TRUE.equals(reviewed.get("ready")), "Có sản phẩm chưa đủ điều kiện mua lại. Hãy kiểm tra từng món.");
        var cart = new CommerceApi.CartOwner(owner, false);
        commerce.checkCart(cart, body);
        var before = commerce.cartView(cart, pricing.book(Instant.now()));
        var selected = selection(body.get("items"), original(order));
        commerce.mutateCart(cart, "cart-clear", body);
        @SuppressWarnings("unchecked")
        var reviewedLines = (List<Map<String,Object>>) reviewed.get("lines");
        for (var entry : selected.entrySet()) {
            var line = reviewedLines.stream().filter(item -> entry.getKey().equals(app.str(item, "productId"))).findFirst().orElseThrow();
            commerce.mutateCart(cart, "cart-set", Map.of("productId", entry.getKey(), "quantity", entry.getValue(),
                "cartToken", commerce.cartToken(cart), "expectedUnitPrice", line.get("currentPrice"), "expectedPriceSource", line.get("priceSource")));
        }
        @SuppressWarnings("unchecked")
        var expectedQuote = (Map<String,Object>) reviewed.get("quote");
        var finalQuote = commerce.cartSummary(cart);
        if (expectedQuote.entrySet().stream().anyMatch(entry -> !Objects.equals(entry.getValue(), finalQuote.get(entry.getKey()))))
            throw new PlatformApi.Problem(409, "Báo giá vừa thay đổi. Giỏ cũ được giữ nguyên; hãy kiểm tra lại.");
        var result = Map.<String,Object>of("ok", true, "sourceOrderId", app.str(order, "id"), "sourceOrderNumber", app.str(order, "number"),
                "measurementMutation", CommerceMeasurement.replacement(before, commerce.cartView(cart, pricing.book(Instant.now()))));
        db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)", owner, key, fingerprint, app.encode(result));
        app.audit(actor, id, "order-reorder");
        return result;
    }

    @ExceptionHandler(Exception.class)
    public org.springframework.http.ResponseEntity<?> error(Exception error) { return app.error(error); }
}
