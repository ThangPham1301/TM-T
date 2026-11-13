import { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const path = (await ctx.params).path.join("/");
  if (
    !/^(policy|state|command|commerce|cart(?:\/summary)?|shipping|categories|products(?:\/[a-z0-9-]+)?|admin\/(products|categories)|catalog\/images\/[a-f0-9-]{36}(?:\/content)?|auth\/(login|register|logout)|evidence\/intents|evidence\/[a-f0-9-]{36}\/content|privacy\/[a-f0-9-]{36}\/export)$/u.test(
      path,
    )
  )
    return Response.json({ message: "Không tìm thấy API." }, { status: 404 });
  const write = !["GET", "HEAD"].includes(req.method),
    origin = req.headers.get("origin");
  const publicOrigins = new Set([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const sameHost = origin === `http://${req.headers.get("host") ?? ""}`;
  // Compare the browser-facing Host, not Docker's internal server hostname.
  if (write && (!origin || !publicOrigins.has(origin) || !sameHost))
    return Response.json(
      { message: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const headers = new Headers();
  for (const name of ["cookie", "content-type", "idempotency-key"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (origin) headers.set("Origin", origin);
  try {
    const body = write ? await req.arrayBuffer() : undefined;
    if (body && body.byteLength > 5 * 1024 * 1024 + 32768)
      return Response.json({ message: "Nội dung quá lớn." }, { status: 413 });
    const upstream = await fetch(
      `${process.env.API_UPSTREAM_URL ?? "http://127.0.0.1:8088/api/v1"}/${path}`,
      {
        method: req.method,
        body,
        headers,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      },
    );
    const out = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
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
export { proxy as GET, proxy as POST, proxy as PUT };
