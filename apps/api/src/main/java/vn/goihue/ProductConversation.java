package vn.goihue;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.regex.Pattern;

/** Resolves conversational references against public product identities, never historical prices or claims. */
@Service
final class ProductConversation {
    record Scope(List<String> ids, boolean needsChoice) {
        static Scope none() { return new Scope(List.of(), false); }
        boolean active() { return !ids.isEmpty(); }
    }

    private static final Set<String> NAME_FILLER = Set.of("hop", "qua", "hue", "goi", "san", "pham");
    private final PlatformApi app;
    private final ProductSearch search;

    ProductConversation(PlatformApi app, ProductSearch search) { this.app = app; this.search = search; }

    List<String> ids(Object value) {
        if (value == null) return List.of();
        app.require(value instanceof List<?>, "Ngữ cảnh sản phẩm phải là danh sách ID.");
        var list = (List<?>) value;
        app.require(list.size() <= 8, "Ngữ cảnh tối đa tám sản phẩm.");
        var ids = new LinkedHashSet<String>();
        for (Object item : list) {
            app.require(item instanceof String, "ID sản phẩm không hợp lệ.");
            app.require(item.toString().matches("(?i)[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"), "ID sản phẩm không hợp lệ.");
            ids.add(app.uuid(item.toString()).toString());
        }
        return List.copyOf(ids);
    }

    private Set<String> nameWords(Map<String, Object> product) {
        var words = ProductSearch.words(app.str(product, "name"));
        words.removeIf(word -> word.isEmpty() || NAME_FILLER.contains(word) || word.matches("[0-9]+(?:g|kg|ml|l)?"));
        return words;
    }

    List<String> mentioned(String text) {
        var words = ProductSearch.words(text);
        String normalized = AgentTools.normalized(text);
        var found = new ArrayList<Map<String, Object>>();
        for (var product : search.visibleProducts()) {
            var name = nameWords(product);
            boolean fullName = normalized.contains(AgentTools.normalized(app.str(product, "name")));
            // A generic word such as "hương" alone must not name "Hộp Quà Hương Huế".
            if (fullName || name.size() >= 2 && words.containsAll(name)) found.add(product);
        }
        found.sort(Comparator.comparingInt(product -> {
            int fullName = normalized.indexOf(AgentTools.normalized(app.str(product, "name")));
            return fullName >= 0 ? fullName : nameWords(product).stream().mapToInt(normalized::indexOf).max().orElse(Integer.MAX_VALUE);
        }));
        return found.stream().map(product -> app.str(product, "id")).toList();
    }

    boolean leavesScope(String answer, Scope scope) {
        return scope.active() && mentioned(answer).stream().anyMatch(id -> !scope.ids().contains(id));
    }

    Scope resolve(String message, List<String> previous, String assistantText) {
        return resolve(message, previous, assistantText, false);
    }

    Scope resolve(String message, List<String> previous, String assistantText, boolean planningFollowup) {
        if (previous.isEmpty()) return Scope.none();
        String text = AgentTools.normalized(message);
        boolean pair = text.matches("(?s).*(?:1|mot) trong (?:2|hai).*|.*(?:hai|2) (?:mon|san pham|loai).*")
            || text.contains("trong so") || text.contains("giua chung") || text.contains("ca hai");
        boolean reference = pair || planningFollowup || text.matches("(?s).*\\b(?:kia|nay|do|tren)\\b.*") || text.contains("luc nay")
            || text.contains("vua roi") || text.contains("mon dau") || text.contains("mon thu") || text.contains("con lai");
        // Explicit shopping for a different type starts a new set, even when the sentence says "còn ... thì sao".
        var candidates = search.visibleProducts().stream().filter(p -> previous.contains(app.str(p, "id"))).toList();
        var frequencies = new HashMap<String, Integer>();
        for (var product : candidates) for (String word : nameWords(product)) frequencies.merge(word, 1, Integer::sum);
        var words = ProductSearch.words(text);
        var matching = candidates.stream().filter(p -> nameWords(p).stream().anyMatch(word -> words.contains(word) && frequencies.get(word) == 1)).toList();
        if (!reference && matching.isEmpty()) return Scope.none();
        // A matching word in a fresh, fully named product outside the old set must not pin a new topic to the old set.
        var explicitlyNamed = mentioned(message);
        if (explicitlyNamed.stream().anyMatch(id -> !previous.contains(id))) return Scope.none();
        boolean newType = Pattern.compile("\\btra\\b").matcher(text).find() && candidates.stream().noneMatch(p -> nameWords(p).contains("tra"))
            || text.contains("me xung") && candidates.stream().noneMatch(p -> nameWords(p).contains("xung"));
        if (newType) return Scope.none();
        if (planningFollowup && matching.isEmpty()) return new Scope(previous, false);
        if (pair) return new Scope(previous, false);
        if (matching.size() == 1) return new Scope(List.of(app.str(matching.getFirst(), "id")), false);
        if (matching.size() > 1) return new Scope(matching.stream().map(p -> app.str(p, "id")).toList(), true);
        int ordinal = Pattern.compile("\\b(?:dau tien|thu nhat|mon dau)\\b").matcher(text).find() ? 0
            : Pattern.compile("\\b(?:thu (?:hai|2)|mon (?:hai|2))\\b").matcher(text).find() ? 1 : -1;
        if (ordinal >= 0 && previous.size() > ordinal) return new Scope(List.of(previous.get(ordinal)), false);
        if (text.contains("con lai") && previous.size() == 2) {
            var focused = mentioned(assistantText).stream().filter(previous::contains).toList();
            if (focused.size() == 1) return new Scope(previous.stream().filter(id -> !id.equals(focused.getFirst())).toList(), false);
        }
        if (previous.size() == 1) return new Scope(previous, false);
        // A new product category without a matching old name is not an anaphoric reference.
        return new Scope(previous, true);
    }
}
