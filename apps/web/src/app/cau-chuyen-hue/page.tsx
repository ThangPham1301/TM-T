import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./story.module.css";

export const metadata: Metadata = {
  title: "Câu chuyện Huế",
  description:
    "Từ bàn trà bên sông Hương đến từng nếp gấp hộp quà, câu chuyện Gói Huế kể về cách đem phong vị Cố đô vào đời sống hôm nay.",
};

export default function HueStoryPage() {
  return (
    <main id="main-content" className={styles.page}>
      <article className="gh-wrap">
        <header className={styles.hero}>
          <div className={styles.intro}>
            <p className="gh-kicker">Câu chuyện Huế</p>
            <h1>Chút Huế nằm trong một nếp gấp</h1>
            <div className="gh-story__rule" aria-hidden="true" />
            <p className={styles.lead}>
              Có những vùng đất đi qua rồi chỉ còn lại vài tấm ảnh trong điện
              thoại. Nhưng Huế thì khác. Huế ở lại bằng mùi hương — mùi khói bếp
              chiều bảng lảng bên bờ sông Hương, mùi mè rang thơm lừng dưới mái
              ngói liệt trầm mặc, mùi thảo mộc thanh tao thoảng qua hiên nhà
              rường sau một cơn mưa rào chợt đến rồi chợt tan.
            </p>
            <p>
              Người ta thường nghĩ di sản là những bức tường thành rêu phong
              nằm yên sau cánh cổng Ngọ Môn, là thứ gì đó trang nghiêm và xa
              cách. Nhưng với người Huế, di sản sống ngay trên bàn trà mỗi sớm
              mai: trong cái dẻo bùi của miếng mè xửng kéo tay từ chảo mạch nha
              liu riu lửa, trong hoa văn khuôn gỗ chạm trổ trên chiếc bánh in
              đậu xanh tan nhẹ nơi đầu lưỡi, và trong chén trà cung đình vàng
              óng giúp lòng người lắng lại giữa dòng đời vội vã.
            </p>
          </div>
          <figure className={`gh-frame-plaque ${styles.cover}`}>
            <Image
              src="/images/heritage/stories/cau-chuyen-hue.webp"
              alt="Đôi tay mở hộp quà Gói Huế bên ly trà nóng trên bàn gỗ"
              width={1344}
              height={756}
              sizes="(max-width: 960px) 94vw, (max-width: 1350px) 52vw, 660px"
              loading="eager"
            />
          </figure>
        </header>

        <div className={styles.chapters}>
          <section aria-labelledby="goi-mot-chieu-song-huong">
            <h2 id="goi-mot-chieu-song-huong">
              Làm sao để “gói” một chiều sông Hương mang đi?
            </h2>
            <p>
              Chúng tôi từng tự hỏi: làm thế nào để một người con xa quê giữa
              lòng Sài Gòn náo nhiệt, hay một vị khách vừa rời chuyến tàu đêm
              khỏi ga Huế, vẫn có thể chạm lại cái nhịp sống dịu dàng ấy bất cứ
              khi nào họ muốn? Bởi đặc sản Huế vốn rất ngon, nhưng đôi khi lại
              bị bỏ quên trong những chiếc túi cũ kỹ, những miếng kẹo lớn khó
              chia, hay những gói trà cầu kỳ khiến người bận rộn ngại mở ra
              thưởng thức.
            </p>
            <p>
              <strong>Gói Huế</strong> ra đời từ chính nỗi trăn trở dịu êm đó.
              Chữ “Gói” là cách đóng hộp và cũng là động tác gói ghém tất cả sự
              tỉ mỉ, lễ nghĩa và tấm lòng của người Cố đô. Từ những công thức
              mộc mạc của làng nghề bên sông Hương, chúng tôi muốn khoác lên di
              sản một diện mạo mới: tinh giản hơn, gọn ghẽ hơn và gần gũi với
              đời sống hôm nay hơn.
            </p>
          </section>
          <section aria-labelledby="huong-hue-trong-nhip-song-hom-nay">
            <h2 id="huong-hue-trong-nhip-song-hom-nay">
              Khi cổ kính gặp gỡ sự mới mẻ trên bàn làm việc của bạn
            </h2>
            <p>
              Gói Huế thú vị nhất ở khoảnh khắc đôi tay bạn mở hộp quà. Vuốt
              nhẹ đai giấy nâu trầm, chạm vào nếp gấp góc ánh vàng đồng trên
              nền giấy kem mộc mạc — bạn nghe thấy tiếng giấy sột soạt đầy
              trân trọng như đang mở một bức thư tay gửi từ Kinh kỳ.
            </p>
            <p>
              Bên trong là một Huế thật quen mà cũng thật mới. Giữa giờ nghỉ
              trưa nơi văn phòng hay một chiều cuối tuần bên khung cửa sổ,
              bạn có thể thả một túi lọc trà cung đình vào ly nước nóng, bóc
              một viên mè xửng rồi nhấp ngụm trà ấm. Hương mè rang bùi và vị
              trà thảo mộc gợi chút hoài niệm, đủ nhẹ nhàng để thành một
              khoảng nghỉ mỗi ngày.
            </p>
            <p>
              Mỗi gói quà rời khỏi Huế mang theo vị ngọt của mè, vị bùi của
              đậu xanh, hương thơm của thảo mộc và một lời nhắn nhủ dịu dàng
              từ Cố đô: <em>hãy sống chậm lại một nhịp, và trao đi điều tinh
              tế nhất cho người bạn thương.</em>
            </p>
          </section>
        </div>

        <div className={`gh-frame-plaque ${styles.closing}`}>
          <blockquote>
            “Từ Huế vươn xa, mang di sản đến mọi nơi, lan tỏa món quà Huế,
            tâm hồn Huế.”
          </blockquote>
          <Link
            className="gh-btn gh-btn--brown gh-btn--fold"
            href="/products?category=qua-bieu"
          >
            Khám phá quà biếu Huế <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </main>
  );
}
