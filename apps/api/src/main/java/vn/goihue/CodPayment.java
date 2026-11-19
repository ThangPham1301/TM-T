package vn.goihue;

import java.util.Map;

final class CodPayment {
    private CodPayment() {}

    static boolean isCod(Map<String, Object> order) {
        Object method = order.get("paymentMethod");
        return method == null || "COD".equals(method);
    }

    static int amountDue(PlatformApi app, Map<String, Object> order) {
        return app.number(order, order.containsKey("codDueAmount") ? "codDueAmount" : "total");
    }

    static void recordCollection(PlatformApi app, Map<String, Object> order,
                                 Map<String, Object> input, String recordedAt) {
        app.require("UNPAID".equals(order.get("paymentStatus")), "Đơn không còn chờ ghi nhận COD.");
        int amount = app.number(input, "collectedAmount");
        app.require(amount >= 0 && amount == amountDue(app, order), "Số tiền COD phải khớp khoản phải thu của đơn.");
        String reference = app.text(input, "reference", 200);
        order.put("paymentStatus", "PAID");
        order.put("paymentReference", reference);
        order.put("codCollectedAmount", amount);
        order.put("paidAt", recordedAt);
    }
}
