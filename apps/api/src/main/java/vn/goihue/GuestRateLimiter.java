package vn.goihue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
class GuestRateLimiter {
    private final JdbcTemplate db;

    GuestRateLimiter(JdbcTemplate db) { this.db = db; }

    // Called before the commerce transaction so rejected attempts also count.
    public boolean allow(String scope, int limit) {
        int attempts = db.queryForObject("""
                INSERT INTO guest_rate_limits(scope, window_start, attempts)
                VALUES (?, date_trunc('minute', now()), 1)
                ON CONFLICT (scope) DO UPDATE SET
                    attempts = CASE WHEN guest_rate_limits.window_start = EXCLUDED.window_start
                        THEN least(guest_rate_limits.attempts + 1, ?) ELSE 1 END,
                    window_start = EXCLUDED.window_start
                RETURNING attempts
                """, Integer.class, scope, limit + 1);
        return attempts <= limit;
    }
}
