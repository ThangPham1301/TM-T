package vn.goihue;

import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

@Service
public class CatalogService {
    final PlatformApi app;
    final JdbcTemplate db;
    final LotInventory inventory;
    public CatalogService(PlatformApi app, JdbcTemplate db, LotInventory inventory) {
        this.app = app;
        this.db = db;
        this.inventory = inventory;
    }

    int stock(Map<String, Object> product) {
        return Boolean.TRUE.equals(product.get("lotTracked"))
                ? inventory.available(app.uuid(app.str(product, "id")))
                : app.number(product, "stock");
    }

    Map<String, Object> withAvailableStock(Map<String, Object> product) {
        product.put("stock", stock(product));
        return product;
    }

    Map<String, Object> addLot(Map<String, Object> actor, Map<String, Object> body) {
        app.permission(actor, "catalog.manage");
        var product = get(app.text(body, "productId", 50), "product");
        revision(product, body);
        var id = app.uuid(app.str(product, "id"));
        int unallocated = app.number(product, "stock");
        int reassigned = body.containsKey("legacyQuantity") ? app.number(body, "legacyQuantity") : 0;
        app.require(reassigned >= 0 && reassigned <= unallocated && reassigned <= app.number(body, "quantity"),
                "Số lượng chuyển từ tồn cũ không hợp lệ.");
        var lot = inventory.add(id, body);
        product.put("lotTracked", true);
        product.put("stock", unallocated - reassigned);
        product.put("revision", app.number(product, "revision") + 1);
        app.save("product", null, product);
        return lot;
    }

    void reserveProduct(Map<String, Object> product, int quantity, Map<String, Object> orderLine) {
        if (Boolean.TRUE.equals(product.get("lotTracked"))) {
            orderLine.put("lotAllocations", inventory.reserve(app.uuid(app.str(product, "id")), quantity));
        } else {
            product.put("stock", app.number(product, "stock") - quantity);
        }
        product.put("revision", app.number(product, "revision") + 1);
        app.save("product", null, product);
    }
    Map<String,Object> get(String id,String kind){return app.record(id,kind,Map.of("role","ADMIN"));}
    public List<Map<String,Object>> categories(boolean all){return db.query("SELECT data::text FROM records WHERE kind='category'"+(all?"":" AND data->>'active'='true'")+" ORDER BY (data->>'sortOrder')::int,data->>'name'",(r,i)->app.decode(r.getString(1)));}
    @SuppressWarnings("unchecked")
    void releaseReservedStock(Map<String, Object> order) {
        for (var line : (List<Map<String, Object>>) order.get("items")) {
            String productId = app.str(line, "productId");
            if (line.get("lotAllocations") instanceof List<?> allocations) {
                restoreLotStock(productId, (List<Map<String, Object>>) allocations);
            } else {
                restoreProductStock(productId, app.number(line, "quantity"));
            }
        }
    }

    void restoreLotStock(String productId, List<Map<String, Object>> allocations) {
        var id = app.uuid(productId);
        for (var allocation : allocations) inventory.restore(id, allocation);
        var product = get(productId, "product");
        product.put("revision", app.number(product, "revision") + 1);
        app.save("product", null, product);
    }

    void restoreProductStock(String productId, int quantity) {
        var product = get(productId, "product");
        product.put("stock", Math.addExact(app.number(product, "stock"), quantity));
        product.put("revision", app.number(product, "revision") + 1);
        app.save("product", null, product);
    }

