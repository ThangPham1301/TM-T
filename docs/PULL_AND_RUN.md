# Pull và chạy giao diện Gói Huế

## Nhánh chứa phiên bản giao diện

Chạy tại thư mục có compose.yml (tên folder có thể khác trên mỗi máy):

```powershell
git status
git fetch origin
git switch codex/home-decoration-preview
git pull --ff-only origin codex/home-decoration-preview
```

Nếu chưa có nhánh local, git switch sẽ tạo nhánh theo dõi remote khi không có tên trùng. Nếu có thay đổi chưa commit, lưu/commit chúng trước; không dùng reset hard.

## Cách 1: chạy toàn bộ bằng Docker

Mở Docker Desktop, chạy tại thư mục có compose.yml:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
docker compose up -d --build
```

Mở http://localhost:3000 (không thay bằng IP LAN vì cấu hình Origin/session hiện dành cho localhost). setup.ps1 tạo .env riêng nếu chưa có; mật khẩu ADMIN nằm trong .env trên máy đó. Không gửi .env qua Git. Nếu đã có database, thay .env không tự đổi mật khẩu ADMIN đã lưu.

Sau mỗi pull có đổi frontend, chạy lại docker compose up -d --build web. docker compose up -d đơn thuần có thể vẫn dùng image cũ. Không chạy dev và container web đồng thời trên cổng 3000.

## Cách 2: phát triển frontend local

Dùng Node.js 24 (Dockerfile cũng dùng Node 24), mở terminal tại repo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
docker compose up -d --build db api
docker compose stop web
cd apps\web
npm.cmd ci
npm.cmd run dev
```

Dùng npm.cmd để tránh lỗi npm.ps1 bị PowerShell chặn. npm ci cài đúng package-lock.json đã commit. Không copy node_modules/.next từ máy khác. Muốn dùng build production, chạy npm.cmd run build rồi npm.cmd run start sau khi đã dừng dev.

## Font và ảnh giao diện

Font Be Vietnam Pro và Noto Serif nằm trong src/assets/fonts kèm giấy phép OFL. next/font/local tự đóng gói và phục vụ font; không cần cài font vào Windows, không cần tải Google Fonts khi build hoặc mở trang. Token font dùng chung toàn website. Giấy phép và nguồn font: google/fonts, các thư mục ofl/bevietnampro và ofl/notoserif.

Ảnh hero, set quà gợi ý, gallery, ảnh auth và logo tham chiếu đã lưu trong public/images/stitch. SOURCES.md lưu URL gốc. Không phụ thuộc các URL ảnh tạm của Stitch khi mở các giao diện này. Các ảnh sản phẩm tải từ API vẫn phụ thuộc dữ liệu/volume backend.

Nếu còn thấy giao diện cũ: dừng tiến trình frontend đang chạy, build/chạy lại đúng nhánh; nhấn Ctrl+F5. Kiểm tra Network có font ttf/woff và ảnh local trả 200. Không sửa tên font token bằng tên font hệ thống tùy máy.

## Những gì Git không đồng bộ

Git chuyển source, font/ảnh tĩnh và thiết kế; không chuyển database PostgreSQL, ảnh upload, tài khoản, đơn hàng hoặc .env. Máy mới có thể seed sáu sản phẩm ban đầu dù máy hiện tại đã xóa chúng trong DB. Vì vậy không thể bảo đảm sản phẩm giống hệt chỉ bằng pull.

Muốn dữ liệu giống nhau cần quy trình backup/restore PostgreSQL và volume /data (catalog/evidence) do nhóm thống nhất, ưu tiên dữ liệu thử đã ẩn danh. Không commit dump chứa dữ liệu cá nhân, credentials hoặc ảnh bằng chứng riêng tư. Nhiệm vụ push này không export/import database hoặc sửa dữ liệu.

## Kiểm tra nhanh

Home, /login, /register: font tiếng Việt, ảnh logo/hero, menu và footer. Kiểm tra /products và /admin sau khi API khởi động. Xem log khi lỗi:

```powershell
docker compose logs --tail=100 web api
```
