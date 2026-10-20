# AI Diagnostics & Workflow Intelligence Specification (SSOT)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Single Source of Truth (SSOT) — Đặc tả Phân hệ AI: Kiến trúc sư Quy trình & Bộ Giám sát Quỹ đạo Dự án  
> **Công nghệ áp dụng**: Google Gemini API (`gemini-1.5-flash` / `gemini-1.5-pro`) + Spring Boot 3 Engine + PostgreSQL JSONB

---

## 1. Tầm nhìn & Nguyên lý Cốt lõi của Phân hệ AI

Khác biệt hoàn toàn với các mô hình AI "bấm nút thụ động" (Passive) hoặc "quét định kỳ đốt token", phân hệ AI trong **Workflow-Pipeline-Engine** được thiết kế theo chuẩn **Enterprise SaaS B2B**:
1. **Nguyên lý Phân công Trách nhiệm (Separation of Concerns)**:
   * **Spring Boot Backend**: Đảm nhận toàn bộ toán học đồ thị, đo lường số liệu, tính toán tiến độ CPM và phát hiện độ lệch (chính xác 100%, chi phí = $0 token, độ trễ < 10ms).
   * **Google Gemini AI**: Đảm nhận năng lực suy luận ngữ cảnh (Contextual Reasoning), trích xuất ý định (Intent Extraction) và đề xuất chiến lược can thiệp kỹ thuật (Actionable Triage).
2. **Kỷ luật Tham số (Parameter Discipline)**: Mọi lời gọi sinh cấu trúc đồ thị đều áp dụng `temperature = 0.2` nhằm triệt tiêu tính sáng tạo bay bổng/ảo giác, ép mô hình tuân thủ tuyệt đối logic nghiệp vụ và JSON Schema.
3. **Hai Trụ cột Chiến lược**:
   * **Tính năng 1: AI Workflow Architect**: Sinh quy trình đồ thị DAG chuẩn toán học qua quy trình 2 pha (2-Phase Synthesis) với kỹ thuật Intent Mirroring.
   * **Tính năng 2: Project Watchdog & JIT Decision Gate**: Hệ thống giám sát kép gồm Bộ đo lệch quỹ đạo (Trajectory Drift) và Điểm kiểm soát quyết định tức thì (Just-In-Time Gate).

---

## 2. TÍNH NĂNG 1: AI Workflow Architect (Sinh Sơ Đồ Quy Trình 2 Pha)

Nhằm loại bỏ hoàn toàn tình trạng **AI sinh ra đồ thị rác (AI Slop)**, sai lệch ngữ cảnh (ví dụ: yêu cầu làm E-commerce lại sinh ra Quản lý lớp học), quy trình sinh đồ thị được chia làm 2 pha nghiêm ngặt:

