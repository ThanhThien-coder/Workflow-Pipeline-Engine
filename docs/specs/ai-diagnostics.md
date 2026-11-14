# AI Diagnostics & Workflow Intelligence Specification (SSOT)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Single Source of Truth (SSOT) — Đặc tả Phân hệ AI: Kiến trúc sư Quy trình & Bộ Giám sát Quỹ đạo Dự án  
> **Công nghệ áp dụng**: Google Gemini API (`gemini-2.5-flash` / `gemini-2.5-pro`) + Spring Boot 3 Engine + PostgreSQL JSONB

---

## 0. Quyết định schema (ĐÃ DUYỆT)

> 📖 Bản tóm tắt dễ hiểu: [`ai-tich-hop-de-hieu.md`](ai-tich-hop-de-hieu.md).
>
> **Trạng thái:** Đã duyệt ngày 14/11/2026. Phạm vi *AI Workflow Architect* và *Simulate-assign* vẫn chưa quyết định (xem bên dưới).

**Quyết định:** với chức năng **chẩn đoán dự án** (cơ chế 2.1 *Trajectory Drift Engine* ở mục 3), schema chuẩn là schema trong [`ai-service-contract.md`](ai-service-contract.md): `criticalPath`, `bottlenecks`, `taskTraps`, `actionableAdvice`, `metrics`. Các mục dưới đây **bị thay thế** bởi contract:

| Mục trong file này | Thay bằng |
| :--- | :--- |
| 3.1.d–e, 4.1.b–c (`driftMetrics`, `forensicInvestigation`, `triageRecommendations`, `TrajectoryAnalysisResponse`) | Schema response ở `ai-service-contract.md` §4 |
| Endpoint `GET /api/ai/projects/{id}/trajectory`, `POST .../trigger-audit` (mục 5) | `GET /api/v1/projects/{id}/ai-analysis`, `POST /api/v1/projects/{id}/ai-diagnostics` |
| Bảng `PROJECT_AI_ANALYSIS` | Cột `project.latest_ai_analysis` (JSONB) |
| Cooldown 24 giờ + Warm-up Guard | Cooldown 180 giây (`app.ai.cooldown-seconds`); Warm-up Guard chưa làm |

**Chưa quyết định, vẫn theo spec này cho đến khi nhóm chốt:** *AI Workflow Architect* (mục 2) và *Simulate-assign* (mục 3.2) chưa có cổng Java nào. Nếu không làm trong lần nộp này thì ghi rõ "để sau".

### Lý do chọn schema của contract
1. **Code đã theo contract.** `AiDiagnosticController`, `HttpAiServiceClient`, test và fixture dùng chung (`shared/test-fixtures/ai-diagnose.*.json`) đều theo contract. Đổi sang spec nghĩa là sửa lại cả bốn nơi.
2. **Python chưa viết.** Chọn contract bây giờ thì người làm AI viết đúng ngay từ đầu, không tốn công làm lại.
3. **Contract chạy được độc lập.** Có stub (`tools/ai-stub`), có chế độ `mock` làm mặc định và fallback `MOCK_FALLBACK`, nên backend không phụ thuộc việc AI xong hay chưa.
4. **Có thể kiểm bằng máy.** Java kiểm các khóa bắt buộc và rơi về dữ liệu dự phòng nếu sai. Schema của spec chưa có bước kiểm tương đương.
5. **Phần của spec không mất:** nếu sau này cần `forensicInvestigation`, thêm nó như một khóa mở rộng. Java lưu nguyên object vào JSONB mà không cắt bớt.

