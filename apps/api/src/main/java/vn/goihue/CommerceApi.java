package vn.goihue;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
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
    final com.fasterxml.jackson.databind.ObjectMapper json;
    final FulfillmentService fulfillment;
    public CommerceApi(PlatformApi app, JdbcTemplate db, CatalogService catalog,
                       com.fasterxml.jackson.databind.ObjectMapper json, FulfillmentService fulfillment) {
        this.app = app;
        this.db = db;
        this.catalog = catalog;
        this.json = json;
        this.fulfillment = fulfillment;
    }
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
    @GetMapping("/products") public Object products(){return db.query("SELECT r.data::text FROM records r WHERE kind='product' AND data->>'active'='true' AND EXISTS(SELECT 1 FROM records c WHERE c.kind='category' AND c.data->>'code'=r.data->>'category' AND c.data->>'active'='true') ORDER BY created_at",(r,i)->app.decode(r.getString(1))).stream().map(catalog::withAvailableStock).toList();}
    @GetMapping("/products/{slug}") public Object detail(@PathVariable String slug){var rows=db.query("SELECT data::text FROM records WHERE kind='product' AND data->>'slug'=?",(r,i)->app.decode(r.getString(1)),slug);if(rows.isEmpty()||!catalog.visible(rows.getFirst()))throw new PlatformApi.Problem(404,"Không tìm thấy sản phẩm.");return catalog.withAvailableStock(rows.getFirst());}
    @GetMapping("/admin/products") public Object adminProducts(HttpServletRequest req){var a=app.actor(req);app.permission(a,"catalog.manage");return app.list("product",a).stream().map(catalog::withAvailableStock).toList();}

    List<Map<String,Object>> cartOf(UUID uid){return db.query("SELECT data::text FROM records WHERE kind='cart' AND owner_id=? ORDER BY id",(r,i)->app.decode(r.getString(1)),uid);}
    String cartToken(UUID uid){return app.hash(app.encode(cartOf(uid)));}
    void checkCart(UUID uid,Map<String,Object> b){if(!cartToken(uid).equals(app.text(b,"cartToken",100)))throw new PlatformApi.Problem(409,"Giỏ hàng đã thay đổi. Hãy tải lại trước khi tiếp tục.");}
    List<Map<String,Object>> cartView(UUID uid){
        var rows=cartOf(uid);
        for(var line:rows){var p=product(app.str(line,"productId"));line.put("currentPrice",p.get("price"));line.put("stock",catalog.stock(p));line.put("available",catalog.visible(p));line.put("priceChanged",app.number(line,"price")!=app.number(p,"price"));line.put("name",p.get("name"));line.put("image",p.get("image"));}
        return rows;
    }
    @GetMapping("/cart") public Object cart(HttpServletRequest req){var a=app.actor(req);app.permission(a,"cart.manage");return cartView((UUID)a.get("id"));}
    @GetMapping("/cart/summary") @Transactional public Object summary(HttpServletRequest req){
        app.lock();var a=app.actor(req);app.permission(a,"cart.manage");UUID uid=(UUID)a.get("id");var rows=cartView(uid);long subtotal=rows.stream().mapToLong(l->(long)app.number(l,"price")*app.number(l,"quantity")).sum();var shipping=catalog.shipping();int fee=catalog.shippingFee(subtotal);
        return Map.of("items",rows,"cartToken",cartToken(uid),"subtotal",subtotal,"shippingFee",fee,"total",subtotal+fee,"shipping",shipping);
    }
    Map<String,Object> cartSnapshot(Map<String,Object> p,int qty,UUID id,int revision){var line=new LinkedHashMap<String,Object>();line.put("id",id.toString());line.put("productId",p.get("id"));line.put("name",p.get("name"));line.put("price",p.get("price"));line.put("quantity",qty);line.put("image",p.get("image"));line.put("revision",revision);line.put("version",UUID.randomUUID().toString());return line;}

    @SuppressWarnings("unchecked")
    void restoreExpiredCart(UUID owner, Map<String, Object> order) {
        var existing = new HashSet<String>();
        for (var line : cartOf(owner)) existing.add(app.str(line, "productId"));
        for (var item : (List<Map<String, Object>>) order.get("items")) {
            String productId = app.str(item, "productId");
            if (!existing.add(productId)) continue;
            var id = UUID.nameUUIDFromBytes((owner + ":" + productId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            var line = cartSnapshot(product(productId), app.number(item, "quantity"), id, 1);
            line.put("price", item.get("price"));
            app.save("cart", owner, line);
        }
    }

    @PostMapping("/commerce") @Transactional @SuppressWarnings("unchecked")
    public Object mutate(@RequestBody Map<String,Object> b,@RequestHeader("Idempotency-Key") String key,HttpServletRequest req){
        app.origin(req);app.lock();var a=app.actor(req);UUID uid=(UUID)a.get("id");app.require(key.matches("[a-zA-Z0-9-]{16,80}"),"Khóa gửi lặp không hợp lệ.");String fingerprint=app.hash(app.encode(new TreeMap<>(b)));var previous=db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?",uid,key);
        if(!previous.isEmpty()){if(!previous.getFirst().get("fingerprint").equals(fingerprint))throw new PlatformApi.Problem(409,"Khóa đã dùng cho thao tác khác.");return app.decode((String)previous.getFirst().get("result"));}
        String action=app.text(b,"action",50);Map<String,Object> result;
        switch(action){
            case "product-save" -> result=catalog.saveProduct(a,b);
            case "inventory-lot-add" -> result=catalog.addLot(a,b);
            case "category-save","category-delete","product-delete","catalog-toggle","shipping-save","catalog-image-intent" -> result=catalog.mutation(a,b);
            case "cart-set" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);var p=product(app.text(b,"productId",50));int qty=app.number(b,"quantity");app.require(qty>=0&&qty<=100,"Số lượng từ 0 đến 100.");if(qty>0)app.require(catalog.visible(p)&&qty<=catalog.stock(p),"Sản phẩm không đủ tồn hoặc đã ngừng bán.");
                UUID id=UUID.nameUUIDFromBytes((uid+":"+app.str(p,"id")).getBytes(java.nio.charset.StandardCharsets.UTF_8));if(qty==0){db.update("DELETE FROM records WHERE id=? AND owner_id=?",id,uid);result=Map.of("ok",true);}else{var old=cartOf(uid).stream().filter(l->app.str(l,"id").equals(id.toString())).findFirst();int revision=old.isPresent()?app.number(old.get(),"revision")+1:1;result=app.save("cart",uid,cartSnapshot(p,qty,id,revision));}
            }
            case "cart-clear","cart-refresh" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);
                if(action.equals("cart-clear"))db.update("DELETE FROM records WHERE kind='cart' AND owner_id=?",uid);
                else for(var line:cartOf(uid)){var p=product(app.str(line,"productId"));app.save("cart",uid,cartSnapshot(p,app.number(line,"quantity"),app.uuid(app.str(line,"id")),app.number(line,"revision")+1));}
                result=Map.of("ok",true);
            }
            case "cart-reorder" -> {
                app.permission(a, "cart.manage");
                checkCart(uid, b);
                var order = app.record(app.text(b, "id", 50), "order", a);
                var items = (List<Map<String, Object>>) order.get("items");
                app.require(!items.isEmpty(), "Đơn hàng không có sản phẩm.");
                var replacement = new ArrayList<Map<String, Object>>();
                for (var item : items) {
                    var product = product(app.str(item, "productId"));
                    int quantity = app.number(item, "quantity");
                    app.require(quantity > 0 && quantity <= 100 && catalog.visible(product)
                            && quantity <= catalog.stock(product),
                            "Sản phẩm không đủ tồn hoặc đã ngừng bán: " + app.str(product, "name"));
                    var id = UUID.nameUUIDFromBytes((uid + ":" + app.str(product, "id"))
                            .getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    replacement.add(cartSnapshot(product, quantity, id, 1));
                }
                db.update("DELETE FROM records WHERE owner_id=? AND kind='cart'", uid);
                for (var line : replacement) app.save("cart", uid, line);
                result = Map.of("ok", true);
            }
            case "checkout" -> {
                app.permission(a,"order.create");checkCart(uid,b);var shipping=catalog.shipping();app.require(Boolean.TRUE.equals(shipping.get("enabled")),"Cửa hàng đang tạm ngừng nhận đơn.");catalog.revision(shipping,Map.of("revision",app.number(b,"shippingRevision")));
                var cart=cartOf(uid);app.require(!cart.isEmpty(),"Giỏ hàng đang trống.");var items=new ArrayList<Map<String,Object>>();long subtotal=0;
                for(var line:cart){var p=product(app.str(line,"productId"));int qty=app.number(line,"quantity");app.require(catalog.visible(p)&&catalog.stock(p)>=qty,"Sản phẩm không đủ tồn hoặc đã ngừng bán: "+app.str(p,"name"));app.require(app.number(p,"price")==app.number(line,"price"),"Giá đã thay đổi. Cập nhật giỏ hàng trước khi đặt.");subtotal+=(long)app.number(p,"price")*qty;var item=new LinkedHashMap<String,Object>();item.put("productId",p.get("id"));item.put("name",p.get("name"));item.put("slug",p.get("slug"));item.put("image",p.get("image"));item.put("quantity",qty);item.put("price",p.get("price"));catalog.reserveProduct(p,qty,item);items.add(item);}
                app.require(subtotal<=100_000_000,"Đơn vượt hạn mức 100 triệu đồng.");int fee=catalog.shippingFee(subtotal);var order=new LinkedHashMap<String,Object>();order.put("number","GH-"+UUID.randomUUID().toString().substring(0,8).toUpperCase());order.put("items",items);order.put("subtotal",subtotal);order.put("shippingFee",fee);order.put("shippingRevision",shipping.get("revision"));order.put("total",subtotal+fee);order.put("status","PLACED");String method=app.str(b,"paymentMethod");if(method.isEmpty())method="COD";app.require(Set.of("COD","VIETQR").contains(method),"Phương thức thanh toán không được hỗ trợ.");order.put("paymentMethod",method);order.put("paymentStatus","UNPAID");recipient(order,app.str(b,"addressId").isEmpty()?b:app.record(app.str(b,"addressId"),"address",a));String firstNote;
                if(method.equals("VIETQR")){var payment=new LinkedHashMap<String,Object>();long total=subtotal+fee;payment.put("method","VIETQR");payment.put("amount",total);payment.put("content",app.str(order,"number"));payment.put("bankBin",bankBin);payment.put("bankAccount",bankAccount);payment.put("bankName",bankName);payment.put("payload",VietQr.payload(bankBin,bankAccount,bankName,total,app.str(order,"number")));payment.put("status","PENDING");payment.put("expiresAt",Instant.now().plusSeconds(paymentTtlMinutes*60L).toString());order.put("payment",payment);firstNote="Đã tiếp nhận đơn hàng, chờ thanh toán VietQR trong "+paymentTtlMinutes+" phút.";} else {
                    order.put("codConfirmBy", Instant.now().plus(java.time.Duration.ofHours(24)).toString());
                    firstNote = "Vui lòng xác nhận đơn COD trong vòng 24 giờ.";
                }
                order.put("fulfillmentQcRequired", true);
                order.put("packingSopRequired", true);
                order.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","PLACED","note",firstNote))));result=app.save("order",uid,order);db.update("DELETE FROM records WHERE owner_id=? AND kind='cart'",uid);
            }
            case "order-cancel","order-cod-confirm","order-return-qc","order-return-refund",
                 "order-pick-qc","order-repick","order-reopen-packing","order-status","order-paid","order-recipient","payment-resolve" -> {
                var order=app.record(app.text(b,"id",50),"order",a);catalog.revision(order,b);String status=app.str(order,"status"),note=app.text(b,"note",2000);
                if (action.equals("order-cod-confirm")) {
                    app.permission(a, "order.create");
                    confirmCod(order, Instant.now());
                } else if(action.equals("order-cancel")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Đơn không còn cho phép hủy trực tiếp.");app.require(!Set.of("PAID","REVIEW").contains(app.str(order,"paymentStatus")),"Cần xử lý đối soát hoặc hoàn tiền trước khi hủy đơn.");
                    catalog.releaseReservedStock(order);
                    if (order.get("payment") instanceof Map<?, ?> rawPayment) {
                        var payment = (Map<String, Object>) rawPayment;
                        if (app.str(payment, "status").equals("PENDING")) payment.put("status", "CANCELLED");
                    }
                    order.put("status","CANCELLED");
                }else if(action.equals("order-recipient")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Chỉ sửa thông tin nhận trước khi đóng gói.");recipient(order,b);
                }else{
                    app.permission(a,"order.manage");
                    if (isPendingCod(order))
                        throw new PlatformApi.Problem(409, "Đơn COD đang chờ khách xác nhận.");
                    if (action.equals("order-pick-qc")) {
                        fulfillment.recordQc(order, b, uid);
                    } else if (action.equals("order-repick")) {
                        fulfillment.repick(order);
                    } else if (action.equals("order-reopen-packing")) {
                        fulfillment.reopenPacking(order);
                    } else if (action.equals("order-return-qc")) {
                        inspectReturnedStock(order, b, uid);
                    } else if (action.equals("order-return-refund")) {
                        app.require("RETURNED".equals(status) && "PAID".equals(app.str(order,"paymentStatus")),
                                "Chỉ ghi nhận hoàn tiền cho đơn đã trả về và đã thu tiền.");
                        order.put("paymentReference", app.text(b, "reference", 200));
                        order.put("paymentStatus", "REFUNDED");
                        if (order.get("payment") instanceof Map<?, ?> rawPayment) {
                            ((Map<String, Object>) rawPayment).put("status", "REFUNDED");
                        }
                    } else if(action.equals("payment-resolve")){
                        app.require(app.str(order,"paymentStatus").equals("REVIEW"),"Đơn không ở trạng thái đối soát thanh toán.");
                        String resolution=app.text(b,"resolution",30);var payment=(Map<String,Object>)order.get("payment");
                        if (resolution.equals("REFUNDED")) {
                            order.put("paymentReference", app.text(b, "reference", 200));
                            order.put("paymentStatus", "REFUNDED");
                            if (payment != null) payment.put("status", "REFUNDED");
                            if (Set.of("PLACED", "CONFIRMED").contains(status)) {
                                catalog.releaseReservedStock(order);
                                order.put("status", "CANCELLED");
                            }
                        }
                        else if(resolution.equals("PAID_RECORDED")){app.require(!Set.of("CANCELLED", "RETURNED").contains(status),"Đơn đã hủy hoặc hoàn về; chỉ có thể xử lý hoàn tiền.");order.put("paymentStatus","PAID");if(payment!=null)payment.put("status","RESOLVED_PAID");order.put("paymentReference",app.text(b,"reference",200));order.put("paidAt",Instant.now().toString());}
                        else throw new PlatformApi.Problem(422,"Cách xử lý đối soát không hợp lệ.");
                    }
                    else if(action.equals("order-paid")){app.require(!app.str(order,"paymentMethod").equals("VIETQR"),"Thanh toán VietQR phải được xác nhận qua webhook hoặc đối soát.");app.require(!Set.of("CANCELLED","RETURNED").contains(status)&&!app.str(order,"paymentStatus").equals("PAID"),"Không thể ghi nhận thu tiền.");order.put("paymentStatus","PAID");order.put("paymentReference",app.text(b,"reference",200));order.put("paidAt",Instant.now().toString());var payment=(Map<String,Object>)order.get("payment");if(payment!=null&&app.str(payment,"status").equals("REVIEW"))payment.put("status","RESOLVED_PAID");}
                    else transitionOrder(order, b, status, uid);
                }
                if (!"CANCELLED".equals(status) && "CANCELLED".equals(app.str(order, "status")))
                    db.update("DELETE FROM packing_photos WHERE order_id = ?", app.uuid(app.str(order, "id")));
                ((List<Object>)order.get("history")).add(Map.of("at",Instant.now().toString(),"status",app.str(order,"status"),"note",note,"action",action));order.put("revision",app.number(order,"revision")+1);result=app.save("order",app.owner(app.str(order,"id")),order);
            }
            default -> throw new PlatformApi.Problem(422,"Thao tác không được hỗ trợ.");
        }
        app.audit(a,app.str(result,"id"),action);db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)",uid,key,fingerprint,app.encode(result));return result;
    }
    private void transitionOrder(Map<String, Object> order, Map<String, Object> body, String status, UUID operator) {
        String next = app.text(body, "status", 40);
        var transitions = Map.of("PLACED", Set.of("CONFIRMED"), "CONFIRMED", Set.of("PACKED"),
                "PACKED", Set.of("SHIPPED"), "SHIPPED", Set.of("DELIVERED", "DELIVERY_FAILED"),
                "DELIVERY_FAILED", Set.of("SHIPPED", "RETURNED"));
        app.require(transitions.getOrDefault(status, Set.of()).contains(next), "Chuyển trạng thái đơn không hợp lệ.");
        if (Set.of("PACKED", "SHIPPED").contains(next) && "VIETQR".equals(app.str(order, "paymentMethod"))) {
            app.require("PAID".equals(app.str(order, "paymentStatus")),
                    "Đơn VietQR phải được thanh toán trước khi đóng gói hoặc giao hàng.");
        }
        switch (next) {
            case "PACKED" -> fulfillment.completePacking(order, body, operator);
            case "SHIPPED" -> {
                fulfillment.requireEligibleLots(order);
                order.put("trackingReference", app.text(body, "reference", 200));
            }
            case "DELIVERED" -> order.put("deliveredAt", Instant.now().toString());
            case "DELIVERY_FAILED" -> order.put("deliveryFailedAt", Instant.now().toString());
            case "RETURNED" -> {
                order.put("returnStockStatus", "QUARANTINED");
                order.put("returnedAt", Instant.now().toString());
            }
            default -> { }
        }
        order.put("status", next);
    }

    @SuppressWarnings("unchecked")
    void inspectReturnedStock(Map<String, Object> order, Map<String, Object> body, UUID inspector) {
        if (!"RETURNED".equals(app.str(order, "status"))
                || !"QUARANTINED".equals(app.str(order, "returnStockStatus"))) {
            throw new PlatformApi.Problem(409, "Chỉ kiểm hàng hoàn đang cách ly và chưa có kết luận QC.");
        }
        String reference = app.text(body, "reference", 200);
        app.require(Boolean.TRUE.equals(body.get("packagingChecked"))
                && Boolean.TRUE.equals(body.get("qualityChecked")),
                "Cần xác nhận đã kiểm bao bì và chất lượng.");
        var items = (List<Map<String, Object>>) order.get("items");
        app.require(body.get("inspection") instanceof List<?> rows && rows.size() == items.size(),
                "Cần kết luận cho tất cả dòng hàng.");
        var rows = (List<?>) body.get("inspection");
        var purchased = new LinkedHashMap<String, Map<String, Object>>();
        for (var item : items) {
            purchased.put(app.str(item, "productId"), item);
        }
        var passed = new LinkedHashMap<String, Integer>();
        var passedLots = new LinkedHashMap<String, List<Map<String, Object>>>();
        var results = new ArrayList<Map<String, Object>>();
        int rejected = 0;
        for (var row : rows) {
            app.require(row instanceof Map<?, ?>, "Dòng kiểm hàng không hợp lệ.");
            var inspection = (Map<String, Object>) row;
            String productId = app.text(inspection, "productId", 50);
            var original = purchased.get(productId);
            app.require(original != null && !passed.containsKey(productId), "Dòng QC không thuộc đơn hoặc bị trùng.");
            int maximum = app.number(original, "quantity");
            var result = new LinkedHashMap<String, Object>();
            int accepted;
            if (original.get("lotAllocations") instanceof List<?> allocations) {
                var acceptedLots = inspectLots((List<Map<String, Object>>) allocations, inspection);
                accepted = acceptedLots.stream().mapToInt(lot -> app.number(lot, "quantity")).sum();
                passedLots.put(productId, acceptedLots);
                result.put("lotInspections", acceptedLots);
            } else {
                accepted = app.number(inspection, "acceptedQuantity");
            }
            app.require(accepted >= 0 && accepted <= maximum, "Số lượng QC không hợp lệ.");
            passed.put(productId, accepted);
            rejected += maximum - accepted;
            result.put("productId", productId);
            result.put("acceptedQuantity", accepted);
            result.put("rejectedQuantity", maximum - accepted);
            results.add(result);
        }
        int restocked = 0;
        for (var entry : passed.entrySet()) {
            if (entry.getValue() == 0) continue;
            var lots = passedLots.get(entry.getKey());
            if (lots == null) catalog.restoreProductStock(entry.getKey(), entry.getValue());
            else catalog.restoreLotStock(entry.getKey(), lots.stream()
                    .filter(lot -> app.number(lot, "quantity") > 0).toList());
            restocked += entry.getValue();
        }
        order.put("returnStockStatus", restocked == 0 ? "REJECTED" : rejected == 0 ? "RESTOCKED" : "PARTIALLY_RESTOCKED");
        order.put("returnInspection", Map.of("inspectorId", inspector.toString(), "reference", reference,
                "inspectedAt", Instant.now().toString(), "lines", results));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> inspectLots(List<Map<String, Object>> allocations, Map<String, Object> inspection) {
        var maxByLot = new HashMap<String, Integer>();
        for (var lot : allocations) maxByLot.put(app.str(lot, "lotId"), app.number(lot, "quantity"));
        app.require(inspection.get("lots") instanceof List<?> rows && rows.size() == allocations.size(),
                "Cần ghi kết quả kiểm định cho từng lô.");
        var result = new ArrayList<Map<String, Object>>();
        for (var row : (List<?>) inspection.get("lots")) {
            app.require(row instanceof Map<?, ?>, "Dòng kiểm định lô không hợp lệ.");
            var lot = (Map<String, Object>) row;
            String lotId = app.text(lot, "lotId", 50);
            Integer maximum = maxByLot.remove(lotId);
            int accepted = app.number(lot, "acceptedQuantity");
            app.require(maximum != null && accepted >= 0 && accepted <= maximum, "Số lượng QC theo lô không hợp lệ.");
            result.add(Map.of("lotId", lotId, "quantity", accepted, "rejectedQuantity", maximum - accepted));
        }
        return result;
    }

    private boolean isPendingCod(Map<String, Object> order) {
        return "COD".equals(app.str(order, "paymentMethod"))
                && "PLACED".equals(app.str(order, "status"))
                && !app.str(order, "codConfirmBy").isEmpty();
    }

    void confirmCod(Map<String, Object> order, Instant now) {
        if (!isPendingCod(order) || !Instant.parse(app.str(order, "codConfirmBy")).isAfter(now))
            throw new PlatformApi.Problem(409, "Đơn COD không còn chờ xác nhận hoặc đã quá hạn.");
        order.put("status", "CONFIRMED");
        order.put("codConfirmedAt", now.toString());
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelayString = "${APP_PAYMENT_SWEEP_MS:60000}")
    @Transactional
    @SuppressWarnings("unchecked")
    public void expireUnconfirmedCod() {
        app.lock();
        var rows = db.queryForList("""
                SELECT owner_id, data::text FROM records WHERE kind = 'order'
                AND data->>'paymentMethod' = 'COD' AND data->>'status' = 'PLACED'
                AND data->>'paymentStatus' = 'UNPAID'
                AND (data->>'codConfirmBy')::timestamptz <= now()
                """);
        for (var row : rows) {
            var order = app.decode((String) row.get("data"));
            catalog.releaseReservedStock(order);
            UUID owner = (UUID) row.get("owner_id");
            restoreExpiredCart(owner, order);
            order.put("status", "CANCELLED");
            order.put("revision", app.number(order, "revision") + 1);
            ((List<Object>) order.get("history")).add(Map.of(
                    "at", Instant.now().toString(), "status", "CANCELLED",
                    "note", "Đã hết hạn xác nhận đơn COD.", "action", "order-cod-expire"));
            app.save("order", owner, order);
        }
    }

    void recipient(Map<String,Object> order,Map<String,Object> b){order.put("recipient",app.text(b,"recipient",100));String phone=app.text(b,"phone",30);app.require(phone.matches("[+0-9() .-]{8,30}"),"Số điện thoại không hợp lệ.");order.put("phone",phone);order.put("address",app.text(b,"address",400));}
    @ExceptionHandler(Exception.class) public org.springframework.http.ResponseEntity<?> error(Exception e){return app.error(e);}
}
