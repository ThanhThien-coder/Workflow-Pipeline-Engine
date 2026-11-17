# Workflow Pipeline Engine — AI Microservice

> **Phân hệ**: AI Intelligence & Diagnostics Microservice  
> **Dự án**: Workflow-Pipeline-Engine (WPE)  
> **Công nghệ**: Python 3.11+, FastAPI, Google Gemini API (`gemini-3.8-flash`, dự phòng `gemini-3.1-flash-lite`), Network DAG / CPM  
> **Cổng mặc định**: `8081`  
> **Hợp đồng tích hợp SSOT**: [`docs/specs/ai-service-contract.md`](../docs/specs/ai-service-contract.md)

---

## 1. Giới Thiệu Tổng Quan

Microservice này đóng vai trò là **"Trợ lý Cố vấn Kỹ thuật & Bác sĩ Pháp y Dự án"**, là dịch vụ nội bộ chỉ được gọi từ Backend Spring Boot 3 (`HttpAiServiceClient`) khi người dùng bấm nút **"AI Diagnosis"**.

Hệ thống hoạt động theo **Mô hình 2 Tầng (Two-Tier Intelligence)**:
- **TẦNG 1: Thuật toán đồ thị & định lượng nội bộ (< 10ms, 0 Token)**:
  - Xác thực DAG bằng **thuật toán Kahn**; nếu có chu trình sẽ trả `criticalPath = []` kèm cảnh báo và bottleneck `HIGH` chỉ rõ các node tạo vòng.
  - Tính toán đường găng **CPM (Critical Path Method)**: `ES`, `EF`, `LS`, `LF`, `Slack`.
  - Phát hiện **Task ngâm lâu (Stalled Node)**: node `IN_PROGRESS` có số giờ đồng hồ kể từ `startedAt` theo múi giờ `Asia/Ho_Chi_Minh` (**trừ khung 0h–7h mỗi đêm**) lớn hơn `2.5 × estimatedHours`.
  - Phát hiện **Task quá hạn (Overdue Node)**.
  - Tính toán Velocity dựa trên `completedLast7Days` (theo `completedAt` trong 7 ngày gần nhất), trạng thái `INSUFFICIENT_DATA` (chưa có task DONE), `OVERDUE` (`overdueDays`, `remainingTasks`), và điểm lệch quỹ đạo **Drift Score**.
- **TẦNG 2: Google Gemini AI (Structured Output JSON qua `response_schema`, `temperature = 0.2`)**:
  - Ép cấu trúc trả về bằng Pydantic `response_schema` với `Literal[...]` cho `action`, `trapType`, `priority` và timeout 15 giây.
  - Chống Prompt Injection bằng `system_instruction` tách biệt và bọc toàn bộ dữ liệu người dùng trong khối `<UNTRUSTED_DATA>...</UNTRUSTED_DATA>`.
  - Kiểm lọc hậu kỳ (Output Validation): mọi `nodeCode` / `targetNodeCode` ngoài request (trừ `"GENERAL"`) hoặc enum sai đều bị loại bỏ và ghi log; lỗi kiểu dữ liệu tự chuyển về `HEURISTIC_FALLBACK` an toàn (không bao giờ trả HTTP 500).
  - Trả `rootCauseNotes` thành trường riêng biệt, gom mọi cảnh báo vào trường `warning`.

---

## 2. Cài Đặt & Khởi Động

### Bước 1: Cài đặt thư viện (đã ghim phiên bản)
```bash
cd wpe-ai-service
pip install -r requirements.txt
```

### Bước 2: Cấu hình biến môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```
Các biến chính:
```env
HOST=0.0.0.0
PORT=8081
APP_RELOAD=false
AI_INTERNAL_KEY=
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=12000
GEMINI_TOTAL_TIMEOUT_MS=25000
GEMINI_THINKING_LEVEL=LOW
GEMINI_THINKING_BUDGET=256
```
- Khi `AI_INTERNAL_KEY` được đặt giá trị, mọi request tới `/api/ai/diagnose` và `/api/ai/scaffold-dag` bắt buộc có header `X-Internal-Key` khớp chính xác (sai hoặc thiếu trả `401 Unauthorized`).
- Gọi lần lượt `GEMINI_MODEL` rồi các model trong `GEMINI_FALLBACK_MODEL`: model trước lỗi (503 quá tải, 504, 429, 404, quá giờ, JSON hỏng) thì gọi model sau; lỗi key (401/403) thì dừng. `tokenUsage.model` ghi model đã trả lời.
- Nếu không có `GEMINI_API_KEY` hoặc mọi model đều lỗi (rate limit 429 / lỗi mạng), service tự chuyển sang `source = "HEURISTIC_FALLBACK"` kèm `tokenUsage.source = "HEURISTIC_FALLBACK"`.

### Bước 3: Khởi động Microservice
```bash
python run.py
```
Hoặc bật auto-reload khi dev cục bộ:
```bash
APP_RELOAD=true python run.py
```
Các endpoint kiểm tra vận hành:
- Liveness: `GET http://localhost:8081/health`
- Readiness: `GET http://localhost:8081/ready`
- Swagger UI: `http://localhost:8081/docs`

### Chạy bằng Docker
`docker-compose.prod.yml` đã sử dụng sẵn `deploy/ai-service.Dockerfile`. Để build lẻ:
```bash
docker build -f ../deploy/ai-service.Dockerfile -t wpe-ai-service .
docker run -p 8081:8081 -e GEMINI_API_KEY=... -e AI_INTERNAL_KEY=... wpe-ai-service
```

---

## 3. Chạy Kiểm Thử (Unit Tests)

Bộ test sử dụng Gemini giả lập (mock), chạy hoàn toàn độc lập không gọi mạng thật kể cả khi máy có key:
```bash
cd wpe-ai-service
GEMINI_API_KEY="" python -m unittest discover -s tests -p "test_*.py"
```
Trên PowerShell (Windows):
```powershell
cd wpe-ai-service
$env:GEMINI_API_KEY=""; python -m unittest discover -s tests -p "test_*.py"
```

---

## 4. Tích Hợp với Spring Boot Backend (Java)

1. Khởi động microservice Python trên cổng `8081` (kèm `AI_INTERNAL_KEY` nếu dùng khóa nội bộ).
2. Khởi động Backend Spring Boot với cùng `AI_INTERNAL_KEY`:
   - **PowerShell (Windows)**:
     ```powershell
     $env:SPRING_PROFILES_ACTIVE="dev"; $env:AI_MODE="http"; $env:AI_SERVICE_URL="http://localhost:8081"; $env:AI_INTERNAL_KEY="example-internal-key"; ./mvnw spring-boot:run
     ```
   - **Linux / macOS**:
     ```bash
     SPRING_PROFILES_ACTIVE=dev AI_MODE=http AI_SERVICE_URL=http://localhost:8081 AI_INTERNAL_KEY=example-internal-key ./mvnw spring-boot:run
     ```
3. Mở giao diện Web Frontend hoặc Swagger UI Backend và bấm **"AI Diagnosis"**.
