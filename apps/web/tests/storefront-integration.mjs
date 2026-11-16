// Run against a disposable local database. The test creates a customer, catalog and order.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
assert(adminEmail && adminPassword, "Set ADMIN_EMAIL and ADMIN_PASSWORD for the local QA instance.");

(async () => {
  const base = "http://127.0.0.1:3000";
  const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || "msedge",headless:true});
  try {
    const admin = await browser.newContext({viewport:{width:1440,height:900}});
    const shopper = await browser.newContext({viewport:{width:390,height:844}});
    const request = async (context, path, body) => {
      const response = body ? await context.request.post(base+"/api/store/"+path,{
        headers:{Origin:base,"Idempotency-Key": randomUUID()},data:body
      }) : await context.request.get(base+"/api/store/"+path);
      assert(response.ok(), path + " " + response.status() + " " + await response.text());
      return response.json();
    };
    await request(admin,"auth/login",{email:adminEmail,password:adminPassword});
    const suffix = randomUUID().slice(0,8);
    await request(shopper,"auth/register",{email:`storefront-${suffix}@example.invalid`,name:"QA storefront",password:"qa-browser-local-only"});
    const code = "qa-lan-"+suffix;
    const title = "Sản phẩm QA "+suffix;
    const category = await request(admin,"commerce",{action:"category-save",code,name:"Danh mục QA "+suffix,
      description:"Danh mục kiểm thử",sortOrder:0,active:true});
    const product = await request(admin,"commerce",{action:"product-save",slug:code,name:title,category:code,
      description:"Sản phẩm kiểm thử tích hợp",price:55000,stock:7,active:true});
    const customerPage = await shopper.newPage();
    const adminPage = await admin.newPage();
    await customerPage.goto(base+"/");
    await customerPage.locator(".lan-hero").waitFor();
    assert(await customerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await customerPage.goto(base+"/products?category="+code);
    await customerPage.getByRole("link",{name:title,exact:true}).first().waitFor();
    await customerPage.goto(base+"/products/"+code);
    await customerPage.getByRole("heading",{name:title}).waitFor();
    await customerPage.getByRole("button",{name:"Tăng số lượng",exact:true}).click();
    await customerPage.getByRole("button",{name:"Thêm vào giỏ hàng",exact:true}).click();
    await customerPage.getByText("Đã lưu thông tin.",{exact:true}).waitFor();
    const cart = await request(shopper,"cart/summary");
    assert.equal(cart.items.find(row=>row.productId===product.id).quantity,2);
    await customerPage.goto(base+"/admin/products");
    await customerPage.getByRole("heading",{name:"Không có quyền truy cập",exact:true}).waitFor();

    await adminPage.goto(base+"/admin/products");
    await adminPage.getByRole("link",{name:"Kho theo lô",exact:true}).waitFor();
    const findProduct = adminPage.getByRole("button",{name:"Sửa "+title,exact:true});
    if (!await findProduct.isVisible()) {
      const search = adminPage.getByPlaceholder("Nhập từ khóa…");
      await search.fill(suffix);
    }
    await findProduct.click();
    await adminPage.getByLabel("Giá niêm yết (VND) *",{exact:true}).fill("64000");
    await adminPage.getByRole("button",{name:"Lưu sản phẩm",exact:true}).click();
    await adminPage.getByText("Đã lưu thông tin.",{exact:true}).waitFor();
    assert.equal((await request(shopper,"products/"+code)).price,64000);

    await adminPage.goto(base+"/admin/categories");
    await adminPage.getByRole("button",{name:"Sửa "+category.name,exact:true}).click();
    await adminPage.getByLabel("Thứ tự hiển thị",{exact:true}).fill("3");
    await adminPage.getByRole("button",{name:"Lưu danh mục",exact:true}).click();
    await adminPage.getByRole("dialog").waitFor({state:"detached"});
    const stored = (await request(admin,"admin/categories")).find(row=>row.id===category.id);
    assert.equal(stored.sortOrder,3);
    await adminPage.goto(base+"/admin/inventory");
    await adminPage.getByRole("heading",{name:"Kho theo lô",exact:true}).waitFor();
    await customerPage.goto(base+"/account/orders");
    await customerPage.getByText("Đơn hàng của tôi",{exact:false}).first().waitFor();

    const freshCart = await request(shopper,"cart/summary");
    await request(shopper,"commerce",{action:"cart-refresh",cartToken:freshCart.cartToken});
    const quote = await request(shopper,"cart/summary");
    const order = await request(shopper,"commerce",{action:"checkout",paymentMethod:"VIETQR",cartToken:quote.cartToken,
      shippingRevision:quote.shipping.revision,recipient:"QA storefront",phone:"0901234567",address:"QA delivery"});
    await customerPage.goto(base+"/account/orders?order="+order.id);
    const qr = customerPage.getByRole("img",{name:"Mã VietQR của đơn hàng",exact:true});
    await qr.waitFor();
    assert.match(await qr.getAttribute("src"),/^data:image\/png;base64,/);
    console.log("LIVE VIETQR QR DEEP-LINK PASS");
    console.log("LIVE BROWSER PASS: home, collection, product and persisted cart, product edit, category edit, authorization and inventory navigation");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