```text
[Người dùng nhập Prompt mô tả yêu cầu]
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 1: KIẾN TRÚC SƠ BỘ & NEO Ý ĐỊNH (INTENT MIRRORING & DISCOVERY)     │
│  - Gemini phân tích và trích xuất:                                     │
│    + Domain, Core Entities, Tech Stack, 4 Phase Scaffold.              │
│  - Bắt buộc: temperature = 0.2.                                        │
│  - Hiển thị Modal để Chủ dự án xác nhận / hiệu chỉnh phạm vi.          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Người dùng bấm "Chốt & Sinh Đồ Thị")
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 2: SINH ĐỒ THỊ DAG & KHỬ TRÙNG TOÁN HỌC (DAG SYNTHESIS & SANITIZER)│
│  - Gemini sinh JSON chi tiết: Phases, Nodes, Dependencies.             │
│  - Backend Sanitizer:                                                  │
│    1. Thuật toán Kahn: Thẩm định 100% không có chu trình (Acyclic).   │
│    2. Auto-Layout: Tự động tính tọa độ (x, y) chuẩn đẹp bằng Dagre/Topo│
│    3. Lưu toàn bộ vào Database trong một Transaction duy nhất.         │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Pha 1: Intent Mirroring & Architectural Discovery

* **Mục tiêu**: Ép AI phải định nghĩa các thực thể cốt lõi trước khi được phép sinh task, khóa chặt không gian ngữ nghĩa (Attention Anchoring).
* **Cấu hình Gemini**:
  * `temperature`: `0.2`
  * `responseMimeType`: `application/json`
* **Schema JSON Pha 1 (Intent Discovery)**:
```json
{
  "discovery": {
    "domain": "E-Commerce Web Application",
    "targetAudience": "Khách hàng mua sắm & Quản trị viên kho",
    "techStack": ["Spring Boot 3", "React 18", "PostgreSQL", "VNPay SDK"],
    "coreEntities": ["User/Auth", "Product Catalog", "Order & Cart", "Payment", "Shipping"]
  },
  "suggestedPhases": [
    { "orderIndex": 1, "name": "1. Khảo sát & Thiết kế Kiến trúc", "estimatedDays": 5 },
    { "orderIndex": 2, "name": "2. Phát triển Dịch vụ Cốt lõi (Core)", "estimatedDays": 14 },
    { "orderIndex": 3, "name": "3. Tích hợp Thanh toán & Frontend", "estimatedDays": 10 },
    { "orderIndex": 4, "name": "4. Kiểm thử & Triển khai", "estimatedDays": 5 }
  ]
}
```

### 2.2 Pha 2: Topological Graph Synthesis & Backend Sanitizer

* Khi người dùng xác nhận bản thảo ở Pha 1, Backend gửi yêu cầu sinh đồ thị chi tiết.
* **Schema JSON Pha 2**:
```json
{
  "phases": [
    { "tempId": "p1", "name": "1. Khảo sát & Thiết kế", "orderIndex": 1 },
    { "tempId": "p2", "name": "2. Phát triển Dịch vụ Cốt lõi", "orderIndex": 2 }
  ],
  "nodes": [
    { "tempId": "n1", "phaseTempId": "p1", "title": "Thiết kế CSDL 3NF", "estimatedHours": 24 },
    { "tempId": "n2", "phaseTempId": "p1", "title": "Đặc tả API Swagger", "estimatedHours": 16 },
    { "tempId": "n3", "phaseTempId": "p2", "title": "Xây dựng Auth & JWT Service", "estimatedHours": 32 }
  ],
  "dependencies": [
    { "parentTempId": "n1", "childTempId": "n3" },
    { "parentTempId": "n2", "childTempId": "n3" }
  ]
}
```
* **Chốt chặn Backend (Sanitizer Pipeline)**:
  1. **Cycle Detection (Thuật toán Kahn)**: Nếu phát hiện cạnh gây chu trình lặp ($A \to B \to A$), Backend tự động loại bỏ cạnh đó hoặc trả lỗi chi tiết, không bao giờ để lọt đồ thị lỗi vào DB.
  2. **Auto-Layout Coordinate Engine**: Backend/Frontend tính toán tọa độ $X, Y$ theo cấp bậc topo (Topological Layering) để các nút hiển thị ngay ngắn trên Canvas SVG (Node tầng 1 xếp ở $X=100$, Node tầng 2 ở $X=400$...).
  3. **Khởi tạo trạng thái**: Các nút gốc (In-degree = 0) nhận trạng thái `TODO`; các nút con phụ thuộc nhận trạng thái `LOCKED`.

---

## 3. TÍNH NĂNG 2: Project Watchdog & JIT Decision Gate (Hệ Thống Giám Sát Kép)

Hệ thống kết hợp 2 cơ chế giám sát: **Vĩ mô (Độ lệch quỹ đạo)** và **Vi mô (Điểm giao cắt ra quyết định)**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   HỆ THỐNG GIÁM SÁT DỰ ÁN KÉP (DUAL WATCHDOG)          │
├───────────────────────────────────┬────────────────────────────────────┤
│ 2.1 GIÁM SÁT QUỸ ĐẠO VĨ MÔ        │ 2.2 ĐIỂM KIỂM SOÁT VI MÔ (JIT)     │
│     (Trajectory Drift Engine)     │     (Just-In-Time Decision Gate)   │
│                                   │                                    │
│ - Đo vận tốc cháy của đồ thị      │ - Can thiệp NGAY TRONG MODAL giao  │
│   (Burn Rate Divergence).         │   việc hoặc phê duyệt task.        │
│ - Kích hoạt khi DriftScore >= 40% │ - Chạy CPM Forward Pass (< 5ms)    │
│ - AI nhận Hồ sơ pháp y để tìm     │   phát hiện "Hội tụ tắc nghẽn"     │
│   nguyên nhân gốc và giải pháp.   │   (Workload Collision > 40h/tuần). │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

### 3.1 Cơ Chế 2.1: Bộ Đo Độ Lệch Quỹ Đạo (Trajectory Drift Engine)

#### a. Thuật toán đo độ lệch (Backend chạy toán Java, 0 Token):
Định kỳ mỗi đêm hoặc sau mỗi mốc bàn giao, Spring Boot tính toán:
1. **Vận tốc Mục tiêu ($V_{\text{target}}$)**:
   $$V_{\text{target}} = \frac{\text{Tổng số Node chưa hoàn tất}}{\text{Số ngày còn lại đến Deadline dự án}}$$
2. **Vận tốc Thực tế 7 ngày gần nhất ($V_{\text{actual}}$)**:
   $$V_{\text{actual}} = \frac{\text{Số Node đã chuyển sang DONE trong 7 ngày qua}}{7}$$
3. **Chỉ số Lệch Quỹ Đạo (Drift Score)**:
   $$\text{DriftScore} = 1 - \frac{V_{\text{actual}}}{V_{\text{target}}}$$

#### b. Ma trận phân cấp cảnh báo (Drift Thresholds):
* **$\text{DriftScore} < 20\%$ (GREEN - Ổn định)**: Quỹ đạo đúng tiến độ, AI ngủ yên (0 token).
* **$20\% \le \text{DriftScore} < 40\%$ (YELLOW - Chệch nhẹ)**: Cập nhật badge cảnh báo vàng trên Overview Dashboard.
* **$\text{DriftScore} \ge 40\%$ (RED - Báo động vỡ tiến độ)**: Kích hoạt **Điều Tra Pháp Y Dữ Liệu (Forensic Profiling)**.

#### c. Hồ sơ Pháp y Dữ liệu (Backend tự thu thập trước khi gọi AI):
Backend gom đúng 3 nhóm bằng chứng định lượng:
1. **Nút ngâm lâu nhất trên đường găng (Stalled Node)**: Nút có $\text{TimeInState}(IN\_PROGRESS) \ge 2.5 \times \text{estimatedHours}$.
2. **Nút bị từ chối nhiều nhất (Rejection Friction)**: Nút có $\text{reject\_count} \ge 2$, đọc 2 lý do từ chối gần nhất từ audit log.
3. **Bán kính phong tỏa (Blast Radius)**: Số lượng task con đang bị nút này giữ chân ở trạng thái `LOCKED`.

#### d. Vòng Kim Cô (Negative Constraints) ép Gemini không lan man:
```text
[BỐI CẢNH DỰ ÁN]: Tên: "E-Commerce", DriftScore = 71.5% (Nguy cơ trễ hạn cao).
[HỒ SƠ BẰNG CHỨNG PHÁP Y]:
- Nút nghẽn chính: [PAY-02] "Webhook VNPay" (Người làm: Thien) - Ngâm 7 ngày (Gấp 3.5 lần dự kiến).
  Đang giữ chân 4 task con: CHECKOUT-UI, INVOICE-GEN, MEMBER-SYNC, ORDER-REPORT.
