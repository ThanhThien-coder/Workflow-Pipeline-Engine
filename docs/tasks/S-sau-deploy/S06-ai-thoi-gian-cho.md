# S06 — AI: nới thời gian chờ cho mạng server chậm, cho chỉnh cooldown, test AI thật

Người làm: Người 2 (gói Nghiệp vụ backend) — phần Python báo Abdul (người phụ trách `wpe-ai-service`) trước khi sửa
Người review: Thiện
Trạng thái: xong
Cần có trước: không (Bước 0 cần Thiện chốt số)
Mở khóa: không
Nhánh git: s06-ai-thoi-gian-cho
Ước lượng: 0,5 ngày

## Vì sao cần task này (lỗi gốc #28)
AI chưa được test trên server. Mạng server chậm nên dễ hết giờ chờ. Các giới hạn hiện có:

| Chỗ | Giá trị | Ở đâu | Đổi bằng biến môi trường? |
| :-- | :-- | :-- | :-- |
| Backend chờ kết nối tới AI service | 3 giây | `application.yml` `app.ai.connect-timeout-seconds` | `AI_CONNECT_TIMEOUT_SECONDS`, nhưng **`docker-compose.prod.yml` chưa truyền** |
| Backend chờ AI service trả lời | 30 giây | `app.ai.read-timeout-seconds` | `AI_READ_TIMEOUT_SECONDS`, **chưa truyền** |
| AI service chờ Gemini mỗi lần thử | 12 giây | `wpe-ai-service/app/config.py` `GEMINI_TIMEOUT_MS` | có, compose đã truyền |
| AI service chờ cả lượt (gồm model dự phòng) | 25 giây | `GEMINI_TOTAL_TIMEOUT_MS` | có |
| Thời gian chờ giữa 2 lần bấm phân tích | 180 giây | `app.ai.cooldown-seconds: 180` | **không**, ghi cứng |
| nginx, Caddy, frontend | 3600s / không giới hạn / không timeout | — | không phải nút thắt |

Thiện muốn "xóa giới hạn". **Không nên bỏ hẳn** (vô hạn): mỗi lần phân tích giữ 1 luồng xử lý của backend và giữ chỗ chống bấm trùng cho tới khi xong. Gemini treo thì luồng treo mãi. Cách đúng là **nới rộng** và cho chỉnh bằng biến môi trường.

## Đang làm gì (tóm tắt cho người đọc)
1. Nới các giới hạn lên mức chịu được mạng chậm. Đưa hết ra biến môi trường trong compose.
2. Cho chỉnh thời gian chờ giữa 2 lần phân tích (lúc demo đặt 0–30 giây).
3. Test AI thật bằng key Gemini trên stack thử, ghi lại thời gian chạy đo được.

## Bước 0 — Thiện chốt số
Đề xuất (Thiện sửa nếu muốn): backend connect 5s, read **180s**; Gemini mỗi lần thử **90000ms**, cả lượt **170000ms** (phải nhỏ hơn read của backend); cooldown mặc định **60s**.

`Thiện chốt (19/11): connect 5 s, read 180 s, Gemini mỗi lần 90000 ms, cả lượt 170000 ms, cooldown 60 s; ĐƯỢC sửa wpe-ai-service/app/config.py; CHƯA test AI thật (bỏ bước 4 của Việc cần làm, ghi rõ trong Ghi chép)`

## Được đọc
- `wpe-backend/src/main/java/com/pipeline/wpe/service/ai/**`, `wpe-backend/src/main/resources/application.yml`, `wpe-ai-service/app/**`, `docker-compose.prod.yml`, `deploy/prod.env.example`, `docs/DEPLOY.md`, `docs/specs/ai-diagnostics.md`, `wpe-frontend/src/components/popovers/AiDiagnosisPopover.tsx`, `wpe-frontend/src/store/slices/overviewSlice.ts`

