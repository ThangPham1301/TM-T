package vn.goihue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Versioned customer-advice policy packaged with the API, loaded once as UTF-8. */
final class AgentInstructions {
    static final String SYSTEM = load();

    private AgentInstructions() {}

    private static String load() {
        try (InputStream source = AgentInstructions.class.getResourceAsStream("/agent-sales-advisor.vi.txt")) {
            if (source == null) throw new IllegalStateException("Missing agent-sales-advisor.vi.txt");
            return new String(source.readAllBytes(), StandardCharsets.UTF_8).strip();
        } catch (IOException failure) {
            throw new IllegalStateException("Cannot load the agent sales-advice policy", failure);
        }
    }
}
