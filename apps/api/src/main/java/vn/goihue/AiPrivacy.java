package vn.goihue;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@Service
public class AiPrivacy {
    static final String PURPOSE = "shopping-assistant-v1";
    private final PlatformApi app;
    private final JdbcTemplate db;
    private final TransactionTemplate transactions;

    public AiPrivacy(PlatformApi app, JdbcTemplate db, PlatformTransactionManager manager) {
        this.app = app;
        this.db = db;
        this.transactions = new TransactionTemplate(manager);
    }

    Map<String, Object> customer(HttpServletRequest request) {
        var actor = app.actor(request);
        app.permission(actor, "self.manage");
        return actor;
    }

    Map<String, Object> optionalCustomer(HttpServletRequest request) {
        if (app.sessionToken(request).isEmpty()) return null;
        var actor = app.actor(request);
        return app.admin(actor) ? null : actor;
    }

    Map<String, Object> preferences(UUID owner) {
        if (owner != null) {
            var rows = db.query("SELECT data::text FROM records WHERE kind='consent' AND owner_id=? AND data->>'purpose'=? ORDER BY created_at DESC, id DESC LIMIT 1",
                (rs, i) -> app.decode(rs.getString(1)), owner, PURPOSE);
            if (!rows.isEmpty()) return rows.getFirst();
        }
        return new LinkedHashMap<>(Map.of("purpose", PURPOSE, "personalization", false,
            "historyUse", false, "memoryUse", false, "revision", 0, "policyVersion", PURPOSE));
    }

    boolean allowed(Map<String, Object> preferences, String purpose) {
        return Boolean.TRUE.equals(preferences.get(purpose));
    }

    Map<String, Object> view(UUID owner, boolean recommendations) {
        var preferences = preferences(owner);
        if (recommendations) return Map.of("granted", allowed(preferences, "personalization"),
            "revision", preferences.get("revision"), "policyVersion", PURPOSE);
        return Map.of("historyUse", allowed(preferences, "historyUse"), "memoryUse", allowed(preferences, "memoryUse"),
            "revision", preferences.get("revision"), "policyVersion", PURPOSE);
    }

    Map<String, Object> change(HttpServletRequest request, Map<String, Object> body, String key, boolean recommendations) {
        app.origin(request);
        return transactions.execute(status -> {
            app.lock();
            var actor = customer(request);
            UUID owner = (UUID) actor.get("id");
            String operation = recommendations ? "recommendation-consent" : "agent-consent";
            String fingerprint = app.hash(operation + app.encode(new TreeMap<>(body)));
            var previous = replay(owner, key, fingerprint);
            if (previous != null) return previous;
            var current = preferences(owner);
            if (app.number(body, "revision") != app.number(current, "revision"))
                throw new PlatformApi.Problem(409, "Lựa chọn đã thay đổi. Vui lòng tải lại.");
            for (String field : recommendations ? List.of("granted") : List.of("historyUse", "memoryUse"))
                app.require(body.get(field) instanceof Boolean, "Lựa chọn đồng ý không hợp lệ.");
            if (recommendations) current.put("personalization", body.get("granted"));
            else {
                current.put("historyUse", body.get("historyUse"));
                current.put("memoryUse", body.get("memoryUse"));
                if (!allowed(current, "historyUse")) erase(owner, "chat");
                if (!allowed(current, "memoryUse")) erase(owner, "ai_memory");
            }
            advance(owner, current);
            app.audit(actor, "ai-consent", operation);
            var result = view(owner, recommendations);
            rememberOperation(owner, key, fingerprint, result);
            return result;
        });
    }

    private void advance(UUID owner, Map<String, Object> preferences) {
        preferences.put("revision", app.number(preferences, "revision") + 1);
        preferences.put("updatedAt", Instant.now().toString());
        preferences.put("policyVersion", PURPOSE);
        app.save("consent", owner, preferences);
    }

    private void erase(UUID owner, String kind) {
        db.update("DELETE FROM records WHERE owner_id=? AND kind=?", owner, kind);
        db.update("UPDATE records SET data=data #- ARRAY['export',?] WHERE kind='privacy' AND owner_id=? AND jsonb_exists(data,'export')", kind, owner);
        db.update("UPDATE operations SET result=result #- ARRAY['export',?] WHERE result->>'id' IN (SELECT id::text FROM records WHERE kind='privacy' AND owner_id=?)", kind, owner);
    }

    private Map<String, Object> replay(UUID owner, String key, String fingerprint) {
        app.require(key.matches("[a-zA-Z0-9-]{16,80}"), "Khóa gửi lặp không hợp lệ.");
        var rows = db.queryForList("SELECT fingerprint, result::text FROM operations WHERE actor_id=? AND key=?", owner, key);
        if (rows.isEmpty()) return null;
        if (!fingerprint.equals(rows.getFirst().get("fingerprint")))
            throw new PlatformApi.Problem(409, "Khóa gửi lặp đã dùng cho nội dung khác.");
        return app.decode((String) rows.getFirst().get("result"));
    }

    private void rememberOperation(UUID owner, String key, String fingerprint, Map<String, Object> result) {
        db.update("INSERT INTO operations(actor_id,key,fingerprint,result) VALUES(?,?,?,?::jsonb)", owner, key, fingerprint, app.encode(result));
    }