## Được ghi
- `wpe-backend/src/main/resources/application.yml` (chỉ khối `app.ai`)
- `docker-compose.prod.yml` (chỉ biến môi trường của `backend` và `ai-service`), `deploy/prod.env.example`
- `wpe-ai-service/app/config.py` (chỉ giá trị mặc định và comment của 2 biến timeout) — báo Abdul trước
- `wpe-frontend/src/components/popovers/AiDiagnosisPopover.tsx` (chỉ dòng chữ báo "có thể mất tới ~3 phút" khi đang phân tích)
- `docs/DEPLOY.md`, `docs/specs/ai-diagnostics.md` (cập nhật số), test liên quan, file task này

## Đặc tả đã chốt
- `application.yml`:
  - `cooldown-seconds: ${AI_COOLDOWN_SECONDS:<số chốt>}`;
  - `connect-timeout-seconds: ${AI_CONNECT_TIMEOUT_SECONDS:<số chốt>}`;
  - `read-timeout-seconds: ${AI_READ_TIMEOUT_SECONDS:<số chốt>}`.
- `docker-compose.prod.yml`:
  - service `backend` thêm `AI_CONNECT_TIMEOUT_SECONDS`, `AI_READ_TIMEOUT_SECONDS`, `AI_COOLDOWN_SECONDS` dạng `${BIEN:-<số chốt>}`;
  - service `ai-service` đổi mặc định `GEMINI_TIMEOUT_MS`, `GEMINI_TOTAL_TIMEOUT_MS` theo số chốt.
- `config.py`: mặc định theo số chốt; giữ comment "tổng phải nhỏ hơn read-timeout của backend" và cập nhật số trong comment.
- `prod.env.example`: thêm 3 biến backend kèm comment; sửa comment "backend chờ 30 giây".
- Không đổi logic gọi AI, logic giữ chỗ chống bấm trùng, logic trả 503.

## Việc cần làm
1. 🧠 Bước 0 (Thiện chốt số). Đọc `HttpAiServiceClient` và `gemini_client.py`, trả lời: model đầu chạy hết thời gian thì model dự phòng còn bao nhiêu thời gian?
2. 🤝 Sửa cấu hình như Đặc tả. Chạy `./mvnw -q test` và test Python (`cd wpe-ai-service && python -m pytest`, nếu có).
3. 🤝 Chữ trên popover AI khi đang chạy.
4. 🧠 **Test AI thật** trên stack thử (README mục 4):
   - thêm `GEMINI_API_KEY=<key của bạn>` vào file env thử **ngoài repo**, **không commit, không dán vào chat**;
   - bấm Re-scan ở Overview;
   - xem log `docker compose -p wpe-test -f docker-compose.prod.yml logs ai-service backend --since 5m`.

   Ghi vào Ghi chép: thời gian thật từ lúc bấm tới lúc có kết quả, model nào trả lời, có lỗi gì. Nếu log báo model không tồn tại (mặc định `GEMINI_MODEL=gemini-3.8-flash`, dự phòng `gemini-3.1-flash-lite`), tra trang danh sách model của Google rồi báo Thiện tên đúng. Không tự đoán tên model.

## Tiêu chí xong
- [ ] `./mvnw -q test` xanh; `docker compose -f docker-compose.prod.yml config` chạy không lỗi.
- [ ] Đổi `AI_COOLDOWN_SECONDS=0` trong env thử → bấm phân tích 2 lần liền đều chạy (không 429).
- [ ] Có số đo thật lần test AI trong Ghi chép (hoặc ghi rõ "chưa có key nên chưa test được").

## Câu hỏi bảo vệ
1. Vì sao tổng thời gian chờ Gemini phải nhỏ hơn thời gian backend chờ AI service?
2. Vì sao không đặt thời gian chờ vô hạn?
3. Cooldown chống điều gì? Vì sao lúc demo có thể đặt 0?

## Cấm
- Commit, in, dán API key hoặc file `.env*`. Đổi logic AI ngoài cấu hình. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5.
- Dòng "Thiện chốt" còn trống thì hỏi người làm số, không tự chọn (có thể nhắc số đề xuất).
- Không bao giờ yêu cầu người làm dán API key vào chat. Bước test AI thật do người làm tự chạy và báo kết quả.
- Làm xong: ghi chép, `chờ kiểm`, hỏi 3 câu bảo vệ.

## Ghi chép của người làm

- Xem .kb/tasks/TASK_80.report.md. Chưa test AI thật (Thiện chốt bỏ). Chưa kiểm tay.
