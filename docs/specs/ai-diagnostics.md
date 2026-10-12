# AI Diagnostics Specification (SSOT — Gemini Worker & JSON Schema)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Single Source of Truth (SSOT) — Đặc tả Phân hệ AI Diagnostics, Gemini Worker & Schema Dữ liệu  
> **Công nghệ áp dụng**: Google Gemini API (gemini-1.5-pro / flash) + Spring Boot Background Worker + PostgreSQL JSONB

---

## 1. Mục tiêu & Nguyên tắc Vận hành Phân hệ AI

Phân hệ **AI Diagnostics** được thiết kế nhằm giải quyết bài toán quản trị rủi ro và tối ưu hóa luồng thực thi trong các dự án quy trình kỹ thuật:
1. **Chẩn đoán Tự động & Dự báo Sớm**: Tự động phát hiện các điểm nghẽn (Bottlenecks), task bẫy (Task Traps) và tính toán đường găng tới hạn (Critical Path Method - CPM) trước khi sự cố xảy ra.
2. **Kiến trúc Bất đồng bộ qua Background Worker (Tránh Latency & Tiết kiệm Token)**:
   - **Tuyệt đối không gọi trực tiếp API Gemini khi người dùng tải trang (Page Load)** để tránh tăng độ trễ và vượt hạn mức tài nguyên (Rate Limiting).
   - Một tiến trình xử lý ngầm (AI Background Worker) được kích hoạt theo chu kỳ định kỳ (ví dụ: mỗi 30 phút) hoặc khi có sự kiện thay đổi lớn trên đồ thị (hoàn thành Phase, có task trễ hạn).
   - Kết quả phân tích được tổng hợp và ghi đè trực tiếp vào cột `latest_ai_analysis` (kiểu `jsonb`) trong bảng `PROJECT`. Người dùng mở Overview Screen chỉ việc đọc dữ liệu đã cache trong DB với độ trễ 1 mili-giây.
3. **Nguyên tắc Con người Kiểm soát (Human-in-the-loop)**:
   - AI chỉ đóng vai trò phân tích, cảnh báo và đề xuất bản thảo. Tuyệt đối không cấp quyền cho AI tự ý thay đổi dữ liệu chính thức nếu chưa qua sự phê duyệt của người dùng.

---

## 2. 4 Năng lực Chẩn đoán AI Cốt lõi

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      4 NĂNG LỰC CHẨN ĐOÁN CỐT LÕI                      │
├───────────────────────────────────┬────────────────────────────────────┤
│ 1. Phát hiện Anomaly Kiến trúc    │ 2. Nhận diện Task Bẫy              │
│    - Nút thắt cổ chai (Bottleneck)│    - Áp lực hạn chót ngầm          │
│    - Hội tụ nhiều luồng thiếu     │    - Khối lượng dồn nén gần        │
│      người phụ trách              │      deadline                      │
├───────────────────────────────────┼────────────────────────────────────┤
│ 3. Dự báo Chuỗi Đường Găng (CPM)  │ 4. Khuyến nghị Hành động Thực tế   │
│    - Critical Path nodes          │    - Chỉ dẫn tái phân bổ nhân lực  │
│    - Thời gian dự phòng (Slack)   │    - Thứ tự ưu tiên giải phóng     │
│    - Dự báo số ngày trễ dây chuyền│      các nút cản trở               │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Phát hiện Anomaly Kiến trúc (Architectural Anomalies)**:
   - Quét đồ thị để phát hiện các nút hội tụ nhiều nhánh phụ thuộc (In-degree cao) nhưng chưa có người phụ trách (`assigned_user_id IS NULL`), hoặc các nút cô lập làm gián đoạn dòng chảy công việc.
2. **Nhận diện Task Bẫy (Task Traps)**:
   - Phát hiện các tác vụ tiềm ẩn rủi ro trễ hạn: khối lượng công việc phức tạp nhưng thời gian đến hạn chót (`due_date`) còn quá ngắn, hoặc các task bị từ chối nghiệm thu nhiều lần (`reject_reason` tích lũy).
