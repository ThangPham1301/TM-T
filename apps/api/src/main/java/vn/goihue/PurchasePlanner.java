package vn.goihue;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Bounded purchase arithmetic. Model output is never used as a price, stock level or computed total. */
@Service
final class PurchasePlanner {
    private static final String NUMBER = "(?:[0-9]{1,3}|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)";
    private static final String MONEY = "[0-9][0-9., ]*\\s*(?:k|tr|trieu|nghin|ngan|dong|vnd|d)\\b";
    private static final Set<String> FIELDS = Set.of("budget", "budgetScope", "recipientCount", "unitsPerRecipient", "shippingInBudget", "selectionMode");
    record Context(Integer budget, String budgetScope, Integer recipientCount, int unitsPerRecipient,
                   String shippingInBudget, String selectionMode) {
        static Context empty() { return new Context(null, "TOTAL", null, 1, "UNSPECIFIED", "ANY"); }
        boolean present() { return recipientCount != null || budget != null; }
        Map<String, Object> data() {
            if (!present()) return Map.of();
            var data = new LinkedHashMap<String, Object>();
            if (budget != null) data.put("budget", budget);
            data.put("budgetScope", budgetScope);
            if (recipientCount != null) data.put("recipientCount", recipientCount);
            data.put("unitsPerRecipient", unitsPerRecipient); data.put("shippingInBudget", shippingInBudget); data.put("selectionMode", selectionMode);
            return data;
        }
    }
    record Update(Context context, boolean requested) {}
    private record Option(List<Map<String, Object>> lines, long subtotal, long shipping, long total, boolean uniform, long maxRecipientCost) {}
    private final PlatformApi app;
    private final ProductSearch search;
    private final RecommendApi recommendations;
    private final CatalogService catalog;

    PurchasePlanner(PlatformApi app, ProductSearch search, RecommendApi recommendations, CatalogService catalog) {
        this.app = app; this.search = search; this.recommendations = recommendations; this.catalog = catalog;
    }

    Context context(Object value) {
        if (value == null) return Context.empty();
        app.require(value instanceof Map<?, ?>, "Ngữ cảnh mua hàng không hợp lệ.");
        var data = (Map<?, ?>) value;
        app.require(FIELDS.containsAll(data.keySet()), "Tham số ngữ cảnh mua hàng không hợp lệ.");
        if (data.isEmpty()) return Context.empty();
        return new Context(integer(data, "budget", 1, 100_000_000, null), choice(data, "budgetScope", "TOTAL", "TOTAL", "PER_RECIPIENT"),
            integer(data, "recipientCount", 1, 100, null), integer(data, "unitsPerRecipient", 1, 100, 1),
            choice(data, "shippingInBudget", "UNSPECIFIED", "UNSPECIFIED", "INCLUDED", "EXCLUDED"),
            choice(data, "selectionMode", "ANY", "ANY", "SAME", "DIFFERENT"));
    }

    private Integer integer(Map<?, ?> data, String key, int minimum, int maximum, Integer fallback) {
        Object value = data.get(key);
        if (value == null) return fallback;
        app.require(value instanceof Number, "Số lượng hoặc ngân sách không hợp lệ.");
        var number = (Number) value;
        app.require(Double.isFinite(number.doubleValue()) && number.doubleValue() == number.longValue()
            && number.longValue() >= minimum && number.longValue() <= maximum, "Số lượng hoặc ngân sách ngoài giới hạn hỗ trợ.");
        return number.intValue();
    }

    private String choice(Map<?, ?> data, String key, String fallback, String... allowed) {
        Object value = data.get(key);
        if (value == null) return fallback;
        app.require(value instanceof String && List.of(allowed).contains(value.toString()), "Điều kiện mua hàng không hợp lệ.");
        return value.toString();
    }

    private int number(String value) {
        var names = List.of("khong", "mot", "hai", "ba", "bon", "nam", "sau", "bay", "tam", "chin", "muoi");
        return value.equals("tu") ? 4 : names.contains(value) ? names.indexOf(value) : Integer.parseInt(value);
    }

    boolean wantsAlternatives(String message) {
        String text = AgentTools.normalized(message);
        return text.contains("tim mon khac") || text.contains("tim loai khac") || text.contains("chon mon khac") || text.contains("lua chon khac");
    }

