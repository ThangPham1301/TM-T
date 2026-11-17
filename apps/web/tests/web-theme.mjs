// Synthetic browser QA only. No live accounts, backend writes or provider calls.
// NODE_PATH must supply Playwright. BASE_URL defaults to the isolated dev server.
// Run once with --baseline before importing web-theme.css, then without it.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = path.join(root, "output/playwright/web-theme");
const inventory = JSON.parse(
  fs.readFileSync(
    path.join(root, "docs/ui_web/design/stitch-screen-inventory.json"),
    "utf8",
  ),
);
const base = process.env.BASE_URL || "http://127.0.0.1:3001";
const baseline = process.argv.includes("--baseline");
const routes = inventory.map((s) => s.route.replace("[slug]", "me-xung-gion"));
assert.equal(new Set(routes).size, 23);
const photo = "/goi-hue/assets/photo-sp-me-xung-dia.jpg";
const categories = [
  {
    id: "c1",
    code: "me-xung",
    name: "Mè xửng Cố Đô",
    description: "Thức quà truyền thống",
    active: true,
    sortOrder: 1,
    image: photo,
    revision: 1,
  },
  {
    id: "c2",
    code: "qua-bieu",
    name: "Hộp quà Gói Huế",
    description: "Gửi người thương",
    active: true,
    sortOrder: 2,
    image: "/goi-hue/assets/photo-cat-qua-bieu.jpg",
    revision: 1,
  },
];
const products = [
  {
    id: "p1",
    slug: "me-xung-gion",
    name: "Mè xửng giòn Cố Đô",
    description: "Mạch nha và mè rang, thức quà từ Huế.",
    category: "me-xung",
    price: 45000,
    stock: 20,
    active: true,
    image: photo,
    revision: 1,
  },
  {
    id: "p2",
    slug: "me-xung-deo",
    name: "Mè xửng dẻo",
    description: "Hương vị mè rang và mạch nha.",
    category: "me-xung",
    price: 55000,
    stock: 0,
    active: true,
    image: photo,
    revision: 1,
  },
  {
    id: "p3",
    slug: "hop-qua",
    name: "Hộp quà gửi người thương",
    description: "Một hộp quà nhỏ từ Huế.",
    category: "qua-bieu",
    price: 265000,
    stock: 8,
    active: true,
    image: "/goi-hue/assets/photo-cat-qua-bieu.jpg",
    revision: 1,
  },
];
const address = {
  id: "a1",
  label: "Địa chỉ thử nghiệm",
  recipient: "Người kiểm thử",
  phone: "0980000000",
  address: "Địa chỉ giả lập cho kiểm thử UI",
  revision: 1,
};
const policy = {
  id: "policy",
  version: "1.0-draft",
  content:
    "Chính sách dự thảo dùng trong kiểm thử UI.\n\nNội dung và dữ liệu là giả lập, không phải chính sách đã công bố.",
};
const order = {
  id: "o1",
  number: "GH-2041",
  recipient: address.recipient,
  phone: address.phone,
  address: address.address,
  status: "DELIVERED",
  paymentStatus: "PAID",
  total: 120000,
  subtotal: 90000,
  shippingFee: 30000,
  revision: 1,
  createdAt: "2026-11-16T08:00:00Z",
  deliveredAt: "2026-11-16T12:00:00Z",
  items: [
    {
      id: "i1",
      productId: "p1",
      name: products[0].name,
      price: 45000,
      quantity: 2,
      returnableQuantity: 2,
    },
  ],
  history: [],
};
const returnCase = {
  id: "r1",
  caseId: "case1",
  orderId: "o1",
  orderNumber: order.number,
  productId: "p1",
  product: products[0].name,
  quantity: 1,
  reason: "DAMAGED",
  status: "SUBMITTED",
  resolution: "REFUND",
  revision: 1,
  createdAt: order.createdAt,
  description: "Bao bì hư hỏng trong dữ liệu giả lập.",
  history: [],
};
const privacy = {
  id: "pr1",
  type: "ACCESS",
  status: "REQUESTED",
  description: "Yêu cầu giả lập",
  revision: 1,
  createdAt: order.createdAt,
  history: [],
};
let role = "CUSTOMER",
  empty = false,
  fail = false,
  conflict = false;
