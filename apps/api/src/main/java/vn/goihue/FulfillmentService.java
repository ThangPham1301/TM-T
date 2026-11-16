package vn.goihue;

import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
class FulfillmentService {
    private static final List<String> PACKING_STEPS = List.of(
            "WAX_PAPER", "MOLDED_TRAY", "KRAFT_BOX", "HONEYCOMB", "CORN_TAPE", "LABEL");
    private final PlatformApi app;
    private final CatalogService catalog;
    private final LotInventory inventory;
    private final JdbcTemplate db;

    FulfillmentService(PlatformApi app, CatalogService catalog, LotInventory inventory, JdbcTemplate db) {
        this.app = app;
        this.catalog = catalog;
        this.inventory = inventory;
        this.db = db;
    }

    void recordQc(Map<String, Object> order, Map<String, Object> body, UUID inspector) {
        requireReadyToPick(order);
        String reference = app.text(body, "reference", 200);
        String outcome = app.text(body, "qcOutcome", 10);
        app.require(Set.of("PASSED", "FAILED").contains(outcome), "Kết quả QC không hợp lệ.");
        var checks = Map.of("texture", Boolean.TRUE.equals(body.get("qcTexture")),
                "aroma", Boolean.TRUE.equals(body.get("qcAroma")),
                "packaging", Boolean.TRUE.equals(body.get("qcPackaging")),
                "contents", Boolean.TRUE.equals(body.get("qcContents")));
        boolean allPassed = checks.values().stream().allMatch(Boolean::booleanValue);
        app.require(outcome.equals("PASSED") == allPassed, "Kết quả phải khớp bốn mục kiểm định.");

        var affected = affectedLots(order, body);
        if (allPassed) {
            app.require(affected.isEmpty(), "Kết quả đạt không thể có lô lỗi.");
            requireEligibleLots(order);
        } else {
            for (var lotId : affected) inventory.quarantine(app.uuid(lotId), reference);
        }
        order.put("fulfillmentQc", Map.of("outcome", outcome, "checks", checks, "reference", reference,
                "inspectorId", inspector.toString(), "inspectedAt", Instant.now().toString(),
                "affectedLotIds", affected));
        order.put("fulfillmentQcRequired", true);
    }

    void repick(Map<String, Object> order) {
        requireReadyToPick(order);
        boolean changed = false;
        for (var item : items(order)) {
            String productId = app.str(item, "productId");
            var id = app.uuid(productId);
            var valid = new ArrayList<Map<String, Object>>();
            var invalid = new ArrayList<Map<String, Object>>();
            for (var allocation : allocations(item)) {
                var target = inventory.eligible(id, app.uuid(app.str(allocation, "lotId"))) ? valid : invalid;
                target.add(allocation);
            }
            if (invalid.isEmpty()) continue;
            int quantity = invalid.stream().mapToInt(lot -> app.number(lot, "quantity")).sum();
            catalog.restoreLotStock(productId, invalid);
            valid.addAll(inventory.reserve(id, quantity));
            var byLot = new LinkedHashMap<String, Map<String, Object>>();
            for (var allocation : valid) {
                byLot.merge(app.str(allocation, "lotId"), allocation, (first, extra) -> {
                    var combined = new LinkedHashMap<>(first);
                    combined.put("quantity", Math.addExact(app.number(first, "quantity"),
                            app.number(extra, "quantity")));
                    return combined;
                });
            }
            item.put("lotAllocations", new ArrayList<>(byLot.values()));
            changed = true;
        }
        if (!changed) throw new PlatformApi.Problem(409, "Không có lô cần cấp lại.");
        order.remove("fulfillmentQc");
    }

