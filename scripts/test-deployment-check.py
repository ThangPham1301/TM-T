"""Exercise deployment checks against an isolated, read-only HTTP fixture."""

import argparse
import contextlib
import http.server
import importlib.util
import io
import json
import pathlib
import threading
import unittest


spec = importlib.util.spec_from_file_location("deployment_check", pathlib.Path(__file__).with_name("check-deployment.py"))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class DeploymentCheckTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        product = {"id": "fixture", "name": "Fixture", "slug": "fixture", "price": 50000, "stock": 2}
        self.responses = {
            "/api/store/products": [product],
            "/api/store/categories": [],
            "/api/store/shipping": {"enabled": True, "baseFee": 30000, "freeShippingThreshold": 500000, "revision": 1},
            "/api/store/products/recommended?surface=home&limit=4": {"items": [product], "strategy": "POPULAR"},
            **{"/api/store/policy/" + topic: {"topic": topic, "status": "PUBLISHED"}
               for topic in ("privacy", "shipping", "returns")},
        }
        self.failure = None
        self.bad_json = False
        fixture = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                fixture.requests.append((self.command, self.path))
                self.send_response(503 if self.path == fixture.failure else 200)
                is_json = self.path.startswith("/api/") and not fixture.bad_json
                self.send_header("Content-Type", "application/json" if is_json else "text/html")
                self.end_headers()
                if is_json:
                    raw = json.dumps(fixture.responses[self.path])
                else:
                    raw = '<html><script src="/_next/static/fixture.js"></script><link href="/_next/static/fixture.css" rel="stylesheet"></html>'
                self.wfile.write(raw.encode())

            def log_message(self, *_):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def run_check(self):
        deployment = checker.Deployment(self.origin, 2)
        with contextlib.redirect_stdout(io.StringIO()):
            deployment.run()
        return deployment

    def test_success_uses_only_public_gets(self):
        self.run_check()
        self.assertTrue(self.requests)
        self.assertTrue(all(method == "GET" for method, _ in self.requests))
        self.assertFalse(any(any(s in path for s in ("/commerce", "/auth/", "/agent/", "/payments/", "/guest/cart"))
                             for _, path in self.requests))

    def test_api_unavailable_cannot_report_success(self):
        self.failure = "/api/store/shipping"
        with self.assertRaises(checker.CheckFailed):
            self.run_check()

    def test_html_login_or_proxy_page_is_not_api_readiness(self):
        self.bad_json = True
        with self.assertRaises(checker.CheckFailed):
            self.run_check()

    def test_unknown_recommendation_is_rejected(self):
        self.responses["/api/store/products/recommended?surface=home&limit=4"]["items"] = [{"id": "not-in-catalog"}]
        with self.assertRaises(checker.CheckFailed):
            self.run_check()

    def test_missing_build_chunk_is_rejected(self):
        self.failure = "/_next/static/fixture.js"
        with self.assertRaises(checker.CheckFailed):
            self.run_check()

    def test_unpublished_policy_is_rejected(self):
        self.responses["/api/store/policy/privacy"]["status"] = "DRAFT"
        with self.assertRaises(checker.CheckFailed):
            self.run_check()

    def test_empty_catalog_and_paused_checkout_are_explicit_warnings(self):
        self.responses["/api/store/products"] = []
        self.responses["/api/store/products/recommended?surface=home&limit=4"]["items"] = []
        self.responses["/api/store/shipping"]["enabled"] = False
        self.assertEqual(len(self.run_check().warnings), 2)

    def test_credentials_and_plaintext_public_origins_are_rejected(self):
        for value in ("http://example.com", "https://user:secret@example.com", "https://example.com/path", "https://example.com?key=secret"):
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                checker.base_url(value)
        self.assertEqual(checker.base_url("https://example.com/"), "https://example.com")


if __name__ == "__main__":
    unittest.main()
