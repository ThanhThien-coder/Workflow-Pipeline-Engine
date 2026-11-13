# FB2 — Phase mới tạo phải xếp xuống dưới, không chen ngang

Người làm: B
Trạng thái: chưa làm
Lỗi xử lý: L5 (ảnh 1 trong `test sơ.md`)
Nhánh git: fix-fb2-vi-tri-phase
Làm trước: không

> Viết tắt như FB1.

## Lỗi người dùng thấy
Tạo phase con thứ hai của cùng một phase cha: phase mới nằm **ngang bên phải** phase con thứ nhất (ảnh 1), thay vì xếp **xuống dưới** cùng cột. Kéo vị trí xong F5 cũng có lúc nhảy lại.

## Nguyên nhân (đã đọc code)
- `FE/utils/macroLayout.ts` có `computeSmartMacroPhasePosition(existingPhases, parentPhaseId)`: phase con đặt ở cột bên phải phase cha, **xếp chồng xuống dưới** các phase đã có trong cột đó. Nhưng hàm này **chỉ chế độ mock dùng** (`MockWorkflowService.ts:395`, `mockProjectGraphStore.ts:236`).
- `FE/services/impl/HttpWorkflowService.ts` dòng 624–634, `createPhase`: gửi `name, sub, accent, parentPhaseId`, **không gửi `uiMetadata`**; trả về vị trí `dto.x/dto.y` do nơi gọi đưa (có thể rỗng).
- `FE/services/impl/http/graph.ts` dòng 15–20: `CreatePhaseBody` không có `uiMetadata`, dù backend `WorkflowGraphService.createPhase` (dòng 125) đã nhận và lưu `uiMetadata`.
- `FE/components/workflow/MacroWorkflow.tsx` dòng 71–83: phase có `x, y` thì dùng, không có thì dùng `computeMacroGraphLayout` (bố cục tự động theo cây), nên phase vừa tạo không có vị trí lưu sẽ bị xếp theo thuật toán khác với phase cũ đã lưu vị trí → chen ngang.

## Cách sửa (đã chốt)
1. Khi tạo phase ở chế độ API (cả nút "Tạo phase" lẫn kéo từ nút (+) để sinh phase con), tính vị trí bằng `computeSmartMacroPhasePosition(phase hiện có với vị trí đang hiển thị, parentPhaseId)` rồi gửi `uiMetadata: { x, y, w: MACRO_CARD_W, h: MACRO_CARD_H }` trong `POST /phases`.
2. Thêm `uiMetadata?` vào `CreatePhaseBody`. Kết quả `createPhase` trả về lấy vị trí từ response của backend.
3. "Phase hiện có" phải dùng **vị trí đang hiển thị** (kể cả phase chưa lưu vị trí, lấy từ bố cục tự động), để phép tính không đặt đè lên phase không có `x, y`.
4. Giữ quy tắc của hàm: phase gốc xếp xuống cột đầu; phase con xếp ở cột bên phải cha, dưới phase thấp nhất của cột đó; không đè lên phase nào.

## Được sửa
- `FE/services/impl/http/graph.ts` (chỉ `CreatePhaseBody`, `createPhase`), `FE/services/impl/HttpWorkflowService.ts` (chỉ `createPhase`)
- `FE/components/workflow/MacroWorkflow.tsx`, `FE/components/workflow/CreatePhaseModal.tsx`, `FE/hooks/usePhaseConnectDrag.ts` (chỉ chỗ truyền vị trí khi tạo), `FE/utils/macroLayout.ts`
- Test FE `FE/utils/__tests__/**`, `FE/components/workflow/__tests__/**`

## Test phải có
- `computeSmartMacroPhasePosition`: cha ở (40,60), đã có 1 con ở (510,60) → con thứ hai ở (510, 280) (cùng x, y tăng 1 bước). Phase gốc thứ hai xếp dưới phase gốc thứ nhất.
- `createPhase` ở chế độ HTTP gửi body có `uiMetadata`.

## Kiểm bằng tay
1. Mở dự án, tạo phase A; từ A tạo 2 phase con liên tiếp → 2 con nằm cùng cột, con sau ở dưới con trước.
2. F5 → vị trí giữ nguyên.

## Kết quả (Claude ghi, dán output thật)