    Update update(Context previous, String message) {
        String text = AgentTools.normalized(message);
        Integer budget = previous.budget(), recipients = previous.recipientCount();
        int units = previous.unitsPerRecipient();
        String scope = previous.budgetScope(), shipping = previous.shippingInBudget(), selection = previous.selectionMode();
        var parsedBudget = AgentTools.slots(message).get("budget");
        boolean feeQuestion = text.contains("ship") || text.contains("phi giao") || text.contains("van chuyen") || text.contains("dia chi") || text.contains("giao rieng");
        boolean explicitTotal = Pattern.compile("\\btong(?: cong)?\\s*" + MONEY).matcher(text).find();
        boolean amountIncludesShipping = Pattern.compile(MONEY + "\\s+(?:bao gom|gom(?: ca)?|tinh ca|ca)\\s+(?:tien\\s+|phi\\s+)?(?:ship|giao hang|van chuyen)").matcher(text).find();
        boolean budgetLanguage = text.contains("ngan sach") || text.contains("duoi") || text.contains("toi da") || text.contains("moi nguoi") || amountIncludesShipping
            || text.contains("/nguoi") || text.contains("/ nguoi") || text.contains("co ") || text.contains("danh ") || explicitTotal;
        boolean monetary = parsedBudget != null && (budgetLanguage || previous.recipientCount() != null && !feeQuestion);
        if (monetary) budget = ((Number) parsedBudget).intValue();
        var people = Pattern.compile("\\b(" + NUMBER + ")\\s+(?:nguoi|doi tac|dong nghiep|khach hang|phan qua|suat qua)\\b").matcher(text);
        boolean count = false;
        while (people.find()) {
            // "mỗi người" is a unit qualifier, never a second recipient count.
            recipients = number(people.group(1)); count = true;
        }
        var each = Pattern.compile("\\bmoi (?:nguoi|phan|suat)\\s+(?:la\\s+|duoc\\s+)?(" + NUMBER + ")\\s+(?:san pham|mon|goi|hop|phan)\\b").matcher(text);
        while (each.find()) { units = number(each.group(1)); count = true; }
        if (Pattern.compile("moi (?:nguoi|phan|suat)\\s+(?:(?:co|toi da|duoi|khoang|tam|ngan sach|la)\\s+)*" + MONEY
            + "|" + MONEY + "\\s*(?:/\\s*nguoi|(?:cho\\s+)?moi nguoi)").matcher(text).find()) scope = "PER_RECIPIENT";
        else if (explicitTotal || text.contains("tong ngan sach") || text.contains("ngan sach tong") || text.contains("cho ca") || text.contains("tong cong")) scope = "TOTAL";
        if (text.matches("(?s).*(?:chua|khong)\\s+(?:tinh|gom|bao gom)(?:\\s+ca)?\\s+(?:tien\\s+|phi\\s+)?(?:ship|giao hang|van chuyen).*")) shipping = "EXCLUDED";
        else if (text.matches("(?s).*(?:bao gom|tinh ca|tinh luon|gom ca|ca tien|gom)\\s+(?:tien\\s+|phi\\s+)?(?:ship|giao hang|van chuyen).*")) shipping = "INCLUDED";
        if (text.contains("khong can giong") || text.contains("duoc phep khac") || text.contains("loai nao cung duoc")) selection = "ANY";
        else if (text.contains("giong nhau") || text.contains("cung mot loai") || text.contains("cung loai")) selection = "SAME";
        else if (text.matches("(?s).*moi nguoi (?:mot|1) loai khac.*") || text.contains("khong trung loai")) selection = "DIFFERENT";
        boolean requested = !text.contains("vao gio") && (count || previous.recipientCount() != null && (monetary || feeQuestion || text.contains("phuong an")
            || wantsAlternatives(message) || !selection.equals(previous.selectionMode()) || !scope.equals(previous.budgetScope()) || text.contains("giong nhau") || text.contains("khac loai")));
        boolean freshTopic = (text.matches("(?s).*(?:toi muon|tim|chon|chuyen sang)\\s+.*(?:tra|banh|me xung|hop qua).*")
            || text.matches("(?s).*con\\s+(?:tra|banh|me xung|hop qua).*thi sao.*")) && !monetary && !count && !text.contains("phuong an");
        if (freshTopic) return new Update(Context.empty(), false);
        if (recipients != null && (recipients < 1 || recipients > 100) || units < 1 || units > 100) return new Update(Context.empty(), true);
        return new Update(new Context(budget, scope, recipients, units, shipping, selection), requested);
    }

