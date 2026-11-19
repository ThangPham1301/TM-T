package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.document.Document;
import software.amazon.awssdk.services.bedrockruntime.model.*;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class AgentTools {
    private final PlatformApi app;
    private final JdbcTemplate db;
    private final CatalogService catalog;
    private final RecommendApi recommendations;
    private final AiPrivacy privacy;

    public AgentTools(PlatformApi app, JdbcTemplate db, CatalogService catalog, RecommendApi recommendations, AiPrivacy privacy) {
        this.app = app;
        this.db = db;
        this.catalog = catalog;
        this.recommendations = recommendations;
        this.privacy = privacy;
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
            definition("recommend_products", "Tìm quà còn bán được, xếp theo đơn đã giao và lựa chọn cá nhân hóa đã đồng ý. Ngân sách budget tính bằng VND. Hỏi bổ sung khi thiếu ngân sách.",
                Map.of("budget", Map.of("type", "integer", "minimum", 0, "maximum", 100000000), "surface", Map.of("type", "string", "enum", List.of("home", "product", "cart")), "productId", Map.of("type", "string")), List.of()),
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
            case "recommend_products" -> Set.of("budget", "surface", "productId");
            case "get_shipping" -> Set.of("subtotal");
            case "lookup_order" -> Set.of("number");
            case "get_policy" -> Set.of("topic");
            case "get_memory" -> Set.of();
            default -> throw new PlatformApi.Problem(422, "Công cụ không được hỗ trợ.");
        };
        app.require(fields.containsAll(input.keySet()), "Tham số công cụ không hợp lệ.");
        return switch (name) {
            case "recommend_products" -> gifts(actor, input);
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
        Integer budget = input.containsKey("budget") ? integer(input, "budget") : null;
        String surface = app.str(input, "surface");
        if (surface.isEmpty()) surface = "home";
        String productId = app.str(input, "productId");
        var result = recommendations.rank(actor, surface, productId.isEmpty() ? null : productId, 4, budget);
        var cards = (List<Map<String, Object>>) result.get("items");
        String text = cards.isEmpty() ? "Hiện chưa có sản phẩm còn hàng phù hợp ngân sách. Bạn có muốn đổi ngân sách?" :
            "Bạn tham khảo các món còn hàng" + (budget == null ? " dưới đây." : " trong ngân sách " + money(budget) + " dưới đây.");
        return new Result(result, text, "Danh mục và gợi ý theo đơn đã giao · " + result.get("strategy"), cards);
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
        boolean gifts = text.contains("qua") || text.contains("tang") || text.contains("bieu") || giftContext;
        if (gifts && slots.containsKey("budget")) calls.add(new Call("recommend_products", Map.of("budget", slots.get("budget"))));
        return calls;
    }
}