3. **Dự báo Chuỗi Đường Găng (CPM Forecast - Critical Path Method)**:
   - Xác định danh sách các nút nằm trên chuỗi xung yếu nhất của dự án. Nếu bất kỳ nút nào trên chuỗi này trễ hạn, toàn bộ ngày về đích của dự án sẽ bị trễ theo tương ứng.
   - Tính toán thời gian dự phòng (Slack Time) và số ngày dự kiến trễ hạn dây chuyền (`projected_delay_days`).
4. **Khuyến nghị Hành động Thực tế (Actionable Advice)**:
   - Đưa ra lời khuyên cụ thể, định danh chính xác mã nút cần can thiệp (ví dụ: `WPE-004`, `AUTH-02`) để Chủ dự án kịp thời bổ sung nhân sự hoặc gia hạn hạn chót.

---

## 3. Quy trình Thu thập Context & Prompt Engineering

### 3.1 Dữ liệu Đầu vào Thu thập cho AI Worker (Context Extraction)

Trước khi gọi API Gemini, AI Worker truy vấn từ PostgreSQL các thông tin sau:
* Metadata dự án (`PROJECT.name`, `status`, `created_at`, `updated_at`).
* Danh sách toàn bộ các Nodes (`id`, `code`, `title`, `status`, `assigned_user_id`, `due_date`, `is_overdue`, `reject_reason`).
* Danh sách cạnh phụ thuộc (`NODE_DEPENDENCY.parent_node_id`, `child_node_id`).
* Các phản hồi chưa giải quyết từ giáo viên/khách (`PROJECT_FEEDBACK` có `status = 'OPEN'`).

### 3.2 System Prompt & Chỉ thị Định dạng JSON Bắt buộc

```text
BẠN LÀ MỘT CHUYÊN GIA CAO CẤP VỀ PHÂN TÍCH ĐIỀU PHỐI QUY TRÌNH KỸ THUẬT (PRINCIPAL PIPELINE ARCHITECT).
Nhiệm vụ của bạn là phân tích đồ thị quy trình DAG và nhật ký thực thi dự án để đưa ra chẩn đoán sự cố, tính toán đường găng và khuyến nghị hành động.

BẮT BUỘC TRẢ VỀ DỮ LIỆU ĐÚNG ĐỊNH DẠNG JSON DUY NHẤT, KHÔNG CHỨA BẤT KỲ VĂN BẢN MARKDOWN NÀO BÊN NGOÀI.
Tuân thủ nghiêm ngặt schema JSON sau:
{
  "metrics": {
    "total_nodes": number,
    "completed_nodes": number,
    "in_progress_nodes": number,
    "review_nodes": number,
    "overdue_nodes": number,
    "completion_rate": number
  },
  "anomalies": [
    {
      "node_code": string,
      "type": "ORPHAN_OR_BOTTLENECK" | "UNASSIGNED_HIGH_INDEGREE" | "STRUCTURAL_IMBALANCE",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "description": string
    }
  ],
  "traps": [
    {
      "node_code": string,
      "trap_type": "DEADLINE_PRESSURE_TRAP" | "MULTIPLE_REJECTIONS_TRAP",
      "estimated_risk": string
    }
  ],
  "cpm_forecast": {
    "critical_path": string[],
    "total_estimated_duration_hours": number,
    "slack_time_hours": number,
    "projected_delay_days": number
  },
  "advice": string,
  "generated_at": string
}
```

---

## 4. Đặc tả Cấu trúc Dữ liệu JSON Chuẩn (Data Contracts)

### 4.1 Schema Lưu trữ Cột `PROJECT.latest_ai_analysis` (PostgreSQL JSONB)