### Điều đáng lo (cần nhóm biết trước khi duyệt)
1. **Lệch với tài liệu thiết kế.** Nếu người chấm đối chiếu theo spec gốc (`driftMetrics`, `PROJECT_AI_ANALYSIS`), code sẽ lệch. Cần giải thích quyết định này trong báo cáo, hoặc đổi sang spec.
2. **Người làm AI đọc nhầm file.** Nếu họ làm theo mục 3–4 của file này thì Python trả `driftMetrics/forensicInvestigation`, Java coi là sai hợp đồng và luôn rơi về `MOCK_FALLBACK`. Ghép xong mà giao diện vẫn thấy dữ liệu giả. Phải báo cho họ trước khi họ viết code.
3. **Ai tính CPM và drift chưa thống nhất.** Spec nói Java tính (0 token), ghi chú D6 ngày 12/11 nói Python tính. Hai bên có thể cùng tính hoặc không ai tính.
4. **Mất hai cơ chế chống tốn token của spec.** Warm-up Guard và cooldown 24 giờ chưa có. Hiện chỉ có cooldown 180 giây, nên một dự án mới vẫn có thể gọi Gemini ngay ngày đầu và cho `driftScore` 100% giả.
5. **Frontend chưa nối.** `AiDiagnosticReport { engine, insights[] }` còn lệch với JSON backend, nên cần một bộ chuyển đổi dữ liệu trước khi demo thật.
6. **Chưa có xác thực giữa Java và Python.** Ai gọi được cổng của service AI thì dùng được nó.

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
[Người dùng nhập Prompt mô tả yêu cầu]V
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 1: KIẾN TRÚC SƠ BỘ & NEO Ý ĐỊNH (INTENT MIRRORING & DISCOVERY)     │
│  - Gemini phân tích và trích xuất:                                     │
│    + Domain, Core Entities, Tech Stack, Phase Scaffold.                │
│  - Bắt buộc: temperature = 0.2.                                        │
│  - Preview trực quan & hỗ trợ Chat hiệu chỉnh phạm vi / Tech Stack.    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Chủ dự án bấm "Chốt & Sinh Đồ Thị")
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHA 2: SINH ĐỒ THỊ DAG & LƯU DB 1 LẦN (DAG SYNTHESIS & SANITIZER)      │
│  - Gemini sinh JSON chi tiết (giới hạn 15–25 Nodes cốt lõi).           │
│  - Backend Sanitizer:                                                  │
│    1. Thuật toán Kahn: Thẩm định 100% không có chu trình (Acyclic).   │
│    2. Auto-Layout: Tự động tính tọa độ (x, y) chuẩn đẹp bằng Topo.     │
│    3. Lưu toàn bộ vào Database trong một Transaction duy nhất.         │
│  - Hiển thị lên Canvas (mọi tinh chỉnh sau đó thao tác trực tiếp trên FE)│
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Pha 1: Intent Mirroring & Architectural Discovery

* **Mục tiêu**: Ép AI phải định nghĩa các thực thể cốt lõi trước khi được phép sinh task, khóa chặt không gian ngữ nghĩa (Attention Anchoring).
* **Cơ chế tương tác & Xem trước (Preview)**: Pha 1 đóng vai trò là bước xem trước (Preview) cấu trúc vĩ mô. Giao diện hỗ trợ tương tác và hội thoại (chat) để Chủ dự án rà soát, tinh chỉnh linh hoạt phạm vi (Scope), ngăn xếp công nghệ (Tech Stack) và danh sách các giai đoạn (Work Phases) trước khi kích hoạt sinh chi tiết.
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

* **Luồng thực thi & Lưu trữ 1 lần**: Khi Chủ dự án xác nhận bản thảo ở Pha 1, Backend gửi yêu cầu sinh đồ thị chi tiết. Backend chạy thuật toán Kahn khử chu trình rồi lưu thẳng vào Database trong một Transaction duy nhất (`@Transactional`) và hiển thị lên Canvas. Mọi thao tác bổ sung, tinh chỉnh sau khi sinh đồ thị sẽ do người dùng tự thực hiện trực tiếp trên Canvas trực quan (thêm node, nối dây, cập nhật thuộc tính trong Drawer), không cần gọi lại AI.
* **Quy tắc Chống tràn Token (Node Cap Constraint)**: Ghi rõ trong System Prompt của Pha 2 chỉ giới hạn sinh tối đa **15–25 Nodes cốt lõi** (ở cấp độ Module / Feature chính, tuyệt đối không chia vụn thành các sub-task nhỏ lẻ hay checklist vi mô) để tránh JSON kết quả quá dài chạm trần `maxOutputTokens` gây lỗi `Malformed JSON`.
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
  1. **Cycle Detection (Thuật toán Kahn)**: Nếu phát hiện cạnh gây chu trình lặp ($A \to B \to A$), Backend tự động loại bỏ cạnh đó hoặc trả lỗi chi tiết, thẩm định 100% đồ thị phi chu trình (Acyclic) trước khi lưu DB.
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
   $$V_{\text{target}} = \frac{\text{Tổng số Node chưa hoàn tất}}{\max(1, \text{Số ngày còn lại đến Deadline dự án})}$$
   * **Hạn chót dự án**: Được Backend tự động lấy từ $\max(\text{WORK\_PHASE.planned\_end})$ (hoặc fallback về $\max(\text{NODE.due\_date})$ nếu dự án không chia phase).
   * **Bảo vệ an toàn mẫu số**: Mẫu số được bọc qua hàm $\max(1, \text{Số ngày còn lại})$ nhằm triệt tiêu hoàn toàn lỗi chia cho 0 khi dự án đã chạm hoặc vượt quá hạn chót.
   * **Kiểm tra biên ($V_{\text{target}} > 0$)**: Nếu toàn bộ Node đã hoàn thành (`Tổng số Node chưa hoàn tất == 0` $\Rightarrow V_{\text{target}} = 0$), hệ thống kết luận dự án đã hoàn thành đúng hạn và lập tức gán $\text{DriftScore} = 0\%$ (trạng thái GREEN, kết thúc tính toán, tránh lỗi chia cho 0). Hệ thống chỉ thực hiện tính $\text{DriftScore}$ khi $V_{\text{target}} > 0$.
