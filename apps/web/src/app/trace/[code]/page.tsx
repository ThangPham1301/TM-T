import Link from "next/link";

export default async function TracePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code);

  return (
    <main className="gh-home" style={{ padding: "clamp(32px, 6vw, 64px) 16px", minHeight: "80vh" }}>
      <div className="gh-wrap" style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div className="gh-frame-functional gh-frame-functional--fold" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
          <span className="gh-kicker">Hệ thống truy xuất nguồn gốc OCOP</span>
          <h1 style={{ color: "var(--nau-dam)", font: "600 clamp(1.8rem, 3vw, 2.4rem) var(--chu-de)", margin: "8px 0 16px" }}>
            Thông Tin Lô Sản Phẩm
          </h1>

          <div style={{ display: "inline-block", background: "var(--kem-am)", padding: "8px 16px", borderRadius: "4px", border: "1px solid var(--vien)", margin: "0 0 24px", fontFamily: "monospace", fontSize: "1.1rem", color: "var(--nau-dam)", fontWeight: "bold" }}>
            {decodedCode}
          </div>

          <div style={{ display: "grid", gap: "16px", margin: "20px 0 32px", textAlign: "left" }}>
            <div style={{ padding: "12px 16px", background: "var(--kem)", borderLeft: "4px solid var(--mat)", borderRadius: "2px" }}>
              <strong>Sản phẩm:</strong> Mè xửng Cung Đình &amp; Trà Sen Tịnh Tâm
            </div>
            <div style={{ padding: "12px 16px", background: "var(--kem)", borderLeft: "4px solid var(--mat)", borderRadius: "2px" }}>
              <strong>Chứng nhận:</strong> Chuẩn OCOP 4 sao Thừa Thiên Huế — Chỉ dẫn địa lý bảo hộ
            </div>
            <div style={{ padding: "12px 16px", background: "var(--kem)", borderLeft: "4px solid var(--mat)", borderRadius: "2px" }}>
              <strong>Vùng nguyên liệu:</strong> Hạt sen hồ Tịnh Tâm, Mè vàng đất bãi sông Hương, Mạch nha nếp làng Kim Long
            </div>
            <div style={{ padding: "12px 16px", background: "var(--kem)", borderLeft: "4px solid var(--mat)", borderRadius: "2px" }}>
              <strong>Ngày đóng gói:</strong> Lô tháng 10/2026 · Hạn dùng 06 tháng kể từ ngày sản xuất
            </div>
            <div style={{ padding: "12px 16px", background: "var(--kem)", borderLeft: "4px solid var(--mat)", borderRadius: "2px" }}>
              <strong>Cơ sở sản xuất:</strong> Xưởng bánh thủ công Gói Huế, 128 Lê Lợi, Phường Phú Nhuận, TP. Huế
            </div>
          </div>

          <Link className="gh-btn gh-btn--brown gh-btn--fold" href="/" style={{ display: "inline-flex" }}>
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
