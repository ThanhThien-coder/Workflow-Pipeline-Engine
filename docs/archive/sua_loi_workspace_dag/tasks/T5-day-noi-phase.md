# T5 — Phase xếp theo cột, dây vuông góc chạy trong khe, có hướng

Sửa lỗi: G3
Trạng thái: chờ làm
Cần có trước: không (nên làm sau G2 đã sửa)
Mở khóa: không

## Vì sao cần task này
Dây nối giữa các phase cùng màu, không có mũi tên, chồng nhau ở hai đầu; dây tới phase bên trái/cùng cột cắt ngang qua thẻ. Chi tiết: `loi-dang-sua.md` mục G3.

## Quyết định đã chốt (14/11/2026)
- **Cột do DAG quyết định:** cột của phase = độ sâu dài nhất tính từ phase gốc (`colMap` trong `computeMacroGraphLayout`). Phase luôn nằm bên phải mọi phase cha, nên **mọi dây đi trái → phải**, không có dây ngược.
- **Kéo thẻ chỉ đổi thứ tự trong cột:** thả ra thì `x` bám về cột của phase, chỉ giữ `y` (thứ tự trên–dưới). Không đặt được sang cột khác.
- **Nối dây / tạo phase / xóa dây làm đổi độ sâu** → phase bị ảnh hưởng tự dời sang đúng cột (giữ thứ tự trên–dưới gần nhất có thể, không đè thẻ), lưu vị trí mới qua `PUT /phases/{id}` (uiMetadata).
- **Dây vuông góc (orthogonal):** ra cạnh phải thẻ nguồn → chạy ngang tới khe giữa cột nguồn và cột kế → chạy dọc trong khe → ngang vào cạnh trái thẻ đích. Dây vượt nhiều cột thì đi ngang trong **khe giữa hai hàng thẻ** của các cột trung gian, không cắt qua thẻ. Góc bo tròn nhẹ.
- **Mũi tên** ở đầu đích. **Nổi dây** của phase đang chọn/rê chuột (đậm, indigo, nét liền); dây khác mờ.
- **Auto Layout:** giữ cột theo DAG, sắp lại thứ tự trong từng cột để ít dây cắt nhau (heuristic barycenter: thứ tự theo trung bình vị trí phase cha), rồi lưu.
- Bỏ phương án "vòng dây ra ngoài thẻ".

## Được đọc
- `wpe-frontend/src/**`
- `docs/archive/sua_loi_workspace_dag/**`

## Được ghi
- `wpe-frontend/src/utils/macroLayout.ts` (cột theo DAG, bám cột, sắp thứ tự, tính đường dây)
- `wpe-frontend/src/components/workflow/WorkflowEdge.tsx`
- `wpe-frontend/src/components/workflow/MacroWorkflow.tsx` (kéo thả bám cột, SVG marker, nổi dây, Auto Layout)
- `wpe-frontend/src/components/workflow/PhaseCard.tsx` (chỉ nếu cần sự kiện rê chuột)
- `wpe-frontend/src/store/useWorkflowStore.ts` (sau `connectPhases`/`disconnectPhases`/`createPhase`: dời cột + lưu vị trí)
- Test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **Hàm thuần trong `macroLayout.ts`** (viết test trước cho từng hàm):
   - `phaseColumns(phases): Record<id, number>`: độ sâu dài nhất theo `parentPhaseIds`.
   - `columnX(col)`: `40 + col * (MACRO_CARD_W + MACRO_GAP_X)`.
   - `snapToColumn(phases, phaseId, y)`: trả `{ x: columnX(col), y }`, đẩy y xuống nếu đè thẻ khác cùng cột.
   - `reflowColumns(phases)`: phase nào có `x` khác cột đúng thì dời về cột đúng, không đè thẻ; trả danh sách phase đổi vị trí.
   - `orderColumnsByBarycenter(phases)`: vị trí cho Auto Layout.
   - `routeEdge(from, to, obstacles)`: chuỗi `d` của path vuông góc + điểm giữa (cho nút ✕). Test: không đoạn nào nằm trong khung thẻ nào khác; điểm đầu ở cạnh phải nguồn, điểm cuối ở cạnh trái đích.
2. **Kéo thả** (`MacroWorkflow.handleDragCardStart`): khi thả, dùng `snapToColumn` rồi lưu. Trong lúc kéo có thể cho lệch nhẹ, thả ra mới bám.
3. **Đổi cấu trúc** (store `connectPhases`, `disconnectPhases`, `createPhase`, `deletePhase`): sau khi BE nhận, chạy `reflowColumns`, cập nhật vị trí + gọi `updatePhasePosition` cho phase bị dời.
4. **Dây:** `WorkflowEdge` dùng `routeEdge`. Thêm `<defs><marker>` (thường + nổi) trong SVG của `MacroWorkflow`, path dùng `markerEnd`. Giữ nút ✕ gỡ dây ở điểm giữa và vùng bấm rộng 16px.
5. **Nổi dây:** `MacroWorkflow` giữ `hoveredPhaseId`; truyền `highlight: 'on' | 'dim' | 'normal'` cho `WorkflowEdge` theo phase đang chọn/rê.
6. **Auto Layout:** dùng `orderColumnsByBarycenter`, lưu vị trí.
7. Commit nhỏ theo bước.

## Tiêu chí xong
- Test mới cho các hàm ở bước 1 qua; typecheck 0 lỗi; vitest toàn bộ qua.
- Test tay: dựng sơ đồ như ảnh G3 (1 phase nối 4 phase, nối chéo PHASE 3/4/5 → 6/7).
  - Mọi dây có mũi tên, đi trái → phải, không dây nào cắt qua thẻ.
  - Kéo một thẻ sang cột khác rồi thả → thẻ bám về cột của nó.
  - Nối PHASE 7 → PHASE 3 (hợp lệ, không vòng) → PHASE 3 tự dời sang cột bên phải PHASE 7; F5 vẫn giữ vị trí.
  - Chọn/rê PHASE 6 → chỉ dây vào/ra PHASE 6 đậm, dây khác mờ.
  - Auto Layout → ít dây cắt nhau hơn trước, thứ tự được lưu.
  - Nút ✕ vẫn gỡ dây được.
