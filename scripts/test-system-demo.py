"""Exercise the store through an HTTPS reverse proxy and a disposable database.

Requires Docker, OpenSSL and Python 3.11+. Build goihue-api:system-review and
goihue-web:system-review first. Provider callbacks here use synthetic signed
payloads. --keep retains the isolated stack for browser checks.
"""

import argparse
import base64
import concurrent.futures
import contextlib
import hashlib
import hmac
import http.cookiejar
import json
import os
import pathlib
import socket
import ssl
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid
import zlib


ORIGIN = "https://127.0.0.1:13443"
PASSWORD = "disposable-system-password"
IPN_SECRET = "synthetic-ipn-secret-for-local-tests"
SEPAY_SECRET = "synthetic-sepay-secret-for-local-tests"
BANK_ACCOUNT = "0000123456789"
RESULTS = []


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    RESULTS.append(message)
    print("PASS " + message, flush=True)


class Client:
    def __init__(self, context):
        self.context = context
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPSHandler(context=context), urllib.request.HTTPCookieProcessor(self.cookies)
        )

    def request(self, path, method="GET", body=None, key=None, expected=200, headers=None, origin=ORIGIN, raw=False):
        outgoing = {} if origin is None else {"Origin": origin}
        outgoing.update(headers or {})
        data = body
        if body is not None and not isinstance(body, bytes):
            data = json.dumps(body, ensure_ascii=False).encode()
            outgoing.setdefault("Content-Type", "application/json")
        if key:
            outgoing["Idempotency-Key"] = key
        url = path if path.startswith("http") else ORIGIN + "/api/store/" + path
        request = urllib.request.Request(url, data=data, headers=outgoing, method=method)
        try:
            response = self.opener.open(request, timeout=65)
        except urllib.error.HTTPError as error:
            response = error
        payload = response.read()
        if response.status != expected:
            raise AssertionError(f"{method} {path}: expected {expected}, got {response.status}: {payload[:400]!r}")
        if raw:
            return payload, response.headers
        return json.loads(payload)

    def mutate(self, action, path="commerce", expected=200, key=None, **fields):
        return self.request(path, "POST", {"action": action, **fields}, key or str(uuid.uuid4()), expected)

    def login(self, email, password=PASSWORD):
        return self.request("auth/login", "POST", {"email": email, "password": password})

    def state(self):
        return self.request("state")

    def order(self, order_id):
        return next(order for order in self.state()["orders"] if order["id"] == order_id)

    def add(self, product_id, quantity=1):
        summary = self.request("cart/summary")
        return self.mutate("cart-set", cartToken=summary["cartToken"], productId=product_id, quantity=quantity)

    def checkout(self, product_id, method="COD", quantity=1, **fields):
        summary = self.request("cart/summary")
        if summary["items"]:
            self.mutate("cart-clear", cartToken=summary["cartToken"])
        self.add(product_id, quantity)
        summary = self.request("cart/summary")
        return self.mutate("checkout", cartToken=summary["cartToken"], shippingRevision=summary["shipping"]["revision"],
                           recipient="Synthetic Recipient", phone="0900000000", address="Synthetic test address", paymentMethod=method, **fields)


class WebSocketProbe:
    def __init__(self, client, origin=ORIGIN, authenticated=True, expected=101):
        self.socket = client.context.wrap_socket(socket.create_connection(("127.0.0.1", 13443), timeout=10), server_hostname="127.0.0.1")
        self.socket.settimeout(8)
        self.buffer = b""
        key = base64.b64encode(os.urandom(16)).decode()
        headers = ["GET /api/store/live HTTP/1.1", "Host: 127.0.0.1:13443", "Upgrade: websocket", "Connection: Upgrade",
                   "Sec-WebSocket-Version: 13", "Sec-WebSocket-Key: " + key, "Origin: " + origin]
        if authenticated:
            headers.append("Cookie: " + "; ".join(cookie.name + "=" + cookie.value for cookie in client.cookies))
        self.socket.sendall(("\r\n".join(headers) + "\r\n\r\n").encode())
        while b"\r\n\r\n" not in self.buffer:
            chunk = self.socket.recv(4096)
            if not chunk:
                raise AssertionError("WebSocket closed before handshake")
            self.buffer += chunk
        handshake, self.buffer = self.buffer.split(b"\r\n\r\n", 1)
        status = int(handshake.split(b" ")[1])
        if status != expected:
            self.close()
            raise AssertionError(f"WebSocket expected {expected}, got {handshake!r}")

    def read(self, size):
        while len(self.buffer) < size:
            chunk = self.socket.recv(4096)
            if not chunk:
                raise EOFError("WebSocket closed")
            self.buffer += chunk
        result, self.buffer = self.buffer[:size], self.buffer[size:]
        return result

    def next_frame(self):
        first, second = self.read(2)
        size = second & 127
        if size == 126:
            size = struct.unpack("!H", self.read(2))[0]
        elif size == 127:
            size = struct.unpack("!Q", self.read(8))[0]
        payload = self.read(size)
        opcode = first & 15
        if opcode == 9:
            mask = os.urandom(4)
            self.socket.sendall(bytes([0x8A, 0x80 | len(payload)]) + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(payload)))
        return opcode, payload

    def text(self):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            opcode, payload = self.next_frame()
            if opcode == 1:
                return payload.decode()
            if opcode == 8:
                raise EOFError("WebSocket revoked")
        raise AssertionError("No text invalidation received")

    def close(self):
        with contextlib.suppress(OSError):
            self.socket.close()


