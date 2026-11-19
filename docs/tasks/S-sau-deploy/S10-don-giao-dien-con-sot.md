# S10 — Dọn các lỗi giao diện nhỏ còn sót sau TASK_68–74

Người làm: Người 3 (gói Giao diện)
Người review: Thiện
Trạng thái: chưa làm
Cần có trước: không (làm sau S09 để khỏi đụng `ProjectWorkspaceView`)
Mở khóa: không
Nhánh git: s10-don-giao-dien
Ước lượng: 0,5–1 ngày

## Vì sao cần task này
Khi Thiện test trên stack production thử (19/11), các mục chính đều chạy đúng, còn sót vài điểm nhỏ:
1. **Đầu thẻ ghost hiện id phase:** `[GHOST - 14]` (số 14 là id phase nguồn). Người dùng không hiểu số này. Code ở `FE/components/mindmap/GhostCard.tsx` khoảng dòng 44–71.
2. **Task có ghost bị lùi 1 cột:** ghost đứng ở cột ngay trước task nên task đó bị đẩy sang phải 1 cột, không thẳng hàng với task cùng cấp không có ghost (`FE/utils/spanningTreeLayout.ts`, phần đặt ghost).
3. **Nút demo "D" che nội dung:** khi bật công cụ demo, nút tròn nằm giữa cạnh dưới đè lên cột Kanban và bảng trong Settings (`FE/components/dev/DemoToolsPanel.tsx`, gắn ở `FE/views/ProjectWorkspaceView.tsx`).
4. **File không còn dùng:**
   - `FE/components/popovers/GhostPicker.tsx` (không nơi nào import);
   - `FE/components/mindmap/MicroGraphTree.tsx` (chỉ còn test dùng; màn thật dùng `MindmapTree`).
5. **Chữ cũ:** `AddRootTaskModal` mặc định tiêu đề "Add Root Task" trong khi root đã ẩn (màn thật đã truyền "Add task").

## Đang làm gì (tóm tắt cho người đọc)
1. Thẻ ghost ghi tên phase nguồn.
2. Khi phase có ghost, cây chừa sẵn một cột cho ghost để mọi task gốc thẳng hàng.
3. Dời nút demo lên thanh header (cạnh chuông thông báo) thành nút nhỏ "Demo"; bảng demo mở ngay dưới nút.
4. Xóa 2 file thừa và phần test chỉ dành cho file đó; giữ lại các test còn giá trị.
5. Sửa tiêu đề mặc định của hộp tạo task.

## Bước 0 — Tự đọc (15 phút)
Mở stack thử (README mục 4), tạo 2 phase. Phase B có 3 task, trong đó 1 task có ghost từ phase A. Chụp màn hình cây task của phase B (để so trước/sau). Đọc `calculatePhaseGraphLayout` trong `FE/utils/spanningTreeLayout.ts`, trả lời: x của task và x của ghost đang tính thế nào?

## Được đọc
- `wpe-frontend/src/**`

## Được ghi
> `FE/` = `wpe-frontend/src/`
- `FE/components/mindmap/GhostCard.tsx`, `FE/utils/spanningTreeLayout.ts`, `FE/components/mindmap/AddRootTaskModal.tsx`
- `FE/components/dev/DemoToolsPanel.tsx`, `FE/views/ProjectWorkspaceView.tsx` (chỉ chỗ gắn panel demo)
- Xóa: `FE/components/popovers/GhostPicker.tsx`, `FE/components/mindmap/MicroGraphTree.tsx`
- `FE/components/mindmap/__tests__/PhaseDetailTreeGraph.test.tsx` (bỏ phần chỉ test `MicroGraphTree`, giữ các nhóm test ghost/GhostCard/toolbar), `FE/utils/__tests__/spanningTreeLayout.test.ts`, `FE/components/dev/__tests__/DemoToolsPanel.test.tsx`
- File task này

## Đặc tả đã chốt
- **Thẻ ghost:** đầu thẻ ghi `From <tên phase nguồn>`.
  - Tên lấy theo thứ tự: `node.sourcePhaseTitle` → tên phase trong `macroPhases` qua `phaseDisplayName` → "Other phase".
  - Không hiện id số. `title` (tooltip) ghi tên đầy đủ.
- **Bố cục ghost:**
  - Phase có ít nhất 1 ghost: cột 0 dành cho ghost, mọi task gốc (không có cha trong phase) nằm cột 1, cấp con dịch theo.
  - Phase không có ghost: giữ như hiện tại (task gốc ở cột 0).
  - Ghost vẫn nằm ngang hàng (cùng y) với task đích. Nhiều ghost của cùng task xếp dọc, không đè thẻ khác.
  - Dây vẫn đi ghost → task.
- **Nút demo:**
  - `DemoToolsPanel` nhận thêm prop `variant: 'header'`: nút nhỏ chữ "Demo" (viền vàng), bảng mở dạng popover neo dưới nút (căn mép phải, rộng ~320px, cao tối đa 70vh, cuộn trong).
  - Gắn trong header của `ProjectWorkspaceView`, ngay trước `NotificationBell`. Bỏ chỗ gắn cũ trong `<main>`.
  - Phím tắt Ctrl+Shift+D giữ nguyên. Điều kiện hiện (backend bật + Owner/Admin) giữ nguyên.
- **File thừa:** xóa 2 file. Trong `PhaseDetailTreeGraph.test.tsx`, nhóm `describe` nào chỉ render `MicroGraphTree` thì chuyển sang render `MindmapTree` nếu vẫn còn ý nghĩa; nếu trùng với test đã có thì xóa và ghi rõ trong Ghi chép.
- `AddRootTaskModal` mặc định `heading = 'Add task'`, `description = 'Create a new task in this phase.'`.

## Việc cần làm
1. 🧠 Bước 0, lưu ảnh "trước".
2. 🤝 Thẻ ghost + test (hiện "From Discovery", không có số id).
3. 🤝 Bố cục chừa cột ghost + test: task gốc có ghost và task gốc không có ghost cùng `x`; ghost có `x + width <= x` của task đích; không thẻ nào đè nhau.
4. 🤝 Dời nút demo + sửa test panel.
5. 🤝 Xóa file thừa, sửa test như Đặc tả, sửa tiêu đề hộp tạo task.
6. 🧠 Chụp ảnh "sau" cùng chỗ như Bước 0, đính kèm vào PR.

## Tiêu chí xong
- [ ] `npx tsc -b` sạch, `npx vitest run` (ổ `C:` hoa) xanh; `grep -rn "MicroGraphTree\|GhostPicker" wpe-frontend/src` không còn kết quả.
- [ ] Kiểm tay: ảnh trước/sau cho thấy task thẳng hàng; thẻ ghost ghi tên phase; nút "Demo" nằm trên header, không che Kanban.

## Câu hỏi bảo vệ
1. Vì sao chừa cả một cột cho ghost thay vì chỉ lùi task có ghost?
2. Xóa file mà vẫn giữ được độ phủ test bằng cách nào?

## Cấm
- Đổi dữ liệu hay API (task này chỉ giao diện). Sửa phần khác của `ProjectWorkspaceView` ngoài chỗ gắn panel demo.
- Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Test frontend chạy từ `C:\...` viết hoa. File mới hoặc sửa phải lưu UTF-8 không BOM.
- Trước khi xóa file, chạy `grep -rn` để chắc không còn ai import.
- Làm xong: ghi chép, `chờ kiểm`, hỏi 2 câu bảo vệ.

## Ghi chép của người làm
