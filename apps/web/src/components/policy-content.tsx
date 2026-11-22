import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./policies.module.css";

export type PolicyArticle = { id: string; title: string; content: ReactNode };

export const privacyArticles: PolicyArticle[] = [
  {
    id: "dieu-1",
    title: "Mục đích thu thập thông tin khách hàng",
    content: (
      <>
        <div>
          <p>
            Nhằm đảm bảo phong vị bánh mứt và quà phẩm Cố Đô được chuyển giao nguyên vẹn, <strong>Gói Huế</strong> chỉ thu thập dữ liệu cá nhân tối thiểu phục vụ các mục đích vận hành cần thiết:
          </p>
          <div className={styles.detailGrid}>
            <div className={styles.note}>
              <h3>
                Xử lý và hoàn thiện bưu kiện
              </h3>
              <p>
                Phục vụ các công đoạn bao gói mộc thủ công, tạo mã vận đơn bưu điện và điều phối chuyển phát bưu phẩm đến địa chỉ người nhận theo yêu cầu.
              </p>
            </div>
            <div className={styles.note}>
              <h3>
                Giao nhận COD &amp; Đồng kiểm
              </h3>
              <p>
                Hỗ trợ xác minh người nhận tại thời điểm giao hàng thu hộ tiền mặt (COD), đối chiếu nguyên trạng bao bì niêm phong và xử lý đổi hàng nếu có phát sinh sự cố.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-2",
    title: "Phạm vi thông tin thu thập",
    content: (
      <>
        <div>
          <p>
            Tuân thủ nguyên tắc tinh giản dữ liệu cá nhân theo quy định hiện hành, chúng tôi chỉ tiếp nhận các dữ kiện phục vụ trực tiếp cho việc xử lý đơn hàng quà tặng:
          </p>
          <ul>
            <li>

              <span><strong>Họ tên người đặt &amp; người nhận:</strong> Sử dụng để in thông tin vận chuyển ngoài kiện và ghi thiệp chúc mừng theo yêu cầu của quý khách.</span>
            </li>
            <li>

              <span><strong>Số điện thoại liên lạc:</strong> Để nhân viên giao vận liên hệ hẹn giờ phát hàng tận tay người nhận.</span>
            </li>
            <li>

              <span><strong>Địa chỉ nhận hàng chi tiết:</strong> Số nhà, ngõ/phố, phường/xã, quận/huyện và tỉnh/thành phố nơi chuyển phát kiện hàng.</span>
            </li>
          </ul>

          <div className={styles.note}
          >

            <div>
              <strong>
                Không thu thập thông tin thẻ tài chính hoặc mật khẩu ngân hàng
              </strong>
              <p>
                Gói Huế không thực hiện thu thập hay lưu vết thông tin thẻ tín dụng/ghi nợ, mã CVV/CVC hay mật khẩu tài khoản ngân hàng của khách hàng trên hệ thống của chúng tôi. Giao dịch trực tuyến hoặc COD được thực hiện qua các kênh thanh toán độc lập của ngân hàng/đơn vị bưu chính.
              </p>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-3",
    title: "Thời gian lưu trữ & Bảo hộ dữ liệu",
    content: (
      <>
        <div>
          <p>
            Dữ liệu giao dịch được lưu giữ trong giới hạn thời gian cần thiết để đáp ứng nghĩa vụ pháp luật và bảo đảm quyền lợi bảo hành bưu phẩm:
          </p>
          <div className={styles.note}>
            <div>
              <div>
                <strong>Thời hạn lưu trữ chứng từ đơn hàng: 24 tháng</strong>
                <p>
                  Hồ sơ đơn hàng và phiếu gửi được lưu trữ trong vòng 24 tháng nhằm phục vụ công tác đối soát thuế, hóa đơn kế toán và hỗ trợ khiếu nại chất lượng sản phẩm.
                </p>
              </div>
            </div>
            <div>
              <div>
                <strong>Quyền yêu cầu xóa thông tin định danh:</strong>
                <p>
                  Sau khi đơn hàng hoàn tất và thời hạn đối soát kết thúc, quý khách có thể gửi yêu cầu xóa hoặc ẩn thông tin liên lạc cá nhân theo quy định pháp luật.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-4",
    title: "Chia sẻ dữ liệu đối tác bưu chính COD",
    content: (
      <>
        <div>
          <p>
            Để chuyển giao các gói đặc sản Huế đúng địa chỉ hẹn trước, chúng tôi chỉ cung cấp các thông tin liên lạc tối thiểu tới đơn vị vận chuyển đối tác:
          </p>
          <div className={styles.note}>
            <div>

              <span>Phạm vi cung cấp cho đơn vị bưu chính</span>
            </div>
            <p>
              Chỉ chuyển dữ liệu gồm Họ tên, Số điện thoại và Địa chỉ giao hàng để in trên nhãn bưu phẩm phục vụ công tác giao nhận và đối soát thu tiền hộ (COD).
            </p>
          </div>
          <div className={styles.note}>

            <span>
              <strong>Cam kết bảo mật:</strong> Gói Huế không thực hiện mua bán, cho thuê hoặc chuyển nhượng danh sách khách hàng cho bất kỳ bên thứ ba nào vì mục đích tiếp thị thương mại không được phép.
            </span>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-5",
    title: "Quyền của chủ thể dữ liệu cá nhân",
    content: (
      <>
        <div>
          <p>
            Căn cứ Nghị định 13/2023/NĐ-CP, khách hàng được bảo đảm thực hiện các quyền thực tế sau đối với dữ liệu cá nhân của mình:
          </p>
          <div className={styles.detailGrid}>
            {[
              { num: "1", title: "Quyền tiếp cận & tra cứu", desc: "Yêu cầu kiểm tra thông tin cá nhân và lịch sử đơn hàng đã lưu trong hệ thống." },
              { num: "2", title: "Quyền chỉnh sửa", desc: "Yêu cầu cập nhật, chỉnh lý số điện thoại hoặc địa chỉ nhận hàng khi có thay đổi." },
              { num: "3", title: "Quyền xóa hoặc hạn chế", desc: "Đề nghị hủy bỏ hoặc giới hạn phạm vi sử dụng dữ liệu sau khi kết thúc dịch vụ." },
              { num: "4", title: "Quyền trích xuất dữ liệu", desc: "Yêu cầu cung cấp bản sao dữ liệu cá nhân của quý khách theo định dạng số phổ biến." },
              { num: "5", title: "Quyền rút sự đồng ý tiếp thị", desc: "Từ chối nhận thông báo ưu đãi hoặc bản tin mùa vụ bất kỳ lúc nào qua đường liên kết hủy đăng ký." },
            ].map((r) => (
              <div
                key={r.title} className={styles.note}
              >

                <div>
                  <strong>{r.title}</strong>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-6",
    title: "Biện pháp an toàn & Mã hóa thông tin",
    content: (
      <>
        <div>
          <p>
            Nhằm phòng ngừa rủi ro truy cập trái phép, Gói Huế áp dụng các giải pháp kỹ thuật và tổ chức nội bộ phù hợp với quy mô vận hành:
          </p>
          <div>
            <div className={styles.note}>
              <div>
                <strong>Mã hóa đường truyền SSL/TLS</strong>
                <p>
                  Các phiên truy cập và biểu mẫu gửi thông tin trực tuyến được mã hóa qua giao thức bảo mật SSL/TLS tiêu chuẩn nhằm bảo vệ dữ liệu trong quá trình truyền dẫn.
                </p>
              </div>
            </div>
            <div className={styles.note}>
              <div>
                <strong>Phân quyền nội bộ theo vị trí công việc</strong>
                <p>
                  Nhân viên kho chỉ tiếp cận thông tin địa chỉ trên nhãn gửi hàng; dữ liệu đơn hàng chi tiết chỉ mở cho bộ phận phụ trách chăm sóc khách hàng khi cần giải quyết yêu cầu cụ thể.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "dieu-7",
    title: "Thông tin đơn vị quản trị & Liên hệ",
    content: (
      <>
        <p>Mọi câu hỏi, đề xuất thẩm tra hoặc yêu cầu thực thi quyền riêng tư liên quan đến chính sách này, quý khách vui lòng liên hệ:</p>
        <div className={styles.note}>
          <div><strong>Đơn vị vận hành:</strong> Thương hiệu quà tặng Gói Huế</div>
          <div><strong>Văn phòng &amp; Xưởng sản xuất:</strong> Thành phố Huế, Tỉnh Thừa Thiên Huế</div>
          <div><strong>Hộp thư tiếp nhận quyền riêng tư:</strong> privacy@goihue.vn</div>
        </div>
      </>
    ),
  },
];

export const returnArticles: PolicyArticle[] = [
  {
    id: "dieu-1",
    title: "Phạm vi tiếp nhận",
    content: <p>Giao sai, giao thiếu, hỏng, bao bì hở hoặc chất lượng bất thường. Yêu cầu từ đơn hàng đã giao trong tài khoản.</p>,
  },
  {
    id: "dieu-2",
    title: "Thời điểm và bằng chứng",
    content: <p>Đề xuất 7 ngày từ ngày giao được xác nhận cho lỗi nhìn thấy. Lỗi chất lượng hoặc an toàn vẫn được tiếp nhận ngoài
            mốc này để xem xét. Ảnh nhãn hàng, lô và hạn dùng nếu phù hợp; không mặc định bắt buộc video mở hộp.</p>,
  },
  {
    id: "dieu-3",
    title: "Phương án xử lý",
    content: <p>Đổi hoặc hoàn phần sản phẩm được duyệt. Số lượng không vượt phần còn được yêu cầu. Tiền hoàn theo giá thực trả
            của dòng hàng; không tự hoàn phí giao hàng nếu chưa có quyết định riêng.</p>,
  },
  {
    id: "dieu-4",
    title: "Thu hồi và an toàn thực phẩm",
    content: <p>Ngừng sử dụng nếu nghi không an toàn. Cửa hàng quyết định có cần thu hồi; hàng trả được kiểm tra, cách ly hoặc
            xử lý, không tự nhập lại tồn bán.</p>,
  },
  {
    id: "dieu-5",
    title: "Thực hiện và chi phí",
    content: <p>Gói Huế chịu phí khi lỗi thuộc trách nhiệm bên bán/giao nhận. Nhân viên xác nhận kết quả đổi/hoàn với chứng từ.
            Thanh toán và giao vận hiện được quản lý thủ công; không có giao dịch tự động trên website.</p>,
  },
  {
    id: "dieu-6",
    title: "Thời gian và khiếu nại",
    content: <p>SLA phản hồi, lấy hàng, đổi hàng và hoàn tiền cụ thể đang chờ phê duyệt. Khách theo dõi timeline, bổ sung thông
            tin và nhận lý do xử lý ngay trong tài khoản.</p>,
  },
  {
    id: "dieu-7",
    title: "Liên hệ",
    content: <p>Đầu mối: Đang cập nhật. <Link href="/account/orders">Mở đơn hàng</Link> để gửi yêu
            cầu hoặc <Link href="/account/privacy">gửi khiếu nại về dữ liệu</Link>.</p>,
  },
];
