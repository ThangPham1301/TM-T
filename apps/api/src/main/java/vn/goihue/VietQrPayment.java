package vn.goihue;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class VietQrPayment {
    private VietQrPayment() {}

    static Map<String, Object> details(Map<String, Object> order) {
        if (order.get("payment") instanceof Map<?, ?> payment) {
            @SuppressWarnings("unchecked")
            var details = (Map<String, Object>) payment;
            return details;
        }
        return null;
    }

    static boolean isVietQr(Map<String, Object> order) {
        return "VIETQR".equals(order.get("paymentMethod"));
    }

    static boolean canFulfill(Map<String, Object> order, String next) {
        return !isVietQr(order) || !Set.of("PACKED", "SHIPPED", "DELIVERED").contains(next)
                || "PAID".equals(order.get("paymentStatus"));
    }

    // Old duplicate handling marked the entire paid order REVIEW. Preserve the
    // first receipt and move the second into the same list used for new orders.
    static boolean normalizeLegacyExtra(Map<String, Object> order, Map<String, Object> payment) {
        if (!"REVIEW".equals(order.get("paymentStatus")) || payment == null
                || payment.get("paidAt") == null || payment.get("transactionId") == null
                || !(payment.get("extraTransactionId") instanceof String id) || id.isBlank()) {
            return false;
        }
        extras(payment).add(new LinkedHashMap<>(Map.of("transactionId", id, "status", "REVIEW")));
        payment.remove("extraTransactionId");
        payment.put("status", "PAID");
        order.put("paymentStatus", "PAID");
        return true;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> extras(Map<String, Object> payment) {
        return (List<Map<String, Object>>) payment.computeIfAbsent("extraPayments", key -> new ArrayList<>());
    }

    static boolean canRecordPrimaryPayment(Map<String, Object> order, Map<String, Object> payment) {
        return !Set.of("CANCELLED", "RETURNED").contains(order.get("status"))
                && payment.get("reviewReason") == null;
    }
}