- Nút nghẽn phụ: [AUTH-02] (Người làm: Nam) - Bị Reject 2 lần do lỗi: "Chưa xử lý Token Rotation".

[QUY TẮC CẤM BẮT BUỘC]:
- CẤM đưa ra các lời khuyên chung chung (như: họp hành, động viên, tăng cường giao tiếp).
- BẮT BUỘC chỉ đề xuất các hành động can thiệp vào: CẤU TRÚC ĐỒ THỊ DAG (tách task, dời nhánh) hoặc TÁI PHÂN BỔ NHÂN LỰC.
- Phải chỉ định rõ mã Node và tên nhân sự trong giải pháp.
```

---

### 3.2 Cơ Chế 2.2: Điểm Kiểm Soát Quyết Định Tức Thì (Just-In-Time Gate)

#### a. Kịch bản vận hành tại giao diện (Ambient UX):
* Khi Chủ dự án mở Modal **Phân công Tác vụ (Assign Member)** cho Node $X$ và chọn nhân sự **Nam**.
* Frontend tự động kích hoạt API ngầm: `POST /api/nodes/{id}/simulate-assign?userId={namId}` (phản hồi trong 5ms).

#### b. Thuật toán Lan truyền Thời gian (CPM Forward Pass - Toán học Java):
1. **Tính Cửa sổ Thời gian Thực thi khả dĩ của Node $X$**:
   * Ngày sớm nhất bắt đầu: $ES_X = \max_{P \in \text{Parents}(X)} (ES_P + \text{Duration}_P)$
   * Ngày sớm nhất kết thúc: $EF_X = ES_X + \text{Duration}_X$
   * Cửa sổ thời gian dự kiến: $[ES_X, EF_X]$.
2. **Kiểm tra trùng lặp lịch trình (Overlap Detection)**:
   * Backend quét toàn bộ các task chưa `DONE` của Nam.
   * Tính số lượng task của Nam có cửa sổ thời gian giao nhau với $[ES_X, EF_X]$.
3. **Phát hiện Hội tụ Tắc nghẽn (Concurrency Spike)**:
   * Nếu tại cửa sổ đó, Nam có $\ge 3$ tasks đồng thời hoặc tổng số giờ vượt quá $40$h/tuần:
   * **Kích hoạt cảnh báo Ambient Card ngay trong Modal** trước khi Chủ dự án bấm nút xác nhận.

```text
┌────────────────────────────────────────────────────────────────────────┐
│  MODAL: GIAO VIỆC CHO TÁC VỤ [AUTH-03]                                 │
├────────────────────────────────────────────────────────────────────────┤
│  Người thực hiện: [ Nguyễn Văn Nam  ▼ ]                                │
│                                                                        │
│  ┌─ ⚠️ CẢNH BÁO MÔ PHỎNG TẢI (AI WORKLOAD COLLISION) ────────────────┐ │
│  │ Nam đang có 2 task độc lập dự kiến cùng mở khóa vào tuần sau.       │ │
│  │ Nếu nhận thêm task này:                                             │ │
│  │ • Khối lượng công việc tuần tới của Nam sẽ đạt 62 giờ (> 40h/tuần). │ │
│  │ • Xác suất trễ hạn dự phóng: 75%.                                   │ │
│  │ 💡 Gợi ý tối ưu: Nên giao cho Tuấn (đang có 12h trống lịch tuần tới)│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  [ Vẫn Giao Cho Nam ]                     [ Giao Cho Tuấn Theo Gợi Ý ] │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Đặc tả Cấu trúc Dữ liệu & JSON Schemas (SSOT Contracts)

