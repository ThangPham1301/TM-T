package vn.goihue;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
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
    public CommerceApi(PlatformApi app,JdbcTemplate db,CatalogService catalog,com.fasterxml.jackson.databind.ObjectMapper json){this.app=app;this.db=db;this.catalog=catalog;this.json=json;}

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
    @GetMapping("/products") public Object products(){return db.query("SELECT r.data::text FROM records r WHERE kind='product' AND data->>'active'='true' AND EXISTS(SELECT 1 FROM records c WHERE c.kind='category' AND c.data->>'code'=r.data->>'category' AND c.data->>'active'='true') ORDER BY created_at",(r,i)->app.decode(r.getString(1)));}
    @GetMapping("/products/{slug}") public Object detail(@PathVariable String slug){var rows=db.query("SELECT data::text FROM records WHERE kind='product' AND data->>'slug'=?",(r,i)->app.decode(r.getString(1)),slug);if(rows.isEmpty()||!catalog.visible(rows.getFirst()))throw new PlatformApi.Problem(404,"Không tìm thấy sản phẩm.");return rows.getFirst();}
    @GetMapping("/admin/products") public Object adminProducts(HttpServletRequest req){var a=app.actor(req);app.permission(a,"catalog.manage");return app.list("product",a);}

    List<Map<String,Object>> cartOf(UUID uid){return db.query("SELECT data::text FROM records WHERE kind='cart' AND owner_id=? ORDER BY id",(r,i)->app.decode(r.getString(1)),uid);}
    String cartToken(UUID uid){return app.hash(app.encode(cartOf(uid)));}
    void checkCart(UUID uid,Map<String,Object> b){if(!cartToken(uid).equals(app.text(b,"cartToken",100)))throw new PlatformApi.Problem(409,"Giỏ hàng đã thay đổi. Hãy tải lại trước khi tiếp tục.");}
    List<Map<String,Object>> cartView(UUID uid){
        var rows=cartOf(uid);
        for(var line:rows){var p=product(app.str(line,"productId"));line.put("currentPrice",p.get("price"));line.put("stock",p.get("stock"));line.put("available",catalog.visible(p));line.put("priceChanged",app.number(line,"price")!=app.number(p,"price"));line.put("name",p.get("name"));line.put("image",p.get("image"));}
        return rows;
    }
    @GetMapping("/cart") public Object cart(HttpServletRequest req){var a=app.actor(req);app.permission(a,"cart.manage");return cartView((UUID)a.get("id"));}
    @GetMapping("/cart/summary") @Transactional public Object summary(HttpServletRequest req){
        app.lock();var a=app.actor(req);app.permission(a,"cart.manage");UUID uid=(UUID)a.get("id");var rows=cartView(uid);long subtotal=rows.stream().mapToLong(l->(long)app.number(l,"price")*app.number(l,"quantity")).sum();var shipping=catalog.shipping();int fee=catalog.shippingFee(subtotal);
        return Map.of("items",rows,"cartToken",cartToken(uid),"subtotal",subtotal,"shippingFee",fee,"total",subtotal+fee,"shipping",shipping);
    }
    Map<String,Object> cartSnapshot(Map<String,Object> p,int qty,UUID id,int revision){var line=new LinkedHashMap<String,Object>();line.put("id",id.toString());line.put("productId",p.get("id"));line.put("name",p.get("name"));line.put("price",p.get("price"));line.put("quantity",qty);line.put("image",p.get("image"));line.put("revision",revision);line.put("version",UUID.randomUUID().toString());return line;}

    @PostMapping("/commerce") @Transactional @SuppressWarnings("unchecked")
    public Object mutate(@RequestBody Map<String,Object> b,@RequestHeader("Idempotency-Key") String key,HttpServletRequest req){
        app.origin(req);app.lock();var a=app.actor(req);UUID uid=(UUID)a.get("id");app.require(key.matches("[a-zA-Z0-9-]{16,80}"),"Khóa gửi lặp không hợp lệ.");String fingerprint=app.hash(app.encode(new TreeMap<>(b)));var previous=db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?",uid,key);
        if(!previous.isEmpty()){if(!previous.getFirst().get("fingerprint").equals(fingerprint))throw new PlatformApi.Problem(409,"Khóa đã dùng cho thao tác khác.");return app.decode((String)previous.getFirst().get("result"));}
        String action=app.text(b,"action",50);Map<String,Object> result;
        switch(action){
            case "product-save" -> result=catalog.saveProduct(a,b);
            case "category-save","category-delete","product-delete","catalog-toggle","shipping-save","catalog-image-intent" -> result=catalog.mutation(a,b);
            case "cart-set" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);var p=product(app.text(b,"productId",50));int qty=app.number(b,"quantity");app.require(qty>=0&&qty<=100,"Số lượng từ 0 đến 100.");if(qty>0)app.require(catalog.visible(p)&&qty<=app.number(p,"stock"),"Sản phẩm không đủ tồn hoặc đã ngừng bán.");
                UUID id=UUID.nameUUIDFromBytes((uid+":"+app.str(p,"id")).getBytes(java.nio.charset.StandardCharsets.UTF_8));if(qty==0){db.update("DELETE FROM records WHERE id=? AND owner_id=?",id,uid);result=Map.of("ok",true);}else{var old=cartOf(uid).stream().filter(l->app.str(l,"id").equals(id.toString())).findFirst();int revision=old.isPresent()?app.number(old.get(),"revision")+1:1;result=app.save("cart",uid,cartSnapshot(p,qty,id,revision));}
            }
            case "cart-clear","cart-refresh" -> {
                app.permission(a,"cart.manage");checkCart(uid,b);
                if(action.equals("cart-clear"))db.update("DELETE FROM records WHERE kind='cart' AND owner_id=?",uid);
                else for(var line:cartOf(uid)){var p=product(app.str(line,"productId"));app.save("cart",uid,cartSnapshot(p,app.number(line,"quantity"),app.uuid(app.str(line,"id")),app.number(line,"revision")+1));}
                result=Map.of("ok",true);
            }
            case "checkout" -> {
                app.permission(a,"order.create");checkCart(uid,b);var shipping=catalog.shipping();app.require(Boolean.TRUE.equals(shipping.get("enabled")),"Cửa hàng đang tạm ngừng nhận đơn.");catalog.revision(shipping,Map.of("revision",app.number(b,"shippingRevision")));
                var cart=cartOf(uid);app.require(!cart.isEmpty(),"Giỏ hàng đang trống.");var items=new ArrayList<Map<String,Object>>();long subtotal=0;
                for(var line:cart){var p=product(app.str(line,"productId"));int qty=app.number(line,"quantity");app.require(catalog.visible(p)&&app.number(p,"stock")>=qty,"Sản phẩm không đủ tồn hoặc đã ngừng bán: "+app.str(p,"name"));app.require(app.number(p,"price")==app.number(line,"price"),"Giá đã thay đổi. Cập nhật giỏ hàng trước khi đặt.");subtotal+=(long)app.number(p,"price")*qty;var item=new LinkedHashMap<String,Object>();item.put("productId",p.get("id"));item.put("name",p.get("name"));item.put("slug",p.get("slug"));item.put("quantity",qty);item.put("price",p.get("price"));items.add(item);p.put("stock",app.number(p,"stock")-qty);p.put("revision",app.number(p,"revision")+1);app.save("product",null,p);}
                app.require(subtotal<=100_000_000,"Đơn vượt hạn mức 100 triệu đồng.");int fee=catalog.shippingFee(subtotal);var order=new LinkedHashMap<String,Object>();order.put("number","GH-"+UUID.randomUUID().toString().substring(0,8).toUpperCase());order.put("items",items);order.put("subtotal",subtotal);order.put("shippingFee",fee);order.put("shippingRevision",shipping.get("revision"));order.put("total",subtotal+fee);order.put("status","PLACED");order.put("paymentMethod","COD");order.put("paymentStatus","UNPAID");recipient(order,b);order.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","PLACED","note","Đã tiếp nhận đơn hàng, thanh toán khi nhận hàng"))));result=app.save("order",uid,order);db.update("DELETE FROM records WHERE owner_id=? AND kind='cart'",uid);
            }
            case "order-cancel","order-status","order-paid","order-recipient" -> {
                var order=app.record(app.text(b,"id",50),"order",a);catalog.revision(order,b);String status=app.str(order,"status"),note=app.text(b,"note",2000);
                if(action.equals("order-cancel")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Đơn không còn cho phép hủy trực tiếp.");app.require(!app.str(order,"paymentStatus").equals("PAID"),"Đơn đã thu tiền cần liên hệ hỗ trợ để xử lý hoàn.");
                    for(var line:(List<Map<String,Object>>)order.get("items")){var p=product(app.str(line,"productId"));p.put("stock",app.number(p,"stock")+app.number(line,"quantity"));p.put("revision",app.number(p,"revision")+1);app.save("product",null,p);}order.put("status","CANCELLED");
                }else if(action.equals("order-recipient")){
                    app.require(Set.of("PLACED","CONFIRMED").contains(status),"Chỉ sửa thông tin nhận trước khi đóng gói.");recipient(order,b);
                }else{
                    app.permission(a,"order.manage");
                    if(action.equals("order-paid")){app.require(!status.equals("CANCELLED")&&!app.str(order,"paymentStatus").equals("PAID"),"Không thể ghi nhận thu tiền.");order.put("paymentStatus","PAID");order.put("paymentReference",app.text(b,"reference",200));order.put("paidAt",Instant.now().toString());}
                    else{String next=app.text(b,"status",40);var transitions=Map.of("PLACED","CONFIRMED","CONFIRMED","PACKED","PACKED","SHIPPED","SHIPPED","DELIVERED");app.require(next.equals(transitions.get(status)),"Chuyển trạng thái đơn không hợp lệ.");if(next.equals("SHIPPED"))order.put("trackingReference",app.text(b,"reference",200));if(next.equals("DELIVERED"))order.put("deliveredAt",Instant.now().toString());order.put("status",next);}
                }
                ((List<Object>)order.get("history")).add(Map.of("at",Instant.now().toString(),"status",app.str(order,"status"),"note",note,"action",action));order.put("revision",app.number(order,"revision")+1);result=app.save("order",app.owner(app.str(order,"id")),order);
            }
            default -> throw new PlatformApi.Problem(422,"Thao tác không được hỗ trợ.");
        }
        app.audit(a,app.str(result,"id"),action);db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)",uid,key,fingerprint,app.encode(result));return result;
    }
    void recipient(Map<String,Object> order,Map<String,Object> b){order.put("recipient",app.text(b,"recipient",100));String phone=app.text(b,"phone",30);app.require(phone.matches("[+0-9() .-]{8,30}"),"Số điện thoại không hợp lệ.");order.put("phone",phone);order.put("address",app.text(b,"address",400));}
    @ExceptionHandler(Exception.class) public org.springframework.http.ResponseEntity<?> error(Exception e){return app.error(e);}
}
