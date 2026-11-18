package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

/**
 * Recommendation engine (demo): POPULAR for the home rail and
 * BOUGHT_TOGETHER for the product page, computed directly from order
 * records. Only sellable products are ever returned (active product in
 * an active category, stock > 0) - the same visibility rule as
 * GET /products plus the stock condition.
 */
@RestController
@RequestMapping("/api/v1")
public class RecommendApi {
    final PlatformApi app;
    final JdbcTemplate db;
    public RecommendApi(PlatformApi app, JdbcTemplate db){this.app=app;this.db=db;}

    static String s(Object v){return v==null?"":v.toString();}
    static int n(Object v){
        if(v instanceof Number num)return num.intValue();
        try{return Integer.parseInt(s(v));}catch(Exception e){return 0;}
    }
    @SuppressWarnings("unchecked")
    static List<Map<String,Object>> items(Map<String,Object> order){
        var raw=order.get("items");
        if(raw instanceof List<?> list){
            List<Map<String,Object>> out=new ArrayList<>();
            for(var e:list)if(e instanceof Map<?,?>)out.add((Map<String,Object>)e);
            return out;
        }
        return List.of();
    }

    List<Map<String,Object>> orders(String sql){
        return db.query(sql,(r,i)->app.decode(r.getString(1)));
    }

    @GetMapping("/products/recommended")
    public Object recommended(@RequestParam(defaultValue="home") String surface,
                              @RequestParam(required=false) String productId,
                              @RequestParam(defaultValue="4") int limit){
        int lim=Math.max(1,Math.min(8,limit));
        // Sellable catalog, in catalog order (same query shape as GET /products).
        var products=db.query("SELECT r.data::text FROM records r WHERE kind='product' AND data->>'active'='true' AND EXISTS(SELECT 1 FROM records c WHERE c.kind='category' AND c.data->>'code'=r.data->>'category' AND c.data->>'active'='true') ORDER BY created_at",(r,i)->app.decode(r.getString(1)));
        Map<String,Map<String,Object>> sellable=new LinkedHashMap<>();
        for(var p:products)if(n(p.get("stock"))>0)sellable.put(s(p.get("id")),p);
        // Popularity: units sold across every order that was not cancelled.
        Map<String,Integer> sold=new HashMap<>();
        for(var o:orders("SELECT data::text FROM records WHERE kind='order' AND data->>'status'<>'CANCELLED'"))
            for(var it:items(o)){var pid=s(it.get("productId"));if(!pid.isEmpty())sold.merge(pid,Math.max(1,n(it.get("quantity"))),Integer::sum);}
        String strategy="POPULAR";
        List<Map<String,Object>> ranked=new ArrayList<>();
        if("product".equals(surface)&&productId!=null&&sellable.containsKey(productId)){
            // Bought together: co-occurrence inside DELIVERED orders only,
            // so the score reflects orders that actually reached customers.
            Map<String,Integer> pairs=new HashMap<>();
            for(var o:orders("SELECT data::text FROM records WHERE kind='order' AND data->>'status'='DELIVERED'")){
                Set<String> ids=new HashSet<>();
                for(var it:items(o)){var pid=s(it.get("productId"));if(!pid.isEmpty())ids.add(pid);}
                if(ids.contains(productId))for(var pid:ids)if(!pid.equals(productId))pairs.merge(pid,1,Integer::sum);
            }
            List<Map.Entry<String,Integer>> es=new ArrayList<>(pairs.entrySet());
            es.sort((a,b)->{int c=Integer.compare(b.getValue(),a.getValue());if(c!=0)return c;return Integer.compare(sold.getOrDefault(b.getKey(),0),sold.getOrDefault(a.getKey(),0));});
            for(var e:es){var p=sellable.get(e.getKey());if(p!=null)ranked.add(p);}
            if(!ranked.isEmpty())strategy="BOUGHT_TOGETHER";
        }
        if(ranked.isEmpty()){
            ranked=new ArrayList<>(sellable.values());
            ranked.sort((a,b)->Integer.compare(sold.getOrDefault(s(b.get("id")),0),sold.getOrDefault(s(a.get("id")),0)));
        }
        if("product".equals(surface)&&productId!=null)ranked.removeIf(p->productId.equals(s(p.get("id"))));
        List<Map<String,Object>> out=new ArrayList<>();
        for(var p:ranked){
            if(out.size()>=lim)break;
            var v=new LinkedHashMap<String,Object>();
            v.put("id",p.get("id"));v.put("slug",p.get("slug"));v.put("name",p.get("name"));
            v.put("price",p.get("price"));v.put("image",p.get("image"));
            v.put("stock",p.get("stock"));v.put("category",p.get("category"));
            out.add(v);
        }
        var res=new LinkedHashMap<String,Object>();
        res.put("strategy",strategy);
        res.put("surface",surface);
        res.put("items",out);
        res.put("generatedAt",Instant.now().toString());
        return res;
    }
}
