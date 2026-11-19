# S11 — Bỏ quan hệ cha-con giữa phase, dùng ghost thay thế (CHỜ THIỆN CHỐT)

Người làm: chưa giao (gợi ý Người 3 sau S10, vì đụng giao diện đồ thị)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: Thiện chốt phương án ở Bước 0
Mở khóa: không
Nhánh git: s11-phase-qua-ghost
Ước lượng: A: 1,5–2 ngày; B: 0,5 ngày

## Vì sao cần task này (lỗi gốc #18)
Hiện có **hai loại "phụ thuộc" chạy song song**, dễ gây hiểu nhầm:
- **Cạnh giữa phase** (bảng `phase_dependency`, nối bằng nút (+) trên thẻ phase hoặc ô "Prerequisite Phase"): **chỉ dùng để xếp cột và vẽ mũi tên** trên màn phase. Nó **không chặn** task nào. Nối phase A → B thì task ở B vẫn làm được ngay.
- **Ghost** (cạnh giữa 2 task ở 2 phase khác nhau, bảng `node_dependency`): **chặn thật**, task con khóa cho tới khi task cha xong. Nhưng màn phase không vẽ mũi tên cho các ghost này.

Thiện đề xuất: chỉ dùng ghost, bỏ quan hệ cha-con phase. Về logic là hợp lý, nhưng ảnh hưởng nhiều chỗ nên cần chốt trước.

## Bước 0 — Thiện chốt phương án
- **A (đề xuất): mũi tên phase tự suy ra từ ghost.**
  - Có ít nhất 1 ghost từ task ở phase X sang task ở phase Y thì vẽ mũi tên X → Y, chỉ để xem (ghi số liên kết, ví dụ "3 links").
  - Bỏ thao tác nối/gỡ phase bằng tay và ô "Prerequisite Phase".
  - Nút (+) trên thẻ phase chỉ còn "tạo phase mới bên phải" (lưu vị trí, không tạo cạnh).
  - Thứ tự cột tính từ mũi tên suy ra; phase không có ghost giữ vị trí đã lưu.
- **B (nhẹ):** giữ cạnh phase làm bằng tay nhưng ghi rõ "chỉ để sắp xếp, không chặn task" (tooltip, chữ trong hộp tạo phase). Vẽ thêm mũi tên **nét đứt** suy ra từ ghost để người dùng thấy phụ thuộc thật.
- **C (không đề xuất):** cạnh phase có hiệu lực thật: nối A → B thì tự tạo ghost từ mọi task cuối của A tới mọi task đầu của B. Sinh dây ngầm nên khó hiểu và khó gỡ.

`Thiện chốt: ___` (19/11: Thiện để sau, chưa làm)

Ảnh hưởng nếu chọn **A** (phải tính trong task):
- **Template**: `BE/service/PipelineTemplateService.java`, `BE/service/TemplateCloneService.java` (sao chép `phase_dependency`), `BE/service/engine/KahnDagService.java` (kiểm vòng của phase trong template), Template Studio phía admin (`FE/features/admin/templates/**`, `PhaseCanvas.tsx`).
  - Đề xuất: **template giữ nguyên** cạnh phase (Studio vẫn dùng).
  - Khi clone template thành dự án, cạnh phase chỉ dùng để đặt vị trí ban đầu, không còn hiện là mũi tên.
- **Dữ liệu cũ**: bảng `phase_dependency` của dự án giữ nguyên, không xóa; màn phase dự án thôi vẽ nó.
- **Tài liệu OOAD D7/D8**: các sơ đồ có "phase DAG" cần cập nhật ghi chú.

## Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/**`, `docs/specs/workflow-engine.md`, `docs/ooad/**`

