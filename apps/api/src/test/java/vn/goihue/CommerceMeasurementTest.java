package vn.goihue;

import java.time.Instant;
import java.util.*;

/** Dependency-free regression checks, executed with -ea by scripts/test-ga4-backend.py. */
public class CommerceMeasurementTest {
    public static void main(String[] args) {
        var row = new LinkedHashMap<String,Object>();
        row.put("productId", "11111111-1111-4111-8111-111111111111");
        row.put("name", "Test item"); row.put("category", "tra-cung-dinh");
        row.put("quantity", 3); row.put("price", 50000); row.put("currentPrice", 50000);
        row.put("pricing", Map.of("source", "BASE")); row.put("currentPricing", Map.of("source", "BASE"));
        row.put("phone", "DO_NOT_COPY"); row.put("cartToken", "DO_NOT_COPY");
        var offer = new DiscountService.Offer("offer-test", 1, "Test offer", "CART", "", List.of(), "", "",
                "QUANTITY", 3, "FIXED", 10000, Instant.EPOCH, Instant.parse("2099-01-01T00:00:00Z"), false, 0, "");
        var quote = DiscountService.calculate(List.of(new DiscountService.Line((String)row.get("productId"),50000,3,true,40000)), List.of(offer));
        var snapshot = CommerceMeasurement.snapshot(List.of(row), quote, 20000, "GH-TEST0001", "COD", "pricing");
        assert ((Number)snapshot.get("netSubtotal")).longValue() == 140000;
        assert ((Number)snapshot.get("total")).longValue() == 160000;
        assert snapshot.get("transactionId").equals("GH-TEST0001");
        assert !snapshot.toString().contains("DO_NOT_COPY");
        var item = (Map<?,?>)((List<?>)snapshot.get("items")).getFirst();
        assert ((Number)item.get("lineDiscountAmount")).longValue() == 10000;
        assert ((Number)item.get("lineNetTotal")).longValue() == 140000;
        var quoteSnapshot = CommerceMeasurement.snapshot(List.of(row), quote, 20000, null, null, "currentPricing");
        assert !quoteSnapshot.containsKey("transactionId") && !quoteSnapshot.containsKey("paymentMethod");

        var next = new LinkedHashMap<String,Object>(row); next.put("quantity",5);
        var mutation = CommerceMeasurement.mutation(List.of(row),next,"cart-set",(String)row.get("productId"));
        var change = (Map<?,?>)((List<?>)mutation.get("changes")).getFirst();
        assert ((Number)change.get("previousQuantity")).longValue() == 3;
        assert ((Number)change.get("newQuantity")).longValue() == 5;
        assert !mutation.toString().contains("DO_NOT_COPY");
        var deleted = CommerceMeasurement.mutation(List.of(row),Map.of("ok",true),"cart-set",(String)row.get("productId"));
        assert ((Number)((Map<?,?>)((List<?>)deleted.get("changes")).getFirst()).get("newQuantity")).longValue() == 0;
        var noop = CommerceMeasurement.mutation(List.of(row),row,"cart-set",(String)row.get("productId"));
        assert ((List<?>)noop.get("changes")).isEmpty();

        var removed = new LinkedHashMap<String,Object>(row); removed.put("productId", "removed");
        var added = new LinkedHashMap<String,Object>(row); added.put("productId", "added"); added.put("quantity", 1);
        var repriced = new LinkedHashMap<String,Object>(next); repriced.put("currentPrice", 60000);
        repriced.put("currentPricing", Map.of("source", "SCHEDULE"));
        var replaced = CommerceMeasurement.replacement(List.of(row, removed), List.of(repriced, added));
        var deltas = (List<?>)replaced.get("changes");
        assert deltas.size() == 3;
        var increased = (Map<?,?>)deltas.get(0);
        assert ((Number)increased.get("previousQuantity")).longValue() == 3;
        assert ((Number)increased.get("newQuantity")).longValue() == 5;
        assert ((Number)increased.get("effectiveUnitPrice")).longValue() == 60000;
        assert increased.get("priceSource").equals("SCHEDULE");
        assert ((Number)((Map<?,?>)deltas.get(1)).get("previousQuantity")).longValue() == 0;
        assert ((Number)((Map<?,?>)deltas.get(2)).get("newQuantity")).longValue() == 0;
        assert !replaced.toString().contains("DO_NOT_COPY");
        assert ((List<?>)CommerceMeasurement.replacement(List.of(row), List.of(row)).get("changes")).isEmpty();

        var floorQuote = DiscountService.calculate(List.of(new DiscountService.Line("a",50000,3,true,50000)),List.of(offer));
        assert floorQuote.discountAmount() == 0;
        var nonBase = DiscountService.calculate(List.of(new DiscountService.Line("a",45000,3,false,40000)),List.of(offer));
        assert nonBase.discountAmount() == 0;
        System.out.println("PASS: safe quote/order snapshots, deltas, deletion/noop, floor and non-BASE discount isolation");
    }
}
