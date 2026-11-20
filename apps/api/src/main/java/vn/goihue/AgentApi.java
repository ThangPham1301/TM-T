package vn.goihue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.model.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.*;

/**
 * AI shopping assistant (demo): answers from live store data only.
 * The brain is Amazon Bedrock (Nova Lite, Converse streaming); the reply
 * is grounded in a context block assembled per turn from real records
 * (sellable catalog, shipping settings, recommendation candidates, the
 * caller's own orders) and post-checked for invented prices. When
 * Bedrock is unreachable or unconfigured, deterministic template
 * answers cover the demo intents so the widget behaves the same.
 *
 * SSE contract (mirrors the PBL ai-agent vocabulary):
 *   token         {"delta": "..."}            streamed answer text
 *   product_cards {"items": [product, ...]}   cards from the engine
 *   citations     {"sources": ["...", ...]}   where facts came from
 *   correction    {"text": "..."}             post-check replacement
 *   done          {}
 *   error         {"message": "..."}
 */
@RestController
@RequestMapping("/api/v1")
public class AgentApi {
    final PlatformApi app;
    final JdbcTemplate db;
    final CatalogService catalog;
    final RecommendApi recommend;
    final PricingService pricing;
    final ObjectMapper json;
    public AgentApi(PlatformApi app, JdbcTemplate db, CatalogService catalog, RecommendApi recommend, PricingService pricing, ObjectMapper json){
        this.app=app;this.db=db;this.catalog=catalog;this.recommend=recommend;this.pricing=pricing;this.json=json;
    }
    @Value("${APP_BEDROCK_MODEL:amazon.nova-lite-v1:0}") String modelId;
    @Value("${APP_BEDROCK_REGION:ap-southeast-2}") String bedrockRegion;

    static final ExecutorService POOL = Executors.newCachedThreadPool();
    volatile BedrockRuntimeAsyncClient client;
    volatile Boolean credentialsOk;

    static String s(Object v){return v==null?"":v.toString();}
    static int n(Object v){if(v instanceof Number num)return num.intValue();try{return Integer.parseInt(s(v));}catch(Exception e){return 0;}}
    static String money(int v){return String.format("%,d",v).replace(',','.')+"đ";}

    BedrockRuntimeAsyncClient client(){
        if(client==null){
            synchronized(this){
                if(client==null)client=BedrockRuntimeAsyncClient.builder().region(Region.of(bedrockRegion)).build();
            }
        }
        return client;
    }
    boolean bedrockReady(){
        if(credentialsOk==null){
            synchronized(this){
                if(credentialsOk==null){
                    boolean ok;
                    try{DefaultCredentialsProvider.create().resolveCredentials();ok=true;}
                    catch(Exception e){ok=false;System.err.println("[AgentApi] credentials NOT resolved: "+e);}
                    credentialsOk=ok;
                }
            }
        }
        return credentialsOk;
    }

    // ---------- grounding ----------
    record Grounding(List<Map<String,Object>> sellable, Map<String,Object> shipping,
                     List<Map<String,Object>> candidates, List<Map<String,Object>> ownOrders,
                     String policyExcerpt, Set<Integer> allowedAmounts, String contextText) {}

