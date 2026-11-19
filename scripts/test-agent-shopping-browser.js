// Run with Playwright CLI against test-agent-demo.py --keep, never a real deployment.
async (page) => {
  const origin = "http://127.0.0.1:13097";
  if (!page.url().startsWith(origin + "/")) throw new Error("Open the isolated agent fixture first");
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().clearCookies();
  await page.goto(origin + "/");
  const assistant = page.getByRole("region", { name: "Trợ lý Gói Huế", exact: true });
  async function open() {
    await page.getByRole("button", { name: "Mở trợ lý Gói Huế", exact: true }).click();
    await assistant.getByRole("textbox", { name: "Nhắn cho trợ lý", exact: true }).waitFor();
  }
  async function send(text) {
    await assistant.getByRole("textbox", { name: "Nhắn cho trợ lý", exact: true }).fill(text);
    const response = page.waitForResponse(response => response.url().endsWith("/api/store/agent/chat"));
    await assistant.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    if (!(await response).ok()) throw new Error("Chat failed");
    await page.waitForFunction(() => !document.querySelector('[aria-label="Nhắn cho trợ lý"]').disabled);
  }
  async function reset() { await assistant.getByRole("button", { name: "Cuộc trò chuyện mới", exact: true }).click(); }
  async function cart() { return await (await page.request.get(origin + "/api/store/cart/summary")).json(); }
  await open();
  await send("tôi muốn chọn một loại trà");
  if (!(await assistant.textContent()).includes("Tìm theo tên và loại sản phẩm")) throw new Error("Search tool label missing");
  if (!(await assistant.textContent()).includes("Trà Gừng Túi Lọc")) throw new Error("Tea search failed");
  await reset();
  await send("me xung");
  if (!(await assistant.textContent()).includes("Mè Xửng")) throw new Error("Unaccented search failed");
  await reset();
  await send("Thêm 2 hộp Trà Gừng Túi Lọc vào giỏ");
  const dialog = page.getByRole("dialog", { name: "Xác nhận thêm vào giỏ hàng", exact: true });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.goto(origin + "/register");
  await page.getByRole("textbox", { name: "Họ và tên", exact: true }).fill("Synthetic Shopping QA");
  await page.getByRole("textbox", { name: "Địa chỉ email", exact: true }).fill(`shopping-${Date.now()}@example.invalid`);
  await page.getByRole("textbox", { name: "Mật khẩu", exact: true }).fill("synthetic-shopping-password");
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await page.waitForURL(origin + "/account");
  await page.goto(origin + "/");
  await open();
  await send("Thêm 2 hộp Trà Gừng Túi Lọc vào giỏ");
  await dialog.waitFor({ state: "visible" });
  if ((await cart()).items.length) throw new Error("Proposal wrote the cart before confirmation");
  const confirmed = page.waitForResponse(response => response.url().endsWith("/api/store/commerce") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  if (!(await confirmed).ok()) throw new Error("Cart confirmation failed");
  await dialog.waitFor({ state: "hidden" });
  let summary = await cart();
  if (summary.items.length !== 1 || summary.items[0].quantity !== 2 || summary.items[0].name !== "Trà Gừng Túi Lọc") throw new Error("Wrong product or cart quantity");
  await send("Thêm 1 hộp Trà Gừng Túi Lọc vào giỏ");
  await dialog.waitFor({ state: "visible" });
  const incremented = page.waitForResponse(response => response.url().endsWith("/api/store/commerce") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Thêm vào giỏ", exact: true }).click();
  if (!(await incremented).ok()) throw new Error("Cart increment failed");
  await dialog.waitFor({ state: "hidden" });
  summary = await cart();
  if (summary.items.length !== 1 || summary.items[0].quantity !== 3) throw new Error("Existing cart quantity was overwritten");
  await reset();
  await send("Thêm trà vào giỏ");
  if (await dialog.isVisible()) throw new Error("Ambiguous request opened a cart proposal");
  if ((await cart()).items[0].quantity !== 3) throw new Error("Ambiguous request changed cart");
  await reset();
  await send("So sánh Trà Gừng Túi Lọc với Trà Sen Tịnh Tâm");
  if (await assistant.getByRole("link", { name: "Xem sản phẩm", exact: true }).count() !== 2) throw new Error("Structured comparison missing");
  await page.setViewportSize({ width: 390, height: 844 });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error("Mobile viewport overflows");
  await page.screenshot({ path: "output/playwright/agent-shopping-tools-mobile.png" });
  await reset();
  await send("Tìm trà nhài");
  if (!(await assistant.textContent()).includes("hết hàng")) throw new Error("Out-of-stock status missing");
  if (errors.length) throw new Error(errors.join("\n"));
  return { passed: true, checks: ["tea discovery", "search tool trace", "unaccented sesame search", "guest proposal cancellation", "proposal does not mutate cart", "customer confirmation adds exact product/quantity", "repeated confirmation increments cart", "ambiguous tea does not open a proposal or mutate cart", "structured comparison", "mobile layout", "out-of-stock message", "no browser runtime errors"] };
}
