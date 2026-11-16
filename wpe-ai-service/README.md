# Workflow Pipeline Engine — AI Microservice

> **Phân hệ**: AI Intelligence & Diagnostics Microservice  
> **Dự án**: Workflow-Pipeline-Engine (WPE)  
> **Công nghệ**: Python 3.11+, FastAPI, Google Gemini API (`gemini-2.5-flash`), Network DAG / CPM  
> **Cổng mặc định**: `8081`  
> **Hợp đồng tích hợp SSOT**: [`docs/specs/ai-service-contract.md`](../docs/specs/ai-service-contract.md)

---

## 1. Giới Thiệu Tổng Quan

Microservice này đóng vai trò là **"Trợ lý Cố vấn Kỹ thuật & Bác sĩ Pháp y Dự án"**, được gọi từ Backend Spring Boot 3 (`HttpAiServiceClient`) khi người dùng bấm nút **"AI Diagnosis"** trên giao diện Web.

Hệ thống hoạt động theo **Mô hình 2 Tầng (Two-Tier Intelligence)** chuẩn công nghiệp:
- **TẦNG 1: Thuật toán đồ thị nội bộ (< 10ms, 0 Token)**:
  - Tính toán đường găng **CPM (Critical Path Method)**: $ES, EF, LS, LF, Slack$.
  - Phát hiện **Task ngâm lâu (Stalled Node)**: $now - started\_at > 2.5 \times estimated\_hours$.
  - Phát hiện **Task quá hạn (Overdue Node)**.
  - Tính toán chỉ số lệch quỹ đạo **Drift Score** và Vận tốc dự án ($V_{target}, V_{actual}$).
- **TẦNG 2: Google Gemini AI (temperature = 0.2, Structured Output JSON)**:
  - **Semantic Task Trap & Smart Decomposition**: Nhận diện task ôm đồm, phức tạp và đề xuất danh sách 3–4 sub-tasks cụ thể để chia nhỏ.
  - **Root-Cause Synthesizer**: Xâu chuỗi phản hồi của Giáo viên (`PROJECT_FEEDBACK`) và lịch sử Reject của Owner để chỉ ra nguyên nhân gốc rễ dự án bị tắc.
  - **Semantic Parallelization Recommender**: Phát hiện các quan hệ phụ thuộc giả (False Dependencies) để khuyên nhóm làm song song.
  - **Prompt-to-DAG (Auto-Scaffolding)**: Sinh quy trình DAG gồm Phases, Nodes, Dependencies từ câu lệnh mô tả tự nhiên.

---

## 2. Cài Đặt & Khởi Động

### Bước 1: Cài đặt thư viện
```bash
cd wpe-ai-service
pip install -r requirements.txt
```

### Bước 2: Cấu hình biến môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```
Mở file `.env` và điền `GEMINI_API_KEY` của bạn (lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/app/apikey)):
```env
HOST=0.0.0.0
PORT=8081
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Nếu chưa có API Key, hệ thống sẽ tự động chuyển sang chế độ Heuristic Fallback thông minh, đảm bảo app vẫn chạy bình thường không bị sập).*

### Bước 3: Khởi động Microservice
```bash
python run.py
```
Hoặc dùng `uvicorn`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```
- Giao diện Swagger UI tương tác trực tiếp: `http://localhost:8081/docs`
- Kiểm tra trạng thái: `http://localhost:8081/health`

---

## 3. Chạy Kiểm Thử (Unit Tests)

Chạy toàn bộ 6 bài kiểm thử tự động (CPM, chu trình, Contract API, Scaffolding):
```bash
python -m unittest discover -s tests -p "test_*.py"
```

---

## 4. Tích Hợp với Spring Boot Backend (Java)

1. Giữ terminal chạy microservice Python trên cổng `8081`.
2. Mở một terminal khác, khởi động Backend Spring Boot ở chế độ HTTP:
   - **PowerShell (Windows)**:
     ```powershell
     $env:AI_MODE="http"; $env:AI_SERVICE_URL="http://localhost:8081"; ./mvnw spring-boot:run
     ```
   - **Linux / macOS**:
     ```bash
     AI_MODE=http AI_SERVICE_URL=http://localhost:8081 ./mvnw spring-boot:run
     ```
3. Truy cập Web Frontend (`http://localhost:5173`), mở một dự án và bấm nút **"AI Diagnosis"**.
4. Quan sát log trên terminal Python: dữ liệu đồ thị sẽ được gửi qua, xử lý và trả về cho React hiển thị trực quan!
