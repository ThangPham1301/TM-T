package vn.goihue;

import java.util.*;

/** Allowlisted, identity-free commerce data; never serializes a raw order into analytics. */
final class CommerceMeasurement {
    private CommerceMeasurement() {}

    static long amount(Map<?, ?> row, String key) {
        return row.get(key) instanceof Number n ? n.longValue() : 0;
    }

    static String text(Map<?, ?> row, String key) {
        return Objects.toString(row.get(key), "");
    }

    static String source(Object pricing) {
        if (pricing instanceof PricingService.Price price) return price.source();
        if (pricing instanceof Map<?, ?> map) return Objects.toString(map.get("source"), "BASE");
        return "BASE";
    }

    static Map<String, Object> snapshot(List<Map<String, Object>> rows, DiscountService.Quote quote,
                                        long shipping, String transactionId, String method, String pricingField) {
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("schemaVersion", 1);
        snapshot.put("currency", "VND");
        snapshot.putAll(quote.breakdown());
        snapshot.put("shippingFee", shipping);
        snapshot.put("total", quote.netSubtotal() + shipping);
        if (transactionId != null) snapshot.put("transactionId", transactionId);
        if (method != null) snapshot.put("paymentMethod", method);
        snapshot.put("items", rows.stream().map(row -> {
            var item = new LinkedHashMap<String, Object>();
            String productId = text(row, "productId");
            long price = pricingField.equals("currentPricing") ? amount(row, "currentPrice") : amount(row, "price");
            long quantity = amount(row, "quantity");
            long reduction = quote.lineDiscounts().getOrDefault(productId, 0L);
            item.put("productId", productId);
            item.put("name", text(row, "name"));
            item.put("categoryCode", text(row, "category"));
            item.put("quantity", quantity);
            item.put("unitPrice", price);
            item.put("priceSource", source(row.get(pricingField)));
            item.put("lineDiscountAmount", reduction);
            item.put("lineNetTotal", price * quantity - reduction);
            return item;
        }).toList());
        return snapshot;
    }

    static Map<String, Object> mutation(List<Map<String, Object>> before, Map<String, Object> result,
                                         String action, String productId) {
        var changes = new ArrayList<Map<String, Object>>();
        if (action.equals("cart-clear")) {
            for (var row : before) changes.add(change(row, amount(row, "quantity"), 0));
        } else if (action.equals("cart-set")) {
            var previous = before.stream().filter(row -> text(row, "productId").equals(productId)).findFirst();
            long oldQuantity = previous.map(row -> amount(row, "quantity")).orElse(0L);
            long nextQuantity = amount(result, "quantity");
            if (oldQuantity != nextQuantity) {
                var row = nextQuantity > 0 ? result : previous.orElse(Map.of());
                changes.add(change(row, oldQuantity, nextQuantity));
            }
        }
        return Map.of("schemaVersion", 1, "operationId", UUID.randomUUID().toString(), "changes", changes);
    }

    private static Map<String, Object> change(Map<String, Object> row, long previous, long next) {
        return Map.of("productId", text(row, "productId"), "name", text(row, "name"),
                "categoryCode", text(row, "category"), "previousQuantity", previous,
                "newQuantity", next, "effectiveUnitPrice", amount(row, "price"),
                "priceSource", source(row.get("pricing")));
    }
}
