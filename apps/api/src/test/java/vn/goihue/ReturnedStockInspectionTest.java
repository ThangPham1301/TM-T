package vn.goihue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

class ReturnedStockInspectionTest {
    private final CatalogService catalog = mock(CatalogService.class);
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final ObjectMapper json = new ObjectMapper();
    private final PlatformApi app = new PlatformApi(db, json, mock(StoreLive.class));
    private final CommerceApi commerce = new CommerceApi(app, db, catalog, json, mock(FulfillmentService.class));
    private final UUID inspector = UUID.randomUUID();

    @Test
    void inspectionRestocksOnlyAcceptedItemsAndCannotBeRepeated() {
        var order = quarantinedOrder();
        var inspection = results(1, 0);
        commerce.inspectReturnedStock(order, inspection, inspector);

        assertEquals("PARTIALLY_RESTOCKED", order.get("returnStockStatus"));
        assertEquals(inspector.toString(), ((Map<?, ?>) order.get("returnInspection")).get("inspectorId"));
        assertEquals(409, assertThrows(PlatformApi.Problem.class,
                () -> commerce.inspectReturnedStock(order, inspection, inspector)).status);
        verify(catalog).restoreProductStock("product-a", 1);
        verifyNoMoreInteractions(catalog);
    }

    @Test
    void validatesAllQuantitiesBeforeRestockingAnyItem() {
        var order = quarantinedOrder();
        assertEquals(422, assertThrows(PlatformApi.Problem.class,
                () -> commerce.inspectReturnedStock(order, results(1, 2), inspector)).status);
        assertEquals("QUARANTINED", order.get("returnStockStatus"));
        verifyNoInteractions(catalog);
    }

    @Test
    void rejectedInspectionDoesNotChangeSellableStock() {
        var order = quarantinedOrder();
        commerce.inspectReturnedStock(order, results(0, 0), inspector);
        assertEquals("REJECTED", order.get("returnStockStatus"));
        verifyNoInteractions(catalog);
    }

    private Map<String, Object> quarantinedOrder() {
        return new LinkedHashMap<>(Map.of("status", "RETURNED", "returnStockStatus", "QUARANTINED",
                "items", List.of(Map.of("productId", "product-a", "quantity", 2),
                        Map.of("productId", "product-b", "quantity", 1))));
    }

    private Map<String, Object> results(int first, int second) {
        return Map.of("reference", "QC-101", "packagingChecked", true, "qualityChecked", true,
                "inspection", List.of(Map.of("productId", "product-a", "acceptedQuantity", first),
                        Map.of("productId", "product-b", "acceptedQuantity", second)));
    }
}
