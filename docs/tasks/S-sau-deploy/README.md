# Đợt S — Việc còn lại sau khi test production (19/11/2026)

> 👉 **Mới nhận việc? Đọc [BAT-DAU-TU-DAY.md](BAT-DAU-TU-DAY.md) trước**: lấy code, cài môi trường, đọc gì, nhờ AI làm thế nào, xong thì làm gì.

> Thiện đã sửa xong 20/28 lỗi tìm thấy sau khi deploy (nhánh `fix/loi-sau-deploy`, 9 commit, TASK_68–74).
> Thư mục này là **phần còn lại**, chia cho 3 người. Mỗi file `S0x-*.md` là một task trọn vẹn:
> **mở Claude Code (hoặc AI khác) trong repo, dán đường dẫn file và nói "làm theo file này"**.
> Người làm vẫn nên đọc mục "Vì sao" và "Đang làm gì" để hiểu và trả lời được câu hỏi bảo vệ.

## 1. Phân công

| Gói | Người | Task | Nội dung | Ước lượng |
| :-- | :-- | :-- | :-- | :-- |
| **1. Realtime và tốc độ** | Người 1: ____ | [S01](S01-backend-su-kien-realtime.md) → [S02](S02-frontend-mot-ket-noi-realtime.md) → [S03](S03-tao-task-khong-lag.md) | Backend phát đủ sự kiện; frontend dùng 1 kết nối realtime và tự làm mới đúng chỗ; tạo task không lag | 2,5–3 ngày |
| **2. Nghiệp vụ backend** | Người 2: ____ | [S04](S04-mo-lai-task-da-xong.md) → [S05](S05-don-task-mo-coi.md) → [S06](S06-ai-thoi-gian-cho.md) → [S07](S07-viewer-va-test-demo.md) | Mở lại task đã Done; dọn task mồ côi cũ; nới thời gian chờ AI và test AI; chốt quyền Viewer | 2,5–3 ngày |
| **3. Giao diện** | Người 3: ____ | [S08](S08-trang-khach-them-du-lieu.md) → [S09](S09-tim-kiem.md) → [S10](S10-don-giao-dien-con-sot.md) | Trang khách có thêm dữ liệu; tìm kiếm; dọn các lỗi giao diện nhỏ còn sót | 2,5–3 ngày |
| **Chờ Thiện chốt** | chưa giao | [S11](S11-quan-he-phase-qua-ghost.md) | Bỏ quan hệ cha-con giữa phase, dùng ghost thay thế | — |

