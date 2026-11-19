import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path.join("/");
  const webhook = path === "payments/sepay/webhook" && req.method === "POST";
  if (
    !/^(policy|state|password|command|commerce|agent\/(chat|consent|history)|recommendations\/consent|payments\/sepay\/webhook|cart(?:\/summary)?|shipping|categories|products(?:\/[a-z0-9-]+)?|admin\/(products|categories)|catalog\/images\/[a-f0-9-]{36}(?:\/content)?|auth\/(login|register|logout)|evidence\/intents|evidence\/[a-f0-9-]{36}\/content|privacy\/[a-f0-9-]{36}\/export)$/u.test(
      path,
    )
  )
    return Response.json({ message: "Không tìm thấy API." }, { status: 404 });
  if (path === "payments/sepay/webhook" && !webhook)
    return Response.json({ message: "Phương thức không được hỗ trợ." }, { status: 405 });
  const write = !["GET", "HEAD"].includes(req.method),
    origin = req.headers.get("origin");
  const publicOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.APP_PUBLIC_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ]);
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const sameHost = origin === `${proto}://${req.headers.get("host") ?? ""}`;
  // Compare the browser-facing Host, not Docker's internal server hostname.
  if (write && !webhook && (!origin || !publicOrigins.has(origin) || !sameHost))
    return Response.json(
      { message: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const headers = new Headers();
  const forwardedHeaders = webhook
    ? ["content-type", "x-sepay-signature", "x-sepay-timestamp"]
    : ["cookie", "content-type", "idempotency-key"];
  for (const name of forwardedHeaders) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set("Origin", origin);
  try {
    const body = write ? await req.arrayBuffer() : undefined;
    if (webhook && body && body.byteLength > 65536)
      return Response.json({ message: "Nội dung webhook quá lớn." }, { status: 413 });
    if (body && body.byteLength > 5 * 1024 * 1024 + 32768)
      return Response.json({ message: "Nội dung quá lớn." }, { status: 413 });
    const upstream = await fetch(
      `${process.env.API_UPSTREAM_URL ?? "http://127.0.0.1:8088/api/v1"}/${path}${req.nextUrl.search}`,
      {
        method: req.method,
        body,
        headers,
        cache: "no-store",
        redirect: "manual",
        // The AI chat streams over SSE and may run longer than a normal call.
        signal: AbortSignal.timeout(path === "agent/chat" ? 180000 : 20000),
      },
    );
    const out = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (path === "agent/chat") out.set("X-Accel-Buffering", "no");
    for (const name of ["content-type", "content-disposition", "set-cookie"]) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch {
    return Response.json(
      { message: "Không kết nối được máy chủ Gói Huế. Vui lòng thử lại sau." },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