## Được ghi (phương án A)
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`
- `BE/service/WorkflowGraphService.java` (`getGraph` trả thêm `derivedPhaseEdges: [{ from, to, count }]`), `BE/dto/response/graph/WorkflowGraphResponse.java` (thêm field cuối)
- `FE/types/workflow.types.ts` (thêm field tùy chọn), `FE/mappers/graphMapper.ts`, `FE/store/useWorkflowStore.ts`
- `FE/components/workflow/MacroWorkflow.tsx`, `PhaseCard.tsx`, `CreatePhaseModal.tsx`, `WorkflowEdge.tsx`, `FE/hooks/usePhaseConnectDrag.ts`, `FE/utils/phaseColumnLayout.ts`, `FE/utils/macroLayout.ts`
- Test liên quan; `docs/specs/workflow-engine.md`; ghi chú trong `docs/ooad/**` (nếu có sơ đồ phase DAG); file task này

## Được ghi (phương án B)
- `FE/components/workflow/MacroWorkflow.tsx`, `PhaseCard.tsx`, `CreatePhaseModal.tsx`, `WorkflowEdge.tsx`, `BE/service/WorkflowGraphService.java` + DTO (chỉ phần `derivedPhaseEdges`), types, mapper, test.

## Đặc tả đã chốt (phương án A)
- `derivedPhaseEdges`:
  - Gom mọi `node_dependency` có cha thuộc phase X và con thuộc phase Y (X ≠ Y, cả hai khác null). Đếm số cạnh cho mỗi cặp (X, Y).
  - Có vòng giữa phase (X → Y và Y → X qua các task khác nhau) thì vẫn trả cả hai. FE vẽ cả hai, và cột tính theo thứ tự tô-pô **bỏ qua** cạnh gây vòng.
- Màn phase:
  - Mũi tên vẽ từ `derivedPhaseEdges`, ghi số liên kết ở giữa dây, không có nút ✕ gỡ (muốn gỡ thì gỡ ghost trong màn chi tiết phase).
  - Bỏ kéo nối từ cổng (+). Bấm (+) = tạo phase "New phase" ở cột kế bên phải, cùng hàng (logic đặt vị trí của TASK_72 giữ nguyên, chỉ không gửi `parentPhaseId`).
  - `CreatePhaseModal` bỏ ô "Prerequisite Phase".
- Backend: API `connect`/`disconnect` phase **giữ lại** (template và dữ liệu cũ còn dùng) nhưng FE dự án không gọi nữa.

## Việc cần làm
1. 🧠 Bước 0 (Thiện chốt). Người làm đọc `getGraph` và `phaseColumns`, giải thích lại cho Thiện bằng lời: "cột của phase được tính thế nào".
2. 🤝 Backend `derivedPhaseEdges` + test (2 ghost cùng cặp → `count = 2`; cạnh trong cùng phase không tính; node không phase không tính).
3. 🤝 Frontend theo phương án đã chốt + test.
4. Cập nhật tài liệu.

## Tiêu chí xong
- [ ] `./mvnw -q test`, `npx vitest run` (ổ `C:` hoa) xanh, `npx tsc -b` sạch.
- [ ] Kiểm tay (A): gắn ghost từ task phase A sang task phase B → màn phase hiện mũi tên A → B ghi "1 link"; gỡ ghost → mũi tên mất; không còn cách nối phase bằng tay.

## Câu hỏi bảo vệ
1. Vì sao cạnh phase làm bằng tay dễ gây hiểu nhầm cho người dùng?
2. Template vẫn giữ cạnh phase, vậy khi clone template thành dự án thì cạnh đó dùng vào việc gì?

## Cấm
- Bắt đầu code khi dòng "Thiện chốt" còn trống. Xóa bảng `phase_dependency` hoặc dữ liệu cũ.
- Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5.
- Dòng "Thiện chốt" trống thì DỪNG và báo người làm hỏi Thiện. Chỉ làm đúng phần "Được ghi" của phương án đã chốt.
- Làm xong: ghi chép, `chờ kiểm`, hỏi 2 câu bảo vệ.

## Ghi chép của người làm
