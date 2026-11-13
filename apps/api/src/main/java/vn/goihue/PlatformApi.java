package vn.goihue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class PlatformApi {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
    private final SecureRandom random = new SecureRandom();
    private final java.util.concurrent.ConcurrentHashMap<String,long[]> loginLimits = new java.util.concurrent.ConcurrentHashMap<>();
    private final Path storage = Path.of("/data");
    @Value("${ADMIN_EMAIL:admin@goihue.local}") String adminEmail;
    @Value("${ADMIN_PASSWORD}") String adminPassword;
    @Value("${APP_ORIGINS:http://localhost:3000}") String origins;
    public PlatformApi(JdbcTemplate db, ObjectMapper json) { this.db=db; this.json=json; }
    static class Problem extends RuntimeException {
        final int status;
        Problem(int status,String message) { super(message); this.status=status; }
    }
    void require(boolean ok,String message) { if(!ok) throw new Problem(422,message); }
    String str(Map<String,Object> m,String key) { return Objects.toString(m.get(key), "").trim(); }
    int number(Map<String,Object> m,String key) { try { return Integer.parseInt(str(m,key)); } catch(Exception e) { throw new Problem(422,"Giá trị số không hợp lệ: " + key); } }
    String text(Map<String,Object> m,String key,int max) { String s=str(m,key); require(!s.isEmpty() && s.length()<=max,"Thông tin không hợp lệ: " + key); return s; }
    UUID uuid(String id) { try {return UUID.fromString(id);} catch(Exception e){throw new Problem(404,"Không tìm thấy hồ sơ.");} }
    String encode(Object x) { try{return json.writeValueAsString(x);}catch(Exception e){throw new IllegalStateException(e);} }
    Map<String,Object> decode(String x) {try{return json.readValue(x,new TypeReference<>(){});}catch(Exception e){throw new IllegalStateException(e);} }
    String hash(String x) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(x.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);} }
    String token() {byte[] b=new byte[32];random.nextBytes(b);return HexFormat.of().formatHex(b);}
    void lock() {db.execute("SELECT pg_advisory_xact_lock(728124)");}
    void origin(HttpServletRequest r) { if(!Arrays.asList(origins.split(",")).contains(r.getHeader("Origin"))) throw new Problem(403,"Nguồn yêu cầu không được phép."); }
    Map<String,Object> actor(HttpServletRequest r) {
        String t=""; if(r.getCookies()!=null) for(var c:r.getCookies()) if(c.getName().equals("goihue_session"))t=c.getValue();
        var rows=db.queryForList("SELECT c.* FROM customers c JOIN sessions s ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>now() AND c.active=true",hash(t));
        if(rows.isEmpty())throw new Problem(401,"Vui lòng đăng nhập tài khoản Gói Huế.");return rows.getFirst();
    }
    boolean admin(Map<String,Object> a) {return "ADMIN".equals(a.get("role"));}
    void permission(Map<String,Object> a,String p) {
        Set<String> granted=admin(a)?Set.of("policy.manage","privacy.decide","return.decide","audit.read","catalog.manage","order.manage"):Set.of("self.manage","return.create","privacy.create","cart.manage","order.create");
        if(!granted.contains(p))throw new Problem(403,"Bạn không có quyền thực hiện thao tác này.");
    }
    Map<String,Object> safe(Map<String,Object> a) {var m=new LinkedHashMap<>(a);m.remove("password_hash");return m;}
    void cookie(HttpServletResponse res,String t,int age) {res.addHeader("Set-Cookie",ResponseCookie.from("goihue_session",t).httpOnly(true).sameSite("Strict").path("/api/store").maxAge(age).build().toString());}
    void audit(Map<String,Object> a,String subject,String action) {db.update("INSERT INTO audit(actor_id,subject,action) VALUES(?,?,?)",a.get("id"),subject,action);}
    Map<String,Object> save(String kind,UUID owner,Map<String,Object> data) {
        if(!data.containsKey("id")){data.put("id",UUID.randomUUID().toString());data.put("createdAt",Instant.now().toString());data.put("revision",1);}
        db.update("INSERT INTO records(id,kind,owner_id,data) VALUES(?,?,?,?::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",uuid(str(data,"id")),kind,owner,encode(data));return data;
    }
    Map<String,Object> record(String id,String kind,Map<String,Object> a) {
        var rows=db.queryForList("SELECT owner_id,data::text FROM records WHERE id=? AND kind=?",uuid(id),kind);
        if(rows.isEmpty()||(!admin(a)&&!a.get("id").equals(rows.getFirst().get("owner_id"))))throw new Problem(404,"Không tìm thấy hồ sơ.");
        return decode((String)rows.getFirst().get("data"));
    }
    UUID owner(String id) {return db.queryForObject("SELECT owner_id FROM records WHERE id=?",UUID.class,uuid(id));}
    List<Map<String,Object>> list(String kind,Map<String,Object> a) {
        return db.query(admin(a)?"SELECT data::text FROM records WHERE kind=? ORDER BY created_at DESC":"SELECT data::text FROM records WHERE kind=? AND owner_id=? ORDER BY created_at DESC",(rs,i)->decode(rs.getString(1)),admin(a)?new Object[]{kind}:new Object[]{kind,a.get("id")});
    }
    @PostConstruct void seed() {
        require(adminPassword.length()>=12,"Mật khẩu ADMIN phải có ít nhất 12 ký tự.");
        for(String email:List.of(adminEmail)) {
            UUID id=UUID.nameUUIDFromBytes(email.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            db.update("INSERT INTO customers(id,email,password_hash,role,name) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING",id,email,passwords.encode(adminPassword),"ADMIN","Quản trị Gói Huế");
        }
        if(db.queryForObject("SELECT count(*) FROM records WHERE kind='policy'",Integer.class)==0) {
            var p=new LinkedHashMap<String,Object>();p.put("title","Chính sách bảo mật Gói Huế");p.put("version","1.0-draft");p.put("content",POLICY);p.put("status","DRAFT");save("policy",null,p);
        }
    }
    static final String POLICY="""
        CHÍNH SÁCH BẢO MẬT GÓI HUẾ – DỰ THẢO CHỜ PHÊ DUYỆT

        1. Thông tin thu thập
        Họ tên, email, điện thoại, địa chỉ; thông tin tài khoản, đơn hàng, sản phẩm, số lượng, giá trị và trạng thái thanh toán; nội dung hỗ trợ và ảnh chứng cứ cần thiết.

        2. Mục đích sử dụng
        Quản lý tài khoản, xác nhận đơn mè xửng, thanh toán và giao hàng, giải quyết khiếu nại và đổi trả. Chỉ gửi ưu đãi khi có lựa chọn đồng ý phù hợp.

        3. Chia sẻ dữ liệu
        Chỉ chia sẻ thông tin cần thiết cho vận chuyển, thanh toán và nhân viên được phân quyền. Các đối tác cụ thể đang chờ xác nhận. Không dùng thông tin đơn để quảng cáo khi chưa có căn cứ phù hợp.

        4. Bảo vệ thông tin
        Hệ thống dùng mật khẩu BCrypt, phiên server và cookie HttpOnly, kiểm tra quyền và sở hữu, ảnh lưu riêng tư và nhật ký. Chưa được kiểm thử bảo mật production; không cam kết an toàn tuyệt đối.

        5. Quyền khách hàng
        Khách có thể yêu cầu xem, xuất, chỉnh sửa, xóa hoặc hạn chế xử lý theo điều kiện áp dụng; rút đồng ý tiếp thị và gửi khiếu nại. Dữ liệu cần giữ cho đối soát hoặc tranh chấp được ghi rõ khi phản hồi.

        6. Lưu trữ
        Chỉ lưu trong thời gian cần thiết cho mục đích và nghĩa vụ áp dụng. Thời hạn từng nhóm dữ liệu chờ phê duyệt; tác vụ xóa tự động chưa bật.

        7. Liên hệ
        Đơn vị dự kiến: Gói Huế. Email và đầu mối: Đang cập nhật. Dùng mục Quyền dữ liệu trong tài khoản để gửi yêu cầu và nhận mã theo dõi.
        """;
    @GetMapping("/policy") public Object policy() {return db.query("SELECT data::text FROM records WHERE kind='policy' ORDER BY created_at DESC LIMIT 1",(r,i)->decode(r.getString(1))).getFirst();}
    @PostMapping("/auth/{action}") @Transactional public Object auth(@PathVariable String action,@RequestBody Map<String,Object> body,HttpServletRequest req,HttpServletResponse res) {
        origin(req); lock();
        if(action.equals("logout")){actor(req);if(req.getCookies()!=null)for(var c:req.getCookies())if(c.getName().equals("goihue_session"))db.update("DELETE FROM sessions WHERE token_hash=?",hash(c.getValue()));cookie(res,"",0);return Map.of("ok",true);}
        String email=text(body,"email",150).toLowerCase(Locale.ROOT);require(email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"),"Email không hợp lệ.");String password=text(body,"password",72);
        require(password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=72,"Mật khẩu tối đa 72 byte UTF-8.");
        long now=System.currentTimeMillis();loginLimits.entrySet().removeIf(entry->entry.getValue()[1]<now);
        String limitKey=hash(email);long[] attempts=loginLimits.computeIfAbsent(limitKey,k->new long[]{0,now+900000});
        synchronized(attempts){if(attempts[0]>=12)throw new Problem(429,"Quá nhiều lần đăng nhập. Thử lại sau 15 phút.");attempts[0]++;}
        if(action.equals("register")) {
            require(password.length()>=12,"Mật khẩu cần ít nhất 12 ký tự.");
            require(db.queryForObject("SELECT count(*) FROM customers WHERE email=?",Integer.class,email)==0,"Email đã được sử dụng.");
            UUID id=UUID.randomUUID();db.update("INSERT INTO customers(id,email,password_hash,role,name) VALUES(?,?,?,'CUSTOMER',?)",id,email,passwords.encode(password),text(body,"name",100));
        } else if(!action.equals("login"))throw new Problem(404,"Không tìm thấy chức năng.");
        var rows=db.queryForList("SELECT * FROM customers WHERE email=? AND active=true",email);
        if(rows.isEmpty()||!passwords.matches(password,(String)rows.getFirst().get("password_hash")))throw new Problem(401,"Email hoặc mật khẩu không đúng.");
        loginLimits.remove(limitKey);
        var a=rows.getFirst();String t=token();db.update("DELETE FROM sessions WHERE expires_at<now()");db.update("INSERT INTO sessions VALUES(?,?,now()+interval '8 hours')",hash(t),a.get("id"));cookie(res,t,28800);audit(a,"session","LOGIN");return safe(a);
    }
    @GetMapping("/state") public Object state(HttpServletRequest req) {
        var a=actor(req);var out=new LinkedHashMap<String,Object>();out.put("user",safe(a));out.put("orders",list("order",a));out.put("privacy",list("privacy",a));out.put("returns",list("return",a));out.put("consents",list("consent",a));out.put("policy",policy());out.put("retention",Map.of("status","PENDING_APPROVAL","automaticDeletion",false));
        out.put("cartCount",admin(a)?0:db.queryForObject("SELECT COALESCE(sum((data->>'quantity')::int),0) FROM records WHERE kind='cart' AND owner_id=?",Integer.class,a.get("id")));
        if(admin(a)){out.put("audit",db.queryForList("SELECT id,subject,action,at FROM audit ORDER BY id DESC LIMIT 200"));out.put("policyVersions",list("policy",a));}return out;
    }
    @PostMapping("/command") @Transactional public Object command(@RequestBody Map<String,Object> b,@RequestHeader("Idempotency-Key") String key,HttpServletRequest req) {
        origin(req);lock();var a=actor(req);require(key.matches("[a-zA-Z0-9-]{16,80}"),"Khóa gửi lặp không hợp lệ.");
        String fingerprint=hash(encode(new TreeMap<>(b)));var previous=db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?",a.get("id"),key);
        if(!previous.isEmpty()){if(!fingerprint.equals(previous.getFirst().get("fingerprint")))throw new Problem(409,"Khóa đã được dùng với nội dung khác.");return decode((String)previous.getFirst().get("result"));}
        var result=execute(a,b);audit(a,str(result,"id"),text(b,"action",60));db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)",a.get("id"),key,fingerprint,encode(result));return result;
    }
    @SuppressWarnings("unchecked") Map<String,Object> execute(Map<String,Object> a,Map<String,Object> b) {
        String action=text(b,"action",60);UUID uid=(UUID)a.get("id");
        require(Set.of("profile","consent","policy","privacy-create","return-create","privacy-supplement","return-supplement","privacy-update","return-update").contains(action),"Thao tác không được hỗ trợ.");
        if(action.equals("profile")){permission(a,"self.manage");db.update("UPDATE customers SET name=?,phone=?,address=? WHERE id=?",text(b,"name",100),bounded(b,"phone",30),bounded(b,"address",400),uid);return Map.of("ok",true);}
        if(action.equals("consent")){permission(a,"self.manage");boolean granted=Boolean.TRUE.equals(b.get("granted"));db.update("UPDATE customers SET marketing=? WHERE id=?",granted,uid);var c=new LinkedHashMap<String,Object>();c.put("granted",granted);c.put("policyVersion",str((Map<String,Object>)policy(),"version"));return save("consent",uid,c);}
        if(action.equals("policy")){permission(a,"policy.manage");var p=new LinkedHashMap<String,Object>();p.put("version",text(b,"version",40));p.put("title","Chính sách bảo mật Gói Huế");p.put("content",text(b,"content",16000));p.put("status","DRAFT");return save("policy",null,p);}
        if(action.equals("privacy-create")){permission(a,"privacy.create");String type=text(b,"type",30);require(Set.of("ACCESS","EXPORT","DELETE","RESTRICT","COMPLAINT").contains(type),"Loại yêu cầu không hợp lệ.");var p=new LinkedHashMap<String,Object>();p.put("type",type);p.put("description",text(b,"description",2000));p.put("status","SUBMITTED");p.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","SUBMITTED","note","Đã tiếp nhận yêu cầu"))));return save("privacy",uid,p);}
        if(action.equals("return-create")) {
            permission(a,"return.create");var o=record(text(b,"orderId",50),"order",a);String reason=text(b,"reason",40);require(Set.of("WRONG_ITEM","MISSING_ITEM","DAMAGED","UNSAFE","QUALITY").contains(reason),"Lý do không hợp lệ.");
            require(str(o,"status").equals("DELIVERED"),"Chỉ tạo yêu cầu sau khi đơn đã giao.");
            boolean late=Instant.parse(str(o,"deliveredAt")).plus(Duration.ofDays(7)).isBefore(Instant.now());require(!late||Set.of("UNSAFE","QUALITY").contains(reason),"Đã quá cửa sổ dự thảo 7 ngày; lỗi chất lượng/an toàn vẫn được tiếp nhận.");
            String lineId=text(b,"lineId",50);var line=((List<Map<String,Object>>)o.getOrDefault("items",List.of())).stream().filter(l->str(l,"productId").equals(lineId)).findFirst().orElseThrow(()->new Problem(422,"Dòng hàng không thuộc đơn."));
            int qty=number(b,"quantity");int used=list("return",a).stream().filter(r->str(r,"orderId").equals(str(o,"id"))&&str(r,"lineId").equals(lineId)&&!str(r,"status").equals("REJECTED")).mapToInt(r->number(r,"quantity")).sum();require(qty>0&&qty+used<=number(line,"quantity"),"Số lượng vượt phần còn được yêu cầu.");
            List<String> evidence=(List<String>)b.getOrDefault("evidenceIds",List.of());require(evidence.size()<=5,"Tối đa 5 ảnh.");for(String id:evidence){var e=record(id,"evidence",a);require(str(e,"status").equals("STORED_UNSCANNED"),"Ảnh chưa lưu thành công.");}
            var r=new LinkedHashMap<String,Object>();r.put("orderId",str(o,"id"));r.put("orderNumber",str(o,"number"));r.put("lineId",lineId);r.put("product",str(line,"name"));r.put("unitPrice",number(line,"price"));r.put("quantity",qty);r.put("reason",reason);r.put("description",text(b,"description",2000));r.put("evidenceIds",evidence);r.put("status","REQUESTED");r.put("goods","NOT_REQUIRED");r.put("fulfillment","NOT_STARTED");r.put("resolution",text(b,"resolution",30));require(Set.of("REFUND","REPLACEMENT").contains(str(r,"resolution")),"Phương án không hợp lệ.");r.put("policyVersion","return-1.0-draft");r.put("amount",0);r.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","REQUESTED","note","Đã tiếp nhận yêu cầu"))));return save("return",uid,r);
        }
        boolean privacy=action.startsWith("privacy-");String kind=privacy?"privacy":"return";var r=record(text(b,"id",50),kind,a);UUID owner=owner(str(r,"id"));
        if(number(b,"revision")!=number(r,"revision"))throw new Problem(409,"Hồ sơ vừa thay đổi. Hãy tải lại.");
        String status=str(r,"status"),note=text(b,"note",2000);
        if(action.equals("return-supplement")||action.equals("privacy-supplement")) {
            require(!admin(a),"Bổ sung dành cho khách hàng.");require(!Set.of("RESOLVED","COMPLETED","REJECTED").contains(status),"Hồ sơ đã kết thúc.");
            if(action.equals("return-supplement")) {
                List<String> added=(List<String>)b.getOrDefault("evidenceIds",List.of());
                List<String> evidence=new ArrayList<>((List<String>)r.getOrDefault("evidenceIds",List.of()));
                require(added.size()<=5&&evidence.size()+added.size()<=5,"Mỗi yêu cầu đổi trả có tối đa 5 ảnh.");
                for(String id:added){
                    require(!evidence.contains(id),"Không thể đính kèm một ảnh nhiều lần.");
                    var e=record(id,"evidence",a);
                    require(str(e,"status").equals("STORED_UNSCANNED"),"Ảnh chưa lưu thành công.");
                    evidence.add(id);
                }
                r.put("evidenceIds",evidence);
            }
            if(status.equals("EVIDENCE_REQUIRED"))r.put("status","REVIEWING");
        } else {
            permission(a,privacy?"privacy.decide":"return.decide");String next=text(b,"status",40);
            if(privacy) {
                Map<String,Set<String>> transitions=Map.of("SUBMITTED",Set.of("REVIEWING"),"REVIEWING",Set.of("EVIDENCE_REQUIRED","COMPLETED","REJECTED"),"EVIDENCE_REQUIRED",Set.of("REVIEWING"));
                require(transitions.getOrDefault(status,Set.of()).contains(next),"Chuyển trạng thái không hợp lệ.");
                if(next.equals("COMPLETED")) {
                    String type=str(r,"type");
                    if(type.equals("EXPORT")||type.equals("ACCESS")){r.put("export",export(owner));}
                    if(type.equals("RESTRICT")){db.update("UPDATE customers SET marketing=false WHERE id=?",owner);r.put("result","Đã tắt tiếp thị. Các xử lý đơn/đối soát được giữ để xem xét thủ công; không xác nhận hạn chế toàn bộ.");}
                    if(type.equals("DELETE")) {
                        require(db.queryForObject("SELECT count(*) FROM records WHERE owner_id=? AND ((kind='order' AND data->>'status' NOT IN ('DELIVERED','CANCELLED')) OR (kind='return' AND data->>'status' NOT IN ('RESOLVED','REJECTED')))",Integer.class,owner)==0,"Cần xử lý xong các đơn hàng/yêu cầu đổi trả đang mở trước khi đóng tài khoản.");
                        db.update("DELETE FROM sessions WHERE customer_id=?",owner);db.update("UPDATE customers SET active=false,name='Tài khoản đã đóng',email=?,password_hash=?,phone='',address='',marketing=false WHERE id=?","deleted-"+owner+"@invalid.test",passwords.encode(token()),owner);
                        db.update("UPDATE records SET data=(data - 'description' - 'export') || jsonb_build_object('history',jsonb_build_array(jsonb_build_object('note','Nội dung đã ẩn danh theo yêu cầu đóng tài khoản'))) WHERE owner_id=? AND kind IN ('privacy','return')",owner);
                        for(var e:db.query("SELECT data::text FROM records WHERE kind='evidence' AND owner_id=?",(rs,i)->decode(rs.getString(1)),owner)){try{Files.deleteIfExists(storage.resolve(str(e,"id")));}catch(Exception ex){throw new Problem(503,"Chưa xóa được ảnh. Yêu cầu chưa hoàn tất.");}}
                        db.update("DELETE FROM records WHERE kind IN ('evidence','consent') AND owner_id=?",owner);r.put("description","Đã ẩn danh");r.remove("export");r.put("history",new ArrayList<>());r.put("result","Đã đóng tài khoản, xóa liên hệ/ảnh/lựa chọn tiếp thị và ẩn danh nội dung yêu cầu trong phân hệ. Giữ snapshot giao dịch và nhật ký phục vụ đối soát/tranh chấp; lịch lưu cụ thể chờ phê duyệt. Chưa tác động hệ thống khác.");
                        db.update("DELETE FROM operations WHERE actor_id=?",owner);
                        db.update("DELETE FROM records WHERE kind='cart' AND owner_id=?",owner);
                        db.update("UPDATE records SET data=data || jsonb_build_object('recipient','Đã ẩn danh','phone','','address','','history',jsonb_build_array(jsonb_build_object('note','Nội dung liên hệ đã ẩn danh; số liệu giao dịch được giữ phục vụ đối soát'))) WHERE kind='order' AND owner_id=?",owner);
                        db.update("UPDATE operations SET result=jsonb_build_object('redacted',true) WHERE result->>'id' IN (SELECT id::text FROM records WHERE owner_id=?)",owner);
                    }
                }
            } else {
                switch(next) {
                    case "REVIEWING" -> require(Set.of("REQUESTED","EVIDENCE_REQUIRED").contains(status),"Hồ sơ chưa thể xem xét.");
                    case "EVIDENCE_REQUIRED","REJECTED" -> require(status.equals("REVIEWING"),"Cần xem xét trước khi quyết định.");
                    case "APPROVED" -> {
                        require(status.equals("REVIEWING"),"Cần xem xét trước khi duyệt.");int q=number(b,"approvedQuantity");require(q>0&&q<=number(r,"quantity"),"Số lượng duyệt không hợp lệ.");r.put("approvedQuantity",q);r.put("amount",number(r,"unitPrice")*q);r.put("resolution",text(b,"resolution",30));require(Set.of("REFUND","REPLACEMENT").contains(str(r,"resolution")),"Phương án không hợp lệ.");r.put("goods",Boolean.TRUE.equals(b.get("returnRequired"))?"AWAITING_PICKUP":"NOT_REQUIRED");r.put("feeBearer","Gói Huế");
                    }
                    case "RECEIVED" -> {require(status.equals("APPROVED")&&str(r,"goods").equals("AWAITING_PICKUP"),"Chưa có thu hồi được duyệt.");r.put("goods","RECEIVED");}
                    case "INSPECTED" -> {require(status.equals("RECEIVED"),"Chưa nhận hàng trả.");String disposition=text(b,"disposition",30);require(Set.of("QUARANTINE","DAMAGED","DISPOSE").contains(disposition),"Thực phẩm trả không tự nhập lại tồn bán.");r.put("goods",disposition);}
                    case "PROCESSING" -> {require((status.equals("APPROVED")&&str(r,"goods").equals("NOT_REQUIRED"))||status.equals("INSPECTED"),"Chưa đủ điều kiện thực hiện.");var o=record(str(r,"orderId"),"order",a);if(str(r,"resolution").equals("REFUND"))require(str(o,"paymentStatus").equals("PAID"),"Chưa xác nhận thu tiền; chưa thể hoàn tiền.");r.put("fulfillment","MANUAL_PENDING");}
                    case "RESOLVED" -> {require(status.equals("PROCESSING"),"Chưa bắt đầu đổi/hoàn.");r.put("operationReference",text(b,"reference",200));r.put("fulfillment","MANUAL_CONFIRMED");r.put("completedAt",Instant.now().toString());}
                    default -> throw new Problem(422,"Trạng thái không hợp lệ.");
                }
            }
            r.put("status",next);
        }
        var history=(List<Object>)r.getOrDefault("history",new ArrayList<>());history.add(Map.of("at",Instant.now().toString(),"status",str(r,"status"),"note",note,"role",str(a,"role")));r.put("history",history);r.put("revision",number(r,"revision")+1);return save(kind,owner,r);
    }
    String bounded(Map<String,Object> b,String key,int max){String s=str(b,key);require(s.length()<=max,"Thông tin quá dài: "+key);return s;}
    Map<String,Object> export(UUID owner) {
        var a=db.queryForList("SELECT id,email,name,phone,address,marketing FROM customers WHERE id=?",owner).getFirst();
        var data=new LinkedHashMap<String,Object>();data.put("profile",a);data.put("scope","Dữ liệu tài khoản Gói Huế");for(String kind:List.of("order","cart","consent","return","privacy"))data.put(kind,db.query("SELECT (data-'export')::text FROM records WHERE owner_id=? AND kind=?",(rs,i)->decode(rs.getString(1)),owner,kind));return data;
    }
    @GetMapping("/privacy/{id}/export") public Object download(@PathVariable String id,HttpServletRequest req,HttpServletResponse response) {var r=record(id,"privacy",actor(req));require(str(r,"status").equals("COMPLETED")&&r.containsKey("export"),"Chưa có dữ liệu xuất.");response.setHeader("Content-Disposition","attachment; filename=goi-hue-data.json");return r.get("export");}
    @PostMapping("/evidence/intents") @Transactional public Object intent(@RequestBody Map<String,Object> b,HttpServletRequest req) {
        origin(req);var a=actor(req);permission(a,"return.create");var e=new LinkedHashMap<String,Object>();e.put("name",text(b,"name",120));e.put("status","UPLOADING");save("evidence",(UUID)a.get("id"),e);return Map.of("id",e.get("id"));
    }
    @PutMapping(value="/evidence/{id}/content",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE) @Transactional public Object upload(@PathVariable String id,@RequestBody byte[] bytes,HttpServletRequest req) throws Exception {
        origin(req);lock();var a=actor(req);var e=record(id,"evidence",a);require(str(e,"status").equals("UPLOADING"),"Ảnh đã được hoàn tất.");require(bytes.length>0&&bytes.length<=5*1024*1024,"Ảnh tối đa 5 MB.");
        boolean png=bytes.length>8&&HexFormat.of().formatHex(Arrays.copyOf(bytes,8)).equals("89504e470d0a1a0a"),jpg=bytes.length>3&&(bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255;require(png||jpg,"Chỉ chấp nhận nội dung PNG/JPEG.");
        Files.createDirectories(storage);Files.write(storage.resolve(id),bytes,StandardOpenOption.CREATE_NEW);e.put("status","STORED_UNSCANNED");e.put("mime",png?"image/png":"image/jpeg");e.put("scan","NOT_CONFIGURED");save("evidence",owner(id),e);audit(a,id,"EVIDENCE_STORED_UNSCANNED");return Map.of("id",id,"status","STORED_UNSCANNED");
    }
    @GetMapping("/evidence/{id}/content") public ResponseEntity<byte[]> image(@PathVariable String id,HttpServletRequest req) throws Exception {var a=actor(req);var e=record(id,"evidence",a);require(str(e,"status").equals("STORED_UNSCANNED"),"Ảnh chưa lưu.");return ResponseEntity.ok().header("Cache-Control","no-store").header("X-Content-Type-Options","nosniff").header("Content-Disposition","inline; filename=evidence."+(str(e,"mime").equals("image/png")?"png":"jpg")).contentType(MediaType.parseMediaType(str(e,"mime"))).body(Files.readAllBytes(storage.resolve(id)));}
    @ExceptionHandler(Exception.class) public ResponseEntity<?> error(Exception e) {int status=e instanceof Problem p?p.status:e instanceof org.springframework.web.bind.MissingRequestHeaderException||e instanceof org.springframework.http.converter.HttpMessageNotReadableException?400:500;String message=e instanceof Problem?e.getMessage():status==400?"Thiếu header hoặc nội dung JSON không hợp lệ.":"Không thể xử lý yêu cầu. Vui lòng thử lại.";return ResponseEntity.status(status).body(Map.of("code","STORE_"+status,"message",message,"requestId",UUID.randomUUID().toString()));}
}