    AgentTools.Result plan(Context request, ProductConversation.Scope scope, String message) {
        if (request.recipientCount() == null) return notice("NEED_RECIPIENT_COUNT", "Bạn cần tặng bao nhiêu người để mình tính đủ số phần quà?", request);
        if (request.budget() == null) return notice("NEED_BUDGET", "Bạn dành tổng ngân sách bao nhiêu cho " + request.recipientCount() + " người?", request);
        int required = request.recipientCount() * request.unitsPerRecipient();
        if (required > 100) return notice("QUANTITY_LIMIT", "Mình hiện tính được tối đa 100 sản phẩm mỗi phương án. Bạn muốn chia thành các nhóm nhỏ hơn không?", request);
        if (request.selectionMode().equals("DIFFERENT") && request.unitsPerRecipient() != 1)
            return notice("NEED_DISTRIBUTION", "Bạn muốn mỗi người nhận một bộ khác nhau, hay mọi sản phẩm đều phải khác loại?", request);
        String normalized = AgentTools.normalized(message);
        if (normalized.contains("dia chi") && (normalized.contains("rieng") || normalized.matches("(?s).*[2-9]\\s+dia chi.*")))
            return notice("NEED_DELIVERY_DETAILS", "Phương án hiện tính một đơn giao chung. Giao riêng từng địa chỉ cần tính lại phí theo từng đơn; bạn muốn giao chung hay chia đơn?", request);
        var visible = search.visibleProducts();
        boolean sesame = normalized.contains("me xung") || Pattern.compile("(?U)\\bmè\\b").matcher(message.toLowerCase(Locale.ROOT)).find();
        var selected = scope.active() ? scope.ids().stream().flatMap(id -> visible.stream().filter(p -> id.equals(app.str(p, "id"))))
            : visible.stream().filter(p -> !normalized.matches("(?s).*\\btra\\b.*") || ProductSearch.words(app.str(p, "name")).contains("tra"))
                .filter(p -> !sesame || ProductSearch.words(app.str(p, "name")).contains("xung"));
        Comparator<Map<String, Object>> candidateOrder = scope.active()
            ? Comparator.comparingInt(product -> scope.ids().indexOf(app.str(product, "id")))
            : Comparator.<Map<String, Object>>comparingInt(product -> app.number(product, "price")).thenComparing(product -> app.str(product, "id"));
        var candidates = selected.filter(p -> app.number(p, "stock") > 0 && app.number(p, "price") > 0).sorted(candidateOrder).limit(8).toList();
        var shipping = catalog.shipping();
        if (!Boolean.TRUE.equals(shipping.get("enabled"))) return notice("STORE_PAUSED", "Cửa hàng đang tạm ngừng nhận đơn nên mình chưa thể đề xuất phương án mua lúc này.", request);
        long maximum = request.budgetScope().equals("PER_RECIPIENT") ? (long) request.budget() * request.recipientCount() : request.budget();
        var options = new LinkedHashMap<String, Option>();
        for (int i = 0; i < candidates.size(); i++) {
            var amounts = new int[candidates.size()]; amounts[i] = required;
            add(options, candidates, amounts, required, shipping, request);
        }
        if (!request.selectionMode().equals("SAME")) {
            var order = new ArrayList<Integer>();
            for (int i = 0; i < candidates.size(); i++) order.add(i);
            order.sort(Comparator.comparingInt(i -> app.number(candidates.get(i), "price")));
            var cheapest = new int[candidates.size()]; int remaining = required;
            for (int index : order) {
                cheapest[index] = Math.min(remaining, request.selectionMode().equals("DIFFERENT") ? 1 : app.number(candidates.get(index), "stock"));
                remaining -= cheapest[index];
            }
            add(options, candidates, cheapest, required, shipping, request);
            if (!request.selectionMode().equals("DIFFERENT")) for (int i = 0; i < candidates.size(); i++) for (int j = i + 1; j < candidates.size(); j++)
                for (int count = 1; count < required; count++) {
                    var amounts = new int[candidates.size()]; amounts[i] = count; amounts[j] = required - count;
                    add(options, candidates, amounts, required, shipping, request);
                }
        }
        if (!options.isEmpty() && options.values().stream().allMatch(option -> option.subtotal() > 100_000_000L))
            return notice("ORDER_LIMIT", "Phương án này vượt hạn mức tiền hàng 100 triệu đồng cho một đơn. Cần chia thành đơn riêng và tính lại phí giao từng đơn.", request);
        options.values().removeIf(option -> option.subtotal() > 100_000_000L);
        boolean allIn = request.shippingInBudget().equals("INCLUDED");
        var sorted = options.values().stream().sorted(Comparator.comparingLong(option -> allIn ? option.total() : option.subtotal())).toList();
        var feasible = sorted.stream().filter(option -> (allIn ? option.total() : option.subtotal()) <= maximum)
            .filter(option -> !request.budgetScope().equals("PER_RECIPIENT") || option.maxRecipientCost() <= request.budget()).limit(3).toList();
        var over = sorted.stream().filter(option -> (allIn ? option.total() : option.subtotal()) > maximum).findFirst();
        var cards = candidates.stream().map(recommendations::card).toList();
        var data = new LinkedHashMap<String, Object>();
        data.put("code", sorted.isEmpty() ? "INSUFFICIENT_STOCK" : feasible.isEmpty() ? "NO_FEASIBLE_PLAN" : "PLANNED");
        data.put("constraints", request.data()); data.put("requiredQuantity", required); data.put("totalBudget", maximum);
        data.put("items", cards); data.put("shipping", shipping); data.put("shippingVerified", true);
        data.put("options", feasible.stream().map(option -> option(option, maximum, allIn)).toList());
        over.ifPresent(option -> data.put("closestOverBudget", option(option, maximum, allIn)));
        String text = render(request, required, maximum, feasible, sorted, over.orElse(null));
        var chosenIds = feasible.stream().flatMap(option -> option.lines().stream()).map(line -> line.get("productId").toString()).collect(Collectors.toSet());
        return new AgentTools.Result(data, text, "Tính phương án mua · giá, tồn và phí giao hàng hiện tại", cards.stream().filter(card -> chosenIds.contains(app.str(card, "id"))).toList());
    }

