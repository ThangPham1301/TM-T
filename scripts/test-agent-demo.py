"""Regression checks against a disposable Docker stack, including a Bedrock protocol fixture.

Build goihue-api:agent-demo-review and goihue-web:agent-demo-review first.
Run with Python 3.11+. --keep leaves the isolated stack on port 13097 for UI review.
All accounts and orders created here are synthetic and stay in the disposable database.
"""

import argparse
import concurrent.futures
import contextlib
import http.cookiejar
import http.server
import json
import pathlib
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid


ORIGIN = "http://127.0.0.1:13097"
BASE = ORIGIN + "/api/store/"
PASSWORD = "disposable-review-password"
CHECKS = 0


def check(condition, message):
    global CHECKS
    if not condition:
        raise AssertionError(message)
    CHECKS += 1
    print("PASS " + message, flush=True)


class Browser:
    def __init__(self):
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def request(self, path, method="GET", body=None, key=None, expected=200):
        headers = {"Origin": ORIGIN}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, ensure_ascii=False).encode()
        if key:
            headers["Idempotency-Key"] = key
        request = urllib.request.Request(BASE + path, data, headers, method=method)
        try:
            response = self.opener.open(request, timeout=65)
        except urllib.error.HTTPError as error:
            response = error
        raw = response.read().decode()
        if response.status != expected:
            raise AssertionError(f"{method} {path}: expected {expected}, got {response.status}: {raw[:300]}")
        if "text/event-stream" in response.headers.get("Content-Type", ""):
            events = []
            for block in raw.replace("\r\n", "\n").split("\n\n"):
                lines = block.splitlines()
                name = next((line[6:] for line in lines if line.startswith("event:")), "")
                content = "\n".join(line[5:].lstrip() for line in lines if line.startswith("data:"))
                if name and content:
                    events.append((name.strip(), json.loads(content)))
            return events
        return json.loads(raw)

    def chat(self, message, conversation=None, key=None, expected=200, context=None, history=None, purchase=None):
        body = {"message": message, "conversationId": conversation or str(uuid.uuid4())}
        if context is not None:
            body["contextProductIds"] = context
        if history is not None:
            body["history"] = history
        if purchase is not None:
            body["purchaseContext"] = purchase
        events = self.request("agent/chat", "POST", body, key or str(uuid.uuid4()), expected)
        return events, body

    def register(self, email):
        return self.request("auth/register", "POST", {"email": email, "password": PASSWORD, "name": "Synthetic demo reviewer"})


def answer(events):
    return "".join(data["delta"] for event, data in events if event == "token")


def event_data(events, name):
    return [data for event, data in events if event == name]


