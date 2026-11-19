# S09 — Tìm kiếm: ô tìm trên header, tìm task trong cây, lọc Kanban, tìm trong các ô chọn

Người làm: Người 3 (gói Giao diện)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không
Mở khóa: không
Nhánh git: s09-tim-kiem
Ước lượng: 1 ngày

## Vì sao cần task này (lỗi gốc #27)
- Ô **"Search projects, tasks…"** trên header khi đang trong dự án là **ô giả**: không có state, không xử lý gì, phím ⌘K không gắn (`FE/views/ProjectWorkspaceView.tsx`, khoảng dòng 93–103).
- Dự án nhiều task thì khó tìm:
  - không tìm được task trên cây;
  - Kanban của phase không lọc được;
  - ô chọn task nguồn khi gắn ghost (`AddGhostModal`) và ô chọn người làm là danh sách dài không có ô tìm;
  - bảng Artifacts không tìm được.
- Đã có tìm kiếm ở: danh sách dự án, My Tasks, nhật ký trong Settings, các tab Admin. Những chỗ này không cần làm.

## Đang làm gì (tóm tắt cho người đọc)
1. Ô tìm trên header hoạt động thật:
   - gõ để tìm task (mã, tên, người làm) và phase của dự án đang mở;
   - chọn kết quả thì mở đúng phase và làm nổi task đó trên cây;
   - Ctrl/⌘+K để focus.
2. Kanban của phase có ô lọc chữ, lọc người làm, nút "Only mine".
3. Ô chọn task nguồn (gắn ghost) và bảng Artifacts có ô tìm.

Tất cả tìm trên dữ liệu đã có sẵn trên trình duyệt (store), **không cần API mới**.

## Bước 0 — Tự đọc (15 phút)
Đọc `FE/store/useWorkflowStore.ts` (`trees`, `macroPhases`, `loadPhases`) và `FE/components/workflow/WorkflowView.tsx` (đồng bộ đường dẫn với phase). Trả lời:
1. Sau khi vào dự án, store có sẵn cây task của **mọi** phase hay chỉ phase đang mở?
2. Muốn mở phase 12 của dự án 7 bằng code thì gọi gì?

## Được đọc
- `wpe-frontend/src/**`

## Được ghi
> `FE/` = `wpe-frontend/src/`
- `FE/components/search/ProjectSearchBox.tsx` (MỚI), `FE/utils/searchProject.ts` (MỚI, hàm thuần tìm và xếp hạng)
- `FE/views/ProjectWorkspaceView.tsx` (chỉ thay ô tìm giả bằng `ProjectSearchBox`)
- `FE/store/slices/uiSlice.ts` (thêm `highlightNodeId` + setter), `FE/components/mindmap/MindmapTree.tsx` (nghe `highlightNodeId`: zoom tới node, viền sáng ~2 giây)
- `FE/components/kanban/PhaseKanbanBoard.tsx` (thanh lọc), `FE/components/mindmap/AddGhostModal.tsx` (ô tìm task nguồn), `FE/components/workspace/WorkflowArtifactsDrawer.tsx` (ô tìm)
- Test mới/sửa liên quan, file task này

## Đặc tả đã chốt
- `searchProject(query, { macroPhases, trees, members })` trả tối đa 12 kết quả:
  - loại `task` (`id`, `code`, `title`, `phaseId`, tên phase, tên người làm) và loại `phase`;
  - khớp không phân biệt hoa thường, **không phân biệt dấu tiếng Việt** (normalize NFD, bỏ dấu);
  - xếp hạng: khớp mã chính xác > bắt đầu bằng > chứa.
- `ProjectSearchBox`:
  - Gõ ≥1 ký tự thì hiện dropdown. Phím ↑/↓ chọn, Enter mở, Esc đóng.
  - Đồ thị chưa tải cho dự án này thì gọi `loadPhases(projectId)` (hiện "Loading…").
  - Chọn task: `navigate('/project/<id>/workflow/phase/<phaseId>')` + `ui.setHighlightNodeId(taskId)`. Chọn phase: chỉ navigate.
  - Ctrl/⌘+K focus ô tìm (chỉ khi không đang gõ trong input khác).
- `MindmapTree`: khi `highlightNodeId` có trong cây thì dùng `fitToBounds` quanh node đó (zoom ≤ 100%), thêm viền sáng ~2 giây rồi xóa `highlightNodeId`.
- `PhaseKanbanBoard`: thanh lọc gồm ô chữ (mã, tên), ô chọn người làm (All / từng thành viên / Unassigned), nút "Only mine". Lọc trên danh sách đang có; số đếm cột theo kết quả lọc; có nút xóa lọc.
- `AddGhostModal`: ô tìm phía trên danh sách task nguồn (lọc theo mã, tên).
- Bảng Artifacts: ô tìm theo tên, link, loại.

## Việc cần làm
1. 🧠 Bước 0.
2. 🤝 `searchProject` + test (không dấu: gõ "thiet ke" tìm ra "Thiết kế"; xếp hạng; giới hạn 12).
3. 🤝 `ProjectSearchBox` + gắn header + test (gõ → dropdown → Enter gọi `navigate` đúng đường dẫn và `setHighlightNodeId`).
4. 🤝 Làm nổi node trong `MindmapTree` + test (gọi `fitToBounds` một lần, xóa highlight sau đó).
5. 🤝 Lọc Kanban, ô tìm ghost, ô tìm artifact + test.

## Tiêu chí xong
- [ ] `npx tsc -b` sạch, `npx vitest run` (ổ `C:` hoa) xanh.
- [ ] Kiểm tay trên stack thử:
  - đang ở Overview, bấm Ctrl+K, gõ mã một task ở phase khác, Enter → mở đúng phase, task được làm nổi và nằm giữa màn hình;
  - lọc Kanban "Only mine" chỉ còn task của mình.

## Câu hỏi bảo vệ
1. Vì sao tìm trên dữ liệu đã có ở trình duyệt mà không gọi API tìm kiếm?
2. Tìm "không phân biệt dấu" làm thế nào?

## Cấm
- Thêm API backend (không cần). Sửa phần khác của `ProjectWorkspaceView` (S02 và S10 cũng sửa file này, chỉ đụng vùng ô tìm).
- Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Test frontend chạy từ `C:\...` viết hoa.
- Dùng `fitToBounds` có sẵn trong `FE/hooks/usePanZoom.ts`, không viết lại hàm zoom.
- Làm xong: ghi chép, `chờ kiểm`, hỏi 2 câu bảo vệ.

## Ghi chép của người làm