    private AgentTools.Result notice(String code, String text, Context request) {
        return new AgentTools.Result(Map.of("code", code, "constraints", request.data()), text, "Điều kiện lập phương án mua", List.of());
    }

    private void add(Map<String, Option> options, List<Map<String, Object>> products, int[] amounts, int required, Map<String, Object> shipping, Context request) {
        if (Arrays.stream(amounts).sum() != required) return;
        var lines = new ArrayList<Map<String, Object>>(); long subtotal = 0;
        for (int i = 0; i < amounts.length; i++) if (amounts[i] > 0) {
            if (amounts[i] > app.number(products.get(i), "stock") || request.selectionMode().equals("DIFFERENT") && amounts[i] > 1) return;
            int price = app.number(products.get(i), "price"); long lineTotal = (long) price * amounts[i]; subtotal += lineTotal;
            lines.add(Map.of("productId", app.str(products.get(i), "id"), "name", app.str(products.get(i), "name"), "quantity", amounts[i], "unitPrice", price, "lineTotal", lineTotal));
        }
        int threshold = app.number(shipping, "freeShippingThreshold");
        long fee = threshold > 0 && subtotal >= threshold ? 0 : app.number(shipping, "baseFee");
        var unitPrices = new ArrayList<Integer>();
        for (int i = 0; i < amounts.length; i++) for (int count = 0; count < amounts[i]; count++) unitPrices.add(app.number(products.get(i), "price"));
        unitPrices.sort(Comparator.reverseOrder());
        var recipientTotals = new long[request.recipientCount()];
        var recipientUnits = new int[request.recipientCount()];
        for (int price : unitPrices) {
            int next = -1;
            for (int i = 0; i < recipientUnits.length; i++) if (recipientUnits[i] < request.unitsPerRecipient()
                && (next < 0 || recipientTotals[i] < recipientTotals[next])) next = i;
            recipientUnits[next]++; recipientTotals[next] += price;
        }
        long perRecipientFee = request.shippingInBudget().equals("INCLUDED") ? (fee + request.recipientCount() - 1) / request.recipientCount() : 0;
        long maxRecipientCost = Arrays.stream(recipientTotals).max().orElse(0) + perRecipientFee;
        options.putIfAbsent(Arrays.toString(amounts), new Option(lines, subtotal, fee, subtotal + fee, lines.size() == 1, maxRecipientCost));
    }

    private Map<String, Object> option(Option option, long budget, boolean allIn) {
        return Map.of("lines", option.lines(), "subtotal", option.subtotal(), "shippingFee", option.shipping(), "total", option.total(),
            "remainingBudget", budget - (allIn ? option.total() : option.subtotal()), "fitsIncludingShipping", option.total() <= budget, "uniform", option.uniform(), "maxRecipientCost", option.maxRecipientCost());
    }

