"use client";
import Link from "next/link";
import Image from "next/image";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fields, useStore } from "@/lib/store";
import { Button, TextField } from "@/shared/ui";
import { BrandMark } from "@/shared/layout";
import styles from "./auth-form.module.css";

const heritageImage = "/images/stitch/asset-07.jpg";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const { busy, run, reload } = useStore();
  const [showPassword, setShowPassword] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const passwordId = useId();
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{register ? "Tạo tài khoản thành viên" : "Đăng nhập tài khoản"}</span>
        </nav>
        <div className={styles.frame}>
          <aside className={styles.story}>
            <div>
              <BrandMark />
              <p className={styles.kicker}>{register ? "Tri kỷ Cố Đô" : "Hương sắc Cố Đô"}</p>
              <div className={styles.introduction}>
                <span className={styles.kicker}>{register ? "Sổ bộ thân quý" : "Tâm giao xứ Huế"}</span>
                <h2>{register ? "Gắn kết phong vị, trọn vẹn thâm tình" : "“Gói chút Huế, gửi yêu thương.”"}</h2>
                <p>{register
                  ? "Lưu địa chỉ yêu thương, chọn món quà đậm vị Huế. Một tài khoản để mỗi lần gửi trao thêm thuận tiện."
                  : "Chắt lọc tinh hoa ẩm thực Cố Đô qua từng thức quà mộc mạc — mè xửng dẻo bùi, mứt sen Tịnh Tâm, gói trọn ân tình sông Hương núi Ngự."}</p>
              </div>
              {register && <ul className={styles.benefits}>
                <li>Lưu giữ người nhận và địa chỉ giao quà thuận tiện.</li>
                <li>Tra cứu lịch sử và theo dõi đơn hàng của bạn.</li>
                <li>Quản lý lựa chọn tiếp thị và quyền dữ liệu cá nhân.</li>
              </ul>}
            </div>
            <figure className={styles.figure}>
              <Image src={imageFailed ? "/images/product-placeholder.svg" : heritageImage} alt="Hộp quà đặc sản Huế bên ấm trà" width={640} height={320} unoptimized onError={() => { if (!imageFailed) setImageFailed(true); }} className={styles.image} />
              <figcaption>Gói trọn phong vị Cố Đô, trao gửi người thân quý.</figcaption>
            </figure>
          </aside>
          <section className={styles.content} aria-labelledby="auth-title">
            {register && <p className={styles.kicker}>Đăng ký tài khoản</p>}
            <h1 id="auth-title">{register ? "Tạo tài khoản" : "Đăng nhập"}</h1>
            <p className={styles.description}>{register
              ? "Cùng Gói Huế lưu địa chỉ, theo dõi đơn hàng và gửi trao những món quà ý nghĩa."
              : "Chào bạn trở lại. Đăng nhập để tiếp tục chọn quà và theo dõi đơn hàng."}</p>
            <form className={styles.form} aria-busy={busy} onSubmit={(e) => {
              const b = fields(e);
              if (busy) return;
              void run(async () => {
                const user = await api(`auth/${register ? "register" : "login"}`, "POST", b);
                await reload();
                router.push(user.role === "ADMIN" ? "/admin" : "/account");
              });
            }}>
              {register && <TextField label="Họ và tên" name="name" autoComplete="name" required maxLength={100} placeholder="Nhập họ và tên của bạn" />}
              <TextField label="Địa chỉ email" name="email" type="email" autoComplete="username" maxLength={150} required placeholder="Nhập địa chỉ email của bạn" />
              <div className={styles.password}>
                <TextField className={styles.passwordInput} id={passwordId} label="Mật khẩu" name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={72} required placeholder={register ? "Tạo mật khẩu từ 12–72 ký tự" : "Nhập mật khẩu của bạn"} />
                <Button className={styles.passwordToggle} size="small" variant="secondary" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-controls={passwordId} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {showPassword && <path d="m3 3 18 18" />}
                  </svg>
                </Button>
              </div>
              <Button type="submit" loading={busy} className={styles.submit}>{register ? "Tạo tài khoản" : "Đăng nhập"} <span aria-hidden="true">→</span></Button>
            </form>
            <div className={styles.links}>
              <p>{register ? "Đã có tài khoản? " : "Mới đến Gói Huế? "}<Link href={register ? "/login" : "/register"}>{register ? "Đăng nhập" : "Tạo tài khoản"}</Link></p>
              <Link href="/privacy-policy">Chính sách bảo mật</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
