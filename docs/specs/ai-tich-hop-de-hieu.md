# Phần AI: đọc file này trước

> Đây là bản **tóm tắt dễ hiểu** của hai tài liệu kỹ thuật: [`ai-service-contract.md`](ai-service-contract.md) (hợp đồng giữa Java và Python) và [`ai-diagnostics.md`](ai-diagnostics.md) (thiết kế ban đầu). Cần chi tiết thì đọc hai file đó. Nếu ba file nói khác nhau, **file này và `ai-service-contract.md` là đúng** (nhóm đã duyệt ngày 14/11/2026).

## 1. AI trong dự án làm gì?

Chủ dự án bấm nút **AI Diagnosis** trên trang Overview. Hệ thống nhìn toàn bộ sơ đồ công việc rồi báo lại ba thứ:
- **Điểm nghẽn:** việc nào đang bị trễ và đang chặn các việc sau nó.
- **Bẫy công việc:** việc nào có nguy cơ bị treo.
- **Lời khuyên:** nên làm gì (ví dụ tách việc to thành hai việc nhỏ).

Kèm theo là **đường găng** (chuỗi việc dài nhất, chậm một việc là cả dự án chậm) và vài con số về tiến độ.

## 2. Các phần ghép với nhau thế nào?

```
Trình duyệt  ──►  Backend Java  ──►  Dịch vụ AI (Python)  ──►  Gemini
 (nút bấm)        (kiểm tra quyền,    (do người làm AI viết)
                   lưu kết quả)
```

- **Trình duyệt không gọi thẳng AI.** Mọi thứ đi qua backend Java, vì Java kiểm tra bạn có quyền không và lưu kết quả vào database.
- **Python chưa xong cũng không sao.** Java có hai chế độ dự phòng, nên cả hệ thống vẫn chạy.

## 3. Ba chế độ chạy

Chọn bằng biến môi trường `AI_MODE` khi chạy backend:

| Chế độ | Khi nào dùng | Kết quả trên màn hình |
|---|---|---|
| `mock` (mặc định) | Python chưa có, hoặc đang làm giao diện | Dữ liệu giả do Java tạo. Nhãn **"Dữ liệu giả lập"** |
| `http` và Python đang chạy | Ghép thật | Dữ liệu từ AI. Nhãn **"Gemini Engine"** |
| `http` nhưng Python chưa bật hoặc bị lỗi | Python chết giữa chừng | Dữ liệu giả **và** một dải cảnh báo vàng nói rõ lý do. Hệ thống không bị lỗi |

Chạy chế độ http: `AI_MODE=http AI_SERVICE_URL=http://localhost:8081`.

## 4. Ai làm gì? Việc nào chờ việc nào?

Phía Python và phía Java/giao diện **làm song song được**, vì cả hai cùng theo một "hợp đồng" cố định (mục 5).

| Người làm | Việc | Thử bằng gì khi bên kia chưa xong |
|---|---|---|
| **Python (AI)** | Viết dịch vụ nhận dữ liệu dự án, trả về kết quả đúng hợp đồng | File mẫu `shared/test-fixtures/ai-diagnose.*.json` |
| **Java + giao diện** | Gọi AI, lưu kết quả, hiện lên màn hình | Chế độ `mock`, hoặc stub `tools/ai-stub` |

Chỉ **một bước** phải chờ: chạy thử ghép thật (Java gọi Python thật). Kiểm tra nội dung AI trả có hợp lý không cũng chỉ làm được khi có Python thật.

## 5. Hợp đồng: Python phải trả về gì?

Python nhận một yêu cầu `POST /api/ai/diagnose` chứa dự án, danh sách việc, các mũi tên phụ thuộc và các góp ý chưa xử lý. Python trả về JSON có **5 khóa bắt buộc**:

| Khóa | Kiểu | Ý nghĩa |
|---|---|---|
| `criticalPath` | danh sách mã việc | Đường găng, ví dụ `["WPE-001","WPE-002"]` |
| `bottlenecks` | danh sách | Điểm nghẽn: mã việc, tiêu đề, lý do, mức độ |
| `taskTraps` | danh sách | Bẫy công việc: mã việc, loại bẫy, gợi ý |
| `actionableAdvice` | danh sách | Lời khuyên: hành động, việc cần làm, hướng dẫn, ưu tiên |
| `metrics` | object | Số liệu tiến độ: vận tốc mục tiêu, vận tốc thực tế, điểm lệch, trạng thái |

Ví dụ đầy đủ: `shared/test-fixtures/ai-diagnose.response.json` (và đầu vào: `ai-diagnose.request.json`).