### 4.1 Schema Lưu trữ Cột `PROJECT.latest_ai_analysis` (PostgreSQL JSONB)

```json
{
  "driftMetrics": {
    "targetVelocity": 2.0,
    "actualVelocity": 0.58,
    "driftScore": 71.0,
    "status": "RED_ALERT"
  },
  "forensicInvestigation": {
    "primaryBottleneckNode": "PAY-02",
    "culpritAssignee": "Thien",
    "daysOverrun": 5,
    "blastRadiusBlockedNodes": ["CHECKOUT-UI", "INVOICE-GEN", "MEMBER-SYNC", "ORDER-REPORT"],
    "rootCauseSummary": "Tác vụ Webhook VNPay đang bị phình to phạm vi (Over-scoped), chặn đứng toàn bộ luồng thanh toán downstream."
  },
  "triageRecommendations": [
    {
      "action": "SPLIT_NODE",
      "targetNodeCode": "PAY-02",
      "instruction": "Tách PAY-02 thành 2 subtask: Nhận IPN cơ bản (làm ngay trong 1 ngày để giải phóng CHECKOUT-UI) và Xử lý Refund tự động (dời sang Phase sau)."
    },
    {
      "action": "PAIR_PROGRAMMING",
      "targetNodeCode": "AUTH-02",
      "instruction": "Nam đang vướng lỗi lặp Token Rotation (reject lần 2). Cử Tech Lead pair-program giải quyết dứt điểm trong 2 giờ."
    }
  ],
  "analyzedAt": "2026-10-18T10:00:00Z"
}
```