const writes = [];
async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: true,
  });
  try {
    const context = await browser.newContext();
    await context.routeWebSocket(/:8088\/api\/store\/live/, () => {});
    await context.route("**/api/store/**", async (route) => {
      const req = route.request(),
        key = new URL(req.url()).pathname.replace("/api/store/", "");
      let body = {},
        status = 200;
      if (req.method() !== "GET") {
        const payload = JSON.parse(req.postData() || "{}");
        writes.push({
          key,
          body: payload,
          idempotency: req.headers()["idempotency-key"],
        });
        if (conflict) {
          status = 409;
          body = { message: "Dữ liệu đã thay đổi. Vui lòng kiểm tra lại." };
        } else
          body = key.startsWith("auth/")
            ? { role: "CUSTOMER" }
            : { id: "saved" };
      } else if (key === "state") {
        if (role === "GUEST") {
          status = 401;
          body = { message: "Đăng nhập để tiếp tục" };
        } else
          body = {
            user: {
              id: "u1",
              name: "Người kiểm thử",
              email: "ui-test@example.invalid",
              phone: address.phone,
              address: address.address,
              role,
              marketing: false,
            },
            addresses: empty ? [] : [address],
            orders: empty ? [] : [order],
            returns: empty ? [] : [returnCase],
            privacy: empty ? [] : [privacy],
            consents: [],
            cartCount: empty ? 0 : 2,
            policy,
            policyVersions: [policy],
            audit: empty
              ? []
              : [
                  {
                    id: "log1",
                    action: "PRODUCT_UPDATED",
                    subject: "Dữ liệu giả lập",
                    at: order.createdAt,
                  },
                ],
          };
      } else if (
        fail &&
        ["products", "cart/summary", "admin/products"].includes(key)
      ) {
        status = 503;
        body = { message: "Máy chủ tạm gián đoạn — dữ liệu kiểm thử" };
      } else if (key === "products" || key === "admin/products")
        body = empty ? [] : products;
      else if (key.startsWith("products/"))
        body = products.find((p) => p.slug === key.slice(9)) ?? products[0];
      else if (key === "categories" || key === "admin/categories")
        body = categories;
      else if (key === "policy") body = policy;
      else if (key === "shipping")
        body = {
          revision: 1,
          enabled: true,
          baseFee: 30000,
          freeShippingThreshold: 500000,
        };
      else if (key === "cart/summary")
        body = {
          items: empty
            ? []
            : [
                {
                  id: "l1",
                  productId: "p1",
                  name: products[0].name,
                  image: photo,
                  quantity: 2,
                  price: 45000,
                  lineTotal: 90000,
                  stock: 20,
                  available: true,
                  priceChanged: false,
                },
              ],
          cartToken: "synthetic-cart",
          subtotal: 90000,
          shippingFee: 30000,
          total: 120000,
          shipping: {
            revision: 1,
            enabled: true,
            baseFee: 30000,
            freeShippingThreshold: 500000,
          },
        };
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    // Keep visual QA deterministic and avoid external image requests.
    await context.route("**/lh3.googleusercontent.com/**", (route) =>
      route.fulfill({
        contentType: "image/jpeg",
        body: fs.readFileSync(
          path.join(
            root,
            "apps/web/public/goi-hue/assets/photo-hero-tea-table.jpg",
          ),
        ),
      }),
    );
    await context.route("**/_next/image?**", (route) => {
      const source =
        new URL(route.request().url()).searchParams.get("url") || "";
      const image = source.includes("qua")
        ? "photo-cat-qua-bieu.jpg"
        : source.includes("aida")
          ? "photo-hero-tea-table.jpg"
          : "photo-sp-me-xung-dia.jpg";
      return route.fulfill({
        contentType: "image/jpeg",
        body: fs.readFileSync(
          path.join(root, "apps/web/public/goi-hue/assets", image),
        ),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const snapshots = {};
    const previous = baseline
      ? null
      : JSON.parse(fs.readFileSync(path.join(output, "baseline.json"), "utf8"));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 960 });
      for (const route of routes) {
        role = route.startsWith("/admin")
          ? "ADMIN"
          : route === "/login" || route === "/register"
            ? "GUEST"
            : "CUSTOMER";
        await page.goto(base + route);
        await page.waitForLoadState("networkidle");
        await page
          .locator("main h1")
          .waitFor({ timeout: 20000 })
          .catch(async (e) => {
            throw new Error(
              `${route}: ${e.message}; runtime=${errors.join(";")}; text=${(await page.locator("body").innerText()).slice(0, 1000)}`,
            );
          });
        const key = `${width}:${route}`;
        const snapshot = await page.locator("main").evaluate((main) => {
          const elements = [main, ...main.querySelectorAll("*")];
          const dom = elements.map((el) => [
            el.tagName,
            el.getAttribute("class"),
            el.getAttribute("name"),
            el.getAttribute("type"),
            el.getAttribute("href"),
            el.getAttribute("role"),
            el.matches("h1,h2,h3,label,button,summary")
              ? el.textContent.replace(/\s+/g, " ").trim()
              : null,
          ]);
          const layout = elements
            .filter((el) =>
              el.matches(
                "main,section,article,aside,nav,form,.store-two,.hero-grid,.heritage-products,.heritage-categories,.auth-frame,.store-management-row",
              ),
            )
            .map((el) => {
              const s = getComputedStyle(el);
              return [
                el.tagName,
                el.className,
                s.display,
                s.flexDirection,
                s.order,
                s.gridTemplateColumns === "none"
                  ? 0
                  : s.gridTemplateColumns.split(" ").length,
              ];
            });
          return {
            dom,
            layout,
            headings: [...main.querySelectorAll("h1,h2")].map((el) =>
              el.textContent.trim(),
            ),
          };
        });
        snapshots[key] = snapshot;
        if (previous) {
          assert.deepEqual(
            snapshot.dom,
            previous[key].dom,
            `DOM/order changed ${key}`,
          );
          assert.deepEqual(
            snapshot.layout,
            previous[key].layout,
            `Layout mode changed ${key}`,
          );
        }
        assert.equal(
          await page.locator("main h1").count(),
          1,
          `Missing route heading ${key}`,
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Page overflow ${key}`,
        );
        if (!baseline) {
          assert.match(
            await page
              .locator("body")
              .evaluate((el) => getComputedStyle(el).backgroundImage),
            /08-nen-giay/,
          );
          assert.match(
            await page
              .locator("main h1")
              .evaluate((el) => getComputedStyle(el).fontFamily),
            /Playfair Display/,
          );
        }
        const filename =
          (route === "/" ? "home" : route.slice(1).replaceAll("/", "-")) +
          `-${width}.png`;
        await page.screenshot({
          path: path.join(output, (baseline ? "before-" : "after-") + filename),
          fullPage: true,
        });
      }
    }
    fs.writeFileSync(
      path.join(output, baseline ? "baseline.json" : "after.json"),
      JSON.stringify(snapshots, null, 2),
    );
    assert.deepEqual(errors, [], "Client runtime errors");
    console.log(
      `${baseline ? "BASELINE" : "PASS"}: 23 routes x 2 widths; main DOM/order, layout modes, headings and overflow${baseline ? "" : " + paper/font theme"}`,
    );
    if (!baseline) {
      role = "CUSTOMER";
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(base + "/account/profile");
      await page
        .getByRole("button", { name: "Lưu thông tin", exact: true })
        .waitFor();
      await page
        .getByLabel("Họ tên", { exact: true })
        .fill("Tên kiểm thử đã sửa");
      await page
        .getByRole("button", { name: "Lưu thông tin", exact: true })
        .click();
      await page.getByText("Đã lưu thông tin.", { exact: true }).waitFor();
      assert.equal(writes.at(-1).body.action, "profile");
      assert(writes.at(-1).idempotency);
      await page.goto(base + "/account/addresses");
      await page
        .getByRole("button", { name: "Thêm địa chỉ", exact: true })
        .click();
      await page
        .getByLabel("Tên gợi nhớ", { exact: true })
        .fill("Nhà thử nghiệm");
      await page
        .getByLabel("Người nhận", { exact: true })
        .fill("Người kiểm thử");
      await page
        .getByLabel("Số điện thoại", { exact: true })
        .fill(address.phone);
      await page
        .getByLabel("Địa chỉ giao hàng", { exact: true })
        .fill(address.address);
      await page
        .getByRole("button", { name: "Lưu địa chỉ", exact: true })
        .click();
      await page.getByText("Đã lưu thông tin.", { exact: true }).waitFor();
      assert.equal(writes.at(-1).body.action, "address-save");
      await page.goto(base + "/account/security");
      await page
        .getByLabel("Mật khẩu hiện tại", { exact: true })
        .fill("SyntheticPassword1!");
      await page
        .getByLabel("Mật khẩu mới", { exact: true })
        .fill("SyntheticPassword2!");
      await page
        .getByLabel("Nhập lại mật khẩu mới", { exact: true })
        .fill("SyntheticPassword2!");
      await page
        .getByRole("button", { name: "Cập nhật mật khẩu", exact: true })
        .click();
      await page.getByText("Đã đổi mật khẩu.", { exact: true }).waitFor();
      assert.equal(writes.at(-1).key, "password");
      await page.goto(base + "/account/orders");
      await page.locator("button.store-row").first().click();
      await page.locator(".store-detail").waitFor();
      await page.screenshot({
        path: path.join(output, "order-expanded.png"),
        fullPage: true,
      });
      role = "ADMIN";
      await page.goto(base + "/admin/products");
      await page
        .locator(".store-management-row")
        .first()
        .getByRole("button", { name: "Sửa", exact: true })
        .click();
      await page.getByLabel("Tên", { exact: true }).fill("Mè xửng kiểm thử");
      conflict = true;
      await page
        .getByRole("button", { name: "Lưu sản phẩm", exact: true })
        .click();
      await page.locator('.store-error[role="alert"]').waitFor();
      assert(
        await page
          .getByRole("button", { name: "Lưu sản phẩm", exact: true })
          .isVisible(),
      );
      conflict = false;
      await page
        .getByRole("button", { name: "Lưu sản phẩm", exact: true })
        .click();
      await page.getByText("Đã lưu thông tin.", { exact: true }).waitFor();
      assert.equal(writes.at(-1).body.action, "product-save");
      role = "CUSTOMER";
      await page.goto(base + "/admin/orders");
      await page
        .getByRole("heading", { name: "Không có quyền truy cập", exact: true })
        .waitFor();
      role = "GUEST";
      await page.goto(base + "/cart");
      await page
        .getByRole("link", { name: "Đăng nhập để mua hàng →", exact: true })
        .waitFor();
      role = "CUSTOMER";
      empty = true;
      await page.goto(base + "/cart");
      await page.getByText("Giỏ hàng đang trống.", { exact: true }).waitFor();
      empty = false;
      fail = true;
      await page.goto(base + "/cart");
      await page.locator('.store-error[role="alert"]').waitFor();
      await page.screenshot({
        path: path.join(output, "cart-error.png"),
        fullPage: true,
      });
      fail = false;
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(base + "/products");
      await page.locator(".store-products article").first().waitFor();
      assert.equal(
        await page
          .locator(".store-products article")
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDuration),
        "0s",
      );
      assert.deepEqual(errors, []);
      console.log(
        "PASS: profile/address/password writes, order expansion, admin save error+recovery, authorization, empty/error and reduced motion (synthetic only)",
      );
    }
  } finally {
    await browser.close();
  }
}
await run();
