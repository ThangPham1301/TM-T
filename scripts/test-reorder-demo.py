"""Exercise reviewed reorder against disposable Docker data; --keep retains a browser fixture on 13098."""
import argparse
import concurrent.futures
import importlib.util
import json
import pathlib
import subprocess
import tempfile
import time
import uuid

spec = importlib.util.spec_from_file_location("agent_checks", pathlib.Path(__file__).with_name("test-agent-demo.py"))
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)
agent.ORIGIN = "http://127.0.0.1:13098"
agent.BASE = agent.ORIGIN + "/api/store/"
Browser, check = agent.Browser, agent.check
PASSWORD = agent.PASSWORD


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true")
    parser.add_argument("--api-image", default="goihue-api:reorder-review")
    parser.add_argument("--web-image", default="goihue-web:reorder-review")
    args = parser.parse_args()
    project = "tmt-reorder-check-" + uuid.uuid4().hex[:8]
    temporary = tempfile.TemporaryDirectory(prefix="tmt-reorder-check-")
    path = pathlib.Path(temporary.name) / "compose.json"
    config = {"services": {
        "db": {"image": "postgres:16-alpine", "environment": {"POSTGRES_DB": "goihue", "POSTGRES_USER": "goihue", "POSTGRES_PASSWORD": PASSWORD},
               "healthcheck": {"test": ["CMD", "pg_isready", "-U", "goihue", "-d", "goihue"], "interval": "1s", "retries": 30}},
        "api": {"image": args.api_image, "environment": {"SPRING_DATASOURCE_URL": "jdbc:postgresql://db:5432/goihue", "SPRING_DATASOURCE_USERNAME": "goihue", "SPRING_DATASOURCE_PASSWORD": PASSWORD,
                "ADMIN_EMAIL": "reorder-admin@example.invalid", "ADMIN_PASSWORD": PASSWORD, "APP_ORIGINS": agent.ORIGIN,
                "APP_AGENT_PROVIDER": "deterministic", "AWS_EC2_METADATA_DISABLED": "true"}, "depends_on": {"db": {"condition": "service_healthy"}}},
        "web": {"image": args.web_image, "environment": {"API_UPSTREAM_URL": "http://api:8088/api/v1", "APP_PUBLIC_ORIGINS": agent.ORIGIN}, "ports": ["127.0.0.1:13098:3000"]},
    }}
    path.write_text(json.dumps(config), encoding="utf-8")
    def compose(*arguments, capture=False):
        return subprocess.run(["docker", "compose", "-p", project, "-f", str(path), *arguments], check=True, text=True, capture_output=capture).stdout
    def sql(statement):
        return subprocess.run(["docker", "exec", "-i", db_id, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-U", "goihue", "-d", "goihue"],
                              input=statement, text=True, capture_output=True, encoding="utf-8", check=True).stdout.strip()
    def update(product_id, **values):
        for field, value in values.items():
            encoded = json.dumps(value, ensure_ascii=False).replace("'", "''")
            sql(f"UPDATE records SET data=jsonb_set(data,'{{{field}}}','{encoded}'::jsonb) WHERE id='{product_id}';")
    def preview(client, order, items=None, expected=200):
        return client.request(f"orders/{order['id']}/reorder/preview", "POST", {} if items is None else {"items": items}, expected=expected)
    def confirm(client, order, review, items, key=None, expected=200):
        body = {"items": items, "previewToken": review["previewToken"], "cartToken": review["cartToken"]}
        return client.request(f"orders/{order['id']}/reorder", "POST", body, key or str(uuid.uuid4()), expected)
    succeeded = False
    try:
        compose("up", "-d", "--wait", "--wait-timeout", "45", "--pull", "never")
        db_id = compose("ps", "-q", "db", capture=True).strip()
        for _ in range(45):
            try:
                Browser().request("shipping")
                break
            except (OSError, AssertionError):
                time.sleep(1)
        guest, alice, bob, admin = Browser(), Browser(), Browser(), Browser()
        owner = alice.register("reorder-alice@example.invalid")
        other = bob.register("reorder-bob@example.invalid")
        admin.request("auth/login", "POST", {"email": "reorder-admin@example.invalid", "password": PASSWORD})
        products = guest.request("products")
        a, b, c = products[:3]
        sql("UPDATE records SET data=jsonb_set(data,'{stock}','30'::jsonb) WHERE kind='product';")
        alice.request("command", "POST", {"action": "profile", "name": "Current Profile", "phone": "0911111111", "address": "Current profile address"}, str(uuid.uuid4()))
        alice.request("command", "POST", {"action": "address-save", "label": "Home", "recipient": "Saved Address Recipient", "phone": "0922222222", "address": "Saved address", "isDefault": True}, str(uuid.uuid4()))
        def order(status, number, customer=owner, payment="PAID"):
            order_id = str(uuid.uuid4())
            data = {"id": order_id, "revision": 1, "number": number, "status": status, "paymentStatus": payment, "paymentMethod": "COD", "total": a["price"]*2+b["price"],
                    "createdAt": "2026-01-01T00:00:00Z", "recipient": "Previous Gift Recipient", "phone": "0933333333", "address": "Previous gift address", "history": [],
                    "items": [{"productId": p["id"], "name": p["name"], "image": p.get("image", ""), "quantity": q, "price": p["price"]} for p, q in [(a, 2), (b, 1)]]}
            payload = json.dumps(data).replace("'", "''")
            sql(f"INSERT INTO records(id,kind,owner_id,data) VALUES('{order_id}','order','{customer['id']}','{payload}');")
            return data
        source = order("DELIVERED", "GH-REORDER1")
        alien = order("DELIVERED", "GH-REORDER2", other)
        selection = [{"productId": a["id"], "quantity": 2}, {"productId": b["id"], "quantity": 1}]
        for status in ["PLACED", "CONFIRMED", "PACKED", "SHIPPED"]:
            pending = order(status, "GH-" + status[:8].ljust(8, "0"), payment="UNPAID")
            preview(alice, pending, expected=409)
            alice.request(f"orders/{pending['id']}/reorder", "POST", {"items": selection, "previewToken": "a"*64, "cartToken": "b"*64}, str(uuid.uuid4()), 409)
        check(True, "both endpoints reject ongoing orders, including unpaid sources")
        for status in ["CANCELLED", "DELIVERY_FAILED", "RETURNED"]:
            closed = order(status, "GH-" + status[:8].ljust(8, "0"))
            check(preview(alice, closed)["ready"], "ended source is eligible: " + status)
        preview(guest, source, expected=401)
        preview(admin, source, expected=403)
        preview(bob, source, expected=404)
        preview(alice, alien, expected=404)
        check(True, "preview enforces session, customer permission and source ownership")
        cart = alice.request("cart/summary")
        alice.request("commerce", "POST", {"action": "cart-set", "productId": c["id"], "quantity": 3, "cartToken": cart["cartToken"]}, str(uuid.uuid4()))
        original_cart = alice.request("cart/summary")
        reviewed = preview(alice, source)
        check(reviewed["ready"] and reviewed["cartCount"] == 1 and [line["quantity"] for line in reviewed["lines"]] == [2, 1], "preview selects original quantities and discloses existing cart replacement")
        check(reviewed["recipient"]["recipient"] == "Previous Gift Recipient" and reviewed["recipient"]["address"] == "Previous gift address", "preview returns the old recipient without substituting the profile address")
        check(alice.request("cart/summary")["cartToken"] == original_cart["cartToken"], "preview does not mutate the existing cart")
        for invalid in [[{"productId": c["id"], "quantity": 1}], [selection[0], selection[0]], [{"productId": a["id"], "quantity": 1.5}], [{"productId": a["id"], "quantity": 0}], [{"productId": a["id"], "quantity": 101}]]:
            preview(alice, source, invalid, 422)
        check(True, "invalid, duplicate, foreign and fractional selections are rejected")
        empty = preview(alice, source, [])
        check(not empty["ready"] and not empty["quote"], "explicit empty selection never silently restores all old items")
        update(b["id"], stock=0)
        unavailable = preview(alice, source)
        check(not unavailable["ready"] and len(unavailable["lines"]) == 2 and unavailable["lines"][1]["code"] == "OUT_OF_STOCK", "out-of-stock products remain visible and require an explicit customer decision")
        confirm(alice, source, reviewed, selection, expected=409)
        check(alice.request("cart/summary")["cartToken"] == original_cart["cartToken"], "stock changes at confirmation preserve the complete original cart")
        selected_a = [selection[0]]
        reduced = preview(alice, source, selected_a)
        check(reduced["ready"] and reduced["lines"][1]["quantity"] == 0, "customer can explicitly omit the unavailable product")
        update(a["id"], stock=1)
        insufficient = preview(alice, source, selected_a)
        check(not insufficient["ready"] and insufficient["lines"][0]["quantity"] == 2 and insufficient["lines"][0]["code"] == "INSUFFICIENT_STOCK", "insufficient inventory never silently reduces the requested quantity")
        selected_one = [{"productId": a["id"], "quantity": 1}]
        check(preview(alice, source, selected_one)["ready"], "customer can adjust a quantity to fit available stock")
        update(a["id"], stock=30)
        update(b["id"], active=False)
        hidden = preview(alice, source)
        check(hidden["lines"][1]["code"] == "UNAVAILABLE" and hidden["lines"][1]["currentPrice"] is None, "inactive products use historical data without leaking new hidden catalog details")
        update(b["id"], active=True, stock=30)
        reviewed = preview(alice, source)
        update(a["id"], price=a["price"]+1000)
        confirm(alice, source, reviewed, selection, expected=409)
        changed = preview(alice, source)
        check(changed["lines"][0]["priceChanged"] and changed["lines"][0]["currentPrice"] == a["price"]+1000, "price changes invalidate confirmation and appear in a fresh review")
        check(alice.request("cart/summary")["cartToken"] == original_cart["cartToken"], "price conflict leaves original cart untouched")
        update(a["id"], price=a["price"])
        reviewed = preview(alice, source)
        alice.request("commerce", "POST", {"action": "cart-set", "productId": c["id"], "quantity": 4, "cartToken": original_cart["cartToken"]}, str(uuid.uuid4()))
        confirm(alice, source, reviewed, selection, expected=409)
        check(alice.request("cart/summary")["items"][0]["quantity"] == 4, "another-tab cart edits cannot be overwritten by stale reorder confirmation")
        reviewed = preview(alice, source)
        update(source["id"], status="SHIPPED")
        confirm(alice, source, reviewed, selection, expected=409)
        update(source["id"], status="DELIVERED")
        check(alice.request("cart/summary")["items"][0]["quantity"] == 4, "source status is revalidated at confirmation")
        # Inject a database failure on the second item to prove rollback after cart clearing and first insert.
        sql("CREATE FUNCTION fail_reorder_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='cart' AND NEW.data->>'productId'='" + b["id"] + "' THEN RAISE EXCEPTION 'Synthetic cart failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_reorder_line BEFORE INSERT OR UPDATE ON records FOR EACH ROW EXECUTE FUNCTION fail_reorder_line();")
        reviewed = preview(alice, source)
        before_failure = alice.request("cart/summary")["cartToken"]
        confirm(alice, source, reviewed, selection, expected=500)
        check(alice.request("cart/summary")["cartToken"] == before_failure, "a database failure after clearing and partially inserting rolls back the entire cart replacement")
        sql("DROP TRIGGER fail_reorder_line ON records; DROP FUNCTION fail_reorder_line();")
        # Verify exact quote parity with current dynamic pricing and an eligible discount.
        update(a["id"], priceFloor=a["price"]-10000)
        rule = admin.request("commerce", "POST", {"action": "pricing-save", "name": "Synthetic reorder stock price", "type": "STOCK", "threshold": 1,
                             "enabled": True, "targets": [{"productId": a["id"], "price": a["price"]-5000}]}, str(uuid.uuid4()))
        dynamic = preview(alice, source)
        check(dynamic["ready"] and dynamic["lines"][0]["currentPrice"] == a["price"]-5000 and dynamic["lines"][0]["priceSource"] == "STOCK", "reorder previews resolve dynamic price rules instead of copying historical prices")
        sql("DELETE FROM records WHERE id='" + rule["id"] + "';")
        confirm(alice, source, dynamic, selection, expected=409)
        check(alice.request("cart/summary")["cartToken"] == before_failure, "a dynamic pricing boundary invalidates the preview without replacing the cart")
        shipping = guest.request("shipping")
        reviewed = preview(alice, source)
        update(shipping["id"], baseFee=shipping["baseFee"]+1)
        confirm(alice, source, reviewed, selection, expected=409)
        update(shipping["id"], baseFee=shipping["baseFee"])
        check(alice.request("cart/summary")["cartToken"] == before_failure, "changed shipping invalidates the preview and preserves the cart")
        offer = admin.request("commerce", "POST", {"action": "discount-save", "name": "Synthetic reorder discount", "scope": "PRODUCT", "productId": a["id"], "condition": "QUANTITY", "minimum": 2,
                "method": "FIXED", "value": 10000, "startsAt": "2020-01-01T00:00:00Z", "endsAt": "2099-01-01T00:00:00Z", "enabled": True, "featured": False, "priority": 1, "message": "Synthetic"}, str(uuid.uuid4()))
        reviewed = preview(alice, source)
        check(reviewed["quote"]["discountAmount"] == 10000, "preview uses the current eligible checkout discount")
        paused = admin.request("commerce", "POST", {"action": "discount-toggle", "id": offer["id"], "revision": offer["revision"], "enabled": False}, str(uuid.uuid4()))
        confirm(alice, source, reviewed, selection, expected=409)
        check(alice.request("cart/summary")["cartToken"] == before_failure, "a withdrawn discount invalidates confirmation without changing the cart")
        admin.request("commerce", "POST", {"action": "discount-toggle", "id": offer["id"], "revision": paused["revision"], "enabled": True}, str(uuid.uuid4()))
        reviewed = preview(alice, source)
        confirm(guest, source, reviewed, selection, expected=401)
        confirm(admin, source, reviewed, selection, expected=403)
        confirm(bob, source, reviewed, selection, expected=404)
        check(True, "confirmation independently enforces authenticated customer ownership")
        key = str(uuid.uuid4())
        receipt = confirm(alice, source, reviewed, selection, key)
        summary = alice.request("cart/summary")
        check({line["productId"]: line["quantity"] for line in summary["items"]} == {a["id"]: 2, b["id"]: 1}, "confirmation atomically replaces the old cart with exactly the chosen quantities")
        check(all(summary[field] == reviewed["quote"][field] for field in ("subtotal", "discountAmount", "netSubtotal", "shippingFee", "total")), "review quote exactly matches the resulting checkout quote")
        before_orders = sql("SELECT count(*) FROM records WHERE kind='order';")
        check(receipt["sourceOrderId"] == source["id"] and alice.request("state")["user"]["name"] == "Current Profile", "confirmation returns source identity without changing profile data")
        alice.request("commerce", "POST", {"action": "cart-set", "productId": a["id"], "quantity": 1, "cartToken": summary["cartToken"]}, str(uuid.uuid4()))
        replay = confirm(alice, source, reviewed, selection, key)
        check(replay == receipt and next(line for line in alice.request("cart/summary")["items"] if line["productId"] == a["id"])["quantity"] == 1, "idempotent retries replay success without overwriting subsequent cart edits")
        confirm(alice, source, reviewed, selected_a, key, 409)
        check(sql("SELECT count(*) FROM records WHERE kind='order';") == before_orders, "preview, confirmation and retries never create an order or payment")
        # Two concurrent confirmations with distinct keys must not both replace the same cart revision.
        reviewed = preview(alice, source)
        def race(_):
            client = Browser()
            client.request("auth/login", "POST", {"email": "reorder-alice@example.invalid", "password": PASSWORD})
            try:
                confirm(client, source, reviewed, selection)
                return 200
            except AssertionError as problem:
                if "got 409" in str(problem): return 409
                raise
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = sorted(pool.map(race, range(2)))
        check(outcomes == [200, 409], "concurrent reorder confirmations serialize against the same cart revision")
        summary = alice.request("cart/summary")
        checkout = {"action": "checkout", "cartToken": summary["cartToken"], "quoteToken": summary["quoteToken"], "shippingRevision": summary["shipping"]["revision"],
                    "recipient": "Adjusted Gift Recipient", "phone": "0944444444", "address": "Adjusted gift address", "paymentMethod": "COD"}
        placed = alice.request("commerce", "POST", checkout, str(uuid.uuid4()))
        check(placed["id"] != source["id"] and placed["status"] == "PLACED" and placed["paymentStatus"] == "UNPAID", "explicit checkout creates a new unpaid order without copying the old PAID state")
        check(placed["recipient"] == "Adjusted Gift Recipient" and alice.request("state")["user"]["address"] == "Current profile address", "checkout accepts an adjusted recipient without overwriting the customer profile")
        # Leave normal available products plus one out-of-stock source for browser QA.
        sql("DELETE FROM records WHERE id='" + offer["id"] + "';")
        update(a["id"], stock=30)
        update(b["id"], stock=0)
        check(True, "browser fixture retains delivered, cancelled, active and stock-constrained source orders")
        succeeded = True
        print(f"ALL {agent.CHECKS} REORDER CHECKS PASSED", flush=True)
        if args.keep:
            print(f"Fixture: {agent.ORIGIN}; login reorder-alice@example.invalid / {PASSWORD}", flush=True)
            print(f"Cleanup: docker compose -p {project} -f {path} down --volumes", flush=True)
            temporary._finalizer.detach()
    finally:
        if not (args.keep and succeeded):
            if not succeeded: compose("logs", "--tail", "30", "api")
            compose("down", "--volumes", "--timeout", "3")
            temporary.cleanup()

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    main()
