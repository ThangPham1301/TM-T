package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.document.Document;
import software.amazon.awssdk.services.bedrockruntime.model.*;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AgentTools {
    private static final Set<String> GIFT_PREFERENCES = Set.of("qua", "tang", "bieu", "cho", "me", "bo", "ba", "ong", "gia", "dinh", "ban", "be", "nguoi", "than", "sinh", "nhat", "tet", "phu", "hop", "duoi", "tam", "ngan", "sach", "dong", "vnd", "k", "goi", "hang", "dang", "chay", "so", "sanh", "san", "pham", "mon", "cac", "nhung", "loai", "duoc", "nhieu", "pho", "bien", "combo", "popular", "bestseller", "best", "selling", "gift", "products");
    private final PlatformApi app;
    private final JdbcTemplate db;
    private final CatalogService catalog;
    private final RecommendApi recommendations;
    private final AiPrivacy privacy;
    private final ProductSearch search;

    public AgentTools(PlatformApi app, JdbcTemplate db, CatalogService catalog, RecommendApi recommendations, AiPrivacy privacy, ProductSearch search) {
        this.app = app;
        this.db = db;
        this.catalog = catalog;
        this.recommendations = recommendations;
        this.privacy = privacy;
        this.search = search;
    }

    record Result(Map<String, Object> data, String text, String source, List<Map<String, Object>> cards) {}
    record Call(String name, Map<String, Object> input) {}

    static String normalized(String text) {
        return Normalizer.normalize(text.toLowerCase(Locale.ROOT).replace('đ', 'd'), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    static String money(int amount) { return String.format(Locale.ROOT, "%,d", amount).replace(',', '.') + "đ"; }

    static Map<String, Object> slots(String message) {
        var slots = new LinkedHashMap<String, Object>();
        String text = normalized(message);
        var amounts = Pattern.compile("(?<![a-z0-9-])(\\d{1,3}(?:[., ]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(trieu|nghin|ngan|tr|k|dong|vnd|₫|d)(?![a-z])").matcher(text);
        while (amounts.find()) {
            try {
                String unit = amounts.group(2);
                String number = amounts.group(1).replace(" ", "");
                double value;
                if (unit.equals("trieu") || unit.equals("tr")) value = Double.parseDouble(number.replace(',', '.')) * 1_000_000;
                else value = Double.parseDouble(number.replace(".", "").replace(",", "")) * (Set.of("nghin", "ngan", "k").contains(unit) ? 1000 : 1);
                if (value >= 1000 && value <= 100_000_000) {
                    String prefix = text.substring(Math.max(0, amounts.start() - 30), amounts.start());
                    if (prefix.matches("(?s).*(ngan sach|duoi|toi da|khoang|tam)\\s*[:=]?\\s*")) {
                        slots.put("budget", (int) value);
                        break;
                    }
                    slots.putIfAbsent("budget", (int) value);
                }
            } catch (NumberFormatException ignored) { /* Invalid amounts are left unspecified. */ }
        }
        if (!slots.containsKey("budget")) {
            var amount = Pattern.compile("(?:ngan sach|duoi|toi da|tam)\\s+(\\d{5,8})(?!\\d)").matcher(text);
            if (amount.find()) slots.put("budget", Integer.parseInt(amount.group(1)));
        }
        var recipient = Pattern.compile("\\b(?:cho|tang|bieu)\\s+(me|bo|ba me|ong ba|ban gai|ban trai|dong nghiep|sep|khach hang|gia dinh|ban be)\\b").matcher(text);
        if (recipient.find()) slots.put("recipient", recipient.group(1));
        var occasion = Pattern.compile("\\b(sinh nhat|tet|trung thu|ky niem|cam on|tham nha)\\b").matcher(text);
        if (occasion.find()) slots.put("occasion", occasion.group(1));
        return slots;
    }

    List<Tool> definitions() {
        return List.of(
            definition("search_products", "Tìm sản phẩm theo từ khóa, loại trà/bánh/mè xửng hoặc nhóm hàng, không cần ngân sách. query có thể là tên hoặc từ khóa tiếng Việt có/không dấu; category tùy chọn là mã hoặc tên nhóm hàng. Tìm cả hàng hết kho và đọc available trước khi tư vấn mua. Chỉ bật inStockOnly nếu cần hàng còn kho. Không suy ra thành phần hay công dụng ngoài description. Dùng để khám phá và tìm sản phẩm trước khi so sánh hoặc đề xuất thêm giỏ; không dùng ngân sách thay cho từ khóa.",
                Map.of("query", Map.of("type", "string", "maxLength", 120), "category", Map.of("type", "string", "maxLength", 120), "inStockOnly", Map.of("type", "boolean"), "limit", Map.of("type", "integer", "minimum", 1, "maximum", 8), "budget", Map.of("type", "integer", "minimum", 1, "maximum", 100000000)), List.of()),
            definition("recommend_products", "Tìm sản phẩm còn bán được. budget là số tiền VND, chỉ truyền khi khách nêu rõ số tiền, không truyền 0; không có budget vẫn tìm được sản phẩm. Tra tên bằng query (tên ngắn, ví dụ Hương Huế), không đưa tên vào productId. productId chỉ là UUID ngữ cảnh mua cùng. rankingBasis=CATALOG nghĩa là chưa có dữ liệu bán chạy; deliveredQuantity=0 không chứng minh sản phẩm bán chạy.",
                Map.of("budget", Map.of("type", "integer", "minimum", 1, "maximum", 100000000), "query", Map.of("type", "string", "maxLength", 120), "surface", Map.of("type", "string", "enum", List.of("home", "product", "cart")), "productId", Map.of("type", "string", "format", "uuid")), List.of()),
            definition("compare_products", "So sánh đúng hai sản phẩm còn bán được theo tên ngắn hoặc UUID: giá, tồn kho, số lượng đã giao và chênh lệch giá. Dùng khi khách nêu hai sản phẩm hoặc hỏi so sánh hai món cụ thể. first/second là tên sản phẩm ngắn, ví dụ 'Mè Xửng Gừng' và 'Hộp Quà Hương Huế', hoặc UUID.",
                Map.of("first", Map.of("type", "string", "maxLength", 120), "second", Map.of("type", "string", "maxLength", 120)), List.of("first", "second")),
            definition("add_to_cart", "Đề xuất thêm một sản phẩm vào giỏ với số lượng. Công cụ KHÔNG tự thêm vào giỏ: hệ thống hiện hộp xác nhận và khách bấm đồng ý thì món mới vào giỏ. Chỉ gọi khi khách nói rõ muốn thêm/mua/bỏ vào giỏ một sản phẩm cụ thể. product là tên sản phẩm ngắn hoặc UUID; quantity mặc định 1.",
                Map.of("product", Map.of("type", "string", "maxLength", 120), "quantity", Map.of("type", "integer", "minimum", 1, "maximum", 100)), List.of("product")),
            definition("get_shipping", "Đọc phí giao hàng hiện tại, trạng thái nhận đơn và điều kiện miễn phí. Ngưỡng 0 nghĩa là chưa áp dụng miễn phí theo giá trị đơn. subtotal tùy chọn tính bằng VND.",
                Map.of("subtotal", Map.of("type", "integer", "minimum", 0, "maximum", 100000000)), List.of()),
            definition("lookup_order", "Tra đúng mã GH-XXXXXXXX thuộc khách đã đăng nhập. Quyền chủ sở hữu do backend xác định. Hỏi mã đơn trước khi tra cứu.",
                Map.of("number", Map.of("type", "string", "pattern", "^GH-[A-Fa-f0-9]{8}$")), List.of("number")),
            definition("get_policy", "Đọc chính sách bảo mật theo phiên bản hoặc thông báo đổi trả dự thảo cùng trang nguồn. Giữ nhãn DRAFT trong câu trả lời.",
                Map.of("topic", Map.of("type", "string", "enum", List.of("privacy", "returns"))), List.of("topic")),
            definition("get_memory", "Đọc ngân sách, người nhận và dịp tặng mà khách cho phép ghi nhớ. Trả rỗng khi chưa đồng ý hoặc chưa đăng nhập.", Map.of(), List.of())
        );
    }

    private Tool definition(String name, String description, Map<String, Object> properties, List<String> required) {
        var schema = Map.<String, Object>of("type", "object", "properties", properties, "required", required, "additionalProperties", false);
        return Tool.builder().toolSpec(ToolSpecification.builder().name(name).description(description)
            .inputSchema(ToolInputSchema.builder().json(document(schema)).build()).build()).build();
    }

    static Document document(Object value) {
        if (value == null) return Document.fromNull();
        if (value instanceof Boolean bool) return Document.fromBoolean(bool);
        if (value instanceof Number number) return Document.fromNumber(number.intValue());
        if (value instanceof Map<?, ?> map) {
            var result = new LinkedHashMap<String, Document>();
            map.forEach((key, item) -> result.put(key.toString(), document(item)));
            return Document.fromMap(result);
        }
        if (value instanceof List<?> list) return Document.fromList(list.stream().map(AgentTools::document).toList());
        return Document.fromString(value.toString());
    }

    Result execute(String name, Map<String, Object> input, Map<String, Object> actor) {
        Set<String> fields = switch (name) {
            case "search_products" -> Set.of("query", "category", "inStockOnly", "limit", "budget");
            case "recommend_products" -> Set.of("budget", "query", "surface", "productId");
            case "compare_products" -> Set.of("first", "second");
            case "add_to_cart" -> Set.of("product", "quantity");
            case "get_shipping" -> Set.of("subtotal");
            case "lookup_order" -> Set.of("number");
            case "get_policy" -> Set.of("topic");
            case "get_memory" -> Set.of();
            default -> throw new PlatformApi.Problem(422, "Công cụ không được hỗ trợ.");
        };
        app.require(fields.containsAll(input.keySet()), "Tham số công cụ không hợp lệ.");
        return switch (name) {
            case "search_products" -> search.search(input);
            case "recommend_products" -> gifts(actor, input);
            case "compare_products" -> compareProducts(input);
            case "add_to_cart" -> proposeCart(input);
            case "get_shipping" -> shipping(input);
            case "lookup_order" -> order(actor, app.str(input, "number"));
            case "get_policy" -> policy(app.str(input, "topic"));
            case "get_memory" -> {
                var memory = privacy.memory(actor == null ? null : (UUID) actor.get("id"));
                yield new Result(Map.of("preferences", memory), memory.isEmpty() ? "Chưa có sở thích được ghi nhớ." : "Sở thích đã lưu của bạn: " + app.encode(memory), "Sở thích bạn cho phép ghi nhớ", List.of());
            }
            default -> throw new IllegalStateException("Unreachable tool");
        };
    }

    @SuppressWarnings("unchecked")
    private Result gifts(Map<String, Object> actor, Map<String, Object> input) {
        Integer budget = input.get("budget") == null ? null : app.number(input, "budget");
        if (budget != null && budget <= 0) budget = null;
        app.require(budget == null || budget <= 100_000_000, "Ngân sách không hợp lệ.");
        String surface = app.str(input, "surface");
        if (surface.isEmpty()) surface = "home";
        String productId = app.str(input, "productId");
        String query = app.str(input, "query");
        // Recover a model-supplied product name without treating an invalid UUID as a missing record.
        if (!productId.isEmpty() && !productId.matches("(?i)[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")) {
            if (query.isEmpty()) query = productId;
            productId = "";
            surface = "home";
        }
        app.require(query.length() <= 120, "Tên tìm kiếm quá dài.");
        // Recipient/occasion phrases are gift preferences, not literal product names.
        String normalizedQuery = normalized(query);
        if (Arrays.stream(normalizedQuery.split("[^a-z0-9]+")).allMatch(word -> word.isEmpty() || GIFT_PREFERENCES.contains(word) || word.matches("[0-9]+(?:k|tr|vnd|d)?"))) query = "";
        var result = recommendations.rank(actor, surface, productId.isEmpty() ? null : productId, 4, budget, query);
        result.put("query", query);
        var cards = (List<Map<String, Object>>) result.get("items");
        String text = cards.isEmpty() ?
            (budget == null ? "Hiện chưa tìm thấy sản phẩm còn hàng" + (query.isEmpty() ? " để gợi ý." : " khớp tên bạn hỏi.") : "Hiện chưa có sản phẩm còn hàng phù hợp ngân sách " + money(budget) + ". Bạn có muốn đổi ngân sách?") :
            "Bạn tham khảo các món còn hàng" + (budget == null ? " dưới đây." : " trong ngân sách " + money(budget) + " dưới đây.");
        String source = result.get("rankingBasis").equals("CATALOG") ? "Danh mục hiện đang bán · chưa có dữ liệu bán chạy từ đơn đã giao" : "Danh mục và gợi ý theo đơn đã giao · " + result.get("strategy");
        return new Result(result, text, source, cards);
    }

    /** Resolve a customer/model-supplied product reference (UUID or name) against the sellable catalog. */
    private Map<String, Object> resolveProduct(String reference) {
        String ref = reference == null ? "" : reference.trim();
        app.require(!ref.isEmpty(), "Chưa rõ sản phẩm cần tra.");
        app.require(ref.length() <= 120, "Tên sản phẩm quá dài.");
        var sellable = recommendations.sellable();
        if (ref.matches("(?i)[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"))
            return sellable.stream().filter(p -> ref.equalsIgnoreCase(app.str(p, "id"))).findFirst().orElse(null);
        var words = Arrays.stream(normalized(ref).split("[^a-z0-9]+")).filter(w -> !w.isEmpty()).toList();
        app.require(!words.isEmpty(), "Chưa rõ sản phẩm cần tra.");
        var matches = sellable.stream().filter(p -> {
            String candidate = normalized(app.str(p, "name") + " " + app.str(p, "slug")).replace('-', ' ');
            return words.stream().allMatch(candidate::contains);
        }).toList();
        if (matches.size() <= 1) return matches.isEmpty() ? null : matches.getFirst();
        var exact = matches.stream().filter(p -> normalized(ref).equals(normalized(app.str(p, "name"))) || normalized(ref).equals(normalized(app.str(p, "slug")))).toList();
        if (exact.size() == 1) return exact.getFirst();
        // A broad reference is a choice for the customer, never an implicit cart selection.
        throw new AmbiguousProduct(matches);
    }

    private static class AmbiguousProduct extends RuntimeException {
        final List<Map<String, Object>> products;
        AmbiguousProduct(List<Map<String, Object>> products) { this.products = products; }
    }

    private Result ambiguous(AmbiguousProduct choice) {
        var cards = choice.products.stream().limit(8).map(recommendations::card).toList();
        return new Result(Map.of("code", "AMBIGUOUS", "items", cards), "Có nhiều sản phẩm khớp tên này. Bạn chọn rõ một món giúp mình: "
            + cards.stream().map(card -> app.str(card, "name")).collect(Collectors.joining(", ")) + ".", "Danh mục hiện đang bán · cần chọn sản phẩm", cards);
    }

    private int deliveredQuantity(String productId) {
        int total = 0;
        for (var row : db.queryForList("SELECT data::text FROM records WHERE kind='order' AND data->>'status'='DELIVERED'")) {
            var order = app.decode((String) row.get("data"));
            for (var item : RecommendApi.items(order))
                if (productId.equals(app.str(item, "productId"))) total += app.number(item, "quantity");
        }
        return total;
    }

    private Map<String, Object> comparisonCard(Map<String, Object> product) {
        var card = recommendations.card(product);
        card.put("deliveredQuantity", deliveredQuantity(app.str(product, "id")));
        return card;
    }

    private Result compareProducts(Map<String, Object> input) {
        try { return compareResolved(input); }
        catch (AmbiguousProduct choice) { return ambiguous(choice); }
    }

    private Result compareResolved(Map<String, Object> input) {
        var first = resolveProduct(app.str(input, "first"));
        var second = resolveProduct(app.str(input, "second"));
        if (first == null || second == null) {
            String missing = first == null ? app.str(input, "first") : app.str(input, "second");
            return new Result(Map.of("code", "NOT_FOUND"), "Chưa tìm thấy sản phẩm còn hàng khớp '" + missing + "' để so sánh.", "Danh mục hiện đang bán", List.of());
        }
        app.require(!app.str(first, "id").equals(app.str(second, "id")), "Hai sản phẩm cần so sánh đang trùng nhau.");
        var a = comparisonCard(first);
        var b = comparisonCard(second);
        int difference = Math.abs(app.number(a, "price") - app.number(b, "price"));
        var data = new LinkedHashMap<String, Object>();
        data.put("items", List.of(a, b));
        data.put("priceDifference", difference);
        String text = "**" + app.str(a, "name") + "**: " + money(app.number(a, "price")) + " · Còn " + app.number(a, "stock") + " sản phẩm.\n"
            + "**" + app.str(b, "name") + "**: " + money(app.number(b, "price")) + " · Còn " + app.number(b, "stock") + " sản phẩm.\n"
            + "Chênh lệch giá: " + money(difference) + ".";
        return new Result(data, text, "Danh mục hiện đang bán · so sánh hai sản phẩm", List.of());
    }

    private Result proposeCart(Map<String, Object> input) {
        try { return proposeResolved(input); }
        catch (AmbiguousProduct choice) { return ambiguous(choice); }
    }

    private Result proposeResolved(Map<String, Object> input) {
        var product = resolveProduct(app.str(input, "product"));
        if (product == null)
            return new Result(Map.of("code", "NOT_FOUND"), "Chưa tìm thấy sản phẩm còn hàng khớp '" + app.str(input, "product") + "' để thêm vào giỏ.", "Danh mục hiện đang bán", List.of());
        int stock = app.number(product, "stock");
        int quantity = input.get("quantity") == null ? 1 : app.number(input, "quantity");
        app.require(quantity >= 1 && quantity <= Math.min(100, stock), "Số lượng thêm vào giỏ phải từ 1 tới " + Math.min(100, stock) + " theo tồn kho hiện tại.");
        var proposal = new LinkedHashMap<String, Object>();
        proposal.put("productId", app.str(product, "id"));
        proposal.put("slug", app.str(product, "slug"));
        proposal.put("name", app.str(product, "name"));
        proposal.put("price", app.number(product, "price"));
        proposal.put("image", app.str(product, "image"));
        proposal.put("stock", stock);
        proposal.put("quantity", quantity);
        var data = new LinkedHashMap<String, Object>();
        data.put("proposal", proposal);
        String text = "Bạn xác nhận giúp mình nhé: thêm " + quantity + " × " + app.str(product, "name") + " (" + money(app.number(product, "price") * quantity) + ") vào giỏ. Món chỉ vào giỏ khi bạn bấm xác nhận.";
        return new Result(data, text, "Danh mục hiện đang bán · đề xuất thêm giỏ chờ xác nhận", List.of());
    }

    /** Products named in the (normalized) message, by full name or by all distinctive name words. */
    private List<Map<String, Object>> namedProducts(String text) {
        var tokens = new HashSet<>(Arrays.asList(text.split("[^a-z0-9]+")));
        var found = new ArrayList<Map<String, Object>>();
        for (var product : recommendations.sellable()) {
            String fullName = normalized(app.str(product, "name"));
            if (!fullName.isEmpty() && text.contains(fullName)) {
                found.add(product);
                continue;
            }
            var distinctive = Arrays.stream(fullName.split("[^a-z0-9]+"))
                .filter(w -> !w.isEmpty() && !GIFT_PREFERENCES.contains(w) && !w.equals("hue") && !w.matches("\\d+(g|kg|ml|l)?"))
                .collect(Collectors.toSet());
            if (!distinctive.isEmpty() && tokens.containsAll(distinctive)) found.add(product);
        }
        return found;
    }

    private boolean cartIntent(String text) {
        return text.contains("vao gio") && (text.contains("them") || text.contains("bo") || text.contains("cho"));
    }

    private int cartQuantity(String text) {
        var sized = Pattern.compile("(\\d{1,3})\\s*(hop|goi|cai|san pham|phan)\\b").matcher(text);
        if (sized.find()) {
            int q = Integer.parseInt(sized.group(1));
            if (q >= 1 && q <= 100) return q;
        }
        var times = Pattern.compile("\\bx\\s*(\\d{1,3})\\b").matcher(text);
        if (times.find()) {
            int q = Integer.parseInt(times.group(1));
            if (q >= 1 && q <= 100) return q;
        }
        return 1;
    }

    private int integer(Map<String, Object> input, String field) {
        int amount = app.number(input, field);
        app.require(amount >= 0 && amount <= 100_000_000, "Số tiền không hợp lệ.");
        return amount;
    }

    private Result shipping(Map<String, Object> input) {
        var data = new LinkedHashMap<>(catalog.shipping());
        int threshold = app.number(data, "freeShippingThreshold");
        int fee = app.number(data, "baseFee");
        String text = "Phí giao hàng là " + money(fee) + ". ";
        text += threshold > 0 ? "Miễn phí giao hàng từ " + money(threshold) + " tiền hàng." : "Hiện chưa áp dụng miễn phí giao hàng theo giá trị đơn.";
        if (!Boolean.TRUE.equals(data.get("enabled"))) text += " Cửa hàng đang tạm ngừng nhận đơn.";
        if (input.containsKey("subtotal")) {
            int subtotal = integer(input, "subtotal");
            int shippingFee = threshold > 0 && subtotal >= threshold ? 0 : fee;
            data.put("shippingFee", shippingFee);
            text += " Với tiền hàng " + money(subtotal) + ", phí giao là " + money(shippingFee) + ".";
        }
        return new Result(data, text, "Cài đặt giao hàng · revision " + data.get("revision"), List.of());
    }

    private Result order(Map<String, Object> actor, String number) {
        if (actor == null) return new Result(Map.of("code", "AUTH_REQUIRED"), "Bạn cần đăng nhập để tra cứu đơn của mình.", "Quyền truy cập đơn hàng", List.of());
        number = number.toUpperCase(Locale.ROOT);
        app.require(number.matches("GH-[A-F0-9]{8}"), "Mã đơn có dạng GH-XXXXXXXX.");
        var rows = db.query("SELECT data::text FROM records WHERE kind='order' AND owner_id=? AND data->>'number'=?",
            (rs, i) -> app.decode(rs.getString(1)), actor.get("id"), number);
        if (rows.isEmpty()) return new Result(Map.of("code", "NOT_FOUND"), "Không tìm thấy mã đơn này trong tài khoản của bạn.", "Đơn hàng của chính bạn", List.of());
        var order = rows.getFirst();
        var data = Map.<String, Object>of("number", number, "status", order.get("status"), "total", order.get("total"), "history", order.getOrDefault("history", List.of()));
        String status = switch (app.str(order, "status")) {
            case "PLACED" -> "Đã đặt";
            case "CONFIRMED" -> "Đã xác nhận";
            case "PACKED" -> "Đã đóng gói";
            case "SHIPPED" -> "Đang giao";
            case "DELIVERED" -> "Đã giao";
            case "CANCELLED" -> "Đã hủy";
            case "RETURNED" -> "Đã hoàn hàng";
            default -> app.str(order, "status");
        };
        return new Result(data, "Đơn " + number + " có trạng thái " + status + ", tổng " + money(app.number(order, "total")) + ".", "Đơn " + number + " của chính bạn", List.of());
    }

    private Result policy(String topic) {
        app.require(Set.of("privacy", "returns").contains(topic), "Chính sách không hợp lệ.");
        if (topic.equals("returns")) {
            String text = "Chính sách đổi trả hiện là bản dự thảo chờ phê duyệt. Xem điều kiện và thời hạn đề xuất tại [Chính sách đổi trả](/return-policy).";
            return new Result(Map.of("status", "DRAFT", "version", "return-1.0-draft", "url", "/return-policy", "notice", text), text, "Chính sách đổi trả · return-1.0-draft · DRAFT · /return-policy", List.of());
        }
        var data = (Map<?, ?>) app.policy();
        var result = Map.<String, Object>of("version", data.get("version"), "status", data.get("status"), "content", data.get("content"), "url", "/privacy-policy");
        return new Result(result, "Chính sách bảo mật phiên bản " + data.get("version") + " có trạng thái " + data.get("status") + ". Xem [Chính sách bảo mật](/privacy-policy).", "Chính sách bảo mật · " + data.get("version") + " · " + data.get("status"), List.of());
    }

    List<Call> fallbackPlan(String message, Map<String, Object> slots, boolean giftContext) {
        String text = normalized(message);
        var calls = new ArrayList<Call>();
        var order = Pattern.compile("(?i)\\bGH-[a-f0-9]{8}\\b").matcher(message);
        if (order.find()) calls.add(new Call("lookup_order", Map.of("number", order.group())));
        if (text.contains("ship") || text.contains("van chuyen") || text.contains("phi giao") || text.contains("giao hang")) calls.add(new Call("get_shipping", Map.of()));
        if (text.contains("doi tra") || text.contains("tra hang") || text.contains("hoan tien")) calls.add(new Call("get_policy", Map.of("topic", "returns")));
        if (text.contains("bao mat") || text.contains("rieng tu")) calls.add(new Call("get_policy", Map.of("topic", "privacy")));
        if (text.contains("ghi nho") || text.contains("so thich")) calls.add(new Call("get_memory", Map.of()));
        var named = namedProducts(text);
        Call structured = null;
        if (text.contains("so sanh") && named.size() == 2)
            structured = new Call("compare_products", Map.of("first", app.str(named.get(0), "name"), "second", app.str(named.get(1), "name")));
        else if (cartIntent(text) && named.size() == 1)
            structured = new Call("add_to_cart", Map.of("product", app.str(named.get(0), "name"), "quantity", cartQuantity(text)));
        if (structured != null) calls.add(structured);
        else {
            var products = productLookup(message, slots, giftContext);
            if (products != null) calls.add(products);
        }
        return calls;
    }

    Call productLookup(String message, Map<String, Object> slots, boolean giftContext) {
        String text = normalized(message);
        boolean tea = Pattern.compile("\\btra\\b").matcher(text).find() && !text.contains("tra cuu") && !text.contains("doi tra") && !text.contains("tra hang");
        if (tea || text.contains("me xung") || text.contains("banh") || text.contains("keo") || text.contains("cua hang co gi")) {
            var lookup = new LinkedHashMap<String, Object>();
            lookup.put("query", message.substring(0, Math.min(message.length(), 120)));
            if (slots.containsKey("budget")) lookup.put("budget", slots.get("budget"));
            return new Call("search_products", lookup);
        }
        if (!(giftContext || text.contains("qua") || text.contains("tang") || text.contains("bieu")
                || text.contains("san pham") || text.contains("ban chay") || text.contains("so sanh"))) return null;
        var input = new LinkedHashMap<String, Object>();
        if (slots.containsKey("budget")) input.put("budget", slots.get("budget"));
        var named = Pattern.compile("\\b(hop qua|san pham)\\s+(.+?)(?=\\s+(?:cho|duoc|gia|con|bao nhieu)\\b|[?!.]|$)").matcher(text);
        if (named.find() && !named.group(2).matches(".*\\b(nao|ban chay|phu hop|duoi|ngan sach)\\b.*")) {
            String query = (named.group(1).equals("hop qua") ? "hop qua " : "") + named.group(2);
            input.put("query", query.substring(0, Math.min(query.length(), 120)));
        }
        return new Call("recommend_products", input);
    }
}
