package vn.goihue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentLifecycleTest {
    private static final String NUMBER = "GH-A1234567";
    private final UUID owner = UUID.randomUUID();
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final PlatformApi app = new PlatformApi(db, new ObjectMapper(), mock(StoreLive.class));
    private final CatalogService catalog = mock(CatalogService.class);
    private final CommerceApi commerce = mock(CommerceApi.class);
    private final PaymentApi payments = new PaymentApi(app, db, catalog, commerce);

    @Test
    void notificationAfterManualCancellationGoesToReviewWithoutReleasingStockAgain() {
        var order = prepare("CANCELLED", "CANCELLED", Instant.now().plusSeconds(600));

        assertEquals("REVIEW_LATE", receive());

        verify(catalog, never()).releaseReservedStock(anyMap());
        verify(commerce, never()).restoreExpiredCart(eq(owner), anyMap());
        assertSaved(order, "CANCELLED", "REVIEW");
    }

    @Test
    void lateNotificationBeforeSweepReleasesStockAndRestoresCart() {
        var order = prepare("CONFIRMED", "PENDING", Instant.now().minusSeconds(60));

        assertEquals("REVIEW_LATE", receive());

        verify(catalog).releaseReservedStock(anyMap());
        verify(commerce).restoreExpiredCart(eq(owner), anyMap());
        assertSaved(order, "CANCELLED", "REVIEW");
    }

    @Test
    void onTimeNotificationRecordsPaymentWithoutChangingFulfillment() {
        var order = prepare("PLACED", "PENDING", Instant.now().plusSeconds(600));

        assertEquals("PAID", receive());

        verify(catalog, never()).releaseReservedStock(anyMap());
        assertSaved(order, "PLACED", "PAID");
    }

    @Test
    void duplicateNotificationDoesNotChangeOrderOrStock() {
        var order = prepare("PLACED", "PENDING", Instant.now().plusSeconds(600));
        when(db.update(contains("INSERT INTO payment_notifications"), eq("test"), eq("txn-1"),
                eq(UUID.fromString(app.str(order, "id"))), eq(125_000L))).thenReturn(0);

        assertEquals("DUPLICATE_IGNORED", receive());

        verify(catalog, never()).releaseReservedStock(anyMap());
        verify(db, never()).update(contains("INSERT INTO records"), eq(UUID.fromString(app.str(order, "id"))),
                eq("order"), eq(owner), org.mockito.ArgumentMatchers.anyString());
    }

    private Map<String, Object> prepare(String status, String paymentStatus, Instant expiresAt) {
        var order = new LinkedHashMap<String, Object>();
        order.put("id", UUID.randomUUID().toString());
        order.put("number", NUMBER);
        order.put("status", status);
        order.put("paymentMethod", "VIETQR");
        order.put("paymentStatus", "UNPAID");
        order.put("payment", Map.of("status", paymentStatus, "expiresAt", expiresAt.toString()));
        order.put("total", 125_000);
        order.put("revision", 1);
        order.put("history", new ArrayList<>());
        when(db.queryForList(contains("data->>'number'"), eq(NUMBER)))
                .thenReturn(List.of(Map.of("owner_id", owner, "data", app.encode(order))));
        when(db.update(contains("INSERT INTO payment_notifications"), eq("test"), eq("txn-1"),
                eq(UUID.fromString(app.str(order, "id"))), eq(125_000L))).thenReturn(1);
        return order;
    }

    private String receive() {
        return payments.processPayment(NUMBER, 125_000, "txn-1", "test", "payment-test");
    }

    private void assertSaved(Map<String, Object> original, String status, String paymentStatus) {
        var data = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(db).update(contains("INSERT INTO records"), eq(UUID.fromString(app.str(original, "id"))),
                eq("order"), eq(owner), data.capture());
        var saved = app.decode(data.getValue());
        assertEquals(status, saved.get("status"));
        assertEquals(paymentStatus, saved.get("paymentStatus"));
    }
}
