"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, money, type Row } from "@/lib/store";
import { EmptyState, Button } from "@/shared/ui";
import { ProductImage } from "./product/product-image";
import { brandValues, galleryItems, giftSuggestions, homeImages } from "./home-content";
import styles from "./home.module.css";

function HeritageIcon({ name }: { name: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "temple" ? <><path d="m3 8 9-5 9 5M3 10h18M5 10v10m7-10v10m7-10v10M3 21h18M8 6V3m8 3V3" /></> :
      name === "leaf" ? <><path d="M20 3C9 2 2 8 5 16s17 4 15-13Z" /><path d="m3 22 13-14" /></> :
      name === "flower" ? <><circle cx="12" cy="9" r="3" /><path d="M9 6C5 0 1 8 6 10c-5 4 2 9 5 4 3 5 10 0 5-4 5-2 1-10-3-4M12 13v9m0-2c-5 0-8-3-8-5 5-1 8 2 8 5Zm0-2c4 0 7-2 8-4-4-1-7 1-8 4Z" /></> :
      name === "gift" ? <><path d="M3 9h18v4H3Zm2 4v8h14v-8M12 9v12" /><path d="M12 9C1 8 7-2 12 9Zm0 0c11-1 5-11 0 0Z" /></> :
      <><rect x="4" y="4" width="16" height="17" rx="1" /><path d="M8 4v6h8V4M9 16h6" /></>}
  </svg>;
}

function FoldLink({ href, children, small = false }: { href: string; children: React.ReactNode; small?: boolean }) {
  return <Link className={`${styles.cta} ${small ? styles.smallCta : ""}`} href={href}>{children}<span aria-hidden="true">→</span></Link>;
}

