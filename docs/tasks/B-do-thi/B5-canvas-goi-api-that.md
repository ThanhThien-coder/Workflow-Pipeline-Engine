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

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
- Lời gọi đồ thị đang có fallback ngầm: backend lỗi thì canvas hiện dữ liệu giả mà không ai biết.
- Phần đổi dữ liệu từ mô hình phẳng của backend (phases, nodes, dependencies) sang mô hình Root/Branch/Ghost (`GraphNodeMap`) của FE đang viết lặp lại trong 3 hàm, chưa có test.
- `addRootTask`, `attachGhostNode`, `updatePhasePosition` vẫn chạy mock; vị trí phase sẽ lưu được sau B2.
- **Canvas chưa khóa theo vai trò (thêm ngày 12/11/2026, sau B3).** Từ B3, backend chỉ cho **owner** sửa đồ thị; Collaborator và Viewer gọi API ghi sẽ nhận 403. Nhưng `FE/components/workflow/**`, `FE/components/mindmap/**` không kiểm tra vai trò ở đâu cả: người không phải owner vẫn kéo thả, thêm node, nối cạnh được, thao tác xong mới nhận lỗi. Backend chặn là lớp bảo vệ thật; task này thêm lớp giao diện để người dùng không bấm được ngay từ đầu.

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
- **Khóa canvas theo vai trò** (thêm ngày 12/11/2026):
  - Vai trò lấy từ store: `useWorkflowStore((s) => s.settings.settings?.myRole)` (chỉ đọc, không sửa `settingsSlice`). Quy ước giống `GeneralSettingsSection`: `isOwner = myRole === 'OWNER'`.
  - Không phải owner thì canvas ở chế độ **chỉ xem**: không kéo được phase và node; ẩn hoặc vô hiệu hóa (`disabled`) các nút tạo, sửa, xóa phase và node, nối và gỡ cạnh; không mở được thao tác kéo để nối (`usePhaseConnectDrag`). Nút bị vô hiệu hóa có `title` "Chỉ chủ dự án được sửa đồ thị".
  - Vẫn cho xem: pan, zoom, chọn phase, mở chi tiết node.
  - Không phải owner thì **không gọi** API ghi nào của đồ thị (kể cả `PATCH metadata`, `PUT /phases/{id}`).
  - Vẫn giữ xử lý 403 → toast ở dòng trên, phòng khi vai trò đổi giữa phiên hoặc store chưa kịp cập nhật.
  - Dự án `ARCHIVED`: owner cũng ở chế độ chỉ xem (backend trả 409 `PROJECT_ARCHIVED` từ B2, B3).
  - Phải kiểm `myRole` đã được nạp khi vào thẳng màn canvas (không qua Settings). Nếu chưa nạp thì ghi vào "Điều chưa chắc" và báo nhóm, vì nạp settings nằm ngoài "Được ghi" của task này.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Tự viết** `graphMapper` và test (đây là phần cốt lõi). Claude chỉ review.
3. 🤝 Viết `graph.ts`, nối các component.
4. 🧠 Chạy thật trên dữ liệu seed: tạo phase, nối 2 phase, thêm node, nối node thành vòng.
5. 🤝 Khóa canvas theo vai trò (đặc tả ở trên), có test component cho vai trò VIEWER và OWNER.
6. 🤝 Thêm test component nếu có thay đổi lớn.

## Tiêu chí xong
- [ ] `npm run typecheck && npm test` pass.
- [ ] `graphMapper` có ít nhất 8 test: phase nhiều cha, ghost khác phase, node độc lập, đồ thị rỗng…
- [ ] Chạy thật: tạo phase, nối 2 phase, thêm node, nối node thành vòng thì hiện modal chu trình. F5 vẫn giữ vị trí đã kéo thả.
- [ ] Chạy thật với sarah (COLLABORATOR) và một tài khoản VIEWER trên dự án mẫu: không kéo được phase, node; các nút sửa đồ thị bị ẩn hoặc vô hiệu hóa; tab Network không có request ghi đồ thị nào. Đăng nhập alex (owner) thì thao tác bình thường.
- [ ] Có test component: vai trò VIEWER thì nút thêm node, thêm phase bị vô hiệu hóa; OWNER thì bấm được.

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
