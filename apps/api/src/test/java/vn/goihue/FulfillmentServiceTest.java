package vn.goihue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FulfillmentServiceTest {
    private final PlatformApi app = new PlatformApi(mock(JdbcTemplate.class), new ObjectMapper(), mock(StoreLive.class));
    private final CatalogService catalog = mock(CatalogService.class);
    private final LotInventory inventory = mock(LotInventory.class);
    private final JdbcTemplate db = mock(JdbcTemplate.class);
    private final FulfillmentService fulfillment = new FulfillmentService(app, catalog, inventory, db);
    private final UUID productId = UUID.randomUUID();
    private final UUID badLot = UUID.randomUUID();
    private final UUID goodLot = UUID.randomUUID();

    @Test
    void repickKeepsValidAllocationAndCombinesReplacementFromSameLot() {
        var item = new LinkedHashMap<String, Object>();
        item.put("productId", productId.toString());
        item.put("lotAllocations", List.of(allocation(badLot), allocation(goodLot)));
        var order = new LinkedHashMap<String, Object>(Map.of("status", "CONFIRMED", "paymentMethod", "COD",
                "items", List.of(item), "fulfillmentQc", Map.of("outcome", "FAILED")));
        when(inventory.eligible(productId, goodLot)).thenReturn(true);
        when(inventory.reserve(productId, 1)).thenReturn(List.of(allocation(goodLot)));

        fulfillment.repick(order);

        verify(catalog).restoreLotStock(productId.toString(), List.of(allocation(badLot)));
        var lots = (List<?>) item.get("lotAllocations");
        assertEquals(1, lots.size());
        assertEquals(2, ((Map<?, ?>) lots.getFirst()).get("quantity"));
        assertFalse(order.containsKey("fulfillmentQc"));
    }

    @Test
    void packingRequiresQcForNewOrdersAndRejectsAnIneligibleLotAfterQc() {
        var item = Map.of("productId", productId.toString(), "lotAllocations", List.of(allocation(badLot)));
        var order = new LinkedHashMap<String, Object>(Map.of("fulfillmentQcRequired", true, "items", List.of(item)));

        assertEquals(409, assertThrows(PlatformApi.Problem.class, () -> fulfillment.requirePackingQc(order)).status);
        verifyNoInteractions(inventory);
        order.put("fulfillmentQc", Map.of("outcome", "PASSED"));
        assertEquals(409, assertThrows(PlatformApi.Problem.class, () -> fulfillment.requirePackingQc(order)).status);
        verify(inventory).eligible(productId, badLot);
    }

    @Test
    void packingRequiresAllChecklistStepsAndPhotoFromCurrentRevision() {
        var id = UUID.randomUUID();
        var photo = UUID.randomUUID();
        var actor = UUID.randomUUID();
        var order = new LinkedHashMap<String, Object>(Map.of("id", id.toString(), "revision", 3,
                "packingSopRequired", true, "items", List.of()));

        assertEquals(422, assertThrows(PlatformApi.Problem.class,
                () -> fulfillment.completePacking(order, Map.of("packingSteps", List.of("LABEL")), actor)).status);
        verifyNoInteractions(db);

        var request = Map.<String, Object>of("packingSteps",
                List.of("WAX_PAPER", "MOLDED_TRAY", "KRAFT_BOX", "HONEYCOMB", "CORN_TAPE", "LABEL"),
                "packingPhotoId", photo.toString());
        when(db.queryForObject(contains("FROM packing_photos"), eq(Boolean.class), eq(id), eq(photo), eq(3)))
                .thenReturn(false, true);
        assertEquals(409, assertThrows(PlatformApi.Problem.class,
                () -> fulfillment.completePacking(order, request, actor)).status);
        assertFalse(order.containsKey("packing"));

        fulfillment.completePacking(order, request, actor);
        assertEquals(photo.toString(), ((Map<?, ?>) order.get("packing")).get("photoId"));
    }

    private Map<String, Object> allocation(UUID id) {
        return Map.of("lotId", id.toString(), "code", id.toString(), "expiresOn", "2026-12-01", "quantity", 1);
    }
}