    @SuppressWarnings("unchecked")
    Grounding ground(Map<String,Object> actor, String message, Long budget){
        var products = catalog.publicProducts();
        var book = pricing.book(java.time.Instant.now());
        List<Map<String,Object>> sellable=new ArrayList<>();
        for(var p:products) if(n(p.get("stock"))>0) {
            pricing.publish(p, pricing.resolve(p, book));
            sellable.add(p);
        }
        var shipping=catalog.shipping();
        // Candidates come from the recommendation engine, never invented.
        List<Map<String,Object>> candidates=new ArrayList<>();
        try{
            var rec=(Map<String,Object>)recommend.recommended("home",null,8);
            var items=(List<Map<String,Object>>)rec.get("items");
            if(items!=null)for(var it:items){
                if(budget!=null&&n(it.get("price"))>budget)continue;
                candidates.add(it);
                if(candidates.size()>=4)break;
            }
        }catch(Exception ignored){}
        List<Map<String,Object>> ownOrders=new ArrayList<>();
        if(actor!=null){
            ownOrders=db.query("SELECT data::text FROM records WHERE kind='order' AND owner_id=? ORDER BY created_at DESC LIMIT 3",(r,i)->app.decode(r.getString(1)),(UUID)actor.get("id"));
        }
        String policy="";
        var pol=db.query("SELECT data::text FROM records WHERE kind='policy' ORDER BY created_at DESC LIMIT 1",(r,i)->app.decode(r.getString(1)));
        if(!pol.isEmpty())policy=s(pol.getFirst().get("content"));
        if(policy.length()>600)policy=policy.substring(0,600);
        Set<Integer> allowed=new HashSet<>();
        for(var p:sellable)allowed.add(n(p.get("price")));
        allowed.add(n(shipping.get("baseFee")));
        allowed.add(n(shipping.get("freeShippingThreshold")));
        if(budget!=null&&budget<=Integer.MAX_VALUE)allowed.add(budget.intValue());
        for(var o:ownOrders)allowed.add(n(o.get("total")));
        var ctx=new StringBuilder();
        ctx.append("DANH MỤC ĐANG BÁN (tên | giá | tồn kho | đường dẫn):\n");
        for(var p:sellable)ctx.append("- ").append(s(p.get("name"))).append(" | ").append(money(n(p.get("price")))).append(" | còn ").append(n(p.get("stock"))).append(" | /products/").append(s(p.get("slug"))).append("\n");
        ctx.append("GIAO HÀNG: phí ").append(money(n(shipping.get("baseFee")))).append("/đơn; miễn phí giao hàng cho đơn từ ").append(money(n(shipping.get("freeShippingThreshold")))).append(" trở lên.\n");
        if(!candidates.isEmpty()){
            ctx.append("ỨNG VIÊN GỢI Ý TỪ HỆ THỐNG GỢI Ý (chỉ gợi ý trong danh sách này khi tư vấn sản phẩm): ");
            for(var c:candidates)ctx.append(s(c.get("name"))).append("; ");
            ctx.append("\n");
        }
        if(!ownOrders.isEmpty()){
            ctx.append("ĐƠN GẦN NHẤT CỦA CHÍNH KHÁCH NÀY: ");
            for(var o:ownOrders)ctx.append(s(o.get("number"))).append(" (").append(s(o.get("status"))).append(", ").append(money(n(o.get("total")))).append("); ");
            ctx.append("\n");
        }
        if(!policy.isBlank())ctx.append("CHÍNH SÁCH RIÊNG TƯ (tóm tắt): ").append(policy.replaceAll("\\s+"," ")).append("\n");
        ctx.append("ĐỔI TRẢ: xem chi tiết tại trang /return-policy của cửa hàng.\n");
        return new Grounding(sellable,shipping,candidates,ownOrders,policy,allowed,ctx.toString());
    }

    // ---------- intents (cards, citations, fallback only; the LLM still answers) ----------
    static String intentOf(String m){
        var t=m.toLowerCase(Locale.ROOT);
        if(t.contains("ship")||t.contains("vận chuyển")||t.contains("giao hàng")||t.contains("phí giao"))return "shipping";
        if(t.contains("đổi trả")||t.contains("hoàn tiền")||t.contains("trả hàng"))return "returns";
        if(t.contains("đơn hàng")||t.contains("đơn của")||t.contains("tra cứu")||t.matches(".*gh-[a-z0-9]{8}.*"))return "order";
        if(t.contains("quà")||t.contains("tặng")||t.contains("biếu")||budgetOf(m)!=null)return "gift";
        return "general";
    }
    static Long budgetOf(String m){
        var mt=Pattern.compile("(\\d{1,3}(?:\\.\\d{3})+|\\d+)\\s*(k|nghìn|ngàn|triệu|tr|đồng|đ)?",Pattern.CASE_INSENSITIVE).matcher(m.toLowerCase(Locale.ROOT));
        Long best=null;
        while(mt.find()){
            long base;
            try{base=Long.parseLong(mt.group(1).replace(".",""));}catch(Exception e){continue;}
            var unit=mt.group(2);
            long v=base;
            if(unit!=null&&(unit.equals("k")||unit.startsWith("ngh")))v=base*1_000L;
            else if(unit!=null&&(unit.equals("triệu")||unit.equals("tr")))v=base*1_000_000L;
            else if(base<10_000)v=base*1_000L;
            if(v>=10_000&&(best==null||v<best))best=v;
        }
        return best;
    }