def png():
    def chunk(kind, body):
        return struct.pack("!I", len(body)) + kind + body + struct.pack("!I", zlib.crc32(kind + body))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\0\xff\0\0")) + chunk(b"IEND", b"")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", action="store_true")
    args = parser.parse_args()
    project = "tmt-system-check-" + uuid.uuid4().hex[:8]
    temporary = tempfile.TemporaryDirectory(prefix="tmt-system-check-")
    root = pathlib.Path(temporary.name)
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", str(root / "tls.key"),
                    "-out", str(root / "tls.crt"), "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"],
                   check=True, capture_output=True)
    (root / "nginx.conf").write_text("""events {}
http {
  map $http_upgrade $connection_upgrade { default upgrade; '' close; }
  server {
    listen 8443 ssl;
    ssl_certificate /fixture/tls.crt;
    ssl_certificate_key /fixture/tls.key;
    client_max_body_size 7m;
    location / {
      proxy_pass http://web:3000;
      proxy_http_version 1.1;
      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_read_timeout 190s;
      proxy_buffering off;
    }
  }
}
""", encoding="utf-8")
    config = {"services": {
        "db": {"image": "postgres:16-alpine", "environment": {"POSTGRES_DB": "goihue", "POSTGRES_USER": "goihue", "POSTGRES_PASSWORD": PASSWORD},
               "healthcheck": {"test": ["CMD", "pg_isready", "-U", "goihue", "-d", "goihue"], "interval": "1s", "retries": 30}},
        "api": {"image": "goihue-api:system-review", "environment": {
            "SPRING_DATASOURCE_URL": "jdbc:postgresql://db:5432/goihue", "SPRING_DATASOURCE_USERNAME": "goihue", "SPRING_DATASOURCE_PASSWORD": PASSWORD,
            "ADMIN_EMAIL": "system-admin@example.invalid", "ADMIN_PASSWORD": PASSWORD, "APP_ORIGINS": ORIGIN,
            "APP_COOKIE_SECURE": "true", "APP_BANK_ACCOUNT": BANK_ACCOUNT, "APP_BANK_BIN": "970422", "APP_BANK_NAME": "SYNTHETIC TEST",
            "APP_IPN_SECRET": IPN_SECRET, "APP_SEPAY_SECRET": SEPAY_SECRET, "APP_PAYMENT_SWEEP_MS": "1000", "APP_LIVE_HEARTBEAT_MS": "2000",
            "APP_AGENT_PROVIDER": "deterministic", "AWS_EC2_METADATA_DISABLED": "true"},
            "ports": ["127.0.0.1:18097:8088"], "depends_on": {"db": {"condition": "service_healthy"}}},
        "web": {"image": "goihue-web:system-review", "environment": {"API_UPSTREAM_URL": "http://api:8088/api/v1", "APP_PUBLIC_ORIGINS": ORIGIN}},
        "proxy": {"image": "nginx:alpine", "ports": ["127.0.0.1:13443:8443"], "volumes": [str(root).replace("\\", "/") + ":/fixture:ro",
                  str(root / "nginx.conf").replace("\\", "/") + ":/etc/nginx/nginx.conf:ro"], "depends_on": ["web"]},
    }}
    compose_path = root / "compose.json"
    compose_path.write_text(json.dumps(config), encoding="utf-8")

    def compose(*arguments, capture=False):
        return subprocess.run(["docker", "compose", "-p", project, "-f", str(compose_path), *arguments], check=True,
                              text=True, capture_output=capture).stdout

    def sql(statement):
        result = subprocess.run(["docker", "exec", "-i", db_id, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-U", "goihue", "-d", "goihue"],
                                input=statement, text=True, encoding="utf-8", capture_output=True, check=True)
        return result.stdout.strip()

    context = ssl.create_default_context(cafile=str(root / "tls.crt"))
    succeeded = False
    probes = []
    try:
        compose("up", "-d", "--wait", "--wait-timeout", "45", "--pull", "never")
        db_id = compose("ps", "-q", "db", capture=True).strip()
        guest = Client(context)
        for attempt in range(45):
            try:
                guest.request("shipping")
                break
            except (OSError, AssertionError):
                if attempt == 44:
                    raise
                time.sleep(1)
        guest.request("state", expected=401)
        guest.request("auth/register", "POST", {"email": "weak@example.invalid", "password": "short", "name": "Weak"}, expected=422)
        alice, bob, admin = Client(context), Client(context), Client(context)
        payload = {"email": "system-alice@example.invalid", "password": PASSWORD, "name": "Synthetic Alice", "role": "ADMIN"}
        alice_actor = alice.request("auth/register", "POST", payload)
        check(alice_actor["role"] == "CUSTOMER", "registration always assigns CUSTOMER despite a submitted admin role")
        cookie = next(cookie for cookie in alice.cookies if cookie.name == "goihue_session")
        check(cookie.secure and cookie.path == "/api/store" and "HttpOnly" in cookie._rest and cookie._rest.get("SameSite") == "Strict", "HTTPS registration sets Secure, HttpOnly, SameSite=Strict session cookie")
        guest.request("auth/register", "POST", payload, expected=422)
        bob.request("auth/register", "POST", {"email": "system-bob@example.invalid", "password": PASSWORD, "name": "Synthetic Bob"})
        guest.request("auth/login", "POST", {"email": "system-alice@example.invalid", "password": "wrong-password"}, expected=401)
        admin.login("system-admin@example.invalid")
        admin.request("cart", expected=403)
        alice.mutate("product-save", expected=403, name="Denied")
        guest.request("auth/login", "POST", payload, origin=None, expected=403)
        guest.request("auth/login", "POST", payload, origin="https://foreign.invalid", expected=403)
        check(True, "login, duplicate signup, role checks and untrusted/absent Origin reject invalid requests")
        owner_socket, admin_socket = WebSocketProbe(alice), WebSocketProbe(admin)
        probes += [owner_socket, admin_socket]
        rejected = WebSocketProbe(guest, authenticated=False, expected=401)
        rejected.close()
        rejected = WebSocketProbe(alice, origin="https://foreign.invalid", expected=403)
        rejected.close()
        check(True, "same-domain WSS upgrades through TLS proxy and Next.js; invalid sessions/origins are rejected")
        products = admin.request("admin/products")

        def save_product(product, **fields):
            current = next(row for row in admin.request("admin/products") if row["id"] == product["id"])
            body = {key: current[key] for key in ("id", "revision", "name", "slug", "category", "description", "price", "stock", "active")}
            return admin.mutate("product-save", **{**body, **fields})

        for product in products:
            save_product(product, stock=100)
        product = products[0]
        admin_products = lambda: {row["id"]: row for row in admin.request("admin/products")}
        alice.mutate("profile", "command", name="Synthetic Profile", phone="0900000000", address="Synthetic address")
        address = alice.mutate("address-save", "command", label="Home", recipient="Synthetic Recipient", phone="0900000000", address="Synthetic destination", isDefault=True)
        alice.mutate("address-save", "command", expected=409, id=address["id"], revision=0)
        bob.mutate("address-delete", "command", expected=404, id=address["id"], revision=address["revision"])
        check(alice.state()["addresses"][0]["isDefault"], "profile and default address persist with revision and owner checks")
        category = admin.mutate("category-save", code="synthetic-catalog", name="Synthetic Catalog", description="", sortOrder=9, active=True)
        sample = admin.mutate("product-save", name="Synthetic Product", slug="synthetic-product", category="synthetic-catalog", description="Synthetic lifecycle check", price=120000, stock=5, active=True)
        category = admin.mutate("category-save", id=category["id"], revision=category["revision"], code="synthetic-renamed", name="Synthetic Catalog", description="", sortOrder=9, active=True)
        check(guest.request("products/synthetic-product")["category"] == "synthetic-renamed", "renaming a category updates product references atomically")
        category = admin.mutate("catalog-toggle", id=category["id"], revision=category["revision"], kind="category", active=False)
        guest.request("products/synthetic-product", expected=404)
        check(sample["id"] not in [row["id"] for row in guest.request("products/recommended?limit=8")["items"]], "inactive categories hide their products from detail and recommendation results")
        category = admin.mutate("catalog-toggle", id=category["id"], revision=category["revision"], kind="category", active=True)
        admin.mutate("category-delete", expected=422, id=category["id"], revision=category["revision"])
        bob.add(sample["id"])
        sample = admin_products()[sample["id"]]
        admin.mutate("product-delete", expected=422, id=sample["id"], revision=sample["revision"])
        bob.add(sample["id"], 0)
        admin.mutate("product-delete", id=sample["id"], revision=sample["revision"])
        admin.mutate("category-delete", id=category["id"], revision=category["revision"])
        check(True, "catalog deletion protects referenced records and removes unreferenced product/category pairs")
        shipping = guest.request("shipping")
        shipping_threshold = int(product["price"]) * 2
        shipping = admin.mutate("shipping-save", revision=shipping["revision"], baseFee=30000, freeShippingThreshold=shipping_threshold, enabled=True)
        bob.add(product["id"], 3)
        check(bob.request("cart/summary")["shippingFee"] == 0, "configured free-shipping threshold applies to a qualifying cart")
        bob.add(product["id"], 1)
        old_summary = bob.request("cart/summary")
        check(old_summary["shippingFee"] == 30000, "a cart below the free-shipping threshold pays the configured fee")
        shipping = admin.mutate("shipping-save", revision=shipping["revision"], baseFee=30000, freeShippingThreshold=shipping_threshold, enabled=False, pauseMessage="Synthetic pause")
        bob.mutate("checkout", expected=422, cartToken=old_summary["cartToken"], shippingRevision=shipping["revision"], recipient="Synthetic", phone="0900000000", address="Synthetic")
        shipping = admin.mutate("shipping-save", revision=shipping["revision"], baseFee=30000, freeShippingThreshold=0, enabled=True)
        bob.mutate("checkout", expected=409, cartToken=old_summary["cartToken"], shippingRevision=old_summary["shipping"]["revision"], recipient="Synthetic", phone="0900000000", address="Synthetic")
        bob.add(product["id"], 0)
        check(True, "paused checkout and stale shipping revisions reject orders before committing inventory")
        summary = alice.request("cart/summary")
        alice.mutate("cart-set", expected=422, cartToken=summary["cartToken"], productId=product["id"], quantity=-1)
        alice.add(product["id"], 2)
        alice.mutate("cart-clear", expected=409, cartToken=summary["cartToken"])
        summary = alice.request("cart/summary")
        old_price = summary["items"][0]["price"]
        changed = save_product(product, price=old_price + 1000)
        alice.mutate("checkout", expected=422, cartToken=summary["cartToken"], shippingRevision=summary["shipping"]["revision"], recipient="Synthetic", phone="0900000000", address="Synthetic", paymentMethod="COD")
        check(alice.request("cart/summary")["items"][0]["priceChanged"], "checkout rejects stale catalog prices and exposes a refresh instruction")
        alice.mutate("cart-refresh", cartToken=summary["cartToken"])
        summary = alice.request("cart/summary")
        unchanged_stock = admin_products()[product["id"]]["stock"]
        alice.mutate("checkout", expected=422, cartToken=summary["cartToken"], shippingRevision=summary["shipping"]["revision"], recipient="Synthetic", phone="........", address="Synthetic")
        check(admin_products()[product["id"]]["stock"] == unchanged_stock, "recipient validation failure rolls back all checkout inventory changes")
        checkout_body = {"action": "checkout", "cartToken": summary["cartToken"], "shippingRevision": summary["shipping"]["revision"], "addressId": address["id"], "paymentMethod": "COD", "total": 1, "shippingFee": 0}
        checkout_key = str(uuid.uuid4())
        before_stock = admin_products()[product["id"]]["stock"]
        cod = alice.request("commerce", "POST", checkout_body, checkout_key)
        replay = alice.request("commerce", "POST", checkout_body, checkout_key)
        check(cod["id"] == replay["id"] and cod["total"] == summary["total"] and cod["address"] == address["address"] and admin_products()[product["id"]]["stock"] == before_stock - 2, "COD checkout snapshots server price/destination and retries create exactly one order")
        check(owner_socket.text() == "state-changed" and admin_socket.text() == "state-changed", "committed checkout invalidates both owner and staff WSS subscriptions")
        alice.request("commerce", "POST", {**checkout_body, "total": 2}, checkout_key, expected=409)
        bob.mutate("order-recipient", expected=404, id=cod["id"], revision=cod["revision"], note="Denied")
        cancel_key = str(uuid.uuid4())
        cancelled = alice.mutate("order-cancel", id=cod["id"], revision=cod["revision"], note="Synthetic cancellation", key=cancel_key)
        alice.mutate("order-cancel", id=cod["id"], revision=cod["revision"], note="Synthetic cancellation", key=cancel_key)
        check(cancelled["status"] == "CANCELLED" and admin_products()[product["id"]]["stock"] == before_stock, "cancellation releases inventory once even after an idempotent retry")

        def provider(order, event_id, amount=None, account=BANK_ACCOUNT, signature_ok=True, timestamp=None, transfer_type="in", content=None, expected=200):
            payload = {"id": event_id, "gateway": "MBBank", "accountNumber": account, "transferType": transfer_type,
                       "transferAmount": order["total"] if amount is None else amount, "content": content or order["number"], "code": None}
            raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
            timestamp = str(int(time.time()) if timestamp is None else timestamp)
            signature = hmac.new(SEPAY_SECRET.encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
            return guest.request("payments/sepay/webhook", "POST", raw, expected=expected, origin=None,
                                 headers={"Content-Type": "application/json", "X-SePay-Timestamp": timestamp, "X-SePay-Signature": "sha256=" + (signature if signature_ok else "0" * 64)})

        qr = alice.checkout(product["id"], "VIETQR")
        check(qr["payment"]["status"] == "PENDING" and qr["payment"]["amount"] == qr["total"] and qr["payment"]["bankAccount"] == BANK_ACCOUNT and qr["number"] in qr["payment"]["payload"], "VietQR checkout creates a pending QR with exact amount, reference and receiving account")
        provider(qr, 1001, signature_ok=False, expected=401)
        provider(qr, 1001, timestamp=int(time.time()) - 600, expected=401)
        provider(qr, 1001, account="wrong-account")
        check(alice.order(qr["id"])["paymentStatus"] == "UNPAID", "invalid signatures, expired timestamps and foreign receiving accounts cannot confirm payment")
        check(provider(qr, 1002, amount=float(qr["total"]))["success"], "public SePay webhook accepts valid raw-body HMAC without browser Origin or session")
        paid = alice.order(qr["id"])
        paid_revision = paid["revision"]
        provider(qr, 1002, amount=float(qr["total"]))
        check(paid["paymentStatus"] == "PAID" and alice.order(qr["id"])["revision"] == paid_revision, "decimal .0 VND amounts confirm once and callback retries preserve order revision")
        second = alice.checkout(product["id"], "VIETQR")
        provider(second, 1002)
        check(alice.order(second["id"])["paymentStatus"] == "UNPAID", "one provider transaction ID cannot credit two orders")
        provider(qr, 1003)
        extra_order = alice.order(qr["id"])
        check(extra_order["paymentStatus"] == "PAID" and extra_order["payment"]["status"] == "PAID" and extra_order["payment"]["extraPayments"][0]["status"] == "REVIEW", "a second transfer preserves the paid order and opens separate extra-payment reconciliation")
        provider(qr, 1003)
        check(alice.order(qr["id"])["revision"] == extra_order["revision"], "retrying an extra transfer does not append another receipt or change the order revision")
        extra_order = admin.mutate("payment-resolve", id=extra_order["id"], revision=extra_order["revision"], resolution="EXTRA_REFUNDED", transactionId="SEPAY-1003", reference="SYNTHETIC-EXTRA-REFUND", note="Synthetic extra refund")
        provider(qr, 1003)
        check(extra_order["paymentStatus"] == "PAID" and alice.order(qr["id"])["payment"]["extraPayments"][0]["status"] == "REFUNDED", "refunding the selected extra receipt preserves the original paid status and remains deduplicated")
        mismatch = alice.checkout(product["id"], "VIETQR")
        provider(mismatch, 1004, amount=mismatch["total"] + 1000)
        check(alice.order(mismatch["id"])["paymentStatus"] == "REVIEW", "a valid notification with the wrong amount enters REVIEW")
        outgoing = alice.checkout(product["id"], "VIETQR")
        provider(outgoing, 1005, transfer_type="out")
        check(alice.order(outgoing["id"])["paymentStatus"] == "UNPAID", "outgoing bank transfers are acknowledged without marking orders paid")
        dashless = alice.checkout(product["id"], "VIETQR")
        provider(dashless, 1006, content="Synthetic " + dashless["number"].replace("-", ""))
        check(alice.order(dashless["id"])["paymentStatus"] == "PAID", "bank narratives that strip the code hyphen still match the exact order")
        guest.request("payments/sepay/webhook", expected=405)
        guest.request("payments/sepay/webhook", "POST", b"x" * 65537, expected=413, origin=None)
        guest.request("payments/ipn", "POST", {}, origin=None, expected=404)
        check(True, "provider route rejects unsupported methods/oversized bodies and keeps demo IPN private")
        ipn_order = alice.checkout(product["id"], "VIETQR")
        transaction = "synthetic-ipn-1"
        signature = hmac.new(IPN_SECRET.encode(), f"{ipn_order['number']}|{ipn_order['total']}|{transaction}".encode(), hashlib.sha256).hexdigest()
        ipn_body = {"orderNumber": ipn_order["number"], "amount": ipn_order["total"], "transactionId": transaction, "signature": signature}
        check(guest.request("http://127.0.0.1:18097/api/v1/payments/ipn", "POST", ipn_body, origin=None)["result"] == "PAID", "internal demo IPN validates its separate signing secret")
        manual = alice.checkout(product["id"], "VIETQR")
        admin.mutate("order-paid", expected=422, id=manual["id"], revision=manual["revision"], reference="SYNTHETIC-MANUAL", note="Synthetic invalid override")
        check(alice.order(manual["id"])["paymentStatus"] == "UNPAID", "COD receipt recording cannot bypass VietQR webhook or reconciliation")
        sql("UPDATE records SET data=jsonb_set(jsonb_set(data,'{paymentStatus}','\"REVIEW\"'::jsonb),'{payment,status}','\"REVIEW\"'::jsonb) WHERE id='" + manual["id"] + "';")
        manual = alice.order(manual["id"])
        manual = admin.mutate("payment-resolve", id=manual["id"], revision=manual["revision"], resolution="PAID_RECORDED", reference="SYNTHETIC-LEGACY-CONFIRMED", note="Synthetic legacy reconciliation")
        check(manual["paymentStatus"] == "PAID" and manual["payment"]["status"] == "RESOLVED_PAID", "legacy primary reconciliation completes the QR payment session")
        unpaid = alice.checkout(product["id"], "VIETQR")
        unpaid = admin.mutate("order-status", id=unpaid["id"], revision=unpaid["revision"], status="CONFIRMED", note="Synthetic confirmation")
        admin.mutate("order-status", expected=422, id=unpaid["id"], revision=unpaid["revision"], status="PACKED", note="Synthetic invalid fulfillment")
        check(True, "unpaid VietQR orders cannot enter physical fulfillment before payment confirmation")
        legacy = alice.checkout(product["id"], "VIETQR")
        sql("UPDATE records SET data=jsonb_set(data,'{payment,transactionId}','\"SEPAY-777777\"'::jsonb) WHERE id='" + ipn_order["id"] + "';")
        provider(legacy, 777777)
        check(alice.order(legacy["id"])["paymentStatus"] == "UNPAID", "transaction reuse is blocked for orders created before the payment-event ledger")
        sql("UPDATE records SET data=jsonb_set(data,'{payment,extraPayments}','[{\"transactionId\":\"SEPAY-888888\",\"status\":\"REFUNDED\"}]'::jsonb) WHERE id='" + ipn_order["id"] + "';")
        provider(legacy, 888888)
        check(alice.order(legacy["id"])["paymentStatus"] == "UNPAID", "legacy extra-payment references cannot be reused to credit a different order")
        expiring = alice.checkout(product["id"], "VIETQR")
        reserved_stock = admin_products()[product["id"]]["stock"]
        sql("UPDATE records SET data=jsonb_set(data,'{payment,expiresAt}',to_jsonb((now()-interval '1 minute')::text)) WHERE id='" + expiring["id"] + "';")
        for _ in range(20):
            if alice.order(expiring["id"])["status"] == "CANCELLED":
                break
            time.sleep(.25)
        check(alice.order(expiring["id"])["payment"]["status"] == "EXPIRED" and admin_products()[product["id"]]["stock"] == reserved_stock + 1, "expiry cancels an unpaid QR order and restores inventory once")
        provider(expiring, 1007)
        time.sleep(1.2)
        check(alice.order(expiring["id"])["paymentStatus"] == "REVIEW" and admin_products()[product["id"]]["stock"] == reserved_stock + 1, "a late transfer enters REVIEW without restoring or consuming stock again")
        review = alice.order(mismatch["id"])
        alice.mutate("order-cancel", expected=422, id=review["id"], revision=review["revision"], note="Synthetic invalid cancellation")
        admin.mutate("payment-resolve", expected=422, id=review["id"], revision=review["revision"], resolution="PAID_RECORDED", reference="SYNTHETIC-INVALID", note="Synthetic invalid override")
        refund_stock = admin_products()[product["id"]]["stock"]
        resolved = admin.mutate("payment-resolve", id=review["id"], revision=review["revision"], resolution="REFUNDED", reference="SYNTHETIC-REFUND", note="Synthetic primary refund")
        check(resolved["paymentStatus"] == "REFUNDED" and resolved["status"] == "CANCELLED" and admin_products()[product["id"]]["stock"] == refund_stock + 1, "wrong-amount primary receipts cannot be marked paid or cancelled by customers; staff refund cancels and releases stock once")
        late = alice.order(expiring["id"])
        admin.mutate("payment-resolve", expected=422, id=late["id"], revision=late["revision"], resolution="PAID_RECORDED", reference="SYNTHETIC-INVALID-LATE", note="Synthetic late override")
        check(True, "late primary transfers cannot revive cancelled orders through manual paid reconciliation")

        racing = products[-1]
        save_product(racing, stock=1)
        race_clients = [Client(context), Client(context)]
        race_clients[0].login("system-alice@example.invalid")
        race_clients[1].login("system-bob@example.invalid")
        for client in race_clients:
            summary = client.request("cart/summary")
            client.mutate("cart-clear", cartToken=summary["cartToken"])
            client.add(racing["id"])

        def buy_last(client):
            summary = client.request("cart/summary")
            try:
                return client.mutate("checkout", cartToken=summary["cartToken"], shippingRevision=summary["shipping"]["revision"],
                                     recipient="Synthetic", phone="0900000000", address="Synthetic", paymentMethod="COD")
            except AssertionError as error:
                if "got 422" not in str(error):
                    raise
                return None
        with concurrent.futures.ThreadPoolExecutor() as pool:
            race_results = list(pool.map(buy_last, race_clients))
        check(sum(result is not None for result in race_results) == 1 and admin_products()[racing["id"]]["stock"] == 0, "concurrent checkout of the last unit permits one buyer and preserves nonnegative inventory")

        catalog_image = admin.mutate("catalog-image-intent", name="synthetic.png")
        image_id = catalog_image["id"]
        admin.request("catalog/images/" + image_id + "/content", "PUT", png(), headers={"Content-Type": "application/octet-stream"})
        save_product(product, imageId=image_id)
        image, headers = guest.request("catalog/images/" + image_id, raw=True)
        check(image.startswith(b"\x89PNG") and headers.get_content_type() == "image/png", "catalog image upload/re-encoding survives public retrieval through the proxy")
        evidence = alice.request("evidence/intents", "POST", {"name": "synthetic-evidence.png"})
        alice.request("evidence/" + evidence["id"] + "/content", "PUT", png(), headers={"Content-Type": "application/octet-stream"})
        bob.request("evidence/" + evidence["id"] + "/content", expected=404)
        guest.request("evidence/" + evidence["id"] + "/content", expected=401)
        check(alice.request("evidence/" + evidence["id"] + "/content", raw=True)[0].startswith(b"\x89PNG"), "private evidence images are accessible only to the owner and staff")
        delivered = alice.checkout(product["id"])
        for status in ("CONFIRMED", "PACKED", "SHIPPED"):
            delivered = admin.mutate("order-status", id=delivered["id"], revision=delivered["revision"], status=status, reference="SYNTHETIC-TRACKING", note="Synthetic delivery progression")
        admin.mutate("order-status", expected=422, id=delivered["id"], revision=delivered["revision"], status="DELIVERED", reference="SYNTHETIC-WRONG-COD", collectedAmount=delivered["total"] - 1, note="Synthetic mismatched collection")
        check(alice.order(delivered["id"])["status"] == "SHIPPED" and alice.order(delivered["id"])["paymentStatus"] == "UNPAID", "invalid COD amounts roll back both delivery and collection")
        delivered = admin.mutate("order-status", id=delivered["id"], revision=delivered["revision"], status="DELIVERED", reference="SYNTHETIC-COD", collectedAmount=delivered["total"], note="Synthetic delivery with collection")
        check(delivered["paymentStatus"] == "PAID" and delivered["codCollectedAmount"] == delivered["total"] and delivered["deliveredAt"] == delivered["paidAt"], "COD delivery records exact collection and delivery atomically with a receipt")
        admin.mutate("order-paid", expected=422, id=delivered["id"], revision=delivered["revision"], reference="SYNTHETIC-DUPLICATE-COD", collectedAmount=delivered["total"], note="Synthetic repeated collection")
        legacy_cod = alice.checkout(product["id"])
        sql("UPDATE records SET data=jsonb_set(data,'{status}','\"DELIVERED\"'::jsonb) WHERE id='" + legacy_cod["id"] + "';")
        legacy_cod = admin.mutate("order-paid", id=legacy_cod["id"], revision=legacy_cod["revision"], reference="SYNTHETIC-LEGACY-COD", collectedAmount=legacy_cod["total"], note="Synthetic legacy COD receipt")
        check(legacy_cod["paymentStatus"] == "PAID" and legacy_cod["codCollectedAmount"] == legacy_cod["total"], "legacy delivered COD orders can supplement a missing exact collection receipt")
        returned = alice.mutate("return-create", "command", orderId=delivered["id"], lineId=product["id"], quantity=1, reason="DAMAGED", resolution="REFUND", description="Synthetic damage", evidenceIds=[evidence["id"]])
        returned = admin.mutate("return-update", "command", id=returned["id"], revision=returned["revision"], status="REVIEWING", note="Synthetic review")
        returned = admin.mutate("return-update", "command", id=returned["id"], revision=returned["revision"], status="APPROVED", approvedQuantity=1, resolution="REFUND", returnRequired=False, note="Synthetic approval")
        returned = admin.mutate("return-update", "command", id=returned["id"], revision=returned["revision"], status="PROCESSING", note="Synthetic processing")
        returned = admin.mutate("return-update", "command", id=returned["id"], revision=returned["revision"], status="RESOLVED", reference="SYNTHETIC-REFUND", note="Synthetic recorded refund")
        check(returned["status"] == "RESOLVED" and returned["amount"] == delivered["items"][0]["price"], "delivered COD order supports a paid, evidence-backed return through staff resolution")

        consent = alice.request("agent/consent")
        alice.request("agent/consent", "PUT", {"historyUse": True, "memoryUse": True, "revision": consent["revision"]}, str(uuid.uuid4()))
        conversation = str(uuid.uuid4())
        chat, chat_headers = alice.request("agent/chat", "POST", {"message": "Quà cho mẹ dưới 200k và phí ship", "conversationId": conversation}, str(uuid.uuid4()), raw=True)
        check(b"event:tool_call" in chat and b"event:product_cards" in chat and b"event:done" in chat and chat_headers.get_content_type() == "text/event-stream", "SSE tool status, product cards and completion traverse HTTPS as an event stream")
        check(alice.request("agent/history")["memory"]["budget"] == 200000, "consented AI memory and history work with Secure cookies behind HTTPS")
        recommendation = alice.request("recommendations/consent")
        alice.request("recommendations/consent", "PUT", {"granted": True, "revision": recommendation["revision"]}, str(uuid.uuid4()))
        check(alice.request("products/recommended")["strategy"] == "PERSONALIZED", "personalized recommendations work through the deployed browser origin")

        another = Client(context)
        another.login("system-alice@example.invalid")
        revoked = WebSocketProbe(another)
        probes.append(revoked)
        alice.request("password", "POST", {"currentPassword": PASSWORD, "newPassword": PASSWORD + "-new"})
        another.request("state", expected=401)
        closed = False
        for _ in range(5):
            try:
                opcode, _ = revoked.next_frame()
                if opcode == 8:
                    closed = True
                    break
            except EOFError:
                closed = True
                break
        check(closed and alice.state()["user"]["id"] == alice_actor["id"], "password changes preserve the current session and close revoked WSS sessions")
        alice.request("auth/logout", "POST", {})
        alice.request("state", expected=401)
        check(True, "logout removes the HTTPS session and subsequent authenticated access fails")
        succeeded = True
        print(f"ALL {len(RESULTS)} SYSTEM CHECKS PASSED", flush=True)
        if args.keep:
            print(f"Isolated HTTPS fixture at {ORIGIN}; trust {root / 'tls.crt'} for browser review.", flush=True)
            print(f"Synthetic login system-alice@example.invalid / {PASSWORD}-new", flush=True)
            print(f"Cleanup: docker compose -p {project} -f {compose_path} down --volumes", flush=True)
            temporary._finalizer.detach()
    finally:
        for probe in probes:
            probe.close()
        if not (args.keep and succeeded):
            if not succeeded:
                compose("logs", "--tail", "35", "api", "web", "proxy")
            compose("down", "--volumes", "--timeout", "3")
            temporary.cleanup()


if __name__ == "__main__":
    main()
