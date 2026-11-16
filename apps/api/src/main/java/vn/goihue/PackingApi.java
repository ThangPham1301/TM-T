package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/packing")
class PackingApi {
    private final PlatformApi app;
    private final CatalogService catalog;
    private final FulfillmentService fulfillment;

    PackingApi(PlatformApi app, CatalogService catalog, FulfillmentService fulfillment) {
        this.app = app;
        this.catalog = catalog;
        this.fulfillment = fulfillment;
    }

    @PutMapping(value = "/{orderId}/photo/{revision}", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Transactional
    public Object upload(@PathVariable String orderId, @PathVariable int revision,
                         @RequestBody byte[] input, HttpServletRequest request) throws Exception {
        app.origin(request);
        var actor = app.actor(request);
        app.permission(actor, "order.manage");
        byte[] png = PackingPhoto.normalize(input);
        app.lock();
        var order = app.record(orderId, "order", actor);
        catalog.revision(order, Map.of("revision", revision));
        String status = app.str(order, "status");
        if (!"CONFIRMED".equals(status))
            throw new PlatformApi.Problem(409, "Chỉ tải ảnh trước khi xác nhận đóng gói.");
        fulfillment.requirePackingQc(order);
        var id = UUID.randomUUID();
        catalog.db.update("""
                INSERT INTO packing_photos (order_id, id, order_revision, content)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (order_id) DO UPDATE SET id = EXCLUDED.id, order_revision = EXCLUDED.order_revision,
                    content = EXCLUDED.content, uploaded_at = now()
                """, app.uuid(orderId), id, revision, png);
        app.audit(actor, orderId, "PACKING_PHOTO_UPLOADED");
        return Map.of("photoId", id.toString());
    }

    @GetMapping("/{orderId}/photo")
    public ResponseEntity<byte[]> photo(@PathVariable String orderId, HttpServletRequest request) {
        var order = app.record(orderId, "order", app.actor(request));
        if (!(order.get("packing") instanceof Map<?, ?> packing) || !(packing.get("photoId") instanceof String id))
            throw new PlatformApi.Problem(404, "Đơn chưa có ảnh đóng gói.");
        var photos = catalog.db.query("""
                SELECT content FROM packing_photos WHERE order_id = ? AND id = ?
                """, (rs, row) -> rs.getBytes("content"), app.uuid(orderId), app.uuid(id));
        if (photos.isEmpty()) throw new PlatformApi.Problem(404, "Đơn chưa có ảnh đóng gói.");
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
                .header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff").body(photos.getFirst());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> error(Exception error) {
        return app.error(error);
    }
}