    String fallbackText(String intent, Grounding g, Long budget){
        return switch(intent){
            case "shipping" -> "Phí giao hàng hiện tại là "+money(n(g.shipping().get("baseFee")))+" cho mỗi đơn. Đơn hàng từ "+money(n(g.shipping().get("freeShippingThreshold")))+" trở lên được miễn phí giao hàng.";
            case "gift" -> {
                if(g.candidates().isEmpty())yield "Hiện cửa hàng chưa có sản phẩm nào còn hàng phù hợp ngân sách này. Bạn xem thêm toàn bộ danh mục tại trang Sản phẩm giúp mình nhé.";
                yield (budget!=null?"Với ngân sách dưới "+money(budget.intValue())+", bạn tham khảo các món quà Huế dưới đây — đều đang còn hàng tại cửa hàng:"
                                    :"Bạn tham khảo các món quà Huế được khách chọn mua nhiều nhất dưới đây — đều đang còn hàng tại cửa hàng:");
            }
            case "order" -> {
                if(g.ownOrders().isEmpty())yield "Bạn cho mình xin mã đơn (dạng GH-XXXXXXXX) hoặc đăng nhập để mình tra cứu đơn của bạn nhé.";
                var o=g.ownOrders().getFirst();
                yield "Đơn gần nhất của bạn là "+s(o.get("number"))+", trạng thái hiện tại: "+s(o.get("status"))+", tổng "+money(n(o.get("total")))+".";
            }
            case "returns" -> "Cửa hàng nhận đổi trả theo chính sách đổi trả đang công bố. Bạn xem chi tiết điều kiện và thời hạn tại trang /return-policy giúp mình nhé.";
            default -> "Xin chào, mình là Trợ lý Gói Huế. Mình có thể tư vấn quà tặng Huế, tra phí giao hàng và hỗ trợ tra cứu đơn hàng của bạn.";
        };
    }

    List<String> sourcesFor(String intent){
        return switch(intent){
            case "shipping" -> List.of("Cài đặt giao hàng của cửa hàng");
            case "gift" -> List.of("Danh mục sản phẩm đang bán","Hệ thống gợi ý của cửa hàng");
            case "order" -> List.of("Đơn hàng của chính bạn");
            case "returns" -> List.of("Trang chính sách đổi trả /return-policy");
            default -> List.of("Dữ liệu cửa hàng Gói Huế");
        };
    }

    // ---------- post-check: no invented prices ----------
    boolean violates(String text, Set<Integer> allowed){
        var mt=Pattern.compile("(\\d{1,3}(?:\\.\\d{3}){1,3})\\s*(?:đ|₫|vnd)?").matcher(text);
        while(mt.find()){
            int v;
            try{v=Integer.parseInt(mt.group(1).replace(".",""));}catch(Exception e){continue;}
            if(v>=10_000&&!allowed.contains(v))return true;
        }
        return false;
    }

