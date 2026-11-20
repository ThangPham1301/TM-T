package vn.goihue;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class CommerceApi {
    final PlatformApi app;
    final JdbcTemplate db;
    final CatalogService catalog;
    final DiscountService discounts;
    final PricingService pricing;
    final com.fasterxml.jackson.databind.ObjectMapper json;
    public CommerceApi(PlatformApi app,JdbcTemplate db,CatalogService catalog,DiscountService discounts,PricingService pricing,com.fasterxml.jackson.databind.ObjectMapper json){this.app=app;this.db=db;this.catalog=catalog;this.discounts=discounts;this.pricing=pricing;this.json=json;}
    @Value("${APP_BANK_BIN:970422}") String bankBin;
    @Value("${APP_BANK_ACCOUNT:012345678901}") String bankAccount;
    @Value("${APP_BANK_NAME:GOI HUE}") String bankName;
    @Value("${APP_PAYMENT_TTL_MINUTES:15}") long paymentTtlMinutes;

    @PostConstruct void seed() throws Exception {
        if(db.queryForObject("SELECT count(*) FROM records WHERE kind='system' AND data->>'code'='catalog-initialized'",Integer.class)>0)return;
        Map<String,String> images;
        try(var stream=new org.springframework.core.io.ClassPathResource("catalog-images.json").getInputStream()){images=json.readValue(stream,new com.fasterxml.jackson.core.type.TypeReference<Map<String,String>>(){});}
        String[][] initial={
            {"me-xung-deo-ngu-thien","Mè Xửng Dẻo Ngự Thiện","me-xung-keo-hue","85000","Hộp 250g · Mè rang thơm, vị ngọt thanh."},
            {"me-xung-gion","Mè Xửng Giòn Cố Đô","me-xung-keo-hue","65000","Hộp 200g · Giòn nhẹ, thích hợp thưởng trà."},
            {"banh-ngu-sac-cung-dinh","Bánh Ngũ Sắc Cung Đình","banh-cung-dinh","120000","Hộp 12 bánh · Tuyển chọn hương vị xứ Huế."},
            {"banh-dau-xanh-trai-cay","Bánh Đậu Xanh Trái Cây","banh-cung-dinh","120000","Hộp 12 cái · Tạo hình trái cây truyền thống."},
            {"tra-sen-tinh-tam","Trà Sen Tịnh Tâm","tra-cung-dinh","380000","Hộp 100g · Hương sen dịu nhẹ."},
            {"bo-qua-hoang-trieu","Hộp Quà Cố Đô Ngự Thiện","qua-bieu","450000","Hộp quà 500g · Phối hợp bánh mứt và trà."}
        };
        for(var row:initial){UUID id=UUID.nameUUIDFromBytes(row[0].getBytes(java.nio.charset.StandardCharsets.UTF_8));if(db.queryForObject("SELECT count(*) FROM records WHERE id=?",Integer.class,id)>0)continue;var p=new LinkedHashMap<String,Object>();p.put("id",id.toString());p.put("slug",row[0]);p.put("name",row[1]);p.put("category",row[2]);p.put("price",Integer.parseInt(row[3]));p.put("description",row[4]);p.put("stock",0);p.put("active",true);p.put("image",images.getOrDefault(row[0],"/images/product-placeholder.svg"));p.put("createdAt",Instant.now().toString());p.put("revision",1);app.save("product",null,p);}
        app.save("system",null,new LinkedHashMap<>(Map.of("id","00000000-0000-4000-8000-000000000601","code","catalog-initialized")));
    }
    Map<String,Object> product(String id){return catalog.get(id,"product");}
    @GetMapping("/products") public Object products() {
        var book = pricing.book(Instant.now());
        var products = catalog.publicProducts();
        products.forEach(product -> pricing.publish(product, pricing.resolve(product, book)));
        return products;
    }

    @GetMapping("/pricing") public Object pricingFeed() {
        var book = pricing.book(Instant.now());
        var prices = new LinkedHashMap<String, PricingService.Price>();
        for (var product : catalog.publicProducts()) {
            prices.put(app.str(product, "id"), pricing.resolve(product, book));
        }
        var response = new LinkedHashMap<String, Object>();
        response.put("asOf", book.asOf());
        response.put("nextChangeAt", book.nextChangeAt());
        response.put("prices", prices);
        return response;
    }

    @GetMapping("/admin/pricing") public Object pricingRules(HttpServletRequest req) {
        app.permission(app.actor(req), "pricing.manage");
        return pricing.rules();
    }
    @GetMapping("/products/{slug}") public Object detail(@PathVariable String slug){var rows=db.query("SELECT data::text FROM records WHERE kind='product' AND data->>'slug'=?",(r,i)->app.decode(r.getString(1)),slug);if(rows.isEmpty()||!catalog.visible(rows.getFirst()))throw new PlatformApi.Problem(404,"Không tìm thấy sản phẩm.");var product=rows.getFirst();pricing.publish(product,pricing.resolve(product,pricing.book(Instant.now())));return product;}
    @GetMapping("/admin/products") public Object adminProducts(HttpServletRequest req){var a=app.actor(req);app.permission(a,"catalog.manage");return app.list("product",a);}

    @GetMapping("/discounts") public Object publicDiscounts() {
        return discounts.publicFeed();
    }

    @GetMapping("/admin/discounts") public Object adminDiscounts(HttpServletRequest req) {
        var actor = app.actor(req);
        app.permission(actor, "discount.manage");
        return app.list("discount", actor);
    }

    List<Map<String,Object>> cartOf(UUID uid){return db.query("SELECT data::text FROM records WHERE kind='cart' AND owner_id=? ORDER BY id",(r,i)->app.decode(r.getString(1)),uid);}
    String cartToken(UUID uid){return app.hash(app.encode(cartOf(uid)));}
    void checkCart(UUID uid,Map<String,Object> b){if(!cartToken(uid).equals(app.text(b,"cartToken",100)))throw new PlatformApi.Problem(409,"Giỏ hàng đã thay đổi. Hãy tải lại trước khi tiếp tục.");}
    List<Map<String,Object>> cartView(UUID uid, PricingService.Book book) {
        var rows = cartOf(uid);
        for (var line : rows) {
            var p = product(app.str(line, "productId"));
            var price = pricing.resolve(p, book);
            line.put("currentPrice", price.amount());
            line.put("currentPricing", price);
            line.put("stock", p.get("stock"));
            line.put("available", catalog.visible(p));
            line.put("priceChanged", priceChanged(line, price));
            line.put("name", p.get("name"));
            line.put("image", p.get("image"));
        }
        return rows;
    }

    private boolean priceChanged(Map<String, Object> line, PricingService.Price current) {
        String previous = line.get("pricing") instanceof Map<?, ?> snapshot
                ? Objects.toString(snapshot.get("source"), "BASE") : "BASE";
        return app.number(line, "price") != current.amount() || !previous.equals(current.source());
    }

    private String priceToken(List<Map<String, Object>> rows) {
        return app.hash(app.encode(rows.stream().map(line -> {
            var price = (PricingService.Price) line.get("currentPricing");
            return List.of(app.str(line, "productId"), price.amount(), price.source());
        }).toList()));
    }

    @GetMapping("/cart") public Object cart(HttpServletRequest req){var a=app.actor(req);app.permission(a,"cart.manage");return cartView((UUID)a.get("id"),pricing.book(Instant.now()));}
    @GetMapping("/cart/summary")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Object summary(HttpServletRequest req){
        var actor = app.actor(req);
        app.permission(actor, "cart.manage");
        UUID uid = (UUID) actor.get("id");
        Instant now = Instant.now();
        var book = pricing.book(now);
        var rows = cartView(uid, book);
        boolean blocked = rows.stream().anyMatch(row -> !Boolean.TRUE.equals(row.get("available"))
                || app.number(row, "quantity") > app.number(row, "stock"));
        var quote = quote(rows, blocked ? List.of() : discounts.activeOffers(now), "currentPricing");
        var shipping = catalog.shipping();
        int fee = catalog.shippingFee(quote.netSubtotal());
        var result = quote.breakdown();
        result.put("items", rows);
        result.put("cartToken", cartToken(uid));
        result.put("priceToken", priceToken(rows));
        result.put("nextPriceChangeAt", book.nextChangeAt());
        result.put("pricedAt", now);
        result.put("quoteToken", quoteToken(quote));
        result.put("shippingFee", fee);
        result.put("total", quote.netSubtotal() + fee);
        result.put("shipping", shipping);
        if (quote.offerHint() != null) result.put("offerHint", quote.offerHint());
        return result;
    }

    DiscountService.Quote quote(List<Map<String, Object>> rows, List<DiscountService.Offer> offers, String field) {
        return DiscountService.calculate(rows.stream().map(row -> {
            var price = (PricingService.Price) row.get(field);
            return new DiscountService.Line(app.str(row, "productId"), price.amount(),
                    app.number(row, "quantity"), price.discountEligible(), price.floor());
        }).toList(), offers);
    }

    String quoteToken(DiscountService.Quote quote) {
        var offer = quote.discount();
        return app.hash(app.encode(List.of(quote.subtotal(), quote.discountAmount(),
                offer == null ? "" : offer.id(), offer == null ? 0 : offer.revision())));
    }
    Map<String,Object> cartSnapshot(Map<String,Object> p,PricingService.Price price,int qty,UUID id,int revision){var line=new LinkedHashMap<String,Object>();line.put("id",id.toString());line.put("productId",p.get("id"));line.put("name",p.get("name"));line.put("price",price.amount());line.put("pricing",price);line.put("quantity",qty);line.put("image",p.get("image"));line.put("revision",revision);line.put("version",UUID.randomUUID().toString());return line;}

    @PostMapping("/commerce") @Transactional @SuppressWarnings("unchecked")
    public Object mutate(@RequestBody Map<String,Object> b,@RequestHeader("Idempotency-Key") String key,HttpServletRequest req){
        app.origin(req);app.lock();var a=app.actor(req);UUID uid=(UUID)a.get("id");app.require(key.matches("[a-zA-Z0-9-]{16,80}"),"Khóa gửi lặp không hợp lệ.");String fingerprint=app.hash(app.encode(new TreeMap<>(b)));var previous=db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?",uid,key);
        if(!previous.isEmpty()){if(!previous.getFirst().get("fingerprint").equals(fingerprint))throw new PlatformApi.Problem(409,"Khóa đã dùng cho thao tác khác.");return app.decode((String)previous.getFirst().get("result"));}
        String action=app.text(b,"action",50);Map<String,Object> result;
        switch(action){
            case "pricing-save", "pricing-toggle", "pricing-floor" -> result = pricing.mutate(a, b);
            case "discount-save", "discount-toggle" -> result = discounts.mutate(a, b);
            case "product-save" -> result=catalog.saveProduct(a,b);
            case "category-save","category-delete","product-delete","catalog-toggle","shipping-save","catalog-image-intent" -> result=catalog.mutation(a,b);
            case "cart-set" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);var p=product(app.text(b,"productId",50));int qty=app.number(b,"quantity");app.require(qty>=0&&qty<=100,"Số lượng từ 0 đến 100.");if(qty>0)app.require(catalog.visible(p)&&qty<=app.number(p,"stock"),"Sản phẩm không đủ tồn hoặc đã ngừng bán.");
                UUID id = UUID.nameUUIDFromBytes((uid + ":" + app.str(p,"id")).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                if (qty == 0) {
                    db.update("DELETE FROM records WHERE id=? AND owner_id=?", id, uid);
                    result = Map.of("ok", true);
                } else {
                    var existing = cartOf(uid).stream().filter(line -> app.str(line, "id").equals(id.toString())).findFirst();
                    var price = pricing.resolve(p, pricing.book(Instant.now()));
                    boolean hasExpectedPrice = b.containsKey("expectedUnitPrice");
                    if (hasExpectedPrice && (price.amount() != app.number(b, "expectedUnitPrice")
                            || !price.source().equals(app.str(b, "expectedPriceSource"))))
                        throw new PlatformApi.Problem(409, "Giá vừa thay đổi. Xem mức giá mới trước khi thêm vào giỏ.");
                    if (existing.isPresent() && !hasExpectedPrice) {
                        var line = existing.get();
                        line.put("quantity", qty);
                        line.put("version", UUID.randomUUID().toString());
                        line.put("revision", app.number(line, "revision") + 1);
                        result = app.save("cart", uid, line);
                    } else {
                        int revision = existing.map(line -> app.number(line, "revision") + 1).orElse(1);
                        result = app.save("cart", uid, cartSnapshot(p, price, qty, id, revision));
                    }
                }
            }
            case "cart-clear","cart-refresh" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);
                if(action.equals("cart-clear"))db.update("DELETE FROM records WHERE kind='cart' AND owner_id=?",uid);
                else {
                    var rows = cartView(uid, pricing.book(Instant.now()));
                    String submitted = app.str(b, "priceToken");
                    if (!submitted.isEmpty() && !submitted.equals(priceToken(rows)))
                        throw new PlatformApi.Problem(409, "Giá lại thay đổi. Kiểm tra và xác nhận mức giá mới.");
                    for (var line : rows) {
                        line.put("price", line.get("currentPrice"));
                        line.put("pricing", line.get("currentPricing"));
                        for (String field : List.of("currentPrice", "currentPricing", "stock", "available", "priceChanged"))
                            line.remove(field);
                        line.put("revision", app.number(line, "revision") + 1);
                        line.put("version", UUID.randomUUID().toString());
                        app.save("cart", uid, line);
                    }
                }
                result=Map.of("ok",true);
            }
            case "checkout" -> {
                app.permission(a, "order.create");
                checkCart(uid, b);
                var shipping = catalog.shipping();
                String pauseMessage = app.str(shipping, "pauseMessage");
                app.require(Boolean.TRUE.equals(shipping.get("enabled")),
                        pauseMessage.isEmpty() ? "Cửa hàng đang tạm ngừng nhận đơn." : pauseMessage);
                catalog.revision(shipping, Map.of("revision", app.number(b, "shippingRevision")));

                Instant now = Instant.now();
                var book = pricing.book(now);
                var cart = cartOf(uid);
                app.require(!cart.isEmpty(), "Giỏ hàng đang trống.");
                var items = new ArrayList<Map<String, Object>>();
                var products = new LinkedHashMap<String, Map<String, Object>>();
                for (var line : cart) {
                    String productId = app.str(line, "productId");
                    var p = product(productId);
                    int quantity = app.number(line, "quantity");
                    app.require(catalog.visible(p) && app.number(p, "stock") >= quantity,
                            "Sản phẩm không đủ tồn hoặc đã ngừng bán: " + app.str(p, "name"));
                    var price = pricing.resolve(p, book);
                    if (priceChanged(line, price))
                        throw new PlatformApi.Problem(409, "Giá bán đã thay đổi. Kiểm tra và xác nhận tổng tiền mới.");
                    var item = new LinkedHashMap<String, Object>();
                    item.put("productId", productId);
                    item.put("name", p.get("name"));
                    item.put("slug", p.get("slug"));
                    item.put("image", p.get("image"));
                    item.put("quantity", quantity);
                    item.put("price", price.amount());
                    item.put("pricing", price);
                    items.add(item);
                    products.put(productId, p);
                }
                var quote = quote(items, discounts.activeOffers(now), "pricing");
                String submittedQuote = app.str(b, "quoteToken");
                if (!(submittedQuote.isEmpty() && quote.discountAmount() == 0) && !quoteToken(quote).equals(submittedQuote))
                    throw new PlatformApi.Problem(409, "Ưu đãi trong giỏ đã thay đổi. Kiểm tra tổng tiền mới trước khi xác nhận.");
                app.require(quote.subtotal() <= 100_000_000, "Đơn vượt hạn mức 100 triệu đồng.");

                for (var item : items) {
                    String productId = app.str(item, "productId");
                    long reduction = quote.lineDiscounts().getOrDefault(productId, 0L);
                    int quantity = app.number(item, "quantity");
                    if (reduction > 0) {
                        item.put("discountAmount", reduction);
                        item.put("netTotal", (long) app.number(item, "price") * quantity - reduction);
                    }
                    var p = products.get(productId);
                    p.put("stock", app.number(p, "stock") - quantity);
                    p.put("revision", app.number(p, "revision") + 1);
                    app.save("product", null, p);
                }
                int fee = catalog.shippingFee(quote.netSubtotal());
                long total = quote.netSubtotal() + fee;
                var order = quote.breakdown();
                String number = "GH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                order.put("number", number);
                order.put("items", items);
                order.put("shippingFee", fee);
                order.put("shippingRevision", shipping.get("revision"));
                order.put("total", total);
                order.put("status", "PLACED");
                String method = app.str(b, "paymentMethod");
                if (method.isEmpty()) method = "COD";
                app.require(Set.of("COD", "VIETQR").contains(method), "Phương thức thanh toán không được hỗ trợ.");
                order.put("paymentMethod", method);
                order.put("paymentStatus", "UNPAID");
                recipient(order, app.str(b, "addressId").isEmpty() ? b : app.record(app.str(b, "addressId"), "address", a));
                String firstNote = "Đã tiếp nhận đơn hàng, thanh toán khi nhận hàng";
                if (method.equals("VIETQR")) {
                    var payment = new LinkedHashMap<String, Object>();
                    payment.put("method", "VIETQR");
                    payment.put("amount", total);
                    payment.put("content", number);
                    payment.put("bankBin", bankBin);
                    payment.put("bankAccount", bankAccount);
                    payment.put("bankName", bankName);
                    payment.put("payload", VietQr.payload(bankBin, bankAccount, bankName, total, number));
                    payment.put("status", "PENDING");
                    payment.put("expiresAt", now.plusSeconds(paymentTtlMinutes * 60L).toString());
                    order.put("payment", payment);
                    firstNote = "Đã tiếp nhận đơn hàng, chờ thanh toán VietQR trong " + paymentTtlMinutes + " phút.";
                }
                order.put("history", new ArrayList<>(List.of(Map.of("at", now.toString(), "status", "PLACED", "note", firstNote))));
                result = app.save("order", uid, order);
                db.update("DELETE FROM records WHERE owner_id=? AND kind='cart'", uid);
            }
            case "order-cancel","order-status","order-paid","order-recipient","payment-resolve" -> {
                var order=app.record(app.text(b,"id",50),"order",a);catalog.revision(order,b);String status=app.str(order,"status"),note=app.text(b,"note",2000);
                var payment = VietQrPayment.details(order);
                VietQrPayment.normalizeLegacyExtra(order, payment);
                String paymentStatus = app.str(order, "paymentStatus");
                if(action.equals("order-cancel")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Đơn không còn cho phép hủy trực tiếp.");
                    app.require(!Set.of("PAID", "REVIEW").contains(paymentStatus),
                            "Đơn đã thu tiền hoặc đang đối soát. Vui lòng liên hệ hỗ trợ để xử lý.");
                    releaseOrderStock(order);
                    order.put("status","CANCELLED");
                    order.put("pricingClosedAt", Instant.now().toString());
                }else if(action.equals("order-recipient")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Chỉ sửa thông tin nhận trước khi đóng gói.");recipient(order,b);
                }else{
                    app.permission(a,"order.manage");
                    if (action.equals("payment-resolve")) {
                        resolveVietQr(order, payment, b, note);
                    } else if (action.equals("order-paid")) {
                        app.require(CodPayment.isCod(order) && status.equals("DELIVERED"),
                                "Chỉ bổ sung chứng từ thu COD cho đơn đã giao. Đơn đang giao dùng thao tác xác nhận giao.");
                        boolean adjusting = Boolean.TRUE.equals(db.queryForObject("""
                                SELECT EXISTS (SELECT 1 FROM records WHERE kind='return'
                                  AND data->>'orderId'=? AND data->>'resolution'='ADJUST_DUE'
                                  AND data->>'status' NOT IN ('RESOLVED', 'REJECTED', 'WITHDRAWN'))
                                """, Boolean.class, app.str(order, "id")));
                        app.require(!adjusting, "Hãy hoàn tất hồ sơ điều chỉnh khoản phải thu trước khi ghi nhận COD.");
                        CodPayment.recordCollection(app, order, b, Instant.now().toString());
                    } else {
                        String next = app.text(b, "status", 40);
                        var transitions = Map.of("PLACED", Set.of("CONFIRMED"), "CONFIRMED", Set.of("PACKED"),
                                "PACKED", Set.of("SHIPPED"), "SHIPPED", Set.of("DELIVERED", "DELIVERY_FAILED"),
                                "DELIVERY_FAILED", Set.of("SHIPPED", "RETURNED"));
                        app.require(transitions.getOrDefault(status, Set.of()).contains(next), "Chuyển trạng thái đơn không hợp lệ.");
                        app.require(VietQrPayment.canFulfill(order, next), "Cần xác nhận thanh toán VietQR trước khi đóng gói hoặc giao hàng.");
                        if (next.equals("SHIPPED")) order.put("trackingReference", app.text(b, "reference", 200));
                        if (next.equals("DELIVERED")) {
                            String now = Instant.now().toString();
                            if (CodPayment.isCod(order) && !paymentStatus.equals("PAID")) {
                                CodPayment.recordCollection(app, order, b, now);
                            }
                            order.put("deliveredAt", now);
                        }
                        if (next.equals("DELIVERY_FAILED")) order.put("deliveryFailedAt", Instant.now().toString());
                        if (next.equals("RETURNED")) {
                            app.require(!paymentStatus.equals("PAID"), "Đơn đã thu tiền cần xử lý qua đổi/trả và hoàn tiền.");
                            releaseOrderStock(order);
                            order.put("returnedAt", Instant.now().toString());
                        }
                        if (next.equals("CONFIRMED")) order.put("confirmedAt", Instant.now().toString());
                        if (next.equals("RETURNED")) order.put("pricingClosedAt", Instant.now().toString());
                        order.put("status", next);
                    }
                }
                ((List<Object>)order.get("history")).add(Map.of("at",Instant.now().toString(),"status",app.str(order,"status"),"note",note,"action",action));order.put("revision",app.number(order,"revision")+1);result=app.save("order",app.owner(app.str(order,"id")),order);
            }
            default -> throw new PlatformApi.Problem(422,"Thao tác không được hỗ trợ.");
        }
        app.audit(a,app.str(result,"id"),action);db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)",uid,key,fingerprint,app.encode(result));return result;
    }

    private void resolveVietQr(Map<String, Object> order, Map<String, Object> payment,
                               Map<String, Object> input, String note) {
        app.require(VietQrPayment.isVietQr(order) && payment != null, "Đơn không dùng VietQR.");
        String resolution = app.text(input, "resolution", 30);
        String reference = app.text(input, "reference", 200);
        String now = Instant.now().toString();
        if (resolution.equals("EXTRA_REFUNDED")) {
            String transactionId = app.text(input, "transactionId", 100);
            var extra = VietQrPayment.extras(payment).stream()
                    .filter(receipt -> transactionId.equals(receipt.get("transactionId")) && "REVIEW".equals(receipt.get("status")))
                    .findFirst()
                    .orElseThrow(() -> new PlatformApi.Problem(422, "Giao dịch bổ sung không còn chờ đối soát."));
            extra.put("status", "REFUNDED");
            extra.put("refundReference", reference);
            extra.put("refundedAt", now);
            extra.put("note", note);
            return;
        }

        app.require("REVIEW".equals(order.get("paymentStatus")), "Đơn không ở trạng thái đối soát thanh toán.");
        if (resolution.equals("PAID_RECORDED")) {
            app.require(VietQrPayment.canRecordPrimaryPayment(order, payment),
                    "Khoản tiền sai số tiền, đến muộn hoặc đơn đã đóng chỉ được ghi nhận hoàn.");
            order.put("paymentStatus", "PAID");
            payment.put("status", "RESOLVED_PAID");
            payment.put("paidAt", now);
            order.put("paidAt", now);
        } else if (resolution.equals("REFUNDED")) {
            order.put("paymentStatus", "REFUNDED");
            payment.put("status", "REFUNDED");
            payment.put("refundedAt", now);
            if (Set.of("PLACED", "CONFIRMED", "PACKED").contains(order.get("status"))) {
                releaseOrderStock(order);
                order.put("status", "CANCELLED");
                order.put("pricingClosedAt", now);
            }
        } else {
            throw new PlatformApi.Problem(422, "Cách xử lý đối soát không hợp lệ.");
        }
        order.put("paymentReference", reference);
    }

    @SuppressWarnings("unchecked")
    private void releaseOrderStock(Map<String, Object> order) {
        for (var line : (List<Map<String, Object>>) order.get("items")) {
            var product = product(app.str(line, "productId"));
            product.put("stock", app.number(product, "stock") + app.number(line, "quantity"));
            product.put("revision", app.number(product, "revision") + 1);
            app.save("product", null, product);
        }
    }
    void recipient(Map<String,Object> order,Map<String,Object> b){order.put("recipient",app.text(b,"recipient",100));String phone=app.text(b,"phone",30);app.require(phone.matches("[+0-9() .-]{8,30}"),"Số điện thoại không hợp lệ.");order.put("phone",phone);order.put("address",app.text(b,"address",400));}
    @ExceptionHandler(Exception.class) public org.springframework.http.ResponseEntity<?> error(Exception e){return app.error(e);}
}
