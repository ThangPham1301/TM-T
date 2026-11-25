"use client";

import { useRef, useState } from "react";
import { api, ApiError, fields, useStore } from "@/lib/store";
import styles from "./account-security.module.css";

const tips = [
  { icon: "key", title: "Một mật khẩu riêng", text: "Dùng mật khẩu riêng cho Gói Huế và tránh dùng lại mật khẩu của những tài khoản khác." },
  { icon: "lock", title: "Giữ thông tin đăng nhập cho bạn", text: "Không chia sẻ mật khẩu hoặc mã xác minh qua tin nhắn, điện thoại hay mạng xã hội." },
  { icon: "devices", title: "Chú ý thiết bị dùng chung", text: "Đăng xuất sau khi sử dụng máy tính công cộng hoặc thiết bị không thuộc về bạn." },
];

export function AccountSecurity() {
  const { state, busy, run } = useStore();
  const formRef = useRef<HTMLFormElement>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [newPassword, setNewPassword] = useState("");
  const score = newPassword ? Math.max(1, Number(newPassword.length >= 12) + Number(newPassword.length >= 16)
    + Number(/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) + Number(/[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword))) : 0;
  const strength = ["Chưa nhập", "Có thể cải thiện", "Trung bình", "Khá tốt", "Tốt"][score];

  function reset() { formRef.current?.reset(); setNewPassword(""); setVisible({}); setError(""); setSuccess(false); }
  const controls = [
    { name: "currentPassword", label: "Mật khẩu hiện tại", autocomplete: "current-password", hint: "Nhập mật khẩu bạn đang sử dụng." },
    { name: "newPassword", label: "Mật khẩu mới", autocomplete: "new-password", hint: "Ít nhất 12 ký tự. Ưu tiên một mật khẩu dài và riêng biệt." },
    { name: "confirmation", label: "Xác nhận mật khẩu mới", autocomplete: "new-password", hint: "Nhập lại mật khẩu mới để xác nhận." },
  ];

  return <section className={styles.security}>
    <header className={styles.heading}>
      <span className={styles.eyebrow}>{state?.user.role === "ADMIN" ? "Quản trị hệ thống" : "Tài khoản Gói Huế"}</span>
      <h1>Bảo mật tài khoản</h1>
      <p>Quản lý mật khẩu và giữ quyền truy cập tài khoản của bạn.</p>
    </header>
    {success && <div className={styles.success} role="status"><span className="material-symbols-outlined" aria-hidden="true">check_circle</span><div><strong>Đã cập nhật mật khẩu</strong><p>Bạn vẫn đăng nhập trên thiết bị này. Các phiên đăng nhập khác đã được kết thúc.</p></div></div>}
    <div className={styles.layout}>
      <section className={styles.panel} aria-labelledby="password-form-title">
        <header className={styles.panelHeading}><span className={`material-symbols-outlined ${styles.emblem}`} aria-hidden="true">lock_reset</span><div><h2 id="password-form-title">Thay đổi mật khẩu</h2><p>Kiểm tra thông tin trước khi cập nhật.</p></div></header>
        <form ref={formRef} onSubmit={event => {
          const form = event.currentTarget;
          const data = fields(event);
          setSuccess(false); setError("");
          if (data.newPassword !== data.confirmation) { setError("Mật khẩu xác nhận chưa khớp với mật khẩu mới."); return; }
          if (new TextEncoder().encode(String(data.newPassword)).length > 72) { setError("Mật khẩu quá dài. Hãy rút ngắn rồi thử lại."); return; }
          if (data.newPassword === data.currentPassword) { setError("Hãy chọn mật khẩu khác mật khẩu hiện tại."); return; }
          void run(async () => {
            try {
              await api("password", "POST", { currentPassword: data.currentPassword, newPassword: data.newPassword });
              form.reset(); setNewPassword(""); setVisible({}); setSuccess(true);
            } catch (problem) {
              setError(problem instanceof Error ? problem.message : "Chưa thể đổi mật khẩu. Bạn thử lại nhé.");
              if (problem instanceof ApiError && problem.status === 401) throw problem;
            }
          });
        }}>
          <div className={styles.fields}>{controls.map(control => <div className={styles.field} key={control.name}>
            <label htmlFor={`security-${control.name}`}>{control.label} <span aria-hidden="true">*</span></label>
            <div className={styles.inputWrap}>
              <input id={`security-${control.name}`} name={control.name} autoComplete={control.autocomplete}
                type={visible[control.name] ? "text" : "password"} required maxLength={72} disabled={busy}
                minLength={control.name === "currentPassword" ? undefined : 12}
                {...(control.name === "newPassword" ? { value: newPassword, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setNewPassword(event.target.value) } : {})}
                aria-describedby={`security-${control.name}-hint`} />
              <button type="button" aria-label={`${visible[control.name] ? "Ẩn" : "Hiện"} ${control.label.toLocaleLowerCase("vi")}`}
                aria-pressed={Boolean(visible[control.name])} disabled={busy} onClick={() => setVisible(current => ({ ...current, [control.name]: !current[control.name] }))}>
                <span className="material-symbols-outlined" aria-hidden="true">{visible[control.name] ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
            <small id={`security-${control.name}-hint`}>{control.hint}</small>
            {control.name === "newPassword" && <div className={styles.strength} data-score={score}>
              <div className={styles.bars} aria-hidden="true">{[0,1,2,3].map(index => <span key={index} data-filled={index < score} />)}</div>
              <span aria-live="polite">{strength}</span>
            </div>}
          </div>)}</div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <p className={styles.sessionNote}><span className="material-symbols-outlined" aria-hidden="true">verified_user</span>Đổi mật khẩu sẽ kết thúc các phiên đăng nhập khác, giữ lại phiên trên thiết bị này.</p>
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={reset}>Đặt lại</button><button className={styles.primary} disabled={busy}>{busy ? "Đang cập nhật…" : "Đổi mật khẩu"}<span aria-hidden="true">→</span></button></div>
        </form>
      </section>
      <aside className={styles.tips} aria-label="Lưu ý bảo mật">
        <span className={styles.eyebrow}>Giữ trọn chữ tin</span><h2>Thói quen nhỏ,<br />tài khoản an tâm.</h2>
        <p>Một vài lưu ý khi sử dụng tài khoản Gói Huế.</p>
        {tips.map(tip => <div className={styles.tip} key={tip.title}><span className="material-symbols-outlined" aria-hidden="true">{tip.icon}</span><div><h3>{tip.title}</h3><p>{tip.text}</p></div></div>)}
      </aside>
    </div>
  </section>;
}