class ModelFixture(http.server.BaseHTTPRequestHandler):
    entered = threading.Event()
    release = threading.Event()
    tool_results_seen = False
    tool_schema_seen = False
    advice_policy_seen = False

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        ModelFixture.advice_policy_seen = any(block.get("text", "").startswith("GOIHUE_SALES_ADVISOR_V4") and "<customer_preferences_data>" in block["text"] and "<current_customer_question>" in block["text"] for block in body.get("system", []))
        ModelFixture.tool_schema_seen = {tool["toolSpec"]["name"] for tool in body.get("toolConfig", {}).get("tools", [])} == {"plan_purchase", "search_products", "recommend_products", "compare_products", "add_to_cart", "get_shipping", "lookup_order", "get_policy", "get_memory"}
        messages = body["messages"]
        prompt = next(block["text"] for msg in reversed(messages) for block in msg["content"] if "text" in block and msg["role"] == "user")
        results = [block["toolResult"] for block in messages[-1]["content"] if "toolResult" in block]
        if "MODEL_ADVICE_GENERAL" in prompt:
            content = [{"text": "Bạn có thể cân nhắc khẩu vị, số người cùng dùng và thành phần cần tránh. Khi chốt món, mình tính thêm ngân sách và phí giao hàng."}]
            stop = "end_turn"
        elif "REVOCATION_RACE" in prompt:
            self.entered.set()
            self.release.wait(15)
            content = [{"text": "Đã xử lý lượt kiểm tra đồng thời."}]
            stop = "end_turn"
        elif "MODEL_PLAN_BAD" in prompt:
            if not results:
                content = [{"toolUse": {"toolUseId": "fixture-plan", "name": "plan_purchase", "input": {"budget": 1, "recipientCount": 1, "unitsPerRecipient": 100, "budgetScope": "PER_RECIPIENT"}}}]
                stop = "tool_use"
            else:
                content = [{"text": "Mua một sản phẩm bất kỳ là đủ, tổng tiền 1 đồng."}]
                stop = "end_turn"
        elif "MODEL_OUTSIDE_CONTEXT" in prompt:
            content = [{"text": "Bạn có thể tặng Mè Xửng Gừng Huế 250g vì món này không chứa đậu phộng."}]
            stop = "end_turn"
        elif "MODEL_ALLOWED_CONTEXT" in prompt:
            content = [{"text": "Mình đang nói về Mè Xửng Đậu Phộng 300g; hương vị cần cân nhắc theo khẩu vị người nhận."}]
            stop = "end_turn"
        elif "MODEL_NO_TOOL" in prompt:
            content = [{"text": "Đã kiểm tra sản phẩm trong danh mục hiện tại."}]
            stop = "end_turn"
        elif "MODEL_TOOL_LOOP" in prompt:
            if not results:
                content = [
                    {"toolUse": {"toolUseId": "fixture-gifts", "name": "recommend_products", "input": {"budget": 200000}}},
                    {"toolUse": {"toolUseId": "fixture-shipping", "name": "get_shipping", "input": {"subtotal": 150000}}},
                ]
                stop = "tool_use"
            else:
                ModelFixture.tool_results_seen = len(results) == 2 and all("json" in item["content"][0] for item in results)
                content = [{"text": "<thinking>PRIVATE_FIXTURE</thinking>\n<response>Đã tìm quà trong ngân sách và kiểm tra phí giao từ hai công cụ.</response>"}]
                stop = "end_turn"
        elif "TOOL_OWNER_INJECTION" in prompt:
            if not results:
                content = [{"toolUse": {"toolUseId": "fixture-injection", "name": "lookup_order", "input": {"number": "GH-AAAAAAAA", "ownerId": "untrusted"}}}]
                stop = "tool_use"
            else:
                check(results[0]["status"] == "error", "untrusted model owner arguments are rejected")
                content = [{"text": "Tham số công cụ đã bị từ chối."}]
                stop = "end_turn"
        elif "MODEL_BUDGET_" in prompt:
            if not results:
                budget = 0 if "MODEL_BUDGET_ZERO" in prompt else -1 if "MODEL_BUDGET_NEGATIVE" in prompt else 1
                arguments = {"budget": budget}
                if "NAME_LOOKUP" in prompt:
                    arguments["productId"] = "Hương Huế"
                if "MISSING_PRODUCT" in prompt:
                    arguments["query"] = "synthetic-nonexistent-product"
                if "RECIPIENT_QUERY" in prompt:
                    arguments["query"] = "quà tặng cho mẹ"
                if "POPULAR_QUERY" in prompt:
                    arguments["query"] = "2 gói hàng đang bán chạy"
                content = [{"toolUse": {"toolUseId": "fixture-budget", "name": "recommend_products", "input": arguments}}]
                stop = "tool_use"
            else:
                data = results[0]["content"][0]["json"]
                content = [{"text": "Dữ liệu sản phẩm đã kiểm tra: " + json.dumps(data, ensure_ascii=False)}]
                stop = "end_turn"
        elif "MODEL_SEARCH::" in prompt:
            if not results:
                arguments = json.loads(prompt.split("MODEL_SEARCH::", 1)[1])
                content = [{"toolUse": {"toolUseId": "fixture-search", "name": "search_products", "input": arguments}}]
                stop = "tool_use"
            else:
                text = "Phí giao hàng là 50.000đ." if "MODEL_BAD_SHIPPING" in prompt else json.dumps(results[0]["content"][0]["json"], ensure_ascii=False)
                content = [{"text": text}]
                stop = "end_turn"
        elif "MODEL_COMPARE::" in prompt:
            if not results:
                names = prompt.split("MODEL_COMPARE::", 1)[1].split("::")
                content = [{"toolUse": {"toolUseId": "fixture-compare", "name": "compare_products", "input": {"first": names[0].strip(), "second": names[1].strip()}}}]
                stop = "tool_use"
            else:
                data = results[0]["content"][0]["json"]
                content = [{"text": "Đã so sánh hai sản phẩm: " + json.dumps(data, ensure_ascii=False)}]
                stop = "end_turn"
        elif "MODEL_CART::" in prompt:
            if not results:
                parts = prompt.split("MODEL_CART::", 1)[1].split("::")
                content = [{"toolUse": {"toolUseId": "fixture-cart", "name": "add_to_cart", "input": {"product": parts[0].strip(), "quantity": int(parts[1])}}}]
                stop = "tool_use"
            else:
                content = [{"text": "Bạn xác nhận giúp mình nhé."}]
                stop = "end_turn"
        elif "MODEL_UNAVAILABLE" in prompt:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"message":"synthetic model outage"}')
            return
        else:
            content = [{"text": "Synthetic model response."}]
            stop = "end_turn"
        response = {"output": {"message": {"role": "assistant", "content": content}}, "stopReason": stop,
                    "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2}, "metrics": {"latencyMs": 1}}
        payload = json.dumps(response, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        with contextlib.suppress(BrokenPipeError):
            self.wfile.write(payload)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true")
    parser.add_argument("--api-image", default="goihue-api:agent-demo-review")
    parser.add_argument("--web-image", default="goihue-web:agent-demo-review")
    args = parser.parse_args()
    project = "tmt-agent-check-" + uuid.uuid4().hex[:8]
    model = http.server.ThreadingHTTPServer(("0.0.0.0", 0), ModelFixture)
    threading.Thread(target=model.serve_forever, daemon=True).start()
    config = {"services": {
        "db": {"image": "postgres:16-alpine", "environment": {"POSTGRES_DB": "goihue", "POSTGRES_USER": "goihue", "POSTGRES_PASSWORD": PASSWORD},
               "healthcheck": {"test": ["CMD", "pg_isready", "-U", "goihue", "-d", "goihue"], "interval": "1s", "retries": 30}},
        "api": {"image": args.api_image, "environment": {
            "SPRING_DATASOURCE_URL": "jdbc:postgresql://db:5432/goihue", "SPRING_DATASOURCE_USERNAME": "goihue", "SPRING_DATASOURCE_PASSWORD": PASSWORD,
            "ADMIN_EMAIL": "review-admin@example.invalid", "ADMIN_PASSWORD": PASSWORD, "APP_ORIGINS": ORIGIN,
            "APP_AGENT_PROVIDER": "deterministic", "AWS_EC2_METADATA_DISABLED": "true"},
            "depends_on": {"db": {"condition": "service_healthy"}}},
        "web": {"image": args.web_image, "environment": {"API_UPSTREAM_URL": "http://api:8088/api/v1", "APP_PUBLIC_ORIGINS": ORIGIN},
                "ports": ["127.0.0.1:13097:3000"]},
    }}
    temporary = tempfile.TemporaryDirectory(prefix="tmt-agent-check-")
    compose_path = pathlib.Path(temporary.name) / "compose.json"

    def compose(*arguments, capture=False):
        compose_path.write_text(json.dumps(config), encoding="utf-8")
        return subprocess.run(["docker", "compose", "-p", project, "-f", str(compose_path), *arguments], check=True,
                              text=True, capture_output=capture).stdout

    def sql(statement):
        result = subprocess.run(["docker", "exec", "-i", db_id, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-U", "goihue", "-d", "goihue"],
                                input=statement, text=True, capture_output=True, encoding="utf-8", check=True)
        return result.stdout.strip()

    def wait_ready():
        for _ in range(45):
            try:
                Browser().request("shipping")
                return
            except (OSError, AssertionError):
                time.sleep(1)
        raise AssertionError("Temporary API did not become ready")

    succeeded = False
    try:
        compose("up", "-d", "--wait", "--wait-timeout", "45", "--pull", "never")
        db_id = compose("ps", "-q", "db", capture=True).strip()
        wait_ready()
        guest, alice, bob = Browser(), Browser(), Browser()
        user = alice.register("alice@example.invalid")
        other = bob.register("bob@example.invalid")
        admin = Browser()
        admin.request("auth/login", "POST", {"email": "review-admin@example.invalid", "password": PASSWORD})
        products = guest.request("products")
        first = products[0]
        partner = next(product for product in products if product["category"] != first["category"])
        bestseller = next(product for product in products if product["category"] not in {first["category"], partner["category"]})
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','25'::jsonb) WHERE kind='product';")
        for owner, number, items, status, age in [
            (user["id"], "GH-AAAAAAAA", [(first, 1), (partner, 1)], "DELIVERED", 2),
            (user["id"], "GH-BBBBBBBB", [(first, 1)], "PLACED", 0),
            (other["id"], "GH-CCCCCCCC", [(bestseller, 10)], "DELIVERED", 1),
            (other["id"], "GH-DDDDDDDD", [(first, 500)], "RETURNED", 1),
        ]:
            data = {"number": number, "status": status, "total": 150000, "history": [],
                    "items": [{"productId": product["id"], "quantity": quantity, "price": product["price"]} for product, quantity in items]}
            payload = json.dumps(data).replace("'", "''")
            sql(f"INSERT INTO records(id,kind,owner_id,data,created_at) VALUES(gen_random_uuid(),'order','{owner}','{payload}',now()-interval '{age} day');")
        popular = alice.request("products/recommended?surface=home")
        check(popular["strategy"] == "POPULAR" and popular["items"][0]["id"] == bestseller["id"], "popular counts delivered orders and ignores returned orders")
        for value in (0, -1):
            unlimited = guest.request("products/recommended?surface=home&budget=" + str(value))
            check([item["id"] for item in unlimited["items"]] == [item["id"] for item in popular["items"]] and unlimited["budgetApplied"] is None, "nonpositive API budget is unspecified rather than an empty price filter: " + str(value))
        under_limit = guest.request("products/recommended?budget=100000")
        check(under_limit["items"] and all(item["price"] <= 100000 for item in under_limit["items"]) and under_limit["budgetApplied"] == 100000, "positive API budgets still filter products by the requested amount")
        guest.request("products/recommended?budget=100000001", expected=422)
        sql("UPDATE records SET data=jsonb_set(data,'{status}','\"CONFIRMED\"'::jsonb) WHERE kind='order' AND data->>'status'='DELIVERED';")
        cold_start = guest.request("products/recommended")
        check(cold_start["items"] and cold_start["rankingBasis"] == "CATALOG" and all(item["deliveredQuantity"] == 0 for item in cold_start["items"]), "missing delivered sales still returns catalog products with explicit non-bestseller evidence")
        sql("UPDATE records SET data=jsonb_set(data,'{status}','\"DELIVERED\"'::jsonb) WHERE kind='order' AND data->>'number' IN ('GH-AAAAAAAA','GH-CCCCCCCC');")
        consent = alice.request("recommendations/consent")
        check(not consent["granted"] and consent["revision"] == 0, "separate personalization consent defaults off")
        alice.request("command", "POST", {"action": "consent", "granted": True}, str(uuid.uuid4()))
        check(alice.request("products/recommended")["strategy"] == "POPULAR", "marketing consent cannot enable personalization")
        alice.request("recommendations/consent", "PUT", {"granted": True, "revision": 0}, str(uuid.uuid4()))
        personalized = alice.request("products/recommended")
        check(personalized["strategy"] == "PERSONALIZED" and all(item["category"] in {first["category"], partner["category"]} for item in personalized["items"]), "personalization uses only consenting owner's purchase categories")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": 0}, str(uuid.uuid4()), 409)
        summary = alice.request("cart/summary")
        alice.request("commerce", "POST", {"action": "cart-set", "productId": first["id"], "quantity": 1, "cartToken": summary["cartToken"]}, str(uuid.uuid4()))
        rail = alice.request("products/recommended?surface=cart&limit=2")
        check(rail["strategy"] == "BOUGHT_TOGETHER" and rail["items"][0]["id"] == partner["id"] and first["id"] not in [item["id"] for item in rail["items"]], "cart rail uses delivered pairs and excludes cart contents")
        guest.request("products/recommended?surface=cart", expected=401)
        admin.request("products/recommended?surface=cart", expected=403)
        alice.request("products/recommended?limit=0", expected=422)
        alice.request("products/recommended?surface=unknown", expected=422)
        check(not guest.request("products/recommended?budget=1")["items"], "budget filter and empty results work through BFF")
        stock = sql("SELECT data->>'stock' FROM records WHERE id='" + partner["id"] + "';")
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','0'::jsonb) WHERE id='" + partner["id"] + "';")
        check(partner["id"] not in [item["id"] for item in alice.request("products/recommended?surface=cart")["items"]], "out-of-stock pairs are excluded before fallback ranking")
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','" + stock + "'::jsonb) WHERE id='" + partner["id"] + "';")
        events, _ = guest.chat("Phí ship bao nhiêu?")
        check("chưa áp dụng" in answer(events) and "0đ trở lên" not in answer(events), "zero threshold correctly disables free shipping")
        events, _ = alice.chat("Tra cứu GH-AAAAAAAA")
        check("GH-AAAAAAAA" in answer(events) and "GH-BBBBBBBB" not in answer(events), "order lookup returns exact requested order, not latest order")
        events, _ = bob.chat("Tra cứu GH-AAAAAAAA")
        check("Không tìm thấy" in answer(events), "another customer cannot read the requested order")
        check(sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory');") == "0", "guest and consent-off chats leave no persistent chat or memory")
        no_budget, _ = guest.chat("so sánh 2 gói hàng đang bán chạy")
        check(len(event_data(no_budget, "product_cards")[0]["items"]) == 2 and "Chênh lệch giá" in answer(no_budget), "budget-free comparisons return two grounded products and their price difference")
        tea_category = next(product["category"] for product in products if "Trà" in product["name"])
        def sample_product(name, slug, price=75000, stock=4, active=True, category=tea_category):
            return admin.request("commerce", "POST", {"action": "product-save", "name": name, "slug": slug, "category": category, "description": "Synthetic public catalog description", "price": price, "stock": stock, "active": active}, str(uuid.uuid4()))
        ginger_tea = sample_product("Trà Gừng Túi Lọc", "synthetic-tra-gung")
        unavailable_tea = sample_product("Trà Nhài", "synthetic-tra-nhai", stock=0)
        hidden_tea = sample_product("Trà Riêng Tư", "synthetic-tra-hidden", active=False)
        for phrase in ("tôi muốn chọn một loại trà", "cửa hàng có những loại trà nào?", "tra gung", "tôi muốn mua bánh mè xửng", "me xung", "tôi muốn mua món quà liên quan đến mè"):
            searched, _ = guest.chat(phrase)
            cards = event_data(searched, "product_cards")[0]["items"]
            category = tea_category if "trà" in phrase or "tra " in phrase else first["category"]
            check(any(tool["name"] == "search_products" for tool in event_data(searched, "tool_call")) and cards and all(card["category"] == category for card in cards), "natural category lookup works without a budget: " + phrase)
        missing_stock, _ = guest.chat("Tìm trà nhài")
        check(event_data(missing_stock, "product_cards")[0]["items"][0]["id"] == unavailable_tea["id"] and "hết hàng" in answer(missing_stock), "search distinguishes visible out-of-stock products from missing products")
        check(hidden_tea["id"] not in [card["id"] for card in event_data(guest.chat("Tìm trà")[0], "product_cards")[0]["items"]], "search never exposes an inactive product")
        ambiguous_cart, _ = guest.chat("Thêm trà vào giỏ")
        check(not event_data(ambiguous_cart, "cart_proposal") and event_data(ambiguous_cart, "product_cards")[0]["items"], "a broad tea request offers choices instead of selecting a cart item")
        search_customer = Browser()
        search_customer.register("search-memory@example.invalid")
        search_customer.request("agent/consent", "PUT", {"historyUse": False, "memoryUse": True, "revision": 0}, str(uuid.uuid4()))
        search_customer.chat("Quà dưới 100k")
        no_inherited_budget, _ = search_customer.chat("Tôi muốn chọn một loại trà")
        check(any(card["price"] > 100000 for card in event_data(no_inherited_budget, "product_cards")[0]["items"]), "general catalog search does not silently inherit an old gifting budget")
        search_customer.request("agent/history", "DELETE", {}, str(uuid.uuid4()))
        compared, _ = guest.chat("So sánh " + first["name"] + " với " + partner["name"] + " giúp mình")
        comparison = event_data(compared, "comparison")
        check(comparison and {item["id"] for item in comparison[0]["items"]} == {first["id"], partner["id"]} and comparison[0]["priceDifference"] == abs(first["price"] - partner["price"]), "named comparison emits a structured two-product comparison event")
        cart_before = alice.request("cart/summary")
        proposed, _ = alice.chat("Thêm 2 hộp " + first["name"] + " vào giỏ giúp mình")
        proposal = event_data(proposed, "cart_proposal")
        check(proposal and proposal[0]["productId"] == first["id"] and proposal[0]["quantity"] == 2, "add-to-cart intent emits a confirmation proposal with product and quantity")
        cart_after = alice.request("cart/summary")
        check(json.dumps(cart_before["items"], sort_keys=True) == json.dumps(cart_after["items"], sort_keys=True), "the assistant proposal never writes the cart before confirmation")
        for phrase in ("Quà cho mẹ dưới 200.000đ", "Quà dưới 200,000 VND", "Quà dưới 200 000 đồng", "Phí ship 30k và quà dưới 200k", "Quà dưới 200k và tiền hàng 150000 đồng"):
            formatted, _ = bob.chat(phrase)
            check("200.000đ" in answer(formatted) and event_data(formatted, "product_cards")[0]["items"], "gift budget parsing preserves the requested amount for " + phrase)
        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": consent["revision"]}, str(uuid.uuid4()))
        conversation, request_key = str(uuid.uuid4()), str(uuid.uuid4())
        events, body = alice.chat("Tặng cho mẹ dịp sinh nhật dưới 200k và phí ship?", conversation, request_key)
        check(len(event_data(events, "tool_call")) == 2 and event_data(events, "product_cards")[0]["items"], "offline multi-intent turn executes two real tools and returns product cards")
        replay = alice.request("agent/chat", "POST", body, request_key)
        check(event_data(replay, "meta")[0].get("replayed") and answer(replay) == answer(events), "completed persisted turn replays idempotently")
        alice.request("agent/chat", "POST", {**body, "message": "different content"}, request_key, 409)
        restored = alice.request("agent/history")
        check(restored["conversationId"] == conversation and len(restored["messages"]) == 2 and restored["memory"]["budget"] == 200000, "history and explicit preferences restore across sessions")
        export_request = alice.request("command", "POST", {"action": "privacy-create", "type": "EXPORT", "note": "Synthetic AI export check", "description": "Synthetic AI export check"}, str(uuid.uuid4()))
        export_row = admin.request("command", "POST", {"action": "privacy-update", "id": export_request["id"], "revision": export_request["revision"], "status": "REVIEWING", "note": "Synthetic review"}, str(uuid.uuid4()))
        admin.request("command", "POST", {"action": "privacy-update", "id": export_row["id"], "revision": export_row["revision"], "status": "COMPLETED", "note": "Synthetic completion"}, str(uuid.uuid4()))
        exported = alice.request("privacy/" + export_row["id"] + "/export")
        check(exported["chat"] and exported["ai_memory"], "normal privacy export includes consented chat and memory")
        check(not bob.request("agent/history?conversationId=" + conversation)["messages"], "conversation UUID never bypasses owner scope")
        fresh, _ = alice.chat("Gợi ý quà như lần trước", str(uuid.uuid4()))
        check(event_data(fresh, "product_cards")[0]["items"], "consented budget memory works in a new conversation")
        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": False, "memoryUse": False, "revision": consent["revision"]}, str(uuid.uuid4()))
        check(sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory');") == "0", "revoking consent atomically removes chat and memory")
        exported = alice.request("privacy/" + export_row["id"] + "/export")
        check("chat" not in exported and "ai_memory" not in exported, "revocation also removes AI data copied into retained export snapshots")
        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": False, "revision": consent["revision"]}, str(uuid.uuid4()))
        for _ in range(21):
            alice.chat("Phí ship bao nhiêu?", conversation)
        check(sql("SELECT count(*) FROM records WHERE kind='chat';") == "20" and not alice.request("agent/history")["memory"], "history is capped at twenty turns independently of memory consent")
        alice.request("agent/history", "DELETE", {}, str(uuid.uuid4()))

        config["services"]["api"]["environment"].update({"APP_AGENT_PROVIDER": "bedrock", "AWS_ACCESS_KEY_ID": "synthetic-key",
            "AWS_SECRET_ACCESS_KEY": "synthetic-secret", "AWS_ENDPOINT_URL_BEDROCK_RUNTIME": f"http://host.docker.internal:{model.server_port}"})
        compose("up", "-d", "--force-recreate", "api")
        wait_ready()
        advice_customer = Browser()
        advice_customer.register("advice-policy@example.invalid")
        general_advice, _ = advice_customer.chat("MODEL_ADVICE_GENERAL Tặng quà gia đình cần cân nhắc gì?")
        check(ModelFixture.advice_policy_seen, "the packaged UTF-8 sales-advice policy and preference data are sent to Bedrock")
        check(not event_data(general_advice, "tool_call") and "khẩu vị" in answer(general_advice) and "phí giao hàng" in answer(general_advice), "general gift advice can mention shipping as a consideration without a forced lookup or a fee claim")
        specific_advice, _ = advice_customer.chat("MODEL_NO_TOOL Tôi cân nhắc Trà Sen Tịnh Tâm, giá bao nhiêu?")
        check(any(data["name"] == "search_products" for data in event_data(specific_advice, "tool_call")), "an advice keyword cannot bypass fresh catalog evidence for a product-price question")
        budget_advice, _ = advice_customer.chat("MODEL_NO_TOOL Tiêu chí chọn quà dưới 200k, gợi ý vài món giúp mình")
        check(event_data(budget_advice, "tool_call") and event_data(budget_advice, "product_cards")[0]["items"] and all(item["price"] <= 200000 for item in event_data(budget_advice, "product_cards")[0]["items"]), "a mixed advice and budget-shopping request retains catalog tools and its explicit price limit")
        search_model, _ = guest.chat('MODEL_SEARCH::{"query":"trà","category":"tra-cung-dinh","limit":8}')
        search_cards = event_data(search_model, "product_cards")[0]["items"]
        check(search_cards and all(card["category"] == tea_category for card in search_cards) and any(card["price"] > 200000 for card in search_cards), "model-selected category search has no implicit budget and returns category metadata")
        check(any(card["id"] == unavailable_tea["id"] and card["available"] is False for card in search_cards), "model search explicitly identifies out-of-stock results")
        stock_only, _ = guest.chat('MODEL_SEARCH::{"query":"trà nhài","inStockOnly":true}')
        check(not event_data(stock_only, "product_cards")[0]["items"] and "hết hàng" in event_data(stock_only, "tool_result")[0]["summary"], "in-stock filtering reports an exhausted match rather than claiming it does not exist")
        unknown_category, _ = guest.chat('MODEL_SEARCH::{"category":"synthetic-unknown-category"}')
        check('"UNKNOWN_CATEGORY"' in answer(unknown_category) and not event_data(unknown_category, "product_cards")[0]["items"], "unknown categories return an explicit empty search result")
        bounded, _ = guest.chat('MODEL_SEARCH::{"query":"trà","limit":1}')
        check(len(event_data(bounded, "product_cards")[0]["items"]) == 1, "search result limits are enforced")
        ungrounded_shipping, _ = guest.chat('MODEL_BAD_SHIPPING MODEL_SEARCH::{"query":"trà"}')
        check("50.000đ" not in answer(ungrounded_shipping) and "Trà" in answer(ungrounded_shipping), "catalog answers cannot invent a shipping fee without calling the shipping tool")
        rejected_search, _ = guest.chat('MODEL_SEARCH::{"query":"trà","ownerId":"untrusted"}')
        check(not event_data(rejected_search, "tool_result")[0]["ok"], "search rejects undeclared identity arguments")
        ambiguous_model, _ = guest.chat("MODEL_CART::Trà::1")
        check(not event_data(ambiguous_model, "cart_proposal") and event_data(ambiguous_model, "product_cards")[0]["items"] and "nhiều sản phẩm" in event_data(ambiguous_model, "tool_result")[0]["summary"], "ambiguous model cart references require a customer choice rather than picking the shortest name")
        for marker in ("MODEL_BUDGET_ZERO", "MODEL_BUDGET_NEGATIVE", "MODEL_BUDGET_INVENTED"):
            unbounded, _ = guest.chat(marker + " gợi ý sản phẩm bán chạy")
            cards = event_data(unbounded, "product_cards")[0]["items"]
            expected_cards = guest.request("products/recommended")["items"]
            check(cards and [item["id"] for item in cards] == [item["id"] for item in expected_cards], "model budget defaults cannot invent a customer price filter: " + marker)
        corrected, _ = guest.chat("MODEL_BUDGET_ZERO quà cho mẹ dưới 100k")
        check(event_data(corrected, "product_cards")[0]["items"] and all(item["price"] <= 100000 for item in event_data(corrected, "product_cards")[0]["items"]) and "100.000đ" in event_data(corrected, "tool_result")[0]["summary"], "a zero model budget cannot override the customer's explicit positive budget")
        small, _ = guest.chat("MODEL_BUDGET_INVENTED quà cho mẹ dưới 200k")
        check(event_data(small, "product_cards")[0]["items"] and "200.000đ" in event_data(small, "tool_result")[0]["summary"], "an incorrectly scaled model budget cannot shrink the customer's stated amount")
        recipient, _ = guest.chat("MODEL_BUDGET_ZERO RECIPIENT_QUERY quà cho mẹ ngân sách 500000 đồng")
        check(event_data(recipient, "product_cards")[0]["items"] and "500.000đ" in event_data(recipient, "tool_result")[0]["summary"], "recipient preferences are not mistaken for a literal product-name filter")
        popular_query, _ = guest.chat("MODEL_BUDGET_ZERO POPULAR_QUERY so sánh 2 gói hàng đang bán chạy")
        check(len(event_data(popular_query, "product_cards")[0]["items"]) == 2 and "Chênh lệch giá" in answer(popular_query), "bestseller and comparison phrases are not mistaken for literal product names")
        missing, _ = guest.chat("MODEL_BUDGET_ZERO MISSING_PRODUCT")
        check(not event_data(missing, "product_cards")[0]["items"] and "ngân sách" not in event_data(missing, "tool_result")[0]["summary"], "empty results do not invent a budget that the customer never supplied")
        named = admin.request("commerce", "POST", {"action": "product-save", "name": "Hộp Quà Hương Huế", "slug": "synthetic-huong-hue", "category": first["category"], "description": "Synthetic box with tea and confectionery", "price": 320000, "stock": 7, "active": True}, str(uuid.uuid4()))
        found, _ = guest.chat("MODEL_BUDGET_ZERO NAME_LOOKUP tôi mua hộp quà Hương Huế cho mẹ được không")
        check([item["id"] for item in event_data(found, "product_cards")[0]["items"]] == [named["id"]] and event_data(found, "tool_result")[0]["ok"], "a product name in the model UUID field recovers as a name search without a false missing-record error")
        check(event_data(found, "product_cards")[0]["items"][0]["description"] == named["description"] and '"rankingBasis": "CATALOG"' in answer(found), "named lookup supplies product descriptions and distinguishes unsold catalog stock from bestsellers")
        refresh, _ = guest.chat("MODEL_NO_TOOL tôi mua hộp quà Hương Huế cho mẹ được không")
        check(event_data(refresh, "tool_call") and [item["id"] for item in event_data(refresh, "product_cards")[0]["items"]] == [named["id"]], "product answers must refresh catalog evidence even when the model tries to answer without a tool")
        compared_model, _ = guest.chat("MODEL_COMPARE::" + named["name"] + "::" + first["name"])
        comparison = event_data(compared_model, "comparison")
        check(comparison and {item["id"] for item in comparison[0]["items"]} == {named["id"], first["id"]}, "model-chosen compare_products emits the structured comparison event")
        proposed_model, _ = guest.chat("MODEL_CART::" + named["name"] + "::3")
        proposal = event_data(proposed_model, "cart_proposal")
        check(proposal and proposal[0]["productId"] == named["id"] and proposal[0]["quantity"] == 3, "model-chosen add_to_cart emits a proposal and never writes the cart itself")
        events, _ = alice.chat("MODEL_TOOL_LOOP tìm quà dưới 200k và phí ship")
        check(event_data(events, "meta")[0]["provider"] == "bedrock" and len(event_data(events, "tool_call")) == 2 and ModelFixture.tool_results_seen and ModelFixture.tool_schema_seen,
              "Bedrock protocol loop sends tool schemas, executes model-chosen tools, and feeds both results back")
        check("PRIVATE_FIXTURE" not in answer(events) and "thinking" not in answer(events) and "<response>" not in answer(events) and "</response>" not in answer(events) and "Đã tìm quà" in answer(events), "model reasoning and response wrappers are removed while preserving the customer answer")
        rejected, _ = alice.chat("TOOL_OWNER_INJECTION")
        check(not event_data(rejected, "tool_result")[0]["ok"], "model-supplied owner identity cannot bypass tool validation")
        outage, _ = alice.chat("MODEL_UNAVAILABLE phí ship bao nhiêu?")
        check(event_data(outage, "meta")[-1]["provider"] == "deterministic" and "chưa áp dụng" in answer(outage), "model failures switch explicitly to functioning deterministic tools")

        context_customer = Browser()
        context_owner = context_customer.register("product-context@example.invalid")
        ginger_candy = sample_product("Mè Xửng Gừng Huế 250g", "synthetic-context-ginger", category=first["category"])
        peanut_candy = sample_product("Mè Xửng Đậu Phộng 300g", "synthetic-context-peanut", price=90000, stock=6, category=first["category"])
        pair = [ginger_candy["id"], peanut_candy["id"]]
        previous = [{"role": "user", "content": "Tôi muốn món quà liên quan đến mè"},
                    {"role": "assistant", "content": ginger_candy["name"] + " và " + peanut_candy["name"]}]
        follow, _ = context_customer.chat("MODEL_BUDGET_ZERO 1 trong 2 món này món nào hợp tặng bạn bè?", context=pair, history=previous)
        check([item["id"] for item in event_data(follow, "product_cards")[0]["items"]] == pair and '"scope": "CONVERSATION"' in answer(follow), "a model recommendation for one of two previous products stays in that set without POPULAR drift")
        inferred, _ = context_customer.chat("MODEL_NO_TOOL 1 trong 2 món này thì chọn món nào?", history=previous)
        check([item["id"] for item in event_data(inferred, "product_cards")[0]["items"]] == pair, "legacy text-only history recovers the pair using verified catalog identities")
        reversed_history = [{"role": "user", "content": "Tôi muốn món quà liên quan đến mè"}, {"role": "assistant", "content": peanut_candy["name"] + " và " + ginger_candy["name"]}]
        reversed_pair, _ = context_customer.chat("MODEL_NO_TOOL 1 trong 2 món này thì chọn món nào?", history=reversed_history)
        check([item["id"] for item in event_data(reversed_pair, "product_cards")[0]["items"]] == list(reversed(pair)), "legacy context preserves the order displayed in the assistant text rather than catalog sorting")
        typo, _ = context_customer.chat('Thế món mè xửng động phộng kia không tặng được hả MODEL_SEARCH::{"query":"mè xửng động phộng"}', context=pair, history=previous)
        check([item["id"] for item in event_data(typo, "product_cards")[0]["items"]] == [peanut_candy["id"]], "a unique distinguishing name word resolves a misspelled contextual reference without global fuzzy search")
        outside_answer, _ = context_customer.chat("MODEL_OUTSIDE_CONTEXT Món mè xửng động phộng kia không tặng được hả?", context=pair)
        check(ginger_candy["name"] not in answer(outside_answer) and peanut_candy["name"] in answer(outside_answer) and "không chứa đậu phộng" not in answer(outside_answer), "a model answer that recommends outside the resolved subject is replaced with grounded contextual advice")
        allowed_answer, _ = context_customer.chat("MODEL_ALLOWED_CONTEXT Món mè xửng động phộng kia tặng được không?", context=pair)
        check("hương vị cần cân nhắc" in answer(allowed_answer), "a generic flavor word cannot be mistaken for an outside gift-box product name")
        ambiguous_context, _ = context_customer.chat("Thêm món kia vào giỏ MODEL_CART::" + ginger_candy["id"] + "::1", context=pair)
        check(not event_data(ambiguous_context, "cart_proposal") and ginger_candy["name"] in answer(ambiguous_context) and peanut_candy["name"] in answer(ambiguous_context), "an ambiguous contextual cart reference asks which product even when the model invents a concrete ID")
        ordinal, _ = context_customer.chat("Thêm món thứ hai vào giỏ MODEL_CART::" + ginger_candy["id"] + "::1", context=pair)
        check(event_data(ordinal, "cart_proposal")[0]["productId"] == peanut_candy["id"], "a contextual ordinal wins over the model's wrong cart ID")
        check(not context_customer.request("cart/summary")["items"], "contextual proposals still leave cart writes to explicit UI confirmation")
        advice_cart, _ = context_customer.chat("Món mè xửng đậu phộng kia tặng bạn bè được không? MODEL_CART::" + ginger_candy["id"] + "::1", context=pair)
        check(not event_data(advice_cart, "cart_proposal"), "contextual suitability questions cannot create an unsolicited cart proposal")
        new_topic, _ = context_customer.chat('Còn trà thì sao? MODEL_SEARCH::{"query":"còn trà thì sao?"}', context=pair)
        check(event_data(new_topic, "product_cards")[0]["items"] and all(item["category"] == tea_category for item in event_data(new_topic, "product_cards")[0]["items"]), "changing to tea releases the previous sesame-candy set")
        only_old = [first["id"]]
        different, _ = context_customer.chat('Tôi muốn Trà Gừng Túi Lọc MODEL_SEARCH::{"query":"Trà Gừng Túi Lọc"}', context=only_old)
        check([item["id"] for item in event_data(different, "product_cards")[0]["items"]] == [ginger_tea["id"]], "a fully named new product is not captured by a shared word in the old set")
        hidden_context, _ = context_customer.chat("MODEL_NO_TOOL Món này còn không?", context=[hidden_tea["id"]])
        check(not event_data(hidden_context, "product_cards")[0]["items"] and hidden_tea["name"] not in answer(hidden_context), "forged hidden product context cannot leak product data or fall back to the whole catalog")
        out_context, _ = context_customer.chat("MODEL_NO_TOOL Món này còn không?", context=[unavailable_tea["id"]])
        check(event_data(out_context, "product_cards")[0]["items"][0]["available"] is False, "context refresh preserves visible out-of-stock status")
        context_customer.chat("Món này", context=["not-a-uuid"], expected=422)
        context_customer.chat("Món này", context=pair * 5, expected=422)
        check(sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory') AND owner_id='" + context_owner["id"] + "';") == "0", "consent-off conversational product context is never stored as history or long-term memory")
        context_customer.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": False, "revision": 0}, str(uuid.uuid4()))
        saved_context = str(uuid.uuid4())
        context_customer.chat("MODEL_BUDGET_ZERO 1 trong 2 món này thì chọn món nào?", saved_context, context=pair)
        restored_context = context_customer.request("agent/history?conversationId=" + saved_context)
        check(restored_context["messages"][-1]["productIds"] == pair and not restored_context["memory"], "history consent restores product identities independently of preference-memory consent")
        fresh_price = 91000
        sql("UPDATE records SET data=jsonb_set(data,'{price}','91000'::jsonb) WHERE id='" + peanut_candy["id"] + "';")
        reloaded, _ = context_customer.chat("MODEL_NO_TOOL Món mè xửng động phộng kia giá bao nhiêu?", saved_context)
        check(event_data(reloaded, "product_cards")[0]["items"][0]["price"] == fresh_price and event_data(reloaded, "product_cards")[0]["items"][0]["id"] == peanut_candy["id"], "a reloaded saved conversation resolves the subject and refreshes its price without client context or stale history facts")
        context_customer.request("agent/consent", "PUT", {"historyUse": False, "memoryUse": False, "revision": 1}, str(uuid.uuid4()))
        check(not context_customer.request("agent/history?conversationId=" + saved_context)["messages"], "revoking history consent also erases saved conversational product identities")

        planner_customer = Browser()
        planner_owner = planner_customer.register("purchase-planner@example.invalid")
        sql("UPDATE records SET data=jsonb_set(jsonb_set(data,'{price}','74998'::jsonb),'{stock}','41'::jsonb) WHERE id='" + ginger_candy["id"] + "';")
        sql("UPDATE records SET data=jsonb_set(jsonb_set(data,'{price}','90000'::jsonb),'{stock}','38'::jsonb) WHERE id='" + peanut_candy["id"] + "';")
        def planned(message, purchase=None, context=pair, history=None):
            events, body = planner_customer.chat(message, context=context, history=history, purchase=purchase)
            return event_data(events, "purchase_plan")[0], event_data(events, "purchase_context")[0], events
        exact, constraints, events = planned("MODEL_NO_TOOL Nhưng ngân sách tôi chỉ có 160k mà phải tặng 2 người mỗi người một sản phẩm thì nên mua sao?")
        chosen = exact["options"][0]
        check(exact["code"] == "PLANNED" and exact["requiredQuantity"] == 2 and len(exact["options"]) == 1 and chosen["lines"][0]["quantity"] == 2 and chosen["lines"][0]["productId"] == ginger_candy["id"] and chosen["subtotal"] == 149996 and chosen["remainingBudget"] == 10004, "160k for two recipients produces two 74,998 VND items, not two independently affordable unit suggestions")
        check(exact["closestOverBudget"]["subtotal"] == 164998 and exact["closestOverBudget"]["remainingBudget"] == -4998 and chosen["total"] == 179996, "mixed gifts and single-order shipping are calculated with exact VND arithmetic")
        check("149.996đ" in answer(events) and "4.998đ" in answer(events) and "19.996đ" in answer(events) and "chưa gồm phí giao" in answer(events), "the final advice retains verified totals, rejected alternative and the unknown-shipping caveat despite a model omission")
        check([card["id"] for card in event_data(events, "product_cards")[0]["items"]] == [ginger_candy["id"]] and event_data(events, "product_cards")[0]["contextProductIds"] == pair, "plan cards show feasible items while retaining the full candidate set for follow-up budget changes")
        included, included_context, _ = planned("MODEL_NO_TOOL 160k bao gồm ship", constraints)
        check(included["code"] == "NO_FEASIBLE_PLAN" and included_context["shippingInBudget"] == "INCLUDED" and included["closestOverBudget"]["total"] == 179996 and not included["options"], "an all-in 160k budget rejects the 179,996 VND single-order total")
        sample_product("Mè Xửng Quà Tiết Kiệm 100g", "synthetic-budget-alternative", price=50000, stock=10, category=first["category"])
        alternatives, alternative_context, _ = planned("MODEL_NO_TOOL Tìm món khác giúp tôi", included_context)
        check(alternatives["options"] and all(option["total"] <= 160000 and sum(line["quantity"] for line in option["lines"]) == 2 for option in alternatives["options"]) and alternative_context["recipientCount"] == 2, "an explicit request for alternatives broadens candidates while retaining total budget, shipping and gift quantity")
        increased, _, _ = planned("MODEL_NO_TOOL 190k bao gồm ship", included_context)
        check(increased["totalBudget"] == 190000 and increased["options"][0]["total"] == 179996, "a later budget amount overrides the prior amount even when it says it includes shipping")
        per_person, per_context, _ = planned("MODEL_NO_TOOL 80k/người, tặng 2 người mỗi người một sản phẩm")
        check(per_person["totalBudget"] == 160000 and per_context["budgetScope"] == "PER_RECIPIENT" and per_person["options"][0]["subtotal"] == 149996, "80k per recipient is distinguished from a total 80k budget")
        total_changed, total_context, _ = planned("MODEL_NO_TOOL Tổng 160k cho cả hai người", per_context)
        check(total_context["budgetScope"] == "TOTAL" and total_changed["totalBudget"] == 160000, "an explicit total budget replaces the previous per-recipient interpretation")
        premium = sample_product("Mè Xửng Cao Cấp 300g", "synthetic-context-premium", price=110000, stock=5, category=first["category"])
        capped, _, _ = planned("MODEL_NO_TOOL 100k mỗi người, tặng hai người mỗi người một sản phẩm", context=[ginger_candy["id"], premium["id"]])
        check(capped["totalBudget"] == 200000 and all(line["unitPrice"] <= 100000 for option in capped["options"] for line in option["lines"]), "a 110k gift is excluded under a 100k per-person cap even when a mixed pair would fit the pooled total")
        quantity, _, _ = planned("MODEL_NO_TOOL Ngân sách 350k tặng 2 người mỗi người 2 hộp")
        check(quantity["requiredQuantity"] == 4 and all(sum(line["quantity"] for line in option["lines"]) == 4 for option in quantity["options"]), "recipient count times units each is enforced across every proposed option")
        inadequate, _, _ = planned("MODEL_NO_TOOL Tổng ngân sách 100k tặng 2 người mỗi người một sản phẩm")
        check(inadequate["code"] == "NO_FEASIBLE_PLAN" and not inadequate["options"], "an insufficient group budget never reduces the number of gifts silently")
        different, _, _ = planned("MODEL_NO_TOOL Tổng 200k tặng 2 người mỗi người một loại khác nhau")
        check(different["options"] and all(len(option["lines"]) == 2 and all(line["quantity"] == 1 for line in option["lines"]) for option in different["options"]), "distinct-gift requests exclude same-product allocations")
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','1'::jsonb) WHERE id IN ('" + ginger_candy["id"] + "','" + peanut_candy["id"] + "');")
        stock_mix, _, _ = planned("MODEL_NO_TOOL Ngân sách 200k tặng hai người mỗi người một sản phẩm")
        check(len(stock_mix["options"]) == 1 and all(line["quantity"] == 1 for line in stock_mix["options"][0]["lines"]), "live stock can force a mixed allocation without overselling a uniform choice")
        uniform, uniform_context, _ = planned("MODEL_NO_TOOL Ngân sách 200k tặng hai người mỗi người một sản phẩm, phải giống nhau")
        check(uniform["code"] == "INSUFFICIENT_STOCK" and not uniform["options"], "a same-product requirement is not relaxed to work around insufficient per-product stock")
        relaxed, _, _ = planned("MODEL_NO_TOOL Không cần giống nhau, xem lại phương án giúp tôi", uniform_context)
        check(relaxed["code"] == "PLANNED", "a later relaxation replaces the earlier same-product requirement")
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','41'::jsonb) WHERE id='" + ginger_candy["id"] + "';")
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','38'::jsonb) WHERE id='" + peanut_candy["id"] + "';")
        sql("UPDATE records SET data=jsonb_set(data,'{freeShippingThreshold}','150000'::jsonb) WHERE kind='settings' AND data->>'code'='shipping';")
        free, _, _ = planned("MODEL_NO_TOOL Ngân sách 200k gồm ship, tặng hai người mỗi người một sản phẩm")
        check(free["options"][0]["subtotal"] == 164998 and free["options"][0]["shippingFee"] == 0 and free["options"][0]["total"] == 164998, "the cheapest all-in choice can be a mixed pair that crosses the verified free-shipping threshold")
        sql("UPDATE records SET data=jsonb_set(data,'{freeShippingThreshold}','0'::jsonb) WHERE kind='settings' AND data->>'code'='shipping';")
        hidden_plan, _, _ = planned("MODEL_NO_TOOL Tổng 160k tặng hai người mỗi người một sản phẩm", context=[hidden_tea["id"]])
        check(not hidden_plan.get("items") and hidden_plan["code"] == "INSUFFICIENT_STOCK", "planning with a hidden product pointer does not expose it or search unrelated products")
        missing, _, _ = planned("MODEL_NO_TOOL Tặng hai người mỗi người một sản phẩm")
        check(missing["code"] == "NEED_BUDGET", "an unknown total budget produces one relevant question instead of an invented amount")
        invented, _, _ = planned("MODEL_PLAN_BAD Tổng 160k tặng hai người mỗi người một sản phẩm")
        check(invented["totalBudget"] == 160000 and invented["requiredQuantity"] == 2 and invented["options"][0]["subtotal"] == 149996, "invented model budget and quantity arguments cannot replace the customer's verified constraints or arithmetic")
        unsolicited, _ = planner_customer.chat("Tổng 160k tặng hai người mỗi người một sản phẩm MODEL_CART::" + ginger_candy["id"] + "::2", context=pair)
        check(not event_data(unsolicited, "cart_proposal") and not planner_customer.request("cart/summary")["items"], "purchase advice never proposes or writes a cart without explicit cart intent")
        sql("UPDATE records SET data=jsonb_set(data,'{enabled}','false'::jsonb) WHERE kind='settings' AND data->>'code'='shipping';")
        paused, _, _ = planned("MODEL_NO_TOOL Tổng 160k tặng hai người mỗi người một sản phẩm")
        check(paused["code"] == "STORE_PAUSED", "a paused store is disclosed before recommending a purchase allocation")
        sql("UPDATE records SET data=jsonb_set(data,'{enabled}','true'::jsonb) WHERE kind='settings' AND data->>'code'='shipping';")
        check(sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory') AND owner_id='" + planner_owner["id"] + "';") == "0", "consent-off purchase constraints and quotes are not persisted")
        planner_customer.chat("test", purchase={"recipientCount": 0}, expected=422)
        planner_customer.chat("test", purchase={"recipientCount": 2, "budget": -1}, expected=422)

        plan_history = Browser()
        plan_history.register("purchase-history@example.invalid")
        plan_history.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": 0}, str(uuid.uuid4()))
        plan_conversation = str(uuid.uuid4())
        plan_key = str(uuid.uuid4())
        first_plan, request_body = plan_history.chat("MODEL_NO_TOOL Tổng 160k tặng hai người mỗi người một sản phẩm", plan_conversation, key=plan_key, context=pair)
        plan_replay = plan_history.request("agent/chat", "POST", request_body, plan_key)
        check(event_data(plan_replay, "meta")[0]["provider"] == "replay" and event_data(plan_replay, "purchase_plan")[0] == event_data(first_plan, "purchase_plan")[0] and event_data(plan_replay, "purchase_context")[0]["recipientCount"] == 2, "idempotent quote retries restore the same computed plan and conversational constraints")
        restored_plan = plan_history.request("agent/history?conversationId=" + plan_conversation)
        check(restored_plan["messages"][-1]["purchaseContext"]["recipientCount"] == 2 and "budget" not in restored_plan["memory"], "history restores group constraints while the group budget is not stored as an ordinary unit preference")
        after_reload, _ = plan_history.chat("MODEL_NO_TOOL Vậy ngân sách 190k gồm ship thì sao?", plan_conversation)
        check(event_data(after_reload, "purchase_plan")[0]["options"][0]["total"] == 179996, "a saved conversation retains recipient count and candidate identities when only the budget changes")
        new_topic, _ = plan_history.chat('Còn trà thì sao? MODEL_SEARCH::{"query":"trà"}', plan_conversation)
        check(event_data(new_topic, "purchase_context")[0] == {} and not event_data(new_topic, "purchase_plan"), "a fresh discovery topic clears purchase constraints instead of silently reusing a group allocation")
        plan_history.request("agent/consent", "PUT", {"historyUse": False, "memoryUse": False, "revision": 1}, str(uuid.uuid4()))
        check(not plan_history.request("agent/history?conversationId=" + plan_conversation)["messages"], "withdrawing history consent also erases purchase constraints and computed quotes")
        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": consent["revision"]}, str(uuid.uuid4()))
        race_key = str(uuid.uuid4())
        race_conversation = str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor() as pool:
            pending = pool.submit(alice.chat, "REVOCATION_RACE quà dưới 200k", race_conversation, race_key)
            check(ModelFixture.entered.wait(15), "in-flight model request reached controlled checkpoint")
            duplicate = Browser()
            duplicate.request("auth/login", "POST", {"email": "alice@example.invalid", "password": PASSWORD})
            duplicate.chat("REVOCATION_RACE quà dưới 200k", race_conversation, race_key, expected=409)
            consent = duplicate.request("agent/consent")
            duplicate.request("agent/consent", "PUT", {"historyUse": False, "memoryUse": False, "revision": consent["revision"]}, str(uuid.uuid4()))
            ModelFixture.release.set()
            events, _ = pending.result(timeout=20)
        check(not event_data(events, "done")[0]["saved"] and sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory');") == "0", "revocation during a running model call prevents resurrecting chat or memory")
        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": consent["revision"]}, str(uuid.uuid4()))
        alice.chat("MODEL_TOOL_LOOP quà dưới 200k")
        forget_key = str(uuid.uuid4())
        result = alice.request("agent/history", "DELETE", {}, forget_key)
        check(alice.request("agent/history", "DELETE", {}, forget_key) == result and not alice.request("agent/history")["messages"], "forget operation deletes data and replays safely")
        check(sql("SELECT count(*) FROM records WHERE kind='ai_memory';") == "0", "forget also removes remembered preferences")
        charlie = Browser()
        closing_user = charlie.register("charlie@example.invalid")
        charlie.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": 0}, str(uuid.uuid4()))
        charlie.chat("MODEL_TOOL_LOOP quà cho mẹ dưới 200k")
        for action in ("RESTRICT", "DELETE"):
            request = charlie.request("command", "POST", {"action": "privacy-create", "type": action, "description": "Synthetic privacy lifecycle check"}, str(uuid.uuid4()))
            reviewed = admin.request("command", "POST", {"action": "privacy-update", "id": request["id"], "revision": request["revision"], "status": "REVIEWING", "note": "Synthetic review"}, str(uuid.uuid4()))
            admin.request("command", "POST", {"action": "privacy-update", "id": reviewed["id"], "revision": reviewed["revision"], "status": "COMPLETED", "note": "Synthetic completion"}, str(uuid.uuid4()))
            check(sql("SELECT count(*) FROM records WHERE kind IN ('chat','ai_memory') AND owner_id='" + closing_user["id"] + "';") == "0", action + " clears assistant data through the normal privacy workflow")
            if action == "RESTRICT":
                consent = charlie.request("agent/consent")
                check(not consent["historyUse"] and not consent["memoryUse"], "restriction also withdraws assistant consent")
                charlie.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": consent["revision"]}, str(uuid.uuid4()))
                charlie.chat("MODEL_TOOL_LOOP quà dưới 200k")
        charlie.request("agent/history", expected=401)
        check(True, "account closure invalidates the assistant session")
        if args.keep:
            config["services"]["api"]["environment"]["APP_AGENT_PROVIDER"] = "deterministic"
            compose("up", "-d", "--force-recreate", "api")
            wait_ready()
        succeeded = True
        print(f"ALL {CHECKS} AGENT DEMO CHECKS PASSED", flush=True)
        if args.keep:
            print(f"Isolated demo left on {ORIGIN}; synthetic login alice@example.invalid / {PASSWORD}", flush=True)
            print(f"Cleanup with docker compose -p {project} -f {compose_path} down --volumes", flush=True)
            temporary._finalizer.detach()
    finally:
        ModelFixture.release.set()
        model.shutdown()
        if not (args.keep and succeeded):
            if not succeeded:
                compose("logs", "--tail", "40", "api")
            compose("down", "--volumes", "--timeout", "3")
            temporary.cleanup()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
