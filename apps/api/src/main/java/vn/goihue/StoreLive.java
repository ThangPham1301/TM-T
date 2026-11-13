package vn.goihue;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Configuration
@EnableWebSocket
public class StoreLive extends TextWebSocketHandler implements WebSocketConfigurer {
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Value("${APP_ORIGINS:http://localhost:3000}")
    private String origins;
    private final PlatformApi app;

    public StoreLive(@org.springframework.context.annotation.Lazy PlatformApi app) {
        this.app = app;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(this, "/api/store/live")
            .setAllowedOrigins(origins.split(","))
            .addInterceptors(new HandshakeInterceptor() {
                @Override
                public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                        WebSocketHandler handler, Map<String, Object> attributes) {
                    if (!(request instanceof ServletServerHttpRequest servlet)) return false;
                    String token = app.sessionToken(servlet.getServletRequest());
                    try {
                        attributes.put("actor", app.sessionActor(token).get("id"));
                        attributes.put("session", token);
                        return true;
                    } catch (PlatformApi.Problem problem) {
                        response.setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
                        return false;
                    }
                }

                @Override
                public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                        WebSocketHandler handler, Exception failure) {}
            });
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session.getId());
    }

    void changed(UUID owner) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (var session : sessions.values()) {
                    synchronized (session) {
                        try {
                            var actor = app.sessionActor((String) session.getAttributes().get("session"));
                            if (app.admin(actor) || owner.equals(actor.get("id"))) {
                                session.sendMessage(new TextMessage("state-changed"));
                            }
                        } catch (Exception failure) {
                            sessions.remove(session.getId());
                            try { session.close(); } catch (java.io.IOException ignored) {}
                        }
                    }
                }
            }
        });
    }
}