### 4.2 DTO Phản hồi Mô phỏng Giao việc (`SimulateAssignmentResponse`)

```json
{
  "nodeId": 142,
  "candidateUserId": 8,
  "candidateName": "Nguyễn Văn Nam",
  "hasConcurrencySpike": true,
  "projectedConcurrentTasks": 3,
  "projectedWeeklyHours": 62,
  "riskLevel": "HIGH",
  "warningMessage": "Nam sẽ bị quá tải 62 giờ vào tuần tới do 2 nhánh upstream cùng hội tụ mở khóa.",
  "recommendedAlternative": {
    "userId": 12,
    "userName": "Trần Tuấn",
    "availableHours": 18,
    "reason": "Tuấn đang trống lịch trong cửa sổ thời gian này và có kỹ năng phù hợp."
  }
}
```

---

## 5. Danh mục API Endpoint của Phân hệ AI

| Method | Endpoint | Vai trò Nghiệp vụ | Input DTO | Output DTO |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/architect/discovery` | Pha 1: Trích xuất phạm vi & Intent Mirroring | `AiDiscoveryRequest(prompt)` | `AiDiscoveryResponse` |
| `POST` | `/api/ai/architect/synthesize`| Pha 2: Sinh đồ thị DAG chi tiết & Kahn Sanitize | `AiSynthesizeGraphRequest` | `AiGraphResponse` |
| `GET`  | `/api/ai/projects/{id}/trajectory` | Truy vấn báo cáo độ lệch quỹ đạo & pháp y | None | `TrajectoryAnalysisResponse` |
| `POST` | `/api/ai/projects/{id}/trigger-audit` | Kích hoạt điều tra pháp y cưỡng bức | None | `TrajectoryAnalysisResponse` |
| `POST` | `/api/nodes/{id}/simulate-assign` | Mô phỏng tải JIT trước khi phân công | `SimulateAssignRequest(userId)` | `SimulateAssignmentResponse` |

---

## 6. Nguyên tắc An toàn & Kiểm soát của Con người (Human-in-the-Loop)

1. **Tuyệt đối không tự ý ghi đè đồ thị**: AI chỉ đề xuất bản thảo hoặc kế hoạch tái cấu trúc; chỉ khi Chủ dự án (Project Owner) bấm nút chấp thuận thì Spring Boot mới thực hiện cập nhật CSDL.
2. **Quyền vượt rào (Override Authority)**: Tại Modal phân công việc, nếu có cảnh báo Quá tải ngầm (Workload Collision), Chủ dự án vẫn có toàn quyền bấm **"Vẫn Giao Việc"** nếu có sự sắp xếp riêng ngoài đời thực.
3. **Bảo mật Thông tin**: Dữ liệu gửi sang Gemini API tuyệt đối không chứa mật khẩu, mã hash BCrypt hoặc thông tin định danh cá nhân nhạy cảm; chỉ gửi mã nút, chức danh kỹ thuật, ước tính thời gian và lịch sử lý do nghiệm thu.
