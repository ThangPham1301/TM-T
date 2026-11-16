package vn.goihue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class CodConfirmationTest {
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final ObjectMapper json = new ObjectMapper();
    private final PlatformApi app = new PlatformApi(db, json, mock(StoreLive.class));
    private final CommerceApi commerce = new CommerceApi(app, db, mock(CatalogService.class), json, mock(FulfillmentService.class));
    private final Instant deadline = Instant.parse("2026-11-17T07:00:00Z");

    @Test
    void confirmationBeforeDeadlineKeepsPaymentUnpaid() {
        var order = order();
        var confirmedAt = deadline.minusSeconds(1);
        commerce.confirmCod(order, confirmedAt);
        assertEquals("CONFIRMED", order.get("status"));
        assertEquals("UNPAID", order.get("paymentStatus"));
        assertEquals(confirmedAt.toString(), order.get("codConfirmedAt"));
    }

    @Test
    void confirmationAtDeadlineFailsWithoutChangingOrder() {
        var order = order();
        assertEquals(409, assertThrows(PlatformApi.Problem.class,
                () -> commerce.confirmCod(order, deadline)).status);
        assertEquals("PLACED", order.get("status"));
    }

    @Test
    void legacyOrderDoesNotEnterNewConfirmationFlow() {
        var order = order();
        order.remove("codConfirmBy");
        assertEquals(409, assertThrows(PlatformApi.Problem.class,
                () -> commerce.confirmCod(order, deadline.minusSeconds(1))).status);
        assertEquals("PLACED", order.get("status"));
    }

    private Map<String, Object> order() {
        return new LinkedHashMap<>(Map.of("paymentMethod", "COD", "status", "PLACED",
                "paymentStatus", "UNPAID", "codConfirmBy", deadline.toString()));
    }
}