    List<Map<String, Object>> turns(UUID owner, String conversationId) {
        if (owner == null || !allowed(preferences(owner), "historyUse")) return List.of();
        return db.query("SELECT data::text FROM records WHERE kind='chat' AND owner_id=? AND data->>'conversationId'=? ORDER BY created_at, id",
            (rs, i) -> app.decode(rs.getString(1)), owner, conversationId);
    }

    Map<String, Object> memory(UUID owner) {
        if (owner == null || !allowed(preferences(owner), "memoryUse")) return Map.of();
        var rows = db.query("SELECT data::text FROM records WHERE kind='ai_memory' AND owner_id=?",
            (rs, i) -> app.decode(rs.getString(1)), owner);
        if (rows.isEmpty()) return Map.of();
        var data = new LinkedHashMap<>(rows.getFirst());
        data.keySet().retainAll(Set.of("budget", "recipient", "occasion"));
        return data;
    }

    Map<String, Object> history(HttpServletRequest request, String conversationId) {
        UUID owner = (UUID) customer(request).get("id");
        if (conversationId == null) {
            var rows = db.queryForList("SELECT data->>'conversationId' AS conversation FROM records WHERE owner_id=? AND kind='chat' ORDER BY created_at DESC, id DESC LIMIT 1", owner);
            conversationId = rows.isEmpty() ? UUID.randomUUID().toString() : (String) rows.getFirst().get("conversation");
        }
        app.uuid(conversationId);
        var messages = new ArrayList<Map<String, Object>>();
        for (var turn : turns(owner, conversationId)) {
            messages.add(Map.of("role", "user", "text", turn.get("message")));
            messages.add(Map.of("role", "assistant", "text", turn.get("answer")));
        }
        return Map.of("conversationId", conversationId, "messages", messages, "memory", memory(owner), "revision", preferences(owner).get("revision"));
    }

    Map<String, Object> forget(HttpServletRequest request, String key) {
        app.origin(request);
        return transactions.execute(status -> {
            app.lock();
            UUID owner = (UUID) customer(request).get("id");
            var previous = replay(owner, key, "forget-ai-data");
            if (previous != null) return previous;
            erase(owner, "chat");
            erase(owner, "ai_memory");
            advance(owner, preferences(owner));
            var result = Map.<String, Object>of("ok", true, "revision", preferences(owner).get("revision"));
            rememberOperation(owner, key, "forget-ai-data", result);
            return result;
        });
    }

    Map<String, Object> completed(UUID owner, String key, String fingerprint) {
        if (owner == null || !allowed(preferences(owner), "historyUse")) return null;
        var rows = db.query("SELECT data::text FROM records WHERE kind='chat' AND owner_id=? AND data->>'requestKey'=?",
            (rs, i) -> app.decode(rs.getString(1)), owner, key);
        if (rows.isEmpty()) return null;
        if (!fingerprint.equals(rows.getFirst().get("fingerprint"))) throw new PlatformApi.Problem(409, "Khóa gửi lặp đã dùng cho nội dung khác.");
        return rows.getFirst();
    }

    boolean finish(String sessionToken, UUID owner, int revision, Map<String, Object> turn, Map<String, Object> slots) {
        if (owner == null) return false;
        return Boolean.TRUE.equals(transactions.execute(status -> {
            app.lock();
            try { app.sessionActor(sessionToken); }
            catch (PlatformApi.Problem problem) { return false; }
            var preferences = preferences(owner);
            if (app.number(preferences, "revision") != revision) return false;
            if (allowed(preferences, "historyUse")) {
                UUID id = UUID.nameUUIDFromBytes((owner + ":chat:" + turn.get("requestKey")).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                turn.put("id", id.toString());
                app.save("chat", owner, turn);
                db.update("DELETE FROM records WHERE owner_id=? AND kind='chat' AND id NOT IN (SELECT id FROM records WHERE owner_id=? AND kind='chat' ORDER BY created_at DESC, id DESC LIMIT 20)", owner, owner);
            }
            if (allowed(preferences, "memoryUse") && !slots.isEmpty()) {
                var data = new LinkedHashMap<>(memory(owner));
                data.putAll(slots);
                data.put("id", UUID.nameUUIDFromBytes((owner + ":ai-memory").getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());
                data.put("updatedAt", Instant.now().toString());
                app.save("ai_memory", owner, data);
            }
            return allowed(preferences, "historyUse");
        }));
    }
}

@RestController
@RequestMapping("/api/v1")
class AiPrivacyApi {
    private final AiPrivacy privacy;
    AiPrivacyApi(AiPrivacy privacy) { this.privacy = privacy; }

    @GetMapping("/recommendations/consent")
    Object recommendations(HttpServletRequest request) { return privacy.view((UUID) privacy.customer(request).get("id"), true); }

    @PutMapping("/recommendations/consent")
    Object recommendations(HttpServletRequest request, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key) {
        return privacy.change(request, body, key, true);
    }

    @GetMapping("/agent/consent")
    Object agent(HttpServletRequest request) { return privacy.view((UUID) privacy.customer(request).get("id"), false); }

    @PutMapping("/agent/consent")
    Object agent(HttpServletRequest request, @RequestBody Map<String, Object> body, @RequestHeader("Idempotency-Key") String key) {
        return privacy.change(request, body, key, false);
    }

    @GetMapping("/agent/history")
    Object history(HttpServletRequest request, @RequestParam(required=false) String conversationId) { return privacy.history(request, conversationId); }

    @DeleteMapping("/agent/history")
    Object forget(HttpServletRequest request, @RequestHeader("Idempotency-Key") String key) { return privacy.forget(request, key); }
}
