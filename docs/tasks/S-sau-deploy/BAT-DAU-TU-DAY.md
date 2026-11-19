# Bắt đầu từ đây — hướng dẫn cho 3 bạn nhận việc đợt S

> Đọc hết file này một lượt (khoảng 10 phút) rồi làm theo từng bước. Kẹt ở đâu thì xem mục 9, vẫn kẹt thì hỏi Thiện.

## 0. Bối cảnh trong 30 giây
- Sau khi deploy production và test thật, Thiện tìm ra 28 lỗi. 20 lỗi đã sửa xong trên nhánh **`fix/loi-sau-deploy`** (9 commit, đã test trên stack production thử: unit test, API, giao diện thật).
- **8 lỗi còn lại cộng vài điểm sót** được chia thành 11 task (S01–S11) cho 3 bạn, nằm trong thư mục này.
- Mỗi task là **một file `.md` viết sẵn cho AI làm**: bạn mở Claude Code trong repo, đưa đường dẫn file, AI làm theo. Bạn vẫn phải hiểu mình đang làm gì: đọc phần "Vì sao", tự làm "Bước 0", kiểm bằng tay, trả lời được "Câu hỏi bảo vệ".

## 1. Xem mình là ai, làm task nào
Mở [README.md](README.md) mục 1 (bảng phân công), tìm tên mình:

| Người | Gói | Làm theo thứ tự | Đọc nền trước khi làm |
| :-- | :-- | :-- | :-- |
| Người 1 | Realtime và tốc độ | S01 → S02 → S03 | `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (tìm "SSE", "realtime"); `docs/tasks/C-thuc-thi/C2-realtime-rabbitmq.md` (mục "Vì sao", "Đặc tả") |
| Người 2 | Nghiệp vụ backend | S04 → S05 → S06 → S07 | `docs/specs/workflow-engine.md` (máy trạng thái 5 bước, mở khóa task); `docs/specs/ai-diagnostics.md` (cho S06) |
| Người 3 | Giao diện | S08 → S09 → S10 | `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (tìm "guest"); mở app chạy thử, bấm qua mọi màn trong một dự án |

S11 chưa giao (chờ Thiện chốt phương án). Ai xong sớm thì hỏi Thiện để nhận.

## 2. Lấy code về (5 phút)
```bash
git fetch origin
git checkout fix/loi-sau-deploy        # nếu Thiện báo đã merge vào main thì dùng: git checkout main
git pull
git checkout -b s04-mo-lai-task        # đổi theo task của bạn: s01-..., s08-...
```
Tên nhánh ghi sẵn ở dòng `Nhánh git:` đầu mỗi file task.

## 3. Cài môi trường (bỏ qua nếu máy đã chạy được dự án)
Làm theo [docs/TEAM_DEVELOPMENT_GUIDE.md](../../TEAM_DEVELOPMENT_GUIDE.md) **Phần 1** (công cụ phải cài) và **Phần 2** (thiết lập từ A đến Z).

Phiên bản cần có (theo CI):
- **JDK 17** (Temurin);
- **Node 22** (vitest 5 đòi Node ≥ 22.12);
- **Docker Desktop**;
- **Python 3** nếu làm S06 (chỉ để chạy test AI service);
- **Claude Code** (hoặc AI code khác đọc được file trong repo).

Cài thư viện frontend lần đầu: `cd wpe-frontend && npm ci`.

## 4. Đọc theo thứ tự (30–45 phút, trước khi đụng code)
1. [README.md](README.md): đọc hết, nhất là mục 2 (task nào đụng file của ai), mục 4 (dựng stack thử), mục 5 (luật chung).
2. File task **đầu tiên** của bạn: đọc kỹ "Vì sao", "Đang làm gì", "Đặc tả đã chốt", "Tiêu chí xong".
3. Tài liệu nền của gói (bảng mục 1).
4. Những gì Thiện vừa sửa (để biết code mới nằm đâu): `git log --oneline main..fix/loi-sau-deploy`, rồi `git show --stat <mã commit>` với commit liên quan tới gói của bạn.
5. Làm **Bước 0** trong file task: tự đọc code và tự trả lời câu hỏi. Ghi câu trả lời vào mục "Ghi chép của người làm" cuối file.

> Dòng `Thiện chốt: ___` trong file task (S04, S06, S07, S11) mà còn trống thì **hỏi Thiện trước khi code**. AI cũng được dặn dừng lại ở đó.

## 5. Chạy test mốc trước khi sửa (10–15 phút)
**Quan trọng trên Windows:** test frontend phải chạy từ đường dẫn ổ `C:` **viết hoa**. VS Code thường mở `c:\...` (chữ thường), khi đó mọi file test báo `Cannot read properties of undefined (reading 'config')`. Đây là lỗi môi trường, không phải lỗi code.

```powershell
# Frontend (PowerShell)
Set-Location 'C:\<đường dẫn tới repo>\wpe-frontend'
npx tsc -b
npx vitest run          # mốc lúc giao việc: 875 test, tất cả xanh
```
```bash
# Backend
cd wpe-backend
rm -rf target/surefire-reports && ./mvnw -q test   # mốc: 1037 test, 0 lỗi
```
Ghi số test mốc vào "Ghi chép" của task. Nếu mốc đã đỏ trước khi sửa thì báo Thiện, đừng làm tiếp.