    // ---------- endpoint ----------
    @PostMapping(value="/agent/chat", produces=MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chat(@RequestBody Map<String,Object> body, HttpServletRequest req){
        app.origin(req);
        Map<String,Object> actor=null;
        try{actor=app.actor(req);}catch(Exception ignored){}
        var message=s(body.get("message")).trim();
        if(message.isBlank()||message.length()>1000)throw new PlatformApi.Problem(422,"Tin nhắn không hợp lệ.");
        List<Map<String,String>> history=new ArrayList<>();
        if(body.get("history")instanceof List<?> list){
            for(var e:list)if(e instanceof Map<?,?> m&&history.size()<6){
                var role=s(m.get("role"));var content=s(m.get("content"));
                if((role.equals("user")||role.equals("assistant"))&&!content.isBlank())
                    history.add(Map.of("role",role,"content",content.substring(0,Math.min(1000,content.length()))));
            }
        }
        var emitter=new SseEmitter(180_000L);
        final var fActor=actor;
        POOL.execute(()->run(emitter,message,history,fActor));
        return emitter;
    }

    void send(SseEmitter emitter, String event, Object data){
        try{emitter.send(SseEmitter.event().name(event).data(json.writeValueAsString(data)));}
        catch(Exception ignored){}
    }

    void run(SseEmitter emitter, String message, List<Map<String,String>> history, Map<String,Object> actor){
        var finished=new AtomicBoolean(false);
        Runnable complete=()->{if(finished.compareAndSet(false,true)){send(emitter,"done",Map.of());try{emitter.complete();}catch(Exception ignored){}}};
        try{
            var budget=budgetOf(message);
            var intent=intentOf(message);
            var g=ground(actor,message,budget);
            boolean cards="gift".equals(intent)&&!g.candidates().isEmpty();
            Runnable tail=()->{
                if(cards)send(emitter,"product_cards",Map.of("items",g.candidates()));
                send(emitter,"citations",Map.of("sources",sourcesFor(intent)));
                complete.run();
            };
            if(!bedrockReady()){
                streamFallback(emitter,fallbackText(intent,g,budget));
                tail.run();
                return;
            }
            var full=new StringBuilder();
            var sys="Bạn là Trợ lý Gói Huế, trợ lý tư vấn của cửa hàng đặc sản Huế Gói Huế. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa khoảng 120 từ).\n"
                +"QUY TẮC BẮT BUỘC:\n"
                +"- Giá tiền, tồn kho, phí giao hàng CHỈ được lấy từ dữ kiện dưới đây. Nếu dữ kiện không có, nói rõ là chưa có thông tin, TUYỆT ĐỐI không bịa số.\n"
                +"- Khi tư vấn sản phẩm, chỉ nhắc tới sản phẩm trong danh mục được cung cấp.\n"
                +"- Bạn chỉ tư vấn; không đặt đơn, không hủy đơn, không thu tiền thay khách.\n"
                +"DỮ KIỆN CỬA HÀNG:\n"+g.contextText();
            List<Message> messages=new ArrayList<>();
            for(var h:history)messages.add(Message.builder()
                .role(h.get("role").equals("assistant")?ConversationRole.ASSISTANT:ConversationRole.USER)
                .content(ContentBlock.fromText(h.get("content"))).build());
            messages.add(Message.builder().role(ConversationRole.USER).content(ContentBlock.fromText(message)).build());
            var request=ConverseStreamRequest.builder().modelId(modelId)
                .system(SystemContentBlock.fromText(sys))
                .messages(messages)
                .inferenceConfig(InferenceConfiguration.builder().maxTokens(600).temperature(0.4f).build())
                .build();
            var handler=ConverseStreamResponseHandler.builder()
                .subscriber(ConverseStreamResponseHandler.Visitor.builder()
                    .onContentBlockDelta(e->{
                        var t=e.delta().text();
                        if(t!=null&&!t.isEmpty()){full.append(t);send(emitter,"token",Map.of("delta",t));}
                    })
                    .build())
                .onError(err->{
                    System.err.println("[AgentApi] bedrock stream error: "+err);
                    if(full.isEmpty())streamFallback(emitter,fallbackText(intent,g,budget));
                    tail.run();
                })
                .onComplete(()->{
                    if(full.isEmpty())streamFallback(emitter,fallbackText(intent,g,budget));
                    else if(violates(full.toString(),g.allowedAmounts()))
                        send(emitter,"correction",Map.of("text",fallbackText(intent,g,budget)));
                    tail.run();
                })
                .build();
            client().converseStream(request,handler);
        }catch(Exception e){
            if(finished.compareAndSet(false,true)){
                send(emitter,"error",Map.of("message","Trợ lý đang bận, bạn thử lại sau ít phút nhé."));
                try{emitter.complete();}catch(Exception ignored){}
            }
        }
    }

    void streamFallback(SseEmitter emitter, String text){
        // Chunk the deterministic answer so the widget streams it the same way.
        for(var part:text.split("(?<= )")){
            send(emitter,"token",Map.of("delta",part));
            try{Thread.sleep(12);}catch(InterruptedException ignored){Thread.currentThread().interrupt();return;}
        }
    }
}