    boolean categoryActive(String code){return db.queryForObject("SELECT count(*) FROM records WHERE kind='category' AND data->>'code'=? AND data->>'active'='true'",Integer.class,code)>0;}
    boolean visible(Map<String,Object> p){return Boolean.TRUE.equals(p.get("active"))&&categoryActive(app.str(p,"category"));}
    public Map<String,Object> shipping(){return db.query("SELECT data::text FROM records WHERE kind='settings' AND data->>'code'='shipping'",(r,i)->app.decode(r.getString(1))).getFirst();}
    int shippingFee(long subtotal){var s=shipping();return app.number(s,"freeShippingThreshold")>0&&subtotal>=app.number(s,"freeShippingThreshold")?0:app.number(s,"baseFee");}
    void revision(Map<String,Object> value,Map<String,Object> input){if(app.number(value,"revision")!=app.number(input,"revision"))throw new PlatformApi.Problem(409,"Dữ liệu vừa thay đổi. Hãy tải lại trước khi lưu.");}
    String code(Map<String,Object> b,String field){String value=app.text(b,field,120);app.require(value.matches("[a-z0-9]+(?:-[a-z0-9]+)*"),"Mã chỉ gồm chữ thường, số và dấu gạch ngang.");return value;}
    void image(Map<String,Object> value,Map<String,Object> b){
        if(!b.containsKey("imageId"))return;
        String id=app.str(b,"imageId");if(id.isEmpty()){value.remove("imageId");value.put("image","/images/product-placeholder.svg");return;}
        var file=get(id,"catalog-image");app.require(app.str(file,"status").equals("READY"),"Ảnh chưa được tải hoàn tất.");value.put("imageId",id);value.put("image","/api/store/catalog/images/"+id);
    }
    public Map<String,Object> saveProduct(Map<String,Object> a,Map<String,Object> b){
        app.permission(a,"catalog.manage");boolean edit=!app.str(b,"id").isEmpty();var p=edit?get(app.str(b,"id"),"product"):new LinkedHashMap<String,Object>();if(edit)revision(p,b);
        String slug=code(b,"slug"),category=app.text(b,"category",120);
        app.require(categoryActive(category),"Chọn danh mục đang hoạt động.");
        app.require(db.queryForObject("SELECT count(*) FROM records WHERE kind='product' AND data->>'slug'=? AND id<>?",Integer.class,slug,edit?app.uuid(app.str(p,"id")):UUID.randomUUID())==0,"Slug đã tồn tại.");
        int price=app.number(b,"price"),stock=app.number(b,"stock");app.require(price>0&&price<=10_000_000&&stock>=0&&stock<=1_000_000,"Giá hoặc tồn kho không hợp lệ.");
        p.put("slug",slug);p.put("category",category);p.put("name",app.text(b,"name",150));p.put("description",app.text(b,"description",4000));p.put("price",price);if(!Boolean.TRUE.equals(p.get("lotTracked")))p.put("stock",stock);p.put("active",Boolean.TRUE.equals(b.get("active")));if(!p.containsKey("image"))p.put("image","/images/product-placeholder.svg");image(p,b);if(edit)p.put("revision",app.number(p,"revision")+1);return withAvailableStock(new LinkedHashMap<>(app.save("product",null,p)));
    }
    public Map<String,Object> mutation(Map<String,Object> a,Map<String,Object> b){
        app.permission(a,"catalog.manage");String action=app.str(b,"action");
        switch(action){
            case "category-save" -> {
                boolean edit=!app.str(b,"id").isEmpty();var c=edit?get(app.str(b,"id"),"category"):new LinkedHashMap<String,Object>();if(edit)revision(c,b);String code=code(b,"code"),old=app.str(c,"code");
                app.require(db.queryForObject("SELECT count(*) FROM records WHERE kind='category' AND data->>'code'=? AND id<>?",Integer.class,code,edit?app.uuid(app.str(c,"id")):UUID.randomUUID())==0,"Mã danh mục đã tồn tại.");
                int sort=app.number(b,"sortOrder");app.require(sort>=0&&sort<=10000,"Thứ tự không hợp lệ.");c.put("code",code);c.put("name",app.text(b,"name",150));c.put("description",app.bounded(b,"description",2000));c.put("sortOrder",sort);c.put("active",Boolean.TRUE.equals(b.get("active")));if(!c.containsKey("image"))c.put("image","/images/product-placeholder.svg");image(c,b);
                if(edit){c.put("revision",app.number(c,"revision")+1);if(!old.equals(code))db.update("UPDATE records SET data=jsonb_set(jsonb_set(data,'{category}',to_jsonb(?::text)),'{revision}',to_jsonb((data->>'revision')::int+1)) WHERE kind='product' AND data->>'category'=?",code,old);}
                return app.save("category",null,c);
            }
            case "product-delete" -> {
                var p=get(app.text(b,"id",50),"product");revision(p,b);
                app.require(!Boolean.TRUE.equals(p.get("lotTracked")), "Sản phẩm đã có lô hàng. Hãy ẩn thay vì xóa.");
                app.require(db.queryForObject("SELECT count(*) FROM records WHERE (kind='cart' AND data->>'productId'=?) OR (kind='order' AND EXISTS(SELECT 1 FROM jsonb_array_elements(data->'items') x WHERE x->>'productId'=?))",Integer.class,p.get("id"),p.get("id"))==0,"Sản phẩm đã được dùng trong giỏ/đơn. Hãy ẩn thay vì xóa.");
                db.update("DELETE FROM records WHERE kind='product' AND id=?",app.uuid(app.str(p,"id")));return Map.of("id",p.get("id"),"deleted",true);
            }
            case "category-delete" -> {
                var c=get(app.text(b,"id",50),"category");revision(c,b);app.require(db.queryForObject("SELECT count(*) FROM records WHERE kind='product' AND data->>'category'=?",Integer.class,c.get("code"))==0,"Danh mục còn sản phẩm liên kết. Hãy chuyển sản phẩm hoặc ẩn danh mục.");db.update("DELETE FROM records WHERE kind='category' AND id=?",app.uuid(app.str(c,"id")));return Map.of("id",c.get("id"),"deleted",true);
            }
            case "catalog-toggle" -> {
                String kind=app.text(b,"kind",20);app.require(Set.of("category","product").contains(kind),"Loại dữ liệu không hợp lệ.");var v=get(app.text(b,"id",50),kind);revision(v,b);v.put("active",Boolean.TRUE.equals(b.get("active")));v.put("revision",app.number(v,"revision")+1);return app.save(kind,null,v);
            }
            case "shipping-save" -> {
                app.permission(a,"order.manage");var s=shipping();revision(s,b);int fee=app.number(b,"baseFee"),threshold=app.number(b,"freeShippingThreshold");app.require(fee>=0&&fee<=1_000_000&&threshold>=0&&threshold<=100_000_000,"Mức phí hoặc ngưỡng miễn phí không hợp lệ.");s.put("baseFee",fee);s.put("freeShippingThreshold",threshold);s.put("enabled",Boolean.TRUE.equals(b.get("enabled")));s.put("revision",app.number(s,"revision")+1);return app.save("settings",null,s);
            }
            case "catalog-image-intent" -> {
                var file=new LinkedHashMap<String,Object>();file.put("name",app.text(b,"name",120));file.put("status","UPLOADING");return app.save("catalog-image",(UUID)a.get("id"),file);
            }
            default -> throw new PlatformApi.Problem(422,"Thao tác không được hỗ trợ.");
        }
    }
}
