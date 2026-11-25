"""Read-only checks for an existing deployment; Python 3.11+, no credentials needed.

Example: python scripts/check-deployment.py --base-url https://goihue.io.vn
This never signs in, creates a cart/order, calls the model or sends a payment.
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser


class CheckFailed(Exception):
    pass


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        value = attrs.get("src" if tag == "script" else "href", "")
        if tag in {"script", "link"} and value.startswith("/_next/static/"):
            self.assets.append(value)


def base_url(value):
    url = urllib.parse.urlsplit(value)
    if (url.scheme not in {"http", "https"} or not url.hostname
            or url.username is not None or url.password is not None
            or url.query or url.fragment or url.path not in {"", "/"}):
        raise argparse.ArgumentTypeError("Use an origin without credentials or a path.")
    if url.scheme != "https" and url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise argparse.ArgumentTypeError("Public deployments must use HTTPS.")
    try:
        url.port
    except ValueError as error:
        raise argparse.ArgumentTypeError("Invalid port.") from error
    return value.rstrip("/")


class Deployment:
    def __init__(self, origin, timeout):
        self.origin = origin
        self.timeout = timeout
        self.checks = 0
        self.warnings = []

    def get(self, path, json_body=True):
        request = urllib.request.Request(self.origin + path, headers={
            "Accept": "application/json" if json_body else "text/html,*/*",
            "Cache-Control": "no-cache",
            "User-Agent": "GoiHue-Deployment-Check/1.0",
        }, method="GET")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                final = urllib.parse.urlsplit(response.url)
                if self.origin.startswith("https://") and final.scheme != "https":
                    raise CheckFailed(f"{path}: HTTPS redirected to HTTP")
                if response.status != 200:
                    raise CheckFailed(f"{path}: HTTP {response.status}")
                raw = response.read(4 * 1024 * 1024 + 1)
                if len(raw) > 4 * 1024 * 1024:
                    raise CheckFailed(f"{path}: response exceeds 4 MiB")
                if json_body:
                    if "application/json" not in response.headers.get("Content-Type", ""):
                        raise CheckFailed(f"{path}: expected JSON, received another content type")
                    return json.loads(raw)
                if not raw:
                    raise CheckFailed(f"{path}: empty response")
                return raw.decode("utf-8")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            # Do not print server bodies, credentials or response payloads.
            status = f"HTTP {error.code}" if isinstance(error, urllib.error.HTTPError) else type(error).__name__
            if isinstance(error, urllib.error.HTTPError):
                error.close()
            raise CheckFailed(f"{path}: {status}") from error

    def require(self, condition, name):
        if not condition:
            raise CheckFailed(name)
        self.checks += 1
        print("PASS " + name, flush=True)

    def run(self):
        products = self.get("/api/store/products")
        self.require(isinstance(products, list) and all(isinstance(p, dict) and
                     {"id", "name", "slug", "price", "stock"} <= p.keys() for p in products), "public catalog schema")
        if not products:
            self.warnings.append("Catalog is empty; prepare visible products and stock before the demo.")
        categories = self.get("/api/store/categories")
        self.require(isinstance(categories, list), "public categories schema")
        shipping = self.get("/api/store/shipping")
        self.require(isinstance(shipping, dict) and isinstance(shipping.get("enabled"), bool)
                     and {"baseFee", "freeShippingThreshold", "revision"} <= shipping.keys(), "API-backed shipping readiness")
        if not shipping["enabled"]:
            self.warnings.append("Checkout is paused by the current shipping configuration.")
        recs = self.get("/api/store/products/recommended?surface=home&limit=4")
        self.require(isinstance(recs, dict) and isinstance(recs.get("items"), list)
                     and recs.get("strategy") in {"POPULAR", "PERSONALIZED", "BOUGHT_TOGETHER"}, "recommendation endpoint")
        ids = {p["id"] for p in products}
        self.require(all(isinstance(p, dict) and p.get("id") in ids for p in recs["items"]), "recommendations belong to the current catalog")
        for topic in ("privacy", "shipping", "returns"):
            policy = self.get("/api/store/policy/" + topic)
            self.require(isinstance(policy, dict) and policy.get("topic") == topic
                         and policy.get("status") == "PUBLISHED", "published policy: " + topic)
        parser = AssetParser()
        for path in ("/", "/cart", "/recommendations", "/privacy-policy",
                     "/shipping-payment-policy", "/return-policy"):
            html = self.get(path, json_body=False)
            self.require("<html" in html.lower(), "page available: " + path)
            parser.feed(html)
        self.require(bool(parser.assets), "Next production assets referenced")
        # Validate one JS and one CSS chunk to catch incomplete/cached deployments.
        for extension in (".js", ".css"):
            asset = next((a for a in parser.assets if urllib.parse.urlsplit(a).path.endswith(extension)), None)
            self.require(asset is not None, "production " + extension + " chunk referenced")
            self.get(asset, json_body=False)
            self.require(True, "production " + extension + " chunk available")
        for warning in self.warnings:
            print("WARN " + warning)
        print(f"ALL {self.checks} READ-ONLY DEPLOYMENT CHECKS PASSED")
        print("Manual checks remain: signed-in WSS, Bedrock conversation, consent and SePay Test-mode delivery.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, type=base_url)
    parser.add_argument("--timeout", type=float, default=15)
    args = parser.parse_args()
    if not 0 < args.timeout <= 60:
        parser.error("--timeout must be between 0 and 60 seconds")
    try:
        Deployment(args.base_url, args.timeout).run()
    except CheckFailed as error:
        print("FAIL " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