2. **Vận tốc Thực tế 7 ngày gần nhất ($V_{\text{actual}}$)**:
   $$V_{\text{actual}} = \frac{\text{Số Node đã chuyển sang DONE trong 7 ngày qua}}{7}$$
3. **Chỉ số Lệch Quỹ Đạo (Drift Score)**:
   $$\text{DriftScore} = 1 - \frac{V_{\text{actual}}}{V_{\text{target}}}$$

#### b. Ma trận phân cấp cảnh báo & 2 Chốt chặn chống đốt Token:
* **$\text{DriftScore} < 20\%$ (GREEN - Ổn định)**: Quỹ đạo đúng tiến độ, AI ngủ yên (0 token).
* **$20\% \le \text{DriftScore} < 40\%$ (YELLOW - Chệch nhẹ)**: Cập nhật badge cảnh báo vàng trên Overview Dashboard.
* **$\text{DriftScore} \ge 40\%$ (RED - Báo động vỡ tiến độ)**: Đạt ngưỡng báo động đỏ. Tuy nhiên, trước khi kích hoạt gọi Gemini API thực hiện **Điều Tra Pháp Y Dữ Liệu (Forensic Profiling)**, Backend **BẮT BUỘC** kiểm tra 2 chốt chặn chống lãng phí token:
  1. *Warm-up Guard (Chống lỗi Cold-Start ngày đầu khi $V_{\text{actual}} = 0$):*  
     Khi dự án mới khởi chạy những ngày đầu, do chưa có task nào hoàn thành ($V_{\text{actual}} = 0$) sẽ dẫn đến $\text{DriftScore} = 100\%$ giả tạo. Do đó, hệ thống chỉ kích hoạt tính `DriftScore` và gọi AI khi:
     * Dự án đã chạy tối thiểu **3–5 ngày** kể từ lúc Node đầu tiên chuyển sang trạng thái `IN_PROGRESS`.
     * **VÀ** có ít nhất **1 Node vi phạm ngưỡng ngâm lâu (`Stalled Node`) hoặc bị Reject $\ge 2$ lần**.
  2. *Cooldown & State Dedup (Chống gọi lặp lại mỗi đêm):*  
     Trước khi gọi Gemini API, Backend kiểm tra bảng `PROJECT_AI_ANALYSIS`:
     * Nếu lần phân tích gần nhất (`analyzed_at`) mới diễn ra trong vòng **24 giờ qua**,
     * **HOẶC** danh sách mã nút nghẽn (`Stalled Node` + `Rejection Friction`) hoàn toàn **không thay đổi** so với lần phân tích trước đó,
     * $\rightarrow$ Lập tức dùng lại kết quả cũ trong DB, chi phí tốn **0 Token** (trừ khi Chủ dự án chủ động bấm `trigger-audit` cưỡng bức).

#### c. Hồ sơ Pháp y Dữ liệu (Backend tự thu thập theo đúng ERD trước khi gọi AI):
Backend gom đúng 3 nhóm bằng chứng định lượng:
1. **Nút ngâm lâu nhất trên đường găng (Stalled Node)**: Nút có thời gian thực thi ở trạng thái `IN_PROGRESS` vượt quá 2.5 lần ước lượng:
   $$\text{TimeInState}(IN\_PROGRESS) = (\text{now} - \text{NODE.started\_at}) \ge 2.5 \times \text{NODE.estimated\_hours}$$
