"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Row } from "@/lib/store";

export function Policies({ returns = false }: { returns?: boolean }) {
  const [policy, setPolicy] = useState<Row | null>(null);
  const [activeArticle, setActiveArticle] = useState<string>("dieu-1");

  useEffect(() => {
    if (!returns) {
      void api("policy")
        .then(setPolicy)
        .catch(() => {});
    }
  }, [returns]);

  if (returns) {
    return (
      <main className="store-page" style={{ maxWidth: "1024px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        <header className="account-hero-banner">
          <span className="account-hero-eyebrow">
            <span className="account-hero-dot" />
            Minh bạch &amp; đồng hành
          </span>
          <h1 className="account-hero-title">Chính sách đổi trả</h1>
          <p className="account-hero-subtitle">
            DỰ THẢO CHỜ PHÊ DUYỆT · Chưa công bố hiệu lực chính thức
          </p>
        </header>

        <article className="heritage-card" style={{ lineHeight: 1.7 }}>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            1. Phạm vi tiếp nhận
          </h2>
          <p>
            Giao sai, giao thiếu, hỏng, bao bì hở hoặc chất lượng bất thường. Yêu cầu từ đơn hàng đã giao trong tài khoản.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            2. Thời điểm và bằng chứng
          </h2>
          <p>
            Đề xuất 7 ngày từ ngày giao được xác nhận cho lỗi nhìn thấy. Lỗi chất lượng hoặc an toàn vẫn được tiếp nhận ngoài
            mốc này để xem xét. Ảnh nhãn hàng, lô và hạn dùng nếu phù hợp; không mặc định bắt buộc video mở hộp.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            3. Phương án xử lý
          </h2>
          <p>
            Đổi hoặc hoàn phần sản phẩm được duyệt. Số lượng không vượt phần còn được yêu cầu. Tiền hoàn theo giá thực trả
            của dòng hàng; không tự hoàn phí giao hàng nếu chưa có quyết định riêng.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            4. Thu hồi và an toàn thực phẩm
          </h2>
          <p>
            Ngừng sử dụng nếu nghi không an toàn. Cửa hàng quyết định có cần thu hồi; hàng trả được kiểm tra, cách ly hoặc
            xử lý, không tự nhập lại tồn bán.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            5. Thực hiện và chi phí
          </h2>
          <p>
            Gói Huế chịu phí khi lỗi thuộc trách nhiệm bên bán/giao nhận. Nhân viên xác nhận kết quả đổi/hoàn với chứng từ.
            Thanh toán và giao vận hiện được quản lý thủ công; không có giao dịch tự động trên website.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            6. Thời gian và khiếu nại
          </h2>
          <p>
            SLA phản hồi, lấy hàng, đổi hàng và hoàn tiền cụ thể đang chờ phê duyệt. Khách theo dõi timeline, bổ sung thông
            tin và nhận lý do xử lý ngay trong tài khoản.
          </p>
          <h2 style={{ fontFamily: "var(--gh-font-display)", color: "var(--af-primary)", fontSize: "20px" }}>
            7. Liên hệ
          </h2>
          <p>
            Đầu mối: Đang cập nhật. <Link href="/account/orders" style={{ color: "var(--af-primary)", fontWeight: 600 }}>Mở đơn hàng</Link> để gửi yêu
            cầu hoặc <Link href="/account/privacy" style={{ color: "var(--af-primary)", fontWeight: 600 }}>gửi khiếu nại về dữ liệu</Link>.
          </p>
        </article>
      </main>
    );
  }

  // PRIVACY POLICY PAGE (Matches UI_Figma/02_Tai_khoan/Man_hinh/Chinh_sach_bao_mat/code.html)
  return (
    <div style={{ backgroundColor: "var(--af-surface)", minHeight: "100vh", paddingBottom: "4rem" }}>
      {/* BREADCRUMB & HERITAGE HEADING SECTION */}
      <section style={{ backgroundColor: "rgba(255, 241, 232, 0.6)", padding: "2.5rem 1.5rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          {/* Breadcrumb */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "13px",
              color: "var(--af-on-surface-variant)",
              marginBottom: "1rem",
            }}
          >
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>cottage</span>
              <span>Trang chủ</span>
            </Link>
            <span style={{ width: "4px", height: "4px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)" }} />
            <span>Chính sách &amp; Quy định</span>
            <span style={{ width: "4px", height: "4px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)" }} />
            <span style={{ color: "var(--af-primary)", fontWeight: 600 }}>Chính sách bảo mật dữ liệu</span>
          </nav>

          {/* Heading Card with Gilded Corner */}
          <div
            className="heritage-card group"
            style={{
              position: "relative",
              padding: "2rem 2.5rem",
              borderRadius: "0.75rem",
              boxShadow: "0 4px 24px rgba(53, 41, 31, 0.05)",
            }}
          >
            <div className="gilded-corner" style={{ width: "20px", height: "20px" }} />

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "#ffddaf",
                  color: "#281800",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--af-secondary)",
                  }}
                />
                BẢN DỰ THẢO — Chưa công bố hiệu lực chính thức
              </div>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--af-on-surface-variant)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "var(--af-secondary)" }}>
                  gavel
                </span>
                Dự thảo theo Nghị định 13/2023/NĐ-CP
              </span>
            </div>

            <h1
              style={{
                fontFamily: "var(--gh-font-display)",
                fontSize: "30px",
                lineHeight: "40px",
                color: "var(--af-primary)",
                margin: "0 0 0.5rem",
                letterSpacing: "-0.005em",
              }}
            >
              Chính sách bảo mật thông tin &amp; Dữ liệu cá nhân
            </h1>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "12px",
                color: "var(--af-on-surface-variant)",
                marginBottom: "1rem",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--af-primary)" }}>Mã phiên bản: {String(policy?.version || "v1.0.4-DRAFT")}</span>
              <span>•</span>
              <span>Ngày cập nhật dự thảo: 20/10/2025</span>
              <span>•</span>
              <span style={{ color: "var(--af-secondary)", fontWeight: 600 }}>Tình trạng: Đang trong quy trình rà soát pháp lý nội bộ</span>
            </div>

            <div
              style={{
                backgroundColor: "rgba(250, 228, 213, 0.5)",
                borderRadius: "0.5rem",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  padding: "0.25rem",
                  borderRadius: "50%",
                  backgroundColor: "var(--af-surface)",
                  color: "var(--af-secondary)",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>info</span>
              </div>
              <div>
                <strong style={{ fontSize: "14px", color: "var(--af-primary)", display: "block" }}>
                  Lưu ý về hiệu lực của văn bản dự thảo
                </strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.55 }}>
                  Văn bản này phản ánh các nguyên tắc và cam kết dự kiến áp dụng đối với quy trình xử lý dữ liệu đơn hàng và vận
                  chuyển quà tặng đặc sản Huế. Bản dự thảo đang được thẩm định nội bộ theo Nghị định 13/2023/NĐ-CP và không cấu
                  thành chứng nhận pháp lý tuyệt đối cho đến khi ban hành chính thức.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN 2-COLUMN SECTION */}
      <section style={{ maxWidth: "1280px", margin: "2rem auto 0", padding: "0 1.5rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2rem",
            alignItems: "flex-start",
          }}
        >
          {/* LEFT COLUMN: NAVIGATION SIDEBAR */}
          <aside style={{ position: "sticky", top: "100px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="heritage-card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--af-surface-container)",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "6px", height: "6px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)" }} />
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--af-primary)",
                    }}
                  >
                    Mục lục điều hướng
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>7 Điều khoản</span>
              </div>

              {/* Navigation links */}
              <nav style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {[
                  { id: "dieu-1", num: "01", title: "Mục đích thu thập thông tin khách hàng" },
                  { id: "dieu-2", num: "02", title: "Phạm vi thông tin thu thập" },
                  { id: "dieu-3", num: "03", title: "Thời gian lưu trữ & Bảo hộ dữ liệu" },
                  { id: "dieu-4", num: "04", title: "Chia sẻ dữ liệu đối tác bưu chính COD" },
                  { id: "dieu-5", num: "05", title: "Quyền của chủ thể dữ liệu cá nhân" },
                  { id: "dieu-6", num: "06", title: "Biện pháp an toàn & Mã hóa thông tin" },
                  { id: "dieu-7", num: "07", title: "Thông tin đơn vị quản trị & Liên hệ" },
                ].map((item) => {
                  const active = activeArticle === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setActiveArticle(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "0.5rem",
                        textDecoration: "none",
                        fontSize: "13px",
                        lineHeight: 1.45,
                        backgroundColor: active ? "var(--af-surface-container-high)" : "transparent",
                        color: active ? "var(--af-primary)" : "var(--af-on-surface-variant)",
                        fontWeight: active ? 600 : 400,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span style={{ color: "var(--af-secondary)", fontWeight: 700, minWidth: "18px" }}>{item.num}</span>
                      <span>{item.title}</span>
                    </a>
                  );
                })}
              </nav>

              {/* CTAs */}
              <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--af-surface-container)", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="heritage-btn-primary group"
                  onClick={() => alert("Bản thảo PDF đang trong tiến trình phê duyệt pháp lý nội bộ. Quý khách vui lòng lưu lại bản sao sau khi chính thức ban hành.")}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <div className="gilded-corner" />
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>picture_as_pdf</span>
                  <span>Tải bản thảo PDF (.pdf)</span>
                </button>

                <Link
                  href="/account/privacy"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.65rem 1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--af-surface-container)",
                    color: "var(--af-primary)",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--af-secondary)" }}>
                    shield
                  </span>
                  <span>Trung tâm Quyền riêng tư khách hàng</span>
                </Link>
              </div>
            </div>

            {/* Department info */}
            <div className="heritage-card" style={{ padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--af-surface-container-high)",
                    color: "var(--af-primary)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>shield_person</span>
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--af-secondary)", textTransform: "uppercase" }}>
                    Bộ phận phụ trách
                  </span>
                  <h4 style={{ margin: 0, fontSize: "15px", color: "var(--af-primary)", fontWeight: 600 }}>
                    Ban Quản trị Dữ liệu Gói Huế
                  </h4>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.6 }}>
                <div>Email tiếp nhận: <strong style={{ color: "var(--af-primary)" }}>privacy@goihue.vn</strong></div>
                <div>Hỗ trợ phản hồi theo giờ làm việc hành chính</div>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: 7 ARTICLES DETAILS */}
          <article style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* ARTICLE 1 */}
            <section id="dieu-1" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 01
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Quy chuẩn dịch vụ</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Mục đích thu thập thông tin khách hàng
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Nhằm đảm bảo phong vị bánh mứt và quà phẩm Cố Đô được chuyển giao nguyên vẹn, <strong style={{ color: "var(--af-primary)" }}>Gói Huế</strong> chỉ thu thập dữ liệu cá nhân tối thiểu phục vụ các mục đích vận hành cần thiết:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                  <div style={{ backgroundColor: "var(--af-surface-container-low)", padding: "1.25rem", borderRadius: "0.5rem" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--af-surface-container-high)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--af-primary)", marginBottom: "0.5rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>inventory_2</span>
                    </div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                      Xử lý và hoàn thiện bưu kiện
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.5, margin: 0 }}>
                      Phục vụ các công đoạn bao gói mộc thủ công, tạo mã vận đơn bưu điện và điều phối chuyển phát bưu phẩm đến địa chỉ người nhận theo yêu cầu.
                    </p>
                  </div>
                  <div style={{ backgroundColor: "var(--af-surface-container-low)", padding: "1.25rem", borderRadius: "0.5rem" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--af-surface-container-high)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--af-primary)", marginBottom: "0.5rem" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>assignment_turned_in</span>
                    </div>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--af-primary)", margin: "0 0 0.35rem" }}>
                      Giao nhận COD &amp; Đồng kiểm
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.5, margin: 0 }}>
                      Hỗ trợ xác minh người nhận tại thời điểm giao hàng thu hộ tiền mặt (COD), đối chiếu nguyên trạng bao bì niêm phong và xử lý đổi hàng nếu có phát sinh sự cố.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ARTICLE 2 */}
            <section id="dieu-2" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 02
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Tối thiểu hóa dữ liệu</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Phạm vi thông tin thu thập
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Tuân thủ nguyên tắc tinh giản dữ liệu cá nhân theo quy định hiện hành, chúng tôi chỉ tiếp nhận các dữ kiện phục vụ trực tiếp cho việc xử lý đơn hàng quà tặng:
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <span style={{ width: "6px", height: "6px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)", marginTop: "8px", flexShrink: 0 }} />
                    <span><strong>Họ tên người đặt &amp; người nhận:</strong> Sử dụng để in thông tin vận chuyển ngoài kiện và ghi thiệp chúc mừng theo yêu cầu của quý khách.</span>
                  </li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <span style={{ width: "6px", height: "6px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)", marginTop: "8px", flexShrink: 0 }} />
                    <span><strong>Số điện thoại liên lạc:</strong> Để nhân viên giao vận liên hệ hẹn giờ phát hàng tận tay người nhận.</span>
                  </li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <span style={{ width: "6px", height: "6px", backgroundColor: "var(--af-secondary)", transform: "rotate(45deg)", marginTop: "8px", flexShrink: 0 }} />
                    <span><strong>Địa chỉ nhận hàng chi tiết:</strong> Số nhà, ngõ/phố, phường/xã, quận/huyện và tỉnh/thành phố nơi chuyển phát kiện hàng.</span>
                  </li>
                </ul>

                <div
                  style={{
                    backgroundColor: "rgba(250, 228, 213, 0.5)",
                    padding: "1rem 1.25rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px", color: "var(--af-secondary)", flexShrink: 0 }}>
                    credit_card_off
                  </span>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--af-primary)", display: "block" }}>
                      Không thu thập thông tin thẻ tài chính hoặc mật khẩu ngân hàng
                    </strong>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)", lineHeight: 1.55 }}>
                      Gói Huế không thực hiện thu thập hay lưu vết thông tin thẻ tín dụng/ghi nợ, mã CVV/CVC hay mật khẩu tài khoản ngân hàng của khách hàng trên hệ thống của chúng tôi. Giao dịch trực tuyến hoặc COD được thực hiện qua các kênh thanh toán độc lập của ngân hàng/đơn vị bưu chính.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ARTICLE 3 */}
            <section id="dieu-3" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 03
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Thời hạn &amp; Quyền xóa</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Thời gian lưu trữ &amp; Bảo hộ dữ liệu
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Dữ liệu giao dịch được lưu giữ trong giới hạn thời gian cần thiết để đáp ứng nghĩa vụ pháp luật và bảo đảm quyền lợi bảo hành bưu phẩm:
                </p>
                <div style={{ backgroundColor: "var(--af-surface-container-low)", padding: "1.25rem", borderRadius: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)", marginTop: "2px" }}>
                      history_toggle_off
                    </span>
                    <div>
                      <strong style={{ color: "var(--af-primary)" }}>Thời hạn lưu trữ chứng từ đơn hàng: 24 tháng</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
                        Hồ sơ đơn hàng và phiếu gửi được lưu trữ trong vòng 24 tháng nhằm phục vụ công tác đối soát thuế, hóa đơn kế toán và hỗ trợ khiếu nại chất lượng sản phẩm.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)", marginTop: "2px" }}>
                      delete_forever
                    </span>
                    <div>
                      <strong style={{ color: "var(--af-primary)" }}>Quyền yêu cầu xóa thông tin định danh:</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
                        Sau khi đơn hàng hoàn tất và thời hạn đối soát kết thúc, quý khách có thể gửi yêu cầu xóa hoặc ẩn thông tin liên lạc cá nhân theo quy định pháp luật.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ARTICLE 4 */}
            <section id="dieu-4" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 04
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Đối tác vận chuyển</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Chia sẻ dữ liệu đối tác bưu chính COD
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Để chuyển giao các gói đặc sản Huế đúng địa chỉ hẹn trước, chúng tôi chỉ cung cấp các thông tin liên lạc tối thiểu tới đơn vị vận chuyển đối tác:
                </p>
                <div style={{ padding: "1rem 1.25rem", borderRadius: "0.5rem", backgroundColor: "rgba(250, 228, 213, 0.4)", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--af-primary)", fontWeight: 600, marginBottom: "0.4rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)" }}>local_shipping</span>
                    <span>Phạm vi cung cấp cho đơn vị bưu chính</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
                    Chỉ chuyển dữ liệu gồm Họ tên, Số điện thoại và Địa chỉ giao hàng để in trên nhãn bưu phẩm phục vụ công tác giao nhận và đối soát thu tiền hộ (COD).
                  </p>
                </div>
                <div style={{ padding: "1rem 1.25rem", borderRadius: "0.5rem", backgroundColor: "var(--af-surface-container-low)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)" }}>verified_user</span>
                  <span style={{ fontSize: "13px", color: "var(--af-on-surface)" }}>
                    <strong>Cam kết bảo mật:</strong> Gói Huế không thực hiện mua bán, cho thuê hoặc chuyển nhượng danh sách khách hàng cho bất kỳ bên thứ ba nào vì mục đích tiếp thị thương mại không được phép.
                  </span>
                </div>
              </div>
            </section>

            {/* ARTICLE 5 */}
            <section id="dieu-5" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 05
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Quyền chủ thể</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Quyền của chủ thể dữ liệu cá nhân
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Căn cứ Nghị định 13/2023/NĐ-CP, khách hàng được bảo đảm thực hiện các quyền thực tế sau đối với dữ liệu cá nhân của mình:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  {[
                    { num: "1", title: "Quyền tiếp cận & tra cứu", desc: "Yêu cầu kiểm tra thông tin cá nhân và lịch sử đơn hàng đã lưu trong hệ thống.", icon: "search" },
                    { num: "2", title: "Quyền chỉnh sửa", desc: "Yêu cầu cập nhật, chỉnh lý số điện thoại hoặc địa chỉ nhận hàng khi có thay đổi.", icon: "edit" },
                    { num: "3", title: "Quyền xóa hoặc hạn chế", desc: "Đề nghị hủy bỏ hoặc giới hạn phạm vi sử dụng dữ liệu sau khi kết thúc dịch vụ.", icon: "delete" },
                    { num: "4", title: "Quyền trích xuất dữ liệu", desc: "Yêu cầu cung cấp bản sao dữ liệu cá nhân của quý khách theo định dạng số phổ biến.", icon: "download" },
                    { num: "5", title: "Quyền rút sự đồng ý tiếp thị", desc: "Từ chối nhận thông báo ưu đãi hoặc bản tin mùa vụ bất kỳ lúc nào qua đường liên kết hủy đăng ký.", icon: "unsubscribe" },
                  ].map((r, i) => (
                    <div
                      key={i}
                      style={{
                        backgroundColor: "var(--af-surface-container-low)",
                        padding: "0.85rem 1rem",
                        borderRadius: "0.5rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.6rem",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--af-secondary)", marginTop: "2px" }}>
                        {r.icon}
                      </span>
                      <div>
                        <strong style={{ fontSize: "13px", color: "var(--af-primary)", display: "block" }}>{r.title}</strong>
                        <span style={{ fontSize: "12px", color: "var(--af-on-surface-variant)", lineHeight: 1.45, display: "block", marginTop: "2px" }}>
                          {r.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ARTICLE 6 */}
            <section id="dieu-6" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 06
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Biện pháp an toàn</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Biện pháp an toàn &amp; Mã hóa thông tin
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Nhằm phòng ngừa rủi ro truy cập trái phép, Gói Huế áp dụng các giải pháp kỹ thuật và tổ chức nội bộ phù hợp với quy mô vận hành:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--af-surface-container-low)", borderRadius: "0.5rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)" }}>lock</span>
                    <div>
                      <strong style={{ color: "var(--af-primary)" }}>Mã hóa đường truyền SSL/TLS</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
                        Các phiên truy cập và biểu mẫu gửi thông tin trực tuyến được mã hóa qua giao thức bảo mật SSL/TLS tiêu chuẩn nhằm bảo vệ dữ liệu trong quá trình truyền dẫn.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "1rem", backgroundColor: "var(--af-surface-container-low)", borderRadius: "0.5rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: "var(--af-secondary)" }}>manage_accounts</span>
                    <div>
                      <strong style={{ color: "var(--af-primary)" }}>Phân quyền nội bộ theo vị trí công việc</strong>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "13px", color: "var(--af-on-surface-variant)" }}>
                        Nhân viên kho chỉ tiếp cận thông tin địa chỉ trên nhãn gửi hàng; dữ liệu đơn hàng chi tiết chỉ mở cho bộ phận phụ trách chăm sóc khách hàng khi cần giải quyết yêu cầu cụ thể.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ARTICLE 7 */}
            <section id="dieu-7" className="heritage-card" style={{ scrollMarginTop: "100px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--af-secondary)", textTransform: "uppercase" }}>
                  ĐIỀU KHOẢN 07
                </span>
                <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>Đơn vị quản trị</span>
              </div>
              <h2 style={{ fontFamily: "var(--gh-font-display)", fontSize: "22px", color: "var(--af-primary)", margin: "0 0 1rem" }}>
                Thông tin đơn vị quản trị &amp; Liên hệ
              </h2>
              <div style={{ fontSize: "15px", lineHeight: 1.65, color: "var(--af-on-surface-variant)" }}>
                <p style={{ margin: "0 0 1rem" }}>
                  Mọi câu hỏi, đề xuất thẩm tra hoặc yêu cầu thực thi quyền riêng tư liên quan đến chính sách này, quý khách vui lòng liên hệ:
                </p>
                <div style={{ backgroundColor: "rgba(250, 228, 213, 0.6)", padding: "1.25rem", borderRadius: "0.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--af-primary)" }}>apartment</span>
                    <div><strong style={{ color: "var(--af-primary)" }}>Đơn vị vận hành:</strong> Thương hiệu quà tặng Gói Huế</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--af-primary)" }}>location_on</span>
                    <div><strong style={{ color: "var(--af-primary)" }}>Văn phòng &amp; Xưởng sản xuất:</strong> Thành phố Huế, Tỉnh Thừa Thiên Huế</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "var(--af-primary)" }}>mail</span>
                    <div><strong style={{ color: "var(--af-primary)" }}>Hộp thư tiếp nhận quyền riêng tư:</strong> privacy@goihue.vn</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--af-surface-container)",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--af-secondary)", textTransform: "uppercase" }}>
                      BAN THẨM ĐỊNH VĂN BẢN
                    </span>
                    <h4 style={{ margin: "0.2rem 0 0", fontSize: "16px", color: "var(--af-primary)", fontWeight: 600 }}>
                      Ban Quản trị Dữ liệu &amp; Pháp chế Gói Huế
                    </h4>
                    <span style={{ fontSize: "12px", color: "var(--af-outline)" }}>
                      Bản thảo kỹ thuật số nội bộ — Cố Đô Huế
                    </span>
                  </div>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      backgroundColor: "var(--af-surface-container-high)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--af-secondary)",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>article</span>
                  </div>
                </div>
              </div>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
}
