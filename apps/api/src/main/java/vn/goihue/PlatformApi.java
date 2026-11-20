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
    private final StoreLive live;
    private final ObjectMapper json;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
    private final SecureRandom random = new SecureRandom();
    private final java.util.concurrent.ConcurrentHashMap<String,long[]> loginLimits = new java.util.concurrent.ConcurrentHashMap<>();
    private final Path storage = Path.of("/data");
    @Value("${ADMIN_EMAIL:admin@goihue.local}") String adminEmail;
    @Value("${ADMIN_PASSWORD}") String adminPassword;
    @Value("${APP_ORIGINS:http://localhost:3000}") String origins;
    @Value("${APP_COOKIE_SECURE:false}") boolean secureCookie;
    public PlatformApi(JdbcTemplate db, ObjectMapper json, StoreLive live) { this.db=db; this.json=json; this.live=live; }
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
    void origin(HttpServletRequest r) { if(Arrays.stream(origins.split(",")).map(String::trim).noneMatch(value -> value.equals(r.getHeader("Origin")))) throw new Problem(403,"Nguồn yêu cầu không được phép."); }
    Map<String,Object> actor(HttpServletRequest r) {
        return sessionActor(sessionToken(r));
    }
    String sessionToken(HttpServletRequest r) {
        if(r.getCookies()!=null) for(var c:r.getCookies()) if(c.getName().equals("goihue_session")) return c.getValue();
        return "";
    }
    Map<String,Object> sessionActor(String t) {
        var rows=db.queryForList("SELECT c.* FROM customers c JOIN sessions s ON c.id=s.customer_id WHERE s.token_hash=? AND s.expires_at>now() AND c.active=true",hash(t));
        if(rows.isEmpty())throw new Problem(401,"Vui lòng đăng nhập tài khoản Gói Huế.");return rows.getFirst();
    }
    boolean admin(Map<String,Object> a) {return "ADMIN".equals(a.get("role"));}
    void permission(Map<String,Object> a,String p) {
        Set<String> granted=admin(a)?Set.of("policy.manage","privacy.decide","return.decide","audit.read","catalog.manage","discount.manage","pricing.manage","order.manage"):Set.of("self.manage","return.create","privacy.create","cart.manage","order.create");
        if(!granted.contains(p))throw new Problem(403,"Bạn không có quyền thực hiện thao tác này.");
    }
    Map<String,Object> safe(Map<String,Object> a) {var m=new LinkedHashMap<>(a);m.remove("password_hash");return m;}
    void cookie(HttpServletResponse res,String t,int age) {res.addHeader("Set-Cookie",ResponseCookie.from("goihue_session",t).httpOnly(true).secure(secureCookie).sameSite("Strict").path("/api/store").maxAge(age).build().toString());}
    void audit(Map<String,Object> a,String subject,String action) {db.update("INSERT INTO audit(actor_id,subject,action) VALUES(?,?,?)",a.get("id"),subject,action);}
    Map<String,Object> save(String kind,UUID owner,Map<String,Object> data) {
        if(!data.containsKey("id")){data.put("id",UUID.randomUUID().toString());data.put("createdAt",Instant.now().toString());data.put("revision",1);}
        db.update("INSERT INTO records(id,kind,owner_id,data) VALUES(?,?,?,?::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",uuid(str(data,"id")),kind,owner,encode(data));
        if(kind.equals("order") || kind.equals("return")) live.changed(owner);
        return data;
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
        var a=actor(req);var out=new LinkedHashMap<String,Object>();out.put("user",safe(a));out.put("addresses",admin(a)?List.of():list("address",a));out.put("orders",list("order",a));out.put("privacy",list("privacy",a));out.put("returns",list("return",a));out.put("consents",list("consent",a));out.put("policy",policy());out.put("retention",Map.of("status","PENDING_APPROVAL","automaticDeletion",false));
        out.put("cartCount",admin(a)?0:db.queryForObject("SELECT COALESCE(sum((data->>'quantity')::int),0) FROM records WHERE kind='cart' AND owner_id=?",Integer.class,a.get("id")));
        if(admin(a)){
            out.put("audit",db.queryForList("""
                SELECT a.id,a.subject,a.action,a.at,c.name AS "actorName",c.role AS "actorRole",
                       r.kind AS "subjectKind",
                       CASE r.kind
                           WHEN 'order' THEN r.data->>'number'
                           WHEN 'return' THEN r.data->>'orderNumber'
                           WHEN 'product' THEN r.data->>'name'
                           WHEN 'discount' THEN r.data->>'name'
                           WHEN 'pricing-rule' THEN r.data->>'name'
                           WHEN 'category' THEN r.data->>'name'
                           WHEN 'policy' THEN r.data->>'version'
                       END AS "subjectLabel"
                FROM (SELECT * FROM audit ORDER BY id DESC LIMIT 200) a
                LEFT JOIN customers c ON c.id=a.actor_id
                LEFT JOIN records r ON r.id=CASE
                    WHEN a.subject ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN a.subject::uuid
                END
                ORDER BY a.id DESC
                """));
            out.put("policyVersions",list("policy",a));
        }
        return out;
    }
    @PostMapping("/password") @Transactional
    public Object changePassword(@RequestBody Map<String,Object> body,HttpServletRequest req) {
        origin(req); lock();
        String currentToken = sessionToken(req);
        var a = sessionActor(currentToken);
        String current = text(body,"currentPassword",72);
        String replacement = text(body,"newPassword",72);
        require(current.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,"Mật khẩu hiện tại không hợp lệ.");
        require(replacement.length() >= 12 && replacement.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72,
                "Mật khẩu mới cần ít nhất 12 ký tự và tối đa 72 byte UTF-8.");
        require(passwords.matches(current,(String)a.get("password_hash")),"Mật khẩu hiện tại không đúng.");
        require(!current.equals(replacement),"Hãy chọn mật khẩu khác mật khẩu hiện tại.");
        db.update("UPDATE customers SET password_hash=? WHERE id=?",passwords.encode(replacement),a.get("id"));
        db.update("DELETE FROM sessions WHERE customer_id=? AND token_hash<>?",a.get("id"),hash(currentToken));
        audit(a,"session","PASSWORD_CHANGED");
        return Map.of("ok",true);
    }

    private Map<String,Object> address(Map<String,Object> a,Map<String,Object> body,String action) {
        permission(a,"self.manage");
        UUID owner = (UUID)a.get("id");
        String id = str(body,"id");
        var row = id.isEmpty() ? new LinkedHashMap<String,Object>() : record(id,"address",a);
        if (!id.isEmpty() && number(body,"revision") != number(row,"revision"))
            throw new Problem(409,"Địa chỉ vừa thay đổi. Hãy tải lại.");
        if (action.equals("address-delete")) {
            if (id.isEmpty()) throw new Problem(404,"Không tìm thấy địa chỉ.");
            boolean wasDefault = Boolean.TRUE.equals(row.get("isDefault"));
            db.update("DELETE FROM records WHERE id=? AND owner_id=? AND kind='address'",uuid(id),owner);
            if (wasDefault) {
                var remaining = list("address", a);
                if (!remaining.isEmpty()) {
                    var first = remaining.getFirst();
                    first.put("isDefault", true);
                    first.put("revision", number(first,"revision")+1);
                    save("address", owner, first);
                }
            }
            return Map.of("id",id,"deleted",true);
        }
        if (id.isEmpty()) require(list("address",a).size()<20,"Bạn có thể lưu tối đa 20 địa chỉ.");
        row.put("label",text(body,"label",60));
        row.put("recipient",text(body,"recipient",100));
        String phone = text(body,"phone",30);
        require(phone.matches("[+0-9() .-]{8,30}") && phone.chars().filter(Character::isDigit).count() >= 8,
                "Số điện thoại không hợp lệ.");
        row.put("phone",phone);
        row.put("address",text(body,"address",400));
        boolean isDefault = Boolean.TRUE.equals(body.get("isDefault")) || "true".equalsIgnoreCase(String.valueOf(body.get("isDefault")));
        if (isDefault) {
            for (var addr : list("address", a)) {
                if (!str(addr, "id").equals(id) && Boolean.TRUE.equals(addr.get("isDefault"))) {
                    addr.put("isDefault", false);
                    addr.put("revision", number(addr,"revision")+1);
                    save("address", owner, addr);
                }
            }
        } else if (list("address", a).stream().noneMatch(addr -> !str(addr, "id").equals(id) && Boolean.TRUE.equals(addr.get("isDefault")))) {
            isDefault = true;
        }
        row.put("isDefault", isDefault);
        if (!id.isEmpty()) row.put("revision",number(row,"revision")+1);
        return save("address",owner,row);
    }

    private int reservedReturnQuantity(Map<String, Object> request) {
        return request.containsKey("approvedQuantity") ? number(request, "approvedQuantity") : number(request, "quantity");
    }

    private int returnAmount(Map<String, Object> request, int quantity) {
        if (!(request.get("refundSlots") instanceof List<?> slots)) return number(request, "unitPrice") * quantity;
        int lineNet = number(request, "lineNetTotal"), lineQuantity = number(request, "lineQuantity");
        int remainder = lineNet % lineQuantity;
        int amount = (lineNet / lineQuantity) * quantity;
        for (Object slot : slots.subList(0, quantity)) {
            if (((Number) slot).intValue() < remainder) amount++;
        }
        return amount;
    }

    @PostMapping("/command") @Transactional public Object command(@RequestBody Map<String,Object> b,@RequestHeader("Idempotency-Key") String key,HttpServletRequest req) {
        origin(req);lock();var a=actor(req);require(key.matches("[a-zA-Z0-9-]{16,80}"),"Khóa gửi lặp không hợp lệ.");
        String fingerprint=hash(encode(new TreeMap<>(b)));var previous=db.queryForList("SELECT fingerprint,result::text FROM operations WHERE actor_id=? AND key=?",a.get("id"),key);
        if(!previous.isEmpty()){if(!fingerprint.equals(previous.getFirst().get("fingerprint")))throw new Problem(409,"Khóa đã được dùng với nội dung khác.");return decode((String)previous.getFirst().get("result"));}
        b.remove("internalAction");var result=execute(a,b);audit(a,str(result,"id"),text(b,"action",60));db.update("INSERT INTO operations VALUES(?,?,?,?::jsonb)",a.get("id"),key,fingerprint,encode(result));return result;
    }
    private boolean missingReturnItem(String reason) {
        return Set.of("MISSING_ITEM","NOT_RECEIVED").contains(reason);
    }
    private void validateReturnResolution(String reason,String resolution,boolean admin) {
        require(Set.of("REFUND","REPLACEMENT","MAKE_UP","ADJUST_DUE").contains(resolution)
                && (admin || !resolution.equals("ADJUST_DUE"))
                && (!resolution.equals("MAKE_UP") || missingReturnItem(reason))
                && (!resolution.equals("REPLACEMENT") || !missingReturnItem(reason)),
                "Phương án không phù hợp với lý do đổi trả.");
    }
    private Map<String,Object> validateReturnPayment(Map<String,Object> row,Map<String,Object> actor) {
        String resolution=str(row,"resolution");
        if (!Set.of("REFUND", "ADJUST_DUE").contains(resolution)) return null;
        var order = record(str(row, "orderId"), "order", actor);
        String paymentStatus = str(order, "paymentStatus");
        if (resolution.equals("REFUND")) {
            require(paymentStatus.equals("PAID"), "Chưa xác nhận thu tiền; chưa thể hoàn tiền.");
        } else {
            require(CodPayment.isCod(order) && paymentStatus.equals("UNPAID"),
                    "Chỉ điều chỉnh khoản phải thu cho đơn COD chưa thu tiền.");
        }
        return order;
    }

    @SuppressWarnings("unchecked")
    private void adjustCodDue(Map<String,Object> order, Map<String,Object> request,
                              Map<String,Object> actor, String now) {
        int amount = number(request, "amount");
        int due = CodPayment.amountDue(this, order);
        require(amount > 0 && amount <= due, "Số tiền điều chỉnh vượt khoản COD còn phải thu.");
        int newDue = due - amount;
        order.put("codDueAmount", newDue);
        order.put("revision", number(order, "revision") + 1);
        request.put("codDueAfterAmount", newDue);
        ((List<Object>) order.get("history")).add(Map.of(
                "at", now, "status", str(order, "status"), "action", "order-cod-adjust",
                "note", "Đã giảm khoản phải thu COD " + amount + " đ theo hồ sơ đổi trả. Còn phải thu " + newDue + " đ."));
        save("order", owner(str(order, "id")), order);
        audit(actor, str(order, "id"), "order-cod-adjust");
    }
    @SuppressWarnings("unchecked") Map<String,Object> execute(Map<String,Object> a,Map<String,Object> b) {
        String action=text(b,"action",60);UUID uid=(UUID)a.get("id");
        require(Set.of("profile","address-save","address-delete","consent","policy","privacy-create","return-create","privacy-supplement","return-supplement","privacy-update","return-update","return-submit","return-confirm","return-withdraw").contains(action),"Thao tác không được hỗ trợ.");
        if(action.equals("profile")){permission(a,"self.manage");db.update("UPDATE customers SET name=?,phone=?,address=? WHERE id=?",text(b,"name",100),bounded(b,"phone",30),bounded(b,"address",400),uid);return Map.of("ok",true);}
        if(action.equals("address-save") || action.equals("address-delete")) return address(a,b,action);
        if(action.equals("consent")){permission(a,"self.manage");boolean granted=Boolean.TRUE.equals(b.get("granted"));db.update("UPDATE customers SET marketing=? WHERE id=?",granted,uid);var c=new LinkedHashMap<String,Object>();c.put("granted",granted);c.put("policyVersion",str((Map<String,Object>)policy(),"version"));return save("consent",uid,c);}
        if(action.equals("policy")){permission(a,"policy.manage");var p=new LinkedHashMap<String,Object>();p.put("version",text(b,"version",40));p.put("title","Chính sách bảo mật Gói Huế");p.put("content",text(b,"content",16000));p.put("status","DRAFT");return save("policy",null,p);}
        if(action.equals("privacy-create")){permission(a,"privacy.create");String type=text(b,"type",30);require(Set.of("ACCESS","EXPORT","DELETE","RESTRICT","COMPLAINT").contains(type),"Loại yêu cầu không hợp lệ.");var p=new LinkedHashMap<String,Object>();p.put("type",type);p.put("description",text(b,"description",2000));p.put("status","SUBMITTED");p.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","SUBMITTED","note","Đã tiếp nhận yêu cầu"))));return save("privacy",uid,p);}
        if(action.equals("return-submit")) {
            permission(a,"return.create");
            if (!(b.get("items") instanceof List<?> items) || items.isEmpty() || items.size()>50)
                throw new Problem(422,"Chọn từ 1 đến 50 dòng hàng.");
            String caseId=UUID.randomUUID().toString();
            var saved=new ArrayList<Map<String,Object>>();
            var products=new HashSet<UUID>();
            for(var item:items) {
                if (!(item instanceof Map<?,?>)) throw new Problem(422,"Dòng hàng không hợp lệ.");
                var line=new LinkedHashMap<>((Map<String,Object>)item);
                require(products.add(uuid(text(line,"lineId",50))),"Mỗi sản phẩm chỉ được chọn một lần trong hồ sơ.");
                line.put("action","return-create");
                line.put("orderId",b.get("orderId"));
                line.put("caseId",caseId);
                line.put("internalAction","return-submit");
                line.put("evidenceIds",b.getOrDefault("evidenceIds",List.of()));
                saved.add(execute(a,line));
            }
            return Map.of("id",saved.getFirst().get("id"),"caseId",caseId,"items",saved);
        }
        if(action.equals("return-create")) {
            permission(a,"return.create");var o=record(text(b,"orderId",50),"order",a);String reason=text(b,"reason",40);require(Set.of("WRONG_ITEM","MISSING_ITEM","DAMAGED","UNSAFE","QUALITY","NOT_RECEIVED","CHANGE_OF_MIND").contains(reason),"Lý do không hợp lệ.");
            require(str(o,"status").equals("DELIVERED"),"Chỉ tạo yêu cầu sau khi đơn đã giao.");
            boolean late=Instant.parse(str(o,"deliveredAt")).plus(Duration.ofDays(7)).isBefore(Instant.now());require(!late||Set.of("UNSAFE","QUALITY").contains(reason),"Đã quá cửa sổ dự thảo 7 ngày; lỗi chất lượng/an toàn vẫn được tiếp nhận.");
            String lineId=text(b,"lineId",50);var line=((List<Map<String,Object>>)o.getOrDefault("items",List.of())).stream().filter(l->str(l,"productId").equals(lineId)).findFirst().orElseThrow(()->new Problem(422,"Dòng hàng không thuộc đơn."));
            int qty = number(b, "quantity"), lineQuantity = number(line, "quantity");
            require(qty > 0 && qty <= lineQuantity, "Số lượng yêu cầu không hợp lệ.");
            var existing = list("return", a).stream()
                    .filter(r -> str(r, "orderId").equals(str(o, "id")) && str(r, "lineId").equals(lineId)
                            && !Set.of("REJECTED", "WITHDRAWN").contains(str(r, "status"))).toList();
            int used = existing.stream().mapToInt(this::reservedReturnQuantity).sum();
            require(qty + used <= lineQuantity, "Số lượng vượt phần còn được yêu cầu.");
            List<String> evidence=(List<String>)b.getOrDefault("evidenceIds",List.of());require(evidence.size()<=5,"Tối đa 5 ảnh.");for(String id:evidence){var e=record(id,"evidence",a);require(str(e,"status").equals("STORED_UNSCANNED"),"Ảnh chưa lưu thành công.");}
            var r=new LinkedHashMap<String,Object>();r.put("orderId",str(o,"id"));r.put("orderNumber",str(o,"number"));r.put("lineId",lineId);r.put("product",str(line,"name"));r.put("unitPrice",number(line,"price"));
            if (line.containsKey("netTotal")) {
                var reserved = new BitSet(lineQuantity);
                for (var previous : existing) {
                    if (previous.get("refundSlots") instanceof List<?> slots) {
                        for (Object slot : slots.subList(0, reservedReturnQuantity(previous)))
                            reserved.set(((Number) slot).intValue());
                    }
                }
                var slots = new ArrayList<Integer>();
                for (int index = 0; index < qty; index++) {
                    int slot = reserved.nextClearBit(0);
                    reserved.set(slot);
                    slots.add(slot);
                }
                r.put("refundSlots", slots);
                r.put("lineNetTotal", line.get("netTotal"));
                r.put("lineQuantity", lineQuantity);
            }
            r.put("quantity",qty);r.put("reason",reason);if(b.containsKey("caseId") && "return-submit".equals(str(b,"internalAction")))r.put("caseId",str(b,"caseId"));r.put("description",text(b,"description",2000));r.put("evidenceIds",evidence);r.put("status","REQUESTED");r.put("goods","NOT_REQUIRED");r.put("fulfillment","NOT_STARTED");r.put("resolution",text(b,"resolution",30));validateReturnResolution(reason,str(r,"resolution"),false);r.put("policyVersion","return-1.0-draft");r.put("amount",0);r.put("history",new ArrayList<>(List.of(Map.of("at",Instant.now().toString(),"status","REQUESTED","note","Đã tiếp nhận yêu cầu"))));return save("return",uid,r);
        }
        boolean privacy=action.startsWith("privacy-");String kind=privacy?"privacy":"return";var r=record(text(b,"id",50),kind,a);UUID owner=owner(str(r,"id"));
        if(number(b,"revision")!=number(r,"revision"))throw new Problem(409,"Hồ sơ vừa thay đổi. Hãy tải lại.");
        String status=str(r,"status"),note=text(b,"note",2000);boolean resumed=false;
        if(action.equals("return-confirm") || action.equals("return-withdraw")) {
            permission(a,"return.create");
            if(action.equals("return-confirm")) {
                require(status.equals("CUSTOMER_CONFIRMATION"),"Không có phương án chờ xác nhận.");
                r.put("approvedQuantity",r.remove("proposedQuantity"));
                r.put("status","APPROVED");
            } else {
                require(Set.of("REQUESTED","REVIEWING","EVIDENCE_REQUIRED","CUSTOMER_CONFIRMATION").contains(status),"Yêu cầu đã chuyển sang thực hiện.");
                r.put("status","WITHDRAWN");
            }
        } else if(action.equals("return-supplement")||action.equals("privacy-supplement")) {
            require(!admin(a),"Bổ sung dành cho khách hàng.");require(!Set.of("RESOLVED","COMPLETED","REJECTED","WITHDRAWN").contains(status),"Hồ sơ đã kết thúc.");
            if(action.equals("return-supplement")) {
                if(!status.equals("EVIDENCE_REQUIRED")) throw new Problem(409,"Chỉ gửi bổ sung khi cửa hàng yêu cầu.");
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
                    if(type.equals("RESTRICT")) {
                        db.update("UPDATE customers SET marketing=false WHERE id=?",owner);
                        db.update("UPDATE records SET data=data || jsonb_build_object('personalization',false,'historyUse',false,'memoryUse',false,'revision',COALESCE((data->>'revision')::int,0)+1) WHERE owner_id=? AND kind='consent' AND data->>'purpose'='shopping-assistant-v1'",owner);
                        db.update("DELETE FROM records WHERE owner_id=? AND kind IN ('chat','ai_memory')",owner);
                        db.update("UPDATE records SET data=(data #- '{export,chat}') #- '{export,ai_memory}' WHERE owner_id=? AND kind='privacy'",owner);
                        db.update("UPDATE operations SET result=(result #- '{export,chat}') #- '{export,ai_memory}' WHERE result->>'id' IN (SELECT id::text FROM records WHERE kind='privacy' AND owner_id=?)",owner);
                        r.put("result","Đã tắt tiếp thị, cá nhân hóa, lưu lịch sử và ghi nhớ trợ lý. Các xử lý đơn/đối soát được giữ để xem xét thủ công; không xác nhận hạn chế toàn bộ.");
                    }
                    if(type.equals("DELETE")) {
                        require(db.queryForObject("SELECT count(*) FROM records WHERE owner_id=? AND ((kind='order' AND data->>'status' NOT IN ('DELIVERED','CANCELLED')) OR (kind='return' AND data->>'status' NOT IN ('RESOLVED','REJECTED','WITHDRAWN')))",Integer.class,owner)==0,"Cần xử lý xong các đơn hàng/yêu cầu đổi trả đang mở trước khi đóng tài khoản.");
                        db.update("DELETE FROM sessions WHERE customer_id=?",owner);db.update("UPDATE customers SET active=false,name='Tài khoản đã đóng',email=?,password_hash=?,phone='',address='',marketing=false WHERE id=?","deleted-"+owner+"@invalid.test",passwords.encode(token()),owner);
                        db.update("UPDATE records SET data=(data - 'description' - 'export') || jsonb_build_object('history',jsonb_build_array(jsonb_build_object('note','Nội dung đã ẩn danh theo yêu cầu đóng tài khoản'))) WHERE owner_id=? AND kind IN ('privacy','return')",owner);
                        for(var e:db.query("SELECT data::text FROM records WHERE kind='evidence' AND owner_id=?",(rs,i)->decode(rs.getString(1)),owner)){try{Files.deleteIfExists(storage.resolve(str(e,"id")));}catch(Exception ex){throw new Problem(503,"Chưa xóa được ảnh. Yêu cầu chưa hoàn tất.");}}
                        db.update("DELETE FROM records WHERE kind IN ('evidence','consent','address','chat','ai_memory') AND owner_id=?",owner);r.put("description","Đã ẩn danh");r.remove("export");r.put("history",new ArrayList<>());r.put("result","Đã đóng tài khoản, xóa liên hệ/ảnh/lựa chọn tiếp thị, lịch sử và ghi nhớ trợ lý và ẩn danh nội dung yêu cầu trong phân hệ. Giữ snapshot giao dịch và nhật ký phục vụ đối soát/tranh chấp; lịch lưu cụ thể chờ phê duyệt. Chưa tác động hệ thống khác.");
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
                    case "WAITING_STOCK","PAYMENT_REVIEW","EXCEPTION" -> {
                        require(Set.of("APPROVED","RECEIVED","INSPECTED","PROCESSING","REPLACEMENT_SENT").contains(status),"Chưa thể ghi nhận vướng mắc.");
                        boolean shipment=Set.of("REPLACEMENT","MAKE_UP").contains(str(r,"resolution"));
                        require(!next.equals("WAITING_STOCK")||(shipment && Set.of("APPROVED","INSPECTED","PROCESSING").contains(status)),"Chỉ chờ tồn kho khi cần gửi hàng.");
                        require(!next.equals("PAYMENT_REVIEW")||Set.of("REFUND","ADJUST_DUE").contains(str(r,"resolution")),"Phương án này không cần đối soát thanh toán.");
                        r.put("resumeStatus",status);
                    }
                    case "RESUME" -> {
                        require(Set.of("WAITING_STOCK","PAYMENT_REVIEW","EXCEPTION").contains(status),"Hồ sơ không ở trạng thái chờ.");
                        next=str(r,"resumeStatus");
                        if(str(r,"resolution").equals("REFUND") && (status.equals("PAYMENT_REVIEW")
                                || status.equals("EXCEPTION") && Set.of("INSPECTED","PROCESSING").contains(next))) {
                            validateReturnPayment(r,a);
                        }
                        r.remove("resumeStatus");
                        resumed=true;
                    }
                    case "APPROVED" -> {
                        require(status.equals("REVIEWING") || (Set.of("WAITING_STOCK","PAYMENT_REVIEW").contains(status)
                                && str(r,"resumeStatus").equals("APPROVED") && str(r,"goods").equals("NOT_REQUIRED")),
                                "Cần xem xét trước khi duyệt.");
                        r.remove("resumeStatus");
                        int q = number(b,"approvedQuantity");
                        require(q > 0 && q <= number(r,"quantity"), "Số lượng duyệt không hợp lệ.");
                        if (r.containsKey("approvedQuantity")) {
                            require(q <= number(r,"approvedQuantity"), "Không thể tăng số lượng đã duyệt.");
                        }
                        String previousResolution = str(r,"resolution");
                        String resolution = text(b,"resolution",30);
                        r.put("approvedQuantity",q);
                        r.put("amount",returnAmount(r, q));
                        r.put("resolution",resolution);
                        validateReturnResolution(str(r,"reason"),resolution,true);
                        if (resolution.equals("ADJUST_DUE")) validateReturnPayment(r,a);
                        require(!Boolean.TRUE.equals(b.get("returnRequired")) || !missingReturnItem(str(r,"reason")),
                                "Không thể thu hồi hàng chưa nhận.");
                        r.put("goods",Boolean.TRUE.equals(b.get("returnRequired"))?"AWAITING_PICKUP":"NOT_REQUIRED");
                        r.put("feeBearer","Gói Huế");
                        if (!resolution.equals(previousResolution)) {
                            r.put("proposedQuantity", r.remove("approvedQuantity"));
                            next = "CUSTOMER_CONFIRMATION";
                        }
                    }
                    case "RECEIVED" -> {require(status.equals("APPROVED")&&str(r,"goods").equals("AWAITING_PICKUP"),"Chưa có thu hồi được duyệt.");int received=b.containsKey("receivedQuantity")?number(b,"receivedQuantity"):number(r,"approvedQuantity");require(received>=0&&received<=number(r,"approvedQuantity"),"Số lượng nhận không hợp lệ.");r.put("receivedQuantity",received);r.put("goods","RECEIVED");if(received<number(r,"approvedQuantity")){r.put("resumeStatus",received==0?"APPROVED":"RECEIVED");next="EXCEPTION";}}
                    case "INSPECTED" -> {require(status.equals("RECEIVED"),"Chưa nhận hàng trả.");String disposition=text(b,"disposition",30);require(Set.of("QUARANTINE","DAMAGED","DISPOSE").contains(disposition),"Thực phẩm trả không tự nhập lại tồn bán.");int inspected=b.containsKey("inspectedQuantity")?number(b,"inspectedQuantity"):number(r,"approvedQuantity");int received=r.containsKey("receivedQuantity")?number(r,"receivedQuantity"):number(r,"approvedQuantity");require(inspected>0&&inspected<=received,"Số lượng đạt kiểm hàng không hợp lệ.");if(inspected<number(r,"approvedQuantity")){r.put("approvedQuantity",inspected);r.put("amount",returnAmount(r, inspected));}r.put("goods",disposition);}
                    case "PROCESSING" -> {require((status.equals("APPROVED")&&str(r,"goods").equals("NOT_REQUIRED"))||status.equals("INSPECTED"),"Chưa đủ điều kiện thực hiện.");validateReturnPayment(r,a);r.put("fulfillment","MANUAL_PENDING");}
                    case "REPLACEMENT_SENT" -> {require(status.equals("PROCESSING")&&Set.of("REPLACEMENT","MAKE_UP").contains(str(r,"resolution")),"Chưa thể gửi hàng.");r.put("replacementTracking",text(b,"reference",200));}
                    case "RESOLVED" -> {
                        boolean shipment = Set.of("REPLACEMENT", "MAKE_UP").contains(str(r, "resolution"));
                        require(shipment ? (status.equals("REPLACEMENT_SENT") ||
                                (status.equals("PROCESSING") && !r.containsKey("caseId"))) : status.equals("PROCESSING"),
                                "Chưa đủ điều kiện xác nhận kết quả.");
                        var order = validateReturnPayment(r, a);
                        String now = Instant.now().toString();
                        r.put("operationReference", text(b, "reference", 200));
                        r.put("fulfillment", "MANUAL_CONFIRMED");
                        r.put("completedAt", now);
                        if (str(r, "resolution").equals("ADJUST_DUE")) {
                            adjustCodDue(order, r, a, now);
                        }
                    }
                    default -> throw new Problem(422,"Trạng thái không hợp lệ.");
                }
            }
            r.put("status",next);
        }
        var history=(List<Object>)r.getOrDefault("history",new ArrayList<>());var entry=new LinkedHashMap<String,Object>(Map.of("at",Instant.now().toString(),"status",str(r,"status"),"note",note,"role",str(a,"role")));if(resumed)entry.put("transition","RESUME");history.add(entry);r.put("history",history);r.put("revision",number(r,"revision")+1);return save(kind,owner,r);
    }
    String bounded(Map<String,Object> b,String key,int max){String s=str(b,key);require(s.length()<=max,"Thông tin quá dài: "+key);return s;}
    Map<String,Object> export(UUID owner) {
        var a=db.queryForList("SELECT id,email,name,phone,address,marketing FROM customers WHERE id=?",owner).getFirst();
        var data=new LinkedHashMap<String,Object>();data.put("profile",a);data.put("scope","Dữ liệu tài khoản Gói Huế");for(String kind:List.of("order","cart","consent","return","privacy","address","chat","ai_memory","payment-event"))data.put(kind,db.query("SELECT (data-'export')::text FROM records WHERE owner_id=? AND kind=?",(rs,i)->decode(rs.getString(1)),owner,kind));return data;
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
    @GetMapping("/evidence/{id}/content")
    public ResponseEntity<byte[]> image(@PathVariable String id,HttpServletRequest req) throws Exception {
        var evidence=record(id,"evidence",actor(req));
        require(str(evidence,"status").equals("STORED_UNSCANNED"),"Ảnh chưa lưu.");
        byte[] bytes;
        try {
            bytes=Files.readAllBytes(storage.resolve(id));
        } catch (java.nio.file.NoSuchFileException missing) {
            throw new Problem(404,"Tệp ảnh đính kèm không còn trong kho lưu trữ.");
        }
        return ResponseEntity.ok()
                .header("Cache-Control","no-store")
                .header("X-Content-Type-Options","nosniff")
                .header("Content-Disposition","inline; filename=evidence."+(str(evidence,"mime").equals("image/png")?"png":"jpg"))
                .contentType(MediaType.parseMediaType(str(evidence,"mime")))
                .body(bytes);
    }
    @ExceptionHandler(Exception.class) public ResponseEntity<?> error(Exception e) {int status=e instanceof Problem p?p.status:e instanceof org.springframework.web.bind.MissingRequestHeaderException||e instanceof org.springframework.http.converter.HttpMessageNotReadableException?400:500;String message=e instanceof Problem?e.getMessage():status==400?"Thiếu header hoặc nội dung JSON không hợp lệ.":"Không thể xử lý yêu cầu. Vui lòng thử lại.";return ResponseEntity.status(status).body(Map.of("code","STORE_"+status,"message",message,"requestId",UUID.randomUUID().toString()));}
}