    private String lines(Option option) {
        return option.lines().stream().map(line -> line.get("quantity") + " × **" + line.get("name") + "** (" + AgentTools.money(((Number) line.get("unitPrice")).longValue()) + "/sản phẩm)").collect(Collectors.joining(" + "));
    }

    private String render(Context request, int quantity, long budget, List<Option> feasible, List<Option> sorted, Option over) {
        String basis = request.budgetScope().equals("PER_RECIPIENT") ? "Ngân sách " + AgentTools.money(request.budget()) + "/người, tổng " : "Tổng ngân sách ";
        String header = basis + AgentTools.money(budget) + " cho " + request.recipientCount() + " người, mỗi người " + request.unitsPerRecipient() + " sản phẩm (cần " + quantity + " sản phẩm).\n\n";
        if (sorted.isEmpty()) return header + (request.selectionMode().equals("DIFFERENT") ? "Chưa đủ số loại khác nhau còn hàng để chia theo yêu cầu." : "Các món đang cân nhắc chưa đủ tồn kho để đáp ứng số lượng" + (request.selectionMode().equals("SAME") ? " cùng một loại." : ".")) + " Bạn muốn mình tìm món khác không?";
        if (feasible.isEmpty()) {
            var cheapest = sorted.getFirst();
            long cost = request.shippingInBudget().equals("INCLUDED") ? cheapest.total() : cheapest.subtotal();
            if (cost <= budget && request.budgetScope().equals("PER_RECIPIENT"))
                return header + "Tổng tiền có thể nằm trong mức chung nhưng cách chia đang tính được chưa bảo đảm từng người không vượt " + AgentTools.money(request.budget())
                    + (request.unitsPerRecipient() == 1 ? ". Bạn muốn tăng mức mỗi người hay tìm món khác?" : ". Bạn muốn mỗi người nhận cùng loại hay một bộ phối nhiều món?");
            return header + "Trong các món đang cân nhắc, chưa có phương án đủ số lượng trong mức này. Phương án thấp nhất đang tính được: " + lines(cheapest) + ", tiền hàng " + AgentTools.money(cheapest.subtotal())
                + (request.shippingInBudget().equals("INCLUDED") ? ", phí giao " + AgentTools.money(cheapest.shipping()) + ", tổng " + AgentTools.money(cost) : " (chưa gồm phí giao)")
                + ", vượt " + AgentTools.money(cost - budget) + ". Bạn muốn tăng ngân sách hay tìm món khác?";
        }
        var text = new StringBuilder(header);
        for (int i = 0; i < feasible.size(); i++) {
            var option = feasible.get(i);
            text.append(feasible.size() == 1 ? "Bạn có thể mua " : (i + 1) + ". ").append(lines(option)).append(" = ").append(AgentTools.money(option.subtotal())).append(" tiền hàng");
            if (request.shippingInBudget().equals("INCLUDED")) text.append(" + ").append(AgentTools.money(option.shipping())).append(" phí giao = ").append(AgentTools.money(option.total()));
            text.append(", còn ").append(AgentTools.money(budget - (request.shippingInBudget().equals("INCLUDED") ? option.total() : option.subtotal()))).append(".\n");
        }
        if (over != null && feasible.size() == 1) text.append("\n").append(lines(over)).append(" sẽ hết ").append(AgentTools.money(request.shippingInBudget().equals("INCLUDED") ? over.total() : over.subtotal()))
            .append(", vượt ").append(AgentTools.money((request.shippingInBudget().equals("INCLUDED") ? over.total() : over.subtotal()) - budget)).append(" nên chưa vừa ngân sách.\n");
        var first = feasible.getFirst();
        if (!request.shippingInBudget().equals("INCLUDED")) {
            text.append("\nCác khoản trên chưa gồm phí giao. Với phương án đầu, phí giao một đơn là ").append(AgentTools.money(first.shipping())).append(", tổng ").append(AgentTools.money(first.total())).append(".");
            if (request.shippingInBudget().equals("UNSPECIFIED") && first.total() > budget) text.append(" Nếu ngân sách phải gồm cả ship thì phương án này vượt ").append(AgentTools.money(first.total() - budget)).append(".");
        } else text.append("\nPhí giao đang tính cho một đơn giao chung.");
        if (request.budgetScope().equals("PER_RECIPIENT") && request.shippingInBudget().equals("INCLUDED")) text.append(" Phí một đơn được chia đều khi kiểm tra trần từng người.");
        return text.toString().strip();
    }
}
