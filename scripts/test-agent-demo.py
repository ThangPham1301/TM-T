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


def check(condition, message):
    if not condition:
        raise AssertionError(message)
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

    def chat(self, message, conversation=None, key=None, expected=200):
        body = {"message": message, "conversationId": conversation or str(uuid.uuid4())}
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

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        ModelFixture.tool_schema_seen = len(body.get("toolConfig", {}).get("tools", [])) == 5
        messages = body["messages"]
        prompt = next(block["text"] for msg in reversed(messages) for block in msg["content"] if "text" in block and msg["role"] == "user")
        results = [block["toolResult"] for block in messages[-1]["content"] if "toolResult" in block]
        if "REVOCATION_RACE" in prompt:
            self.entered.set()
            self.release.wait(15)
            content = [{"text": "Đã xử lý lượt kiểm tra đồng thời."}]
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
                content = [{"text": "<thinking>PRIVATE_FIXTURE</thinking>\nĐã tìm quà trong ngân sách và kiểm tra phí giao từ hai công cụ."}]
                stop = "end_turn"
        elif "TOOL_OWNER_INJECTION" in prompt:
            if not results:
                content = [{"toolUse": {"toolUseId": "fixture-injection", "name": "lookup_order", "input": {"number": "GH-AAAAAAAA", "ownerId": "untrusted"}}}]
                stop = "tool_use"
            else:
                check(results[0]["status"] == "error", "untrusted model owner arguments are rejected")
                content = [{"text": "Tham số công cụ đã bị từ chối."}]
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
    args = parser.parse_args()
    project = "tmt-agent-check-" + uuid.uuid4().hex[:8]
    model = http.server.ThreadingHTTPServer(("0.0.0.0", 0), ModelFixture)
    threading.Thread(target=model.serve_forever, daemon=True).start()
    config = {"services": {
        "db": {"image": "postgres:16-alpine", "environment": {"POSTGRES_DB": "goihue", "POSTGRES_USER": "goihue", "POSTGRES_PASSWORD": PASSWORD},
               "healthcheck": {"test": ["CMD", "pg_isready", "-U", "goihue", "-d", "goihue"], "interval": "1s", "retries": 30}},
        "api": {"image": "goihue-api:agent-demo-review", "environment": {
            "SPRING_DATASOURCE_URL": "jdbc:postgresql://db:5432/goihue", "SPRING_DATASOURCE_USERNAME": "goihue", "SPRING_DATASOURCE_PASSWORD": PASSWORD,
            "ADMIN_EMAIL": "review-admin@example.invalid", "ADMIN_PASSWORD": PASSWORD, "APP_ORIGINS": ORIGIN,
            "APP_AGENT_PROVIDER": "deterministic", "AWS_EC2_METADATA_DISABLED": "true"},
            "depends_on": {"db": {"condition": "service_healthy"}}},
        "web": {"image": "goihue-web:agent-demo-review", "environment": {"API_UPSTREAM_URL": "http://api:8088/api/v1", "APP_PUBLIC_ORIGINS": ORIGIN},
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
        events, _ = alice.chat("MODEL_TOOL_LOOP tìm quà dưới 200k và phí ship")
        check(event_data(events, "meta")[0]["provider"] == "bedrock" and len(event_data(events, "tool_call")) == 2 and ModelFixture.tool_results_seen and ModelFixture.tool_schema_seen,
              "Bedrock protocol loop sends tool schemas, executes model-chosen tools, and feeds both results back")
        check("PRIVATE_FIXTURE" not in answer(events) and "thinking" not in answer(events), "model reasoning markup is removed before rendering or persistence")
        rejected, _ = alice.chat("TOOL_OWNER_INJECTION")
        check(not event_data(rejected, "tool_result")[0]["ok"], "model-supplied owner identity cannot bypass tool validation")
        outage, _ = alice.chat("MODEL_UNAVAILABLE phí ship bao nhiêu?")
        check(event_data(outage, "meta")[-1]["provider"] == "deterministic" and "chưa áp dụng" in answer(outage), "model failures switch explicitly to functioning deterministic tools")
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
        print("ALL AGENT DEMO CHECKS PASSED", flush=True)
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
