"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Row } from "@/lib/store";
export function Policies({ returns = false }: { returns?: boolean }) {
  const [policy, setPolicy] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!returns)
      void api("policy")
        .then(setPolicy)
        .catch((e) => setError(e.message));
  }, [returns]);
  return (
    <main className="store-page">
      <header className="store-heading">
        <span className="eyebrow">Minh bạch & đồng hành</span>
        <h1>{returns ? "Chính sách đổi trả" : "Chính sách bảo mật"}</h1>
        <p className="store-warning">
          DỰ THẢO CHỜ PHÊ DUYỆT · Chưa công bố hiệu lực chính thức
        </p>
      </header>
      <article className="store-card store-policy">
        {returns ? (
          <>
            <h2>1. Phạm vi tiếp nhận</h2>
            <p>
              Giao sai, giao thiếu, hỏng, bao bì hở hoặc chất lượng bất thường.
              Yêu cầu từ đơn hàng đã giao trong tài khoản.
            </p>
            <h2>2. Thời điểm và bằng chứng</h2>
            <p>
              Đề xuất 7 ngày từ ngày giao được xác nhận cho lỗi nhìn thấy. Lỗi
              chất lượng hoặc an toàn vẫn được tiếp nhận ngoài mốc này để xem
              xét. Ảnh nhãn hàng, lô và hạn dùng nếu phù hợp; không mặc định bắt
              buộc video mở hộp.
            </p>
            <h2>3. Phương án xử lý</h2>
            <p>
              Đổi hoặc hoàn phần sản phẩm được duyệt. Số lượng không vượt phần
              còn được yêu cầu. Tiền hoàn theo giá thực trả của dòng hàng; không
              tự hoàn phí giao hàng nếu chưa có quyết định riêng.
            </p>
            <h2>4. Thu hồi và an toàn thực phẩm</h2>
            <p>
              Ngừng sử dụng nếu nghi không an toàn. Cửa hàng quyết định có cần
              thu hồi; hàng trả được kiểm tra, cách ly hoặc xử lý, không tự nhập
              lại tồn bán.
            </p>
            <h2>5. Thực hiện và chi phí</h2>
            <p>
              Gói Huế chịu phí khi lỗi thuộc trách nhiệm bên bán/giao nhận. Nhân
              viên xác nhận kết quả đổi/hoàn với chứng từ. Thanh toán và giao
              vận hiện được quản lý thủ công; không có giao dịch tự động trên
              website.
            </p>
            <h2>6. Thời gian và khiếu nại</h2>
            <p>
              SLA phản hồi, lấy hàng, đổi hàng và hoàn tiền cụ thể đang chờ phê
              duyệt. Khách theo dõi timeline, bổ sung thông tin và nhận lý do xử
              lý ngay trong tài khoản.
            </p>
            <h2>7. Liên hệ</h2>
            <p>
              Đầu mối: Đang cập nhật.{" "}
              <Link href="/account/orders">Mở đơn hàng</Link> để gửi yêu cầu
              hoặc <Link href="/account/privacy">gửi khiếu nại về dữ liệu</Link>
              .
            </p>
          </>
        ) : error ? (
          <p className="store-error">{error}</p>
        ) : policy ? (
          <>
            <p>Phiên bản: {String(policy.version)}</p>
            {String(policy.content)
              .split("\n\n")
              .map((part, i) => (
                <p key={i}>{part}</p>
              ))}
          </>
        ) : (
          <p>Đang tải chính sách…</p>
        )}
      </article>
    </main>
  );
}