    void reopenPacking(Map<String, Object> order) {
        if (!"PACKED".equals(app.str(order, "status")))
            throw new PlatformApi.Problem(409, "Chỉ mở lại đơn đã đóng gói và chưa bàn giao.");
        order.put("status", "CONFIRMED");
        order.put("fulfillmentQcRequired", true);
        order.remove("fulfillmentQc");
        order.remove("packing");
        db.update("DELETE FROM packing_photos WHERE order_id = ?", app.uuid(app.str(order, "id")));
    }

    void requirePackingQc(Map<String, Object> order) {
        boolean tracked = items(order).stream().anyMatch(item -> !allocations(item).isEmpty());
        if (Boolean.TRUE.equals(order.get("fulfillmentQcRequired")) || tracked) {
            if (!(order.get("fulfillmentQc") instanceof Map<?, ?> qc) || !"PASSED".equals(qc.get("outcome")))
                throw new PlatformApi.Problem(409, "Cần ghi nhận QC đạt trước khi đóng gói.");
        }
        requireEligibleLots(order);
    }

    void completePacking(Map<String, Object> order, Map<String, Object> body, UUID operator) {
        requirePackingQc(order);
        if (!Boolean.TRUE.equals(order.get("packingSopRequired")) && !body.containsKey("packingSteps")) return;
        if (!(body.get("packingSteps") instanceof List<?> steps) || steps.size() != PACKING_STEPS.size()
                || !steps.containsAll(PACKING_STEPS)) {
            throw new PlatformApi.Problem(422, "Cần hoàn thành đủ sáu bước đóng gói xanh.");
        }
        var photoId = app.uuid(app.text(body, "packingPhotoId", 50));
        boolean attached = Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM packing_photos WHERE order_id = ? AND id = ? AND order_revision = ?)
                """, Boolean.class, app.uuid(app.str(order, "id")), photoId, app.number(order, "revision")));
        if (!attached)
            throw new PlatformApi.Problem(409, "Ảnh phải thuộc phiên bản đơn hiện tại. Hãy tải ảnh lại.");
        order.put("packing", Map.of("steps", PACKING_STEPS, "photoId", photoId.toString(),
                "packedAt", Instant.now().toString(), "operatorId", operator.toString()));
    }

    void requireEligibleLots(Map<String, Object> order) {
        for (var item : items(order)) {
            var id = app.uuid(app.str(item, "productId"));
            for (var allocation : allocations(item)) {
                if (!inventory.eligible(id, app.uuid(app.str(allocation, "lotId"))))
                    throw new PlatformApi.Problem(409, "Lô " + app.str(allocation, "code")
                            + " đã bị cách ly hoặc không còn đủ hạn dùng. Cần cấp lại lô trước khi tiếp tục.");
            }
        }
    }

    private void requireReadyToPick(Map<String, Object> order) {
        if (!"CONFIRMED".equals(app.str(order, "status"))
                || ("VIETQR".equals(app.str(order, "paymentMethod"))
                && !"PAID".equals(app.str(order, "paymentStatus"))))
            throw new PlatformApi.Problem(409, "Đơn chưa đủ điều kiện soạn hàng.");
    }

    private Set<String> affectedLots(Map<String, Object> order, Map<String, Object> body) {
        if (!body.containsKey("affectedLotIds")) return Set.of();
        app.require(body.get("affectedLotIds") instanceof List<?>, "Danh sách lô lỗi không hợp lệ.");
        var valid = new HashSet<String>();
        for (var item : items(order)) {
            for (var lot : allocations(item)) valid.add(app.str(lot, "lotId"));
        }
        var affected = new HashSet<String>();
        for (var lot : (List<?>) body.get("affectedLotIds")) {
            app.require(lot instanceof String && valid.contains(lot) && affected.add((String) lot),
                    "Lô lỗi phải thuộc phiếu soạn và chỉ được chọn một lần.");
        }
        return affected;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> items(Map<String, Object> order) {
        return (List<Map<String, Object>>) order.get("items");
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> allocations(Map<String, Object> item) {
        return (List<Map<String, Object>>) item.getOrDefault("lotAllocations", List.of());
    }
}