## 6. Chạy app để xem và kiểm bằng tay
Làm theo [README.md](README.md) mục 4: dựng stack production thử trên cổng **8095**, bật sẵn công cụ demo.

Ba điều hay quên:
- Phải có `COMPOSE_BAKE=false` trước lệnh `docker compose` (thiếu là build dừng giữa chừng).
- Đăng nhập bằng **email** (`alex.kim@pipeline.engine`…), không phải username.
- Nút tròn **D** (hoặc Ctrl+Shift+D) là công cụ demo: làm task quá hạn ngay, ép trạng thái, hoàn thành cả phase…, rất tiện khi kiểm bằng tay.

Sửa code xong muốn xem lại: build lại đúng phần đã sửa.
```bash
COMPOSE_BAKE=false docker compose -p wpe-test -f docker-compose.prod.yml --env-file C:/temp/wpe-test.env up -d --build --no-deps frontend   # hoặc backend
```

## 7. Làm task với AI
Mở Claude Code ở **thư mục gốc repo**, dán câu sau (đổi tên file):
```
Tôi là người làm task docs/tasks/S-sau-deploy/S04-mo-lai-task-da-xong.md.
Đọc docs/tasks/S-sau-deploy/README.md rồi đọc file task đó, làm đúng theo mục "Dành cho Claude".
Câu trả lời Bước 0 của tôi: <dán câu trả lời>.
```
Các ký hiệu trong file task:
- **🧠**: bạn tự làm (đọc hiểu, trả lời, đo, kiểm bằng tay). AI chỉ gợi ý.
- **🤝**: AI làm code; bạn đọc lại diff, hỏi AI chỗ nào không hiểu, tự chạy test.
- **Được ghi**: chỉ những file này được sửa. AI đòi sửa file ngoài danh sách thì dừng, hỏi Thiện.

Sau mỗi bước 🤝, bạn tự chạy test (mục 5). AI báo "xong" mà test đỏ thì chưa xong.

## 8. Xong task thì làm gì
1. Kiểm đủ các ô trong "Tiêu chí xong", kể cả phần kiểm bằng tay.
2. Điền "Ghi chép của người làm": đã làm gì, số test trước/sau, điều chưa chắc. S03 phải có số đo thật trước/sau.
3. Đổi dòng `Trạng thái:` thành `chờ kiểm`, cập nhật bảng ở [README.md](README.md) mục 6.
4. Commit nhỏ, mỗi commit một việc. Message theo mẫu lịch sử repo, ví dụ `fix(be): ...`, `feat(fe): ...`.
   - Thêm file bằng tên: `git add <file>`. Không `git add .`, không `git add -f`.
   - Không commit `.env*`.
5. Push nhánh, tạo PR **vào đúng nhánh bạn đã tách ra** (bước 2). Mô tả PR ghi: task S0x, tóm tắt, số test, ảnh trước/sau nếu là giao diện. Checklist trước khi tạo PR: [TEAM_DEVELOPMENT_GUIDE.md](../../TEAM_DEVELOPMENT_GUIDE.md) Phần 7.
6. Báo Thiện review. Thiện hỏi "Câu hỏi bảo vệ" cuối file task, trả lời được mới tính xong.
7. Làm task kế tiếp: tạo nhánh mới từ nhánh gốc **sau khi pull**. Nếu task trước chưa merge mà task sau cần nó thì tách từ nhánh task trước.

## 9. Gặp lỗi thường gặp
| Hiện tượng | Cách xử lý |
| :-- | :-- |
| Mọi file test frontend lỗi `reading 'config'` | Chạy lại từ `C:\...` viết hoa (mục 5) |
| `docker compose ... --build` báo `additional privileges requested` | Thêm `COMPOSE_BAKE=false` trước lệnh |
| Đăng nhập báo sai mật khẩu dù đúng | Phải nhập **email**, không nhập username |
| Cổng 8095 đang bận | Đổi `WEB_PORT` trong file env thử, mở cổng mới |
| Backend không lên, log báo `SEED_ACCOUNT_PASSWORD` | Thêm biến này vào file env thử (≥12 ký tự, có số) |
| Flyway báo trùng số migration (V22…) | Pull mới nhất, đổi file của mình sang số kế tiếp chưa dùng; **không** sửa migration đã có |
| Conflict khi rebase ở `usePhaseKanban.ts`, `ProjectWorkspaceView.tsx`, `WorkflowGraphService.java` | Bình thường (README mục 2). Giữ phần của cả hai bên, chạy lại test |
| AI đòi đọc `.env` hoặc bạn định dán API key vào chat | Không làm. Key chỉ để trong file env thử ngoài repo |
| Không hiểu một đoạn code | Hỏi AI "giải thích đoạn này làm gì, ai gọi nó", rồi tự viết lại bằng lời vào Ghi chép |

## 10. Liên hệ
- Câu hỏi nghiệp vụ, các dòng "Thiện chốt", review PR: **Thiện**.
- Phần Python AI (`wpe-ai-service`, liên quan S06): **Abdul**.
