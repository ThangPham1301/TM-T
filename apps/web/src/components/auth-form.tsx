"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, fields, useStore } from "@/lib/store";
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter(),
    { busy, run, reload } = useStore();
  return (
    <main className="auth-page">
      <div className="auth-frame">
        <aside className="auth-story">
          <span className="story-badge">Tài khoản Gói Huế</span>
          <p className="story-kicker">Tri kỷ Cố Đô</p>
          <h2>
            Gói trọn phong vị,
            <br />
            gửi trao yêu thương.
          </h2>
          <p>
            Một tài khoản để mua sắm, theo dõi đơn hàng và quản lý quyền dữ liệu
            cá nhân.
          </p>
        </aside>
        <section className="auth-content">
          <span className="eyebrow">Chào mừng bạn</span>
          <h1>{register ? "Đăng ký tài khoản" : "Đăng nhập"}</h1>
          <p className="lead">Tiếp tục hành trình cùng Gói Huế.</p>
          <form
            className="store-form"
            onSubmit={(e) => {
              const b = fields(e);
              void run(async () => {
                const user = await api(
                  `auth/${register ? "register" : "login"}`,
                  "POST",
                  b,
                );
                await reload();
                router.push(user.role === "ADMIN" ? "/admin" : "/account");
              });
            }}
          >
            {register && (
              <label>
                Họ tên
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                maxLength={150}
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={12}
                maxLength={72}
                required
              />
            </label>
            <small>Mật khẩu ít nhất 12 ký tự, tối đa 72 byte.</small>
            <button disabled={busy} className="primary-button">
              {register ? "Tạo tài khoản" : "Đăng nhập"}
            </button>
          </form>
          <p>
            {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Đăng nhập" : "Đăng ký"}
            </Link>
          </p>
          <p className="store-subtle">
            Tìm hiểu cách Gói Huế xử lý dữ liệu tại{" "}
            <Link href="/privacy-policy">Chính sách bảo mật</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
