# B5 — Nối canvas Macro/Mindmap với API đồ thị thật (FE Cụm 4)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: A2, B3
Cần trước bước frontend: không
Mở khóa: B6
Nhánh git: b5-graph-ui
Ước lượng: 2 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `HttpWorkflowService.ts` đã gọi API thật cho `getMacroPhases`, `getPhaseEdges`, `getPhaseGraph`, `createPhase`, `connectPhases`, `disconnectPhases`, `deletePhase`, nhưng **vẫn rơi về mock khi lỗi** (`return super.…`), và phần chuyển dữ liệu nằm lẫn trong từng hàm. Sau khi A2 tách file, task này dọn lại phần đồ thị.

## Vì sao cần task này
- Lời gọi đồ thị đang có fallback ngầm: backend lỗi thì canvas hiện dữ liệu giả mà không ai biết.
- Phần đổi dữ liệu từ mô hình phẳng của backend (phases, nodes, dependencies) sang mô hình Root/Branch/Ghost (`GraphNodeMap`) của FE đang viết lặp lại trong 3 hàm, chưa có test.
- `addRootTask`, `attachGhostNode`, `updatePhasePosition` vẫn chạy mock; vị trí phase sẽ lưu được sau B2.

## Kiến thức phải nắm
Mẫu Mapper/Adapter, chuẩn hóa dữ liệu (normalize), optimistic UI và cách chờ server, debounce khi kéo thả.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/types/workflow.types.ts`; phần phase/graph trong `FE/services/MockWorkflowService.ts`; `FE/services/workflow/WorkflowService.ts` và `IWorkflowGraphService.ts`; `FE/components/workflow/MacroWorkflow.tsx`, `FE/components/mindmap/MindmapTree.tsx`; `FE/lib/graph/treeLayout.ts`, `phaseLayout.ts`; `FE/mappers/projectMapper.ts` (xem cách một mapper đang được viết).
Trả lời:
1. Root, Branch, Ghost node trên FE tương ứng với gì ở backend? (gợi ý: Ghost là cạnh phụ thuộc nối sang phase khác)
2. Kéo một node làm phát sinh khoảng 60 sự kiện mỗi giây. Gọi API mỗi lần thì sao?
3. `FE/services/workflow/WorkflowService.ts` và `IWorkflowService` khác vai trò nhau thế nào?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `docs/**`

## Được ghi
- `FE/services/impl/http/graph.ts`
- `FE/services/impl/HttpWorkflowService.ts` (chỉ các phương thức đồ thị và danh sách `METHODS_STILL_MOCKED`)
- `FE/mappers/graphMapper.ts` (mới) và test
- `FE/components/workflow/**`, `FE/components/mindmap/**`
- `FE/hooks/usePhaseConnectDrag.ts`, `FE/hooks/useEdgeRenderer.ts`
- `FE/types/workflow.types.ts`
- `FE/store/useWorkflowStore.ts` (chỉ phần phase/đồ thị)
- `docs/tasks/B-do-thi/B5-canvas-goi-api-that.md`

## Đặc tả đã chốt
- Backend trả mô hình phẳng (B2). Gom phần chuyển đổi đang nằm trong `HttpWorkflowService` về `FE/mappers/graphMapper.ts` với 3 hàm: `toMacroPhases(graph)`, `toPhaseEdges(graph)`, `toPhaseTree(graph, phaseId)`. Ghost = dependency có `parent.phaseId !== child.phaseId`, gắn vào node con. Hành vi hiển thị phải giữ nguyên như hiện tại.
- Bỏ mọi `return super.…` trong phần đồ thị: lỗi thì ném `ApiError` (A2).
- `addRootTask` gọi `POST /projects/{id}/nodes`; `attachGhostNode` gọi `POST /projects/{id}/dependencies`.
- Lưu tọa độ node: gọi `PATCH /nodes/{id}/metadata` khi thả chuột, debounce 300ms. Phase lưu tọa độ qua `PUT /phases/{id}` với `uiMetadata` (`updatePhasePosition`, cần B2).
- Lời gọi API đặt trong `FE/services/impl/http/graph.ts` (khung do A2 tạo). Phương thức nào đã gọi thật thì xóa khỏi `METHODS_STILL_MOCKED`.
- Nối tạo vòng (422) → mở `KahnCycleModal` với danh sách mã. 403 và 409 → toast theo `ApiError.code`.
- `resetPhaseTree` chưa có trong SSOT → giữ mock, ghi lý do.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Tự viết** `graphMapper` và test (đây là phần cốt lõi). Claude chỉ review.
3. 🤝 Viết `graph.ts`, nối các component.
4. 🧠 Chạy thật trên dữ liệu seed: tạo phase, nối 2 phase, thêm node, nối node thành vòng.
5. 🤝 Thêm test component nếu có thay đổi lớn.

## Tiêu chí xong
- [ ] `npm run typecheck && npm test` pass.
- [ ] `graphMapper` có ít nhất 8 test: phase nhiều cha, ghost khác phase, node độc lập, đồ thị rỗng…
- [ ] Chạy thật: tạo phase, nối 2 phase, thêm node, nối node thành vòng thì hiện modal chu trình. F5 vẫn giữ vị trí đã kéo thả.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Mapper ở đây là mẫu thiết kế gì? Vì sao không để component tự đổi dữ liệu?
2. Debounce khác throttle ở đâu? Chỗ này vì sao dùng debounce?
3. `PATCH metadata` lỗi mạng thì UI nên làm gì?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