**Java tự kiểm tra.** Nếu Python thiếu khóa hoặc sai kiểu (ví dụ `metrics` là danh sách thay vì object), Java coi như AI bị lỗi và dùng dữ liệu giả kèm cảnh báo. Vì vậy **người làm Python phải theo đúng hợp đồng**, nếu không màn hình sẽ luôn hiện dữ liệu giả.

Hai quy ước khác:
- **Giờ phân tích (`analyzedAt`) do Java tự đặt**, Python gửi gì cũng không dùng. Giờ Python gửi được lưu riêng ở `serviceAnalyzedAt`.
- **Python nên trả lời trong 15–20 giây.** Quá 30 giây Java sẽ bỏ chờ.

## 6. Quy tắc bấm nút

- Bấm xong phải đợi **180 giây** mới bấm lại được, để khỏi tốn tiền gọi Gemini. Bấm sớm sẽ thấy thông báo "Vui lòng thử lại sau … giây".
- Nếu lần trước chỉ là **dữ liệu giả do AI lỗi**, thì **không** phải đợi. AI vừa sống lại là gọi được ngay.
- Chỉ **thành viên của dự án** mới bấm được.

## 7. Đã quyết và chưa quyết

**Đã quyết (14/11/2026):**
- Dùng schema trong hợp đồng ở mục 5, thay cho schema cũ (`driftMetrics`, `forensicInvestigation`…) trong `ai-diagnostics.md`.
- Kết quả lưu ở cột `project.latest_ai_analysis` (không dùng bảng `PROJECT_AI_ANALYSIS` như bản cũ).

**Chưa quyết, cần cả nhóm trả lời:**
1. Lần nộp này có làm **AI Workflow Architect** (gõ mô tả → AI vẽ sẵn sơ đồ) và **Simulate-assign** (cảnh báo quá tải khi giao việc) không? Hiện hai tính năng này chưa có phần nào ở Java hay giao diện.
2. **Ai tính** đường găng và độ lệch tiến độ: Java hay Python? Bản thiết kế cũ nói Java, ghi chú sau đó nói Python. Chỉ nên có **một** nơi tính.

## 8. Đã làm xong và chưa làm

**Đã làm và đã kiểm tra bằng test tự động:**
- Java kiểm hợp đồng, tự đặt giờ phân tích, không giữ kết nối database lúc chờ AI, dữ liệu giả không bắt đợi 180 giây.
- Giao diện: nút chạy chẩn đoán thật, dải cảnh báo dữ liệu giả, thông báo khi bấm quá sớm.
- Fixture dùng chung và stub Python mẫu (`tools/ai-stub`).
- Kết quả test: backend (nhóm AI) 17 test, giao diện 402 test, đều đạt.

**Chưa làm hoặc chưa kiểm tra:**
- **Chưa bấm thử trên trình duyệt thật** với backend và database. Mới có test tự động.
- **Chưa chạy stub Python** vì máy chưa cài Python.
- Giao diện chưa hiện `metrics` (điểm lệch) và `criticalPath`, dù Java đã lưu hai thứ này.
- **Chưa có xác thực giữa Java và Python.** Ai gọi được cổng của dịch vụ AI là dùng được.
- **Bấm đúp rất nhanh** vẫn có thể gửi hai yêu cầu cùng lúc qua được kiểm tra 180 giây.
- `application.yml` đang bật `debug-user-id-enabled: true` (cho phép giả làm người dùng bằng một header). Cần tắt khi chạy thật. Phần này nằm ngoài AI, chưa kiểm tra kỹ.

## 9. Chạy thử nhanh (không cần Python)

1. `cd wpe-backend && docker compose up -d` (bật database và hàng đợi).
2. Chạy backend với `AI_MODE=mock`.
3. `cd wpe-frontend && npm install && npm run dev`, đặt `VITE_USE_MOCK=false` trong file `.env`.
4. Vào trang Overview của một dự án, bấm **AI Diagnosis → Chạy chẩn đoán**: thấy kết quả, nhãn "Dữ liệu giả lập".
5. Bấm lại ngay: thấy thông báo phải đợi.

Muốn thử cảnh báo lỗi AI: chạy `AI_MODE=http` mà không bật Python, bấm chẩn đoán, sẽ thấy dải cảnh báo vàng.

Muốn thử với Python: xem [`tools/ai-stub`](../../tools/ai-stub/main.py). Biến `STUB_MODE` cho phép giả lập lỗi (`bad_schema`, `error500`, `slow`).