2. **Nút bị từ chối nhiều nhất (Rejection Friction)**: Kiểm tra điều kiện `NODE.current_round >= 3` (tức đã bị từ chối nghiệm thu $\ge 2$ lần) và trích xuất đúng 2 lý do (`comment`) gần nhất có `decision = 'REJECTED'` trực tiếp từ bảng **`NODE_REVIEW`**.
3. **Bán kính phong tỏa (Blast Radius)**: Số lượng task con downstream đang bị nút này giữ chân ở trạng thái `LOCKED`.

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
* Frontend tự động kích hoạt API ngầm: `POST /api/nodes/{id}/simulate-assign?userId={namId}`.
* **Bản chất kỹ thuật**: Bước mô phỏng tải khi chọn thành viên trong Dropdown chạy **100% bằng thuật toán đồ thị CPM Forward Pass trên Java thuần (`< 5ms`, tốn `0 Token`)**, hoàn toàn không gọi qua mạng tới Gemini API nhằm đảm bảo phản hồi tức thì và tính khả dụng tuyệt đối.

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
│  ┌─ ⚠️ CẢNH BÁO MÔ PHỎNG TẢI (CPM WORKLOAD COLLISION) ────────────────┐ │
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

### 4.1 Schema Lưu Trữ Bảng `PROJECT_AI_ANALYSIS` (PostgreSQL)

Kết quả phân tích từ Phân hệ AI được lưu trữ trực tiếp vào bảng **`PROJECT_AI_ANALYSIS`** (khớp với ERD hiện tại) với cấu trúc phân bổ các trường:
* Cột `metrics` (`jsonb`): Lưu trữ các số liệu đo lường vận tốc và độ lệch (`driftMetrics`).
* Cột `latest_analysis` (`jsonb`): Lưu trữ hồ sơ điều tra pháp y (`forensicInvestigation`) và danh sách khuyến nghị xử lý (`triageRecommendations`).
* Cột `analyzed_at` (`timestamptz`): Lưu thời gian hoàn tất phân tích (dùng cho chốt chặn Cooldown & State Dedup 24 giờ).

> [!NOTE]
> Cấu trúc JSON của `triageRecommendations` chỉ trả về `instruction` dạng text để đề xuất giải pháp can thiệp, không bổ sung mảng sub-nodes phức tạp nhằm giữ tính gọn nhẹ và trao toàn quyền quyết định cấu trúc đồ thị cho Project Owner.

#### a. Cấu trúc Cột `metrics` (JSONB):
```json
{
  "targetVelocity": 2.0,
  "actualVelocity": 0.58,
  "driftScore": 71.0,
  "status": "RED_ALERT"
}
```

#### b. Cấu trúc Cột `latest_analysis` (JSONB):
```json
{
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
  ]
}
```

#### c. Schema DTO Toàn Phần (`TrajectoryAnalysisResponse`):
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

### 4.3 Đồng bộ Trường Thời Gian trên Bảng `NODE` (Đã Bổ Sung Qua Migration V3)

Để phục vụ các thuật toán tính toán toán học Java thuần của Phân hệ AI (CPM Forward Pass và Trajectory Drift Engine) mà không cần truy vấn phức tạp, bảng `NODE` đã được bổ sung 2 cột sau (thực thi qua file Flyway migration `V3__add_node_ai_time_columns.sql`):

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mặc Định | Vai Trò Kỹ Thuật trong Phân Hệ AI |
| :--- | :--- | :--- | :--- | :--- |
| `estimated_hours` | `int` | NOT NULL | `8` | Thời gian ước tính hoàn thành tác vụ (giờ). Đóng vai trò là $\text{Duration}$ trong thuật toán lan truyền thời gian **CPM Forward Pass** và dùng để tính ngưỡng ngâm việc của **Stalled Node** ($2.5 \times \text{estimated\_hours}$). |
| `started_at` | `timestamptz` | NULLABLE | `NULL` | Thời điểm tác vụ thực tế bắt đầu thực thi (chuyển sang trạng thái `IN_PROGRESS`). Dùng để đo lường chính xác thời gian ngâm tác vụ: $\text{TimeInState}(IN\_PROGRESS) = (\text{now} - \text{started\_at})$. |

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
