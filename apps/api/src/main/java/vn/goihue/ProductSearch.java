package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;

/** Public catalog lookup, independent of purchase-history ranking. */
@Service
public class ProductSearch {
    private static final Set<String> FILLER = Set.of("toi", "minh", "muon", "chon", "tim", "kiem", "mot", "vai", "loai", "cac", "nhung", "san", "pham", "co", "nao", "gi", "mua", "cua", "hang", "giup", "nhe", "voi", "xem", "thu", "cho", "biet", "duoi", "tam", "ngan", "sach", "dong", "vnd", "k", "them", "bo", "vao", "gio", "hop", "goi", "cai", "phan", "nhom");
    private final PlatformApi app;
    private final JdbcTemplate db;
    private final RecommendApi recommendations;
    private final PricingService pricing;

    public ProductSearch(PlatformApi app, JdbcTemplate db, RecommendApi recommendations, PricingService pricing) {
        this.app = app; this.db = db; this.recommendations = recommendations; this.pricing = pricing;
    }

    private record Entry(Map<String, Object> product, String category, String categoryName) {}

    static Set<String> words(String text) {
        return new LinkedHashSet<>(Arrays.asList(AgentTools.normalized(text).split("[^a-z0-9]+")));
    }

    static Set<String> terms(String query) {
        String text = AgentTools.normalized(query).replaceAll("\\b(?:cho|tang|bieu)\\s+(?:me|bo|ba me|ong ba|ban gai|ban trai|dong nghiep|sep|khach hang|doi tac|gia dinh|ban be)\\b", " ")
            .replaceAll("\\bmon qua\\b|\\blien quan (?:den|toi)\\b", " ")
            .replaceAll("^\\s*(?:the\\s+|vay\\s+)?con\\s+(.+?)\\s+thi\\s+sao\\s*[?!.]*\\s*$", "$1");
        var words = words(text);
        words.removeIf(word -> word.isEmpty() || FILLER.contains(word) || word.matches("[0-9]+(?:k|tr|vnd|d)?"));
        if (words.containsAll(Set.of("me", "xung"))) words.remove("banh");
        return words;
    }

    private List<Entry> catalog() {
        var entries = db.query("""
            SELECT p.data::text, c.data->>'code', c.data->>'name'
            FROM records p JOIN records c ON c.kind='category'
              AND c.data->>'code'=p.data->>'category' AND c.data->>'active'='true'
            WHERE p.kind='product' AND p.data->>'active'='true'
            ORDER BY p.data->>'name', p.id
            """, (rs, i) -> new Entry(app.decode(rs.getString(1)), rs.getString(2), rs.getString(3)));
        var book = pricing.book(Instant.now());
        entries.forEach(entry -> pricing.publish(entry.product(), pricing.resolve(entry.product(), book)));
        return entries;
    }

    List<Map<String, Object>> visibleProducts() {
        return catalog().stream().map(Entry::product).toList();
    }

    AgentTools.Result search(Map<String, Object> input) {
        String query = app.str(input, "query"), category = app.str(input, "category");
        app.require(query.length() <= 120 && category.length() <= 120, "Từ khóa hoặc danh mục tìm kiếm quá dài.");
        int limit = input.get("limit") == null ? 4 : app.number(input, "limit");
        app.require(limit >= 1 && limit <= 8, "Số lượng kết quả từ 1 tới 8.");
        Integer budget = input.get("budget") == null ? null : app.number(input, "budget");
        app.require(budget == null || budget <= 100_000_000, "Ngân sách không hợp lệ.");
        final Integer maximum = budget != null && budget > 0 ? budget : null;
        app.require(input.get("inStockOnly") == null || input.get("inStockOnly") instanceof Boolean, "Bộ lọc tồn kho không hợp lệ.");
        boolean inStockOnly = Boolean.TRUE.equals(input.get("inStockOnly"));
        var entries = catalog();
        var activeCategories = db.query("SELECT data->>'code', data->>'name' FROM records WHERE kind='category' AND data->>'active'='true' ORDER BY data->>'code'", (rs, i) -> Map.of("code", rs.getString(1), "name", rs.getString(2)));
        var terms = terms(query);
        var categoryTerms = terms(category);
        Set<String> categories = new HashSet<>();
        if (!category.isBlank() || !terms.isEmpty()) {
            var selected = category.isBlank() ? terms : categoryTerms;
            for (var option : activeCategories) if (!selected.isEmpty() && words(option.get("code") + " " + option.get("name")).containsAll(selected)) categories.add(option.get("code"));
        }
        boolean unknownCategory = !category.isBlank() && categories.isEmpty();
        var matched = entries.stream().filter(entry -> !unknownCategory)
            .filter(entry -> categories.isEmpty() || categories.contains(entry.category))
            .filter(entry -> words(app.str(entry.product, "name") + " " + app.str(entry.product, "slug") + " " + entry.category + " " + entry.categoryName + " " + app.str(entry.product, "description")).containsAll(terms))
            .filter(entry -> maximum == null || app.number(entry.product, "price") <= maximum)
            .sorted(Comparator.<Entry>comparingInt(entry -> relevance(entry, terms)).reversed().thenComparing(entry -> app.str(entry.product, "id")))
            .toList();
        var visible = matched.stream().filter(entry -> !inStockOnly || app.number(entry.product, "stock") > 0).toList();
        var cards = visible.stream().limit(limit).map(entry -> {
            var card = recommendations.card(entry.product);
            card.put("categoryName", entry.categoryName);
            card.put("available", app.number(entry.product, "stock") > 0);
            return card;
        }).toList();
        long unavailable = matched.stream().filter(entry -> app.number(entry.product, "stock") <= 0).count();
        var data = new LinkedHashMap<String, Object>();
        data.put("query", query); data.put("category", category); data.put("items", cards);
        data.put("categories", activeCategories);
        data.put("totalMatches", visible.size()); data.put("outOfStockMatches", unavailable); data.put("budgetApplied", maximum);
        data.put("code", unknownCategory ? "UNKNOWN_CATEGORY" : visible.isEmpty() ? unavailable > 0 ? "OUT_OF_STOCK" : "NO_MATCH" : "MATCHED");
        String text;
        if (cards.isEmpty()) text = unavailable > 0 ? "Có sản phẩm khớp tìm kiếm nhưng hiện đã hết hàng." : "Chưa tìm thấy sản phẩm đang hiển thị khớp tìm kiếm" + (maximum == null ? "." : " trong ngân sách " + AgentTools.money(maximum) + ".");
        else {
            var lines = new ArrayList<String>();
            lines.add("Mình tìm thấy " + visible.size() + " sản phẩm khớp trong danh mục:");
            for (var card : cards) lines.add("**" + app.str(card, "name") + "** · " + AgentTools.money(app.number(card, "price")) + " · "
                + (Boolean.TRUE.equals(card.get("available")) ? "Còn " + app.number(card, "stock") + " sản phẩm." : "Hiện hết hàng.") + "\n" + app.str(card, "description"));
            text = String.join("\n\n", lines);
        }
        return new AgentTools.Result(data, text, "Danh mục sản phẩm và nhóm hàng đang hiển thị", cards);
    }

    private int relevance(Entry entry, Set<String> terms) {
        var title = words(app.str(entry.product, "name") + " " + app.str(entry.product, "slug"));
        return (int) terms.stream().filter(title::contains).count();
    }
}