Ánh xạ với báo cáo lỗi gốc (số # là thứ tự trong danh sách lỗi Thiện gửi):

| Lỗi gốc | Task |
| :-- | :-- |
| #4 Tạo task bị lag | S03 (cần S01, S02 trước) |
| #13 Overview đếm dư node | S05 |
| #18 Quan hệ cha-con phase qua ghost | S11 (chờ chốt) |
| #22 Mở lại task đã Done, artifact tính sao | S04 |
| #25 Trang khách ít dữ liệu | S08 |
| #26 Realtime | S01, S02 |
| #27 Tìm kiếm | S09 |
| #28 AI, giới hạn thời gian chạy | S06 |
| Điểm còn sót sau TASK_68–74 | S07 (quyền Viewer, test API demo), S10 (giao diện) |

## 2. Thứ tự và đụng file

- Mỗi gói làm **tuần tự** trong gói (S01 → S02 → S03…). 3 gói chạy **song song** được.
- Chỗ dễ đụng nhau, ai merge sau thì rebase:
  - `FE/hooks/usePhaseKanban.ts`: S02 (bỏ phần SSE riêng) và S04 (thêm hàm mở lại task).
  - `FE/views/ProjectWorkspaceView.tsx`: S02 (gắn bộ nghe realtime của dự án), S09 (ô tìm kiếm trên header), S10 (dời nút demo lên header).
  - `BE/service/WorkflowGraphService.java`: S01 (phát sự kiện ở các hàm phase) và S05 (có thể dùng lại `recomputeNodeStatus`).
  - Migration Flyway: chỉ S04 thêm `V22`. Task khác cần migration thì lấy số kế tiếp **sau khi pull**, không đoán.
- S03 cần S01 (sự kiện có `actorUserId`) và S02 (hub realtime) xong trước.

## 3. Chuẩn bị (mỗi người làm 1 lần)

1. Lấy code mới nhất:
   - `fix/loi-sau-deploy` đã merge vào `main`: tạo nhánh từ `main`.
   - Chưa merge: tạo nhánh từ `fix/loi-sau-deploy`.
   - Tên nhánh: `s0x-ten-ngan`, ví dụ `s04-mo-lai-task`.
2. Chạy test **trước khi sửa** để biết mốc. Lúc viết README: frontend 875 test, backend 1037 test, tất cả xanh.
3. **Lưu ý quan trọng trên Windows:** test frontend (vitest 5) phải chạy từ đường dẫn ổ `C:` viết HOA. VS Code hay mở ở `c:\...` (chữ thường), khi đó mọi file test báo `Cannot read properties of undefined (reading 'config')`. Đây là lỗi môi trường, không phải lỗi code. Cách chạy đúng (PowerShell):
   ```powershell
   Set-Location 'C:\<đường dẫn repo>\wpe-frontend'; npx tsc -b; npx vitest run
   ```
   Backend: `cd wpe-backend && ./mvnw -q test`. Đếm số test bằng cách cộng `Tests run` trong `target/surefire-reports/*.txt` (xóa thư mục report cũ trước khi chạy).

## 4. Dựng stack production thử trên máy (để test bằng tay)

Không dùng `deploy/.env` thật. Tạo file env thử riêng **ngoài repo**, ví dụ `C:\temp\wpe-test.env`, lấy khuôn từ `deploy/prod.env.example`. Tự điền mật khẩu ngẫu nhiên, và đặt thêm:
```
WEB_PORT=8095
DEMO_TOOLS_ENABLED=true
APP_PUBLIC_URL=http://localhost:8095
SEED_ACCOUNT_PASSWORD=<ít nhất 12 ký tự, có chữ số>
```
Chạy (dùng tên project riêng `wpe-test` để không đụng dữ liệu stack khác):
```bash
COMPOSE_BAKE=false docker compose -p wpe-test -f docker-compose.prod.yml --env-file C:/temp/wpe-test.env up -d --build
```
- `COMPOSE_BAKE=false` là bắt buộc. Không có nó, buildx đòi quyền đọc `deploy/frontend.Dockerfile` và build dừng.
- Mở `http://localhost:8095`. **Đăng nhập bằng email** (không nhận username): `alex.kim@pipeline.engine` (Owner dự án mẫu), `sarah.chen@pipeline.engine` (Collaborator), `admin@pipeline.engine`. Mật khẩu là `SEED_ACCOUNT_PASSWORD` bạn tự đặt.
- **Công cụ demo:** Owner bấm nút tròn **D** ở giữa cạnh dưới (hoặc Ctrl+Shift+D) để làm task quá hạn ngay, ép trạng thái task, hoàn thành cả phase, xóa thời gian chờ AI, cho link khách hoặc lời mời hết hạn, gửi thông báo thử.
- Kiểm toàn luồng cũ có bị hỏng không: `E2E_SEED_PASSWORD=<mật khẩu đã đặt> node .kb/tools/e2e-prod.mjs http://localhost:8095` (thư mục `.kb/` chỉ có trên máy Thiện; nếu không có thì bỏ qua bước này, báo Thiện chạy).
- Tắt stack: `docker compose -p wpe-test -f docker-compose.prod.yml down`.

## 5. Luật chung (áp dụng cho mọi task S)

- Chỉ sửa file trong mục "Được ghi" của task. Cần sửa file dùng chung khác (types, contract, cấu hình) thì hỏi Thiện trước.
- Không đọc, in hay commit `.env*`, khóa, mật khẩu, API key. Không `git add -f`, không `git add .` khi còn file lạ.
- Đọc code liên quan trước khi sửa, không đoán tên hàm, API, kiểu dữ liệu.
- Không xóa test, không `@Disabled`/`skip`, không nới assert. Test cũ phải đổi vì hành vi đổi đúng theo task thì ghi rõ lý do trong báo cáo.
- Giao diện viết tiếng Anh như phần còn lại của app; comment trong code viết tiếng Việt có dấu như code hiện có. File mới lưu UTF-8 **không BOM**.
- Báo cáo đúng sự thật: test lỗi thì nói lỗi, chưa chạy thì nói chưa chạy, không tự nghĩ ra số.
- Làm xong: đổi `Trạng thái:` trong file task thành `chờ kiểm`, điền mục "Ghi chép của người làm", tạo PR vào `main`. Thiện review rồi mới ghi `xong`.

## 6. Theo dõi tiến độ

Các file ở đây dùng mã 2 chữ số (S01…S11) nên `docs/tasks/tien-do.mjs` **không đọc**. Mỗi người tự cập nhật dòng `Trạng thái:` trong file task và cột dưới đây khi đổi trạng thái:

| Task | Trạng thái | PR |
| :-- | :-- | :-- |
| S01 | chưa làm | |
| S02 | chưa làm | |
| S03 | chưa làm | |
| S04 | chưa làm | |
| S05 | chưa làm | |
| S06 | chưa làm | |
| S07 | chưa làm | |
| S08 | chưa làm | |
| S09 | chưa làm | |
| S10 | chưa làm | |
| S11 | chờ Thiện chốt | |