export function HomeExperience() {
  const [products, setProducts] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([api("products"), api("categories")]).then(([p, c]) => {
      if (active) { setProducts(p); setCategories(c); setError(""); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Không thể tải bộ sưu tập."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const visible = products.filter(p => !category || p.category === category).slice(0, 6);
  return (
    <main className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroFrame}>
            <svg className={styles.roof} viewBox="0 0 800 450" fill="none" stroke="currentColor" aria-hidden="true"><path d="M-20 110C140 100 220 60 340 30h80c120 30 200 70 360 80M0 120h760M40 135h670M60 135v165m100-165v165m100-165v165m100-165v165m100-165v165m100-165v165m100-165v165M20 300h680M0 20q70 30 130 0t80 40" /></svg>
            <div className={styles.heroCopy}><div className={styles.heroPaper}>
              <span className={styles.kicker}>— Tinh hoa Cố Đô</span>
              <h1>Phong vị Huế</h1>
              <p>Kế thừa ngự thiện cung đình, chắt chiu hương vị mộc mạc thơm lừng của mè xửng, hạt sen tươi ngào đường phèn và nếp nhà thâm trầm xứ Huế.</p>
              <FoldLink href="#bo-suu-tap-san-pham">Khám phá ngay</FoldLink>
            </div></div>
            <div className={styles.heroVisual}>
              <ProductImage src={homeImages.hero} alt="Mè xửng trên đĩa gốm bên tách trà và hộp quà giấy mộc" fill priority sizes="(max-width:1023px) 100vw, 60vw" unoptimized />
              <div className={styles.heroBadge}><HeritageIcon name="box" /><div><strong>Đặc sản gia truyền Thừa Thiên</strong><small>Gìn giữ công thức truyền thống</small></div></div>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.values} aria-label="Giá trị Gói Huế"><div className={styles.container}>
        <div className={styles.valuesGrid}>{brandValues.map(value => <article key={value.title}><span className={styles.valueIcon}><HeritageIcon name={value.icon} /></span><div><h2>{value.title}</h2><p>{value.description}</p></div></article>)}</div>
      </div></section>
      <section className={`${styles.container} ${styles.catalog}`} id="bo-suu-tap-san-pham">
        <aside className={styles.sidebar}><h2><HeritageIcon name="gift" />Danh mục quà</h2>
          <nav aria-label="Lọc danh mục quà">
            <button type="button" aria-pressed={!category} onClick={() => setCategory("")}><span aria-hidden="true">▦</span>Tất cả đặc sản<span aria-hidden="true">›</span></button>
            {categories.map(c => <button type="button" key={c.id} aria-pressed={category === c.code} onClick={() => setCategory(String(c.code))}><HeritageIcon name={/trà/i.test(String(c.name)) ? "leaf" : "gift"} />{String(c.name)}<span aria-hidden="true">›</span></button>)}
          </nav>
        </aside>
        <div className={styles.catalogBody}>
          <header className={styles.sectionHeading}><div><span className={styles.kicker}>✧ Được yêu thích nhất</span><h2>Sản phẩm tuyển chọn</h2></div><p>Hiển thị {visible.length} thức quà đặc sản tuyển chọn</p></header>
          {loading ? <p role="status">Đang tải bộ sưu tập…</p> : error ? <div role="alert"><p>{error}</p><Button onClick={() => { setLoading(true); setRetry(n => n + 1); }}>Thử lại</Button></div> : !visible.length ? <EmptyState title="Chưa có sản phẩm" description="Bộ sưu tập này đang được cập nhật." action={<Link href="/products">Xem tất cả sản phẩm</Link>} /> : <div className={styles.productGrid}>
            {visible.map(p => <article key={p.id} className={styles.productCard}>
              <Link className={styles.productVisual} href={`/products/${p.slug}`}><ProductImage src={String(p.image ?? "")} alt={String(p.name)} fill sizes="(max-width:639px) 100vw, (max-width:1023px) 50vw, 25vw" /></Link>
              <div className={styles.productBody}><span className={styles.productCategory}>{String(categories.find(c => c.code === p.category)?.name ?? "Đặc sản Huế")}</span><h3><Link href={`/products/${p.slug}`}>{String(p.name)}</Link></h3><p>{String(p.description ?? "")}</p>
                <div className={styles.productBottom}><div><small>Giá niêm yết</small><strong>{money(p.price)}</strong></div><FoldLink href={`/products/${p.slug}`} small>Chọn mua</FoldLink></div>
              </div>
            </article>)}
          </div>}
        </div>
      </section>
      <section className={styles.gifts} id="set-qua-tang"><div className={styles.container}>
        <header className={styles.centerHeading}><span className={styles.kicker}>Trang trọng &amp; Ý nghĩa</span><h2>Set Quà Tặng Gói Huế</h2><span className={styles.goldLine} /><p>Nghệ thuật xếp lớp bao bì giấy mộc, đai nâu in ép kim nhũ và nếp gấp góc thủ công truyền tải trọn vẹn văn hoá tặng lễ trang trọng xứ Cố Đô.</p></header>
        <div className={styles.giftGrid}>{giftSuggestions.map((suggestion, i) => {
          const expectedName = suggestion.title.replace(/\s*\(.*\)$/, "").toLocaleLowerCase("vi");
          const product = products.find(p => String(p.name).toLocaleLowerCase("vi") === expectedName);
          return <article key={suggestion.title} className={styles.giftCard}>
            <div className={styles.giftVisual}><ProductImage src={product ? String(product.image ?? "") : homeImages.gifts[i]} alt={product ? String(product.name) : suggestion.title} fill unoptimized sizes="(max-width:1023px) 100vw, 50vw" /><span>{product ? "Quà tặng Gói Huế" : suggestion.badge}</span></div>
            <div className={styles.giftBody}><div><h3>{product ? String(product.name) : suggestion.title}</h3><p>{product ? String(product.description ?? "") : suggestion.description}</p>{!product && <ul>{suggestion.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}</div>
              <div className={styles.giftAction}>{product ? <strong>{money(product.price)}</strong> : <small>Mẫu gợi ý từ bộ sưu tập thiết kế</small>}<FoldLink href={product ? `/products/${product.slug}` : "/products"} small>{product ? "Chọn set này" : "Xem bộ sưu tập"}</FoldLink></div>
            </div>
          </article>;
        })}</div>
      </div></section>
      <section className={`${styles.container} ${styles.gallery}`}>
        <header className={styles.sectionHeading}><div><span className={styles.kicker}>Góc nhìn nghệ thuật</span><h2>Thư Viện Khoảnh Khắc</h2></div><p>Từ công đoạn rang vừng bốc khói trên chảo gang đến nếp gấp giấy gói vuông vức của người thợ thủ công xứ Huế.</p></header>
        <div className={styles.galleryGrid}>{galleryItems.map((item, i) => <figure key={item.title}><ProductImage src={homeImages.gallery[i]} alt={item.alt} fill unoptimized sizes="(max-width:639px) 100vw, (max-width:1023px) 50vw, 40vw" /><figcaption><span>{item.category}</span><h3>{item.title}</h3></figcaption></figure>)}</div>
      </section>
      <section className={styles.story} id="heritage-story">
        <svg className={styles.storyOrnament} viewBox="0 0 200 200" aria-hidden="true"><path fill="currentColor" d="M100 0C105 50 150 95 200 100C150 105 105 150 100 200C95 150 50 105 0 100C50 95 95 50 100 0Z" /></svg>
        <div className={styles.storyInner}><span className={styles.flower}><HeritageIcon name="flower" /></span><span className={styles.kicker}>Nếp Nhà Trầm Mặc</span><h2>Gói chút Huế gửi nhau...</h2>
          <p>Huế không vội vã. Nhịp sống êm đềm bên dòng sông Hương đã tôi luyện nên thứ ẩm thực cầu kỳ trong hương vị nhưng giản dị, mực thước trong phong thái. Từng thức quà của <strong>Gói Huế</strong> không chỉ đơn thuần là bánh mứt ngọt thơm, mà là một lát cắt dịu dàng của nếp nhà thâm trầm, của tiếng dạ thưa mộc mạc và bóng cây ngô đồng nghiêng bóng Hoàng thành.</p>
          <p>Chúng tôi nâng niu giữ gìn từng công thức nấu mạch nha cổ truyền, tuyển chọn những mẻ hạt sen tươi ngon nhất từ hồ Tịnh Tâm, và gói ghém cẩn trọng bằng chất liệu giấy mộc thân thiện cùng nếp gấp góc mạ kim sắc hoàng gia. Để khi mở từng gói bánh, người phương xa cũng như được chạm vào một phần linh hồn xứ Cố Đô.</p>
          <div className={styles.storyActions}><FoldLink href="#bo-suu-tap-san-pham">Chọn quà Cố Đô</FoldLink><div className={styles.signature}><span aria-hidden="true">G</span><div><strong>Gói Huế Trân Quý</strong><small>Tinh hoa quà tặng xứ Thừa Thiên</small></div></div></div>
        </div>
      </section>
    </main>
  );
}