```json
{
  "metrics": {
    "total_nodes": 24,
    "completed_nodes": 17,
    "in_progress_nodes": 4,
    "review_nodes": 3,
    "overdue_nodes": 2,
    "completion_rate": 70.83
  },
  "anomalies": [
    {
      "node_code": "WPE-014",
      "type": "ORPHAN_OR_BOTTLENECK",
      "severity": "HIGH",
      "description": "Nút hội tụ 3 nhánh phụ thuộc nhưng đang bị chặn bởi tác vụ tiền nhiệm chưa nộp artifact"
    }
  ],
  "traps": [
    {
      "node_code": "AUTH-03",
      "trap_type": "DEADLINE_PRESSURE_TRAP",
      "estimated_risk": "Tác vụ phức tạp nhưng chỉ còn dưới 12 giờ đến hạn chót, nguy cơ trễ hạn cao"
    }
  ],
  "cpm_forecast": {
    "critical_path": ["WPE-001", "WPE-004", "WPE-014", "WPE-020"],
    "total_estimated_duration_hours": 120,
    "slack_time_hours": 0,
    "projected_delay_days": 2
  },
  "advice": "Ưu tiên giải phóng tác vụ WPE-014 nằm trên đường găng (CPM) và phân công hỗ trợ ngay cho AUTH-03 để không ảnh hưởng đến ngày phát hành giai đoạn Core.",
  "generated_at": "2026-10-11T20:30:00Z"
}
```

### 4.2 Ánh xạ Giao diện Frontend (`src/types/overview.types.ts`)

Trên màn hình **Overview Screen**, kết quả chẩn đoán AI từ `latest_ai_analysis` được ánh xạ thành 3 thẻ Insight trực quan bên trong AI Diagnostic Popover / Modal:

```typescript
export type InsightKind = 'CRITICAL_PATH' | 'BOTTLENECK' | 'RECOMMENDATION';
export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'ADVICE';

export interface AiDiagnosticInsight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  icon: string;                // "🔴" | "🟡" | "🟢"
  kicker: string;              // "Cảnh báo Đường găng · Critical Path at risk"
  tag: string;                 // "Nguy cơ cao" | "Cảnh báo" | "Gợi ý"
  title: string;
  description: string;
  relatedNodeIds: string[];    // ["WPE-014"]
  boxClass: string;            // "bg-red-50 border-red-200"
  tagClass: string;            // "bg-red-100 text-red-700"
}

export interface AiDiagnosticReport {
  engine: 'Gemini';
  generatedAt: string;         // ISO-8601
  insights: AiDiagnosticInsight[]; // 3 thẻ theo thứ tự CRITICAL_PATH, BOTTLENECK, RECOMMENDATION
}
```

---

## 5. Quy trình Tự động Sinh Đồ thị có Con người Kiểm soát (Human-in-the-loop)

Khi hệ thống mở rộng tính năng cho phép người dùng nhập yêu cầu ngôn ngữ tự nhiên để AI tự động vẽ quy trình DAG:

```text
[Người dùng nhập Prompt mô tả yêu cầu dự án]
                      │
                      ▼
[Gemini AI phân tích và sinh bản nháp JSON Đồ thị]
                      │
                      ▼
[Trạng thái bản nháp: PENDING_REVIEW trên Canvas]
                      │
                      ▼
[Người dùng xem xét, kéo thả điều chỉnh tọa độ & thuộc tính]
                      │
                      ▼
[Hệ thống kích hoạt Thuật toán Kahn kiểm tra chu trình DAG]
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  [Có chu trình lặp]          [DAG hợp lệ 100%]
        │                           │
  [Bôi đỏ cảnh báo]                 ▼
  [Yêu cầu sửa lại]           [Chủ dự án bấm XÁC NHẬN]
                                    │
                                    ▼
                         [Ghi chính thức vào PostgreSQL]
```

> [!CAUTION]
> **Nguyên tắc An toàn Dữ liệu**:
> 1. AI chỉ có quyền trả về đề xuất cấu trúc tạm thời dưới dạng bản thảo (`PENDING_REVIEW`).
> 2. Bắt buộc phải qua bước người dùng xác nhận và giải thuật Kahn thẩm định 100% không có chu trình trước khi ghi dữ liệu vào các bảng `PIPELINE_TEMPLATE`, `WORK_PHASE`, `NODE`, và `NODE_DEPENDENCY`.
