package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class RecommendApi {
    private final PlatformApi app;
    private final JdbcTemplate db;
    private final AiPrivacy privacy;

    public RecommendApi(PlatformApi app, JdbcTemplate db, AiPrivacy privacy) {
        this.app = app;
        this.db = db;
        this.privacy = privacy;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> items(Map<String, Object> order) {
        if (!(order.get("items") instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item).toList();
    }

    List<Map<String, Object>> sellable() {
        return db.query("SELECT r.data::text FROM records r WHERE kind='product' AND data->>'active'='true' AND (data->>'stock')::int>0 AND EXISTS(SELECT 1 FROM records c WHERE c.kind='category' AND c.data->>'code'=r.data->>'category' AND c.data->>'active'='true') ORDER BY created_at, id",
            (rs, i) -> app.decode(rs.getString(1)));
    }

    @GetMapping("/products/recommended")
    public Object recommended(HttpServletRequest request,
                              @RequestParam(defaultValue="home") String surface,
                              @RequestParam(required=false) String productId,
                              @RequestParam(defaultValue="4") int limit,
                              @RequestParam(required=false) Integer budget) {
        var actor = privacy.optionalCustomer(request);
        if (surface.equals("cart")) actor = privacy.customer(request);
        return rank(actor, surface, productId, limit, budget);
    }

    Map<String, Object> rank(Map<String, Object> actor, String surface, String productId, int limit, Integer budget) {
        app.require(Set.of("home", "product", "cart").contains(surface), "Vị trí gợi ý không hợp lệ.");
        app.require(limit >= 1 && limit <= 8, "Số lượng gợi ý từ 1 đến 8.");
        app.require(budget == null || budget >= 0 && budget <= 100_000_000, "Ngân sách không hợp lệ.");
        if (productId != null) app.uuid(productId);
        var context = new HashSet<String>();
        if (surface.equals("product") && productId != null) context.add(productId);
        UUID owner = actor == null ? null : (UUID) actor.get("id");
        if (surface.equals("cart")) {
            if (owner == null) throw new PlatformApi.Problem(401, "Vui lòng đăng nhập để xem gợi ý cho giỏ hàng.");
            app.permission(actor, "cart.manage");
            context.addAll(db.query("SELECT data->>'productId' FROM records WHERE kind='cart' AND owner_id=?", (rs, i) -> rs.getString(1), owner));
        }
        var orders = db.queryForList("SELECT owner_id, data::text FROM records WHERE kind='order' AND data->>'status'='DELIVERED'");
        var sold = new HashMap<String, Integer>();
        var pairs = new HashMap<String, Integer>();
        var purchased = new HashSet<String>();
        for (var row : orders) {
            var order = app.decode((String) row.get("data"));
            var ids = new HashSet<String>();
            for (var item : items(order)) {
                String id = app.str(item, "productId");
                if (id.isEmpty()) continue;
                sold.merge(id, app.number(item, "quantity"), Integer::sum);
                ids.add(id);
            }
            if (!Collections.disjoint(ids, context)) {
                for (String id : ids) if (!context.contains(id)) pairs.merge(id, 1, Integer::sum);
            }
            if (owner != null && owner.equals(row.get("owner_id"))) purchased.addAll(ids);
        }
        var preferredCategories = new HashSet<String>();
        boolean personalized = owner != null && privacy.allowed(privacy.preferences(owner), "personalization");
        if (personalized && !purchased.isEmpty()) {
            preferredCategories.addAll(db.query("SELECT data->>'category' FROM records WHERE kind='product' AND id::text IN (SELECT jsonb_array_elements(data->'items')->>'productId' FROM records WHERE kind='order' AND owner_id=? AND data->>'status'='DELIVERED')",
                (rs, i) -> rs.getString(1), owner));
        }
        var available = sellable().stream()
            .filter(product -> !context.contains(app.str(product, "id")))
            .filter(product -> budget == null || app.number(product, "price") <= budget)
            .toList();
        var ranked = new ArrayList<>(available.stream().filter(product -> pairs.containsKey(app.str(product, "id"))).toList());
        String strategy = "BOUGHT_TOGETHER";
        Comparator<Map<String, Object>> popularity = Comparator.<Map<String, Object>>comparingInt(product -> sold.getOrDefault(app.str(product, "id"), 0)).reversed()
            .thenComparing(product -> app.str(product, "id"));
        if (!ranked.isEmpty()) ranked.sort(Comparator.<Map<String, Object>>comparingInt(product -> pairs.get(app.str(product, "id"))).reversed().thenComparing(popularity));
        else {
            ranked.addAll(available.stream().filter(product -> preferredCategories.contains(app.str(product, "category"))).toList());
            strategy = "PERSONALIZED";
            if (ranked.isEmpty()) {
                ranked.addAll(available);
                strategy = "POPULAR";
            }
            ranked.sort(popularity);
        }
        var result = ranked.stream().limit(limit).map(this::card).toList();
        return Map.of("strategy", strategy, "surface", surface, "items", result, "generatedAt", Instant.now().toString());
    }

    Map<String, Object> card(Map<String, Object> product) {
        var result = new LinkedHashMap<String, Object>();
        for (String field : List.of("id", "slug", "name", "price", "image", "stock", "category")) result.put(field, product.get(field));
        return result;
    }
}
