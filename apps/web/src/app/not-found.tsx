import Link from "next/link";
export default function NotFound() {
  return (
    <main className="store-page">
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn có thể đã thay đổi.</p>
      <Link className="primary-link" href="/">
        Về Gói Huế
      </Link>
    </main>
  );
}
