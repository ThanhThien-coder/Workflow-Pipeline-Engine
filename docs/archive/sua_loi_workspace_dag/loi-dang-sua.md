# Sửa lỗi Workspace DAG

Lỗi phát hiện khi test tay với backend thật (`VITE_USE_MOCK=false`). Làm tới đâu sửa tới đó. Cách sửa theo [README.md](README.md).

| # | Lỗi | Khu vực | Trạng thái |
|---|---|---|---|
| G1 | Tạo dự án từ template mẫu (SDLC, Marketing, DevOps) bị lỗi, chỉ tạo được dự án trống | FE | Đã sửa, chờ test tay |
| G2 | Phase mới tạo nằm ngang, dính sát nhau, phải bấm Auto Layout mới xếp đúng | FE | Đã sửa, chờ test tay |

---

## G1. Không tạo được dự án từ template mẫu

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Đăng nhập `alex.kim`, mở hộp tạo dự án.
2. Chọn một template mẫu (SDLC, Marketing hoặc DevOps), nhập tên, bấm tạo.
3. Báo lỗi, không tạo được. Tạo dự án trống hoặc từ template tự lưu thì được.

**Nguyên nhân (đã xác định)**
- FE: template mẫu có id là slug (`tpl-sdlc`, `tpl-marketing`, `tpl-devops`), template tự lưu có id số. `HttpWorkflowService.cloneTemplate` và `createProject` gọi `Number(templateId)` nên slug thành `NaN`, khi gửi JSON thành `null`. BE trả 400 "ID mẫu quy trình không được để trống".
- BE: không lỗi. `CloneTemplateRequest` và `CreateProjectRequest` nhận `templateId` kiểu `Object` (số hoặc slug). Gọi thử `POST /projects/clone-template` với từng slug đều tạo được, số phase/node khớp template (SDLC 4/7, Marketing 2/2, DevOps 2/2).
- DB: không liên quan.

**Cách sửa**
- FE: thêm hàm `toTemplateIdPayload()` trong `HttpWorkflowService.ts`: chuỗi toàn chữ số thì gửi số, còn lại gửi nguyên slug. Dùng ở cả `cloneTemplate` và `createProject`.
- BE, DB: không đổi.

**File đã sửa**
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts`
- `wpe-frontend/src/services/impl/__tests__/HttpWorkflowService.test.ts` (3 test mới)

**Kiểm tra**
- Test tự động: 3 test mới fail trước khi sửa (2 ca slug ra `null`), qua sau khi sửa. `npm run typecheck` sạch; `vitest run` 63 file / 456 test qua.
- Test tay: chờ test lại trên giao diện (tạo từ cả 3 template mẫu và từ template tự lưu).

<!-- Mẫu cho mỗi lỗi:

## Gx. <Tên lỗi>

**Ngày phát hiện:** dd/mm/yyyy

**Tái hiện**
1. ...

**Nguyên nhân (đã xác định)**
- FE: ...
- BE: ...
- DB: ...

**Cách sửa**
- FE: ...
- BE: ...
- DB: ...

**File đã sửa**
- ...

**Kiểm tra**
- Test tự động: ...
- Test tay: ...
-->

---

## G2. Phase mới tạo nằm ngang, dính sát nhau

**Ngày phát hiện:** 14/11/2026

**Tái hiện**
1. Mở Macro Pipeline của một dự án, bấm (+) trên một phase để sinh phase con (hoặc Add Phase).
2. Tạo thêm 2–3 phase con từ cùng một phase.
3. Các phase mới xếp thành một hàng ngang, thẻ dính sát và đè nhau một phần. Bấm Auto Layout thì mới xếp đúng (con ở cột bên phải, xếp dọc).

**Nguyên nhân (đã xác định)**
- FE `graphMapper.toMacroPhase` / `toCreatedMacroPhase`: phase chưa có `uiMetadata` thì tự gán `x = 60 + orderIndex * 360`, `y = 80`, tức một hàng ngang. Thẻ phase trên canvas rộng 380px (`MACRO_CARD_W`) nên bước 360px làm các thẻ đè nhau.
- Vì phase luôn có x, y giả, nhánh dùng bố cục tự động (`computeMacroGraphLayout`) trong `MacroWorkflow` không bao giờ chạy.
- FE `HttpWorkflowService.createPhase` và `CreatePhaseBody` không gửi `uiMetadata`, nên phase mới không được lưu vị trí. Hàm đặt vị trí thông minh `computeSmartMacroPhasePosition` chỉ chế độ mock dùng.
- BE: không lỗi. `CreatePhaseRequest` đã nhận và lưu `uiMetadata`, `PhaseResponse` trả lại.
- DB: không đổi (cột `work_phase.ui_metadata` đã có).

**Cách sửa**
- FE `types/workflow.types.ts`: `MacroPhase.x`, `y` thành tùy chọn. Không có thì canvas dùng bố cục tự động (nhánh đã có sẵn trong `MacroWorkflow`).
- FE `mappers/graphMapper.ts`: bỏ vị trí giả xếp ngang; chỉ dùng `uiMetadata.x/y` khi có đủ cả hai. `toCreatedMacroPhase` lấy vị trí từ response của BE.
- FE `utils/macroLayout.ts`: thêm `computeNewPhasePosition(phases, parentPhaseId)`: lấy vị trí đang hiển thị của các phase (phase chưa lưu vị trí thì theo bố cục tự động) rồi gọi `computeSmartMacroPhasePosition`. Phase con ở cột bên phải cha, xếp dưới phase thấp nhất của cột, không đè phase nào.
- FE `store/useWorkflowStore.ts` `createPhase`: tính vị trí bằng hàm trên (dùng cho cả nút Add Phase lẫn (+) sinh phase con) rồi truyền xuống service.
- FE `HttpWorkflowService.createPhase` + `http/graph.ts`: gửi `uiMetadata { x, y, w, h }` trong `POST /phases`.
- BE, DB: không đổi.

**File đã sửa**
- `wpe-frontend/src/types/workflow.types.ts`
- `wpe-frontend/src/mappers/graphMapper.ts`
- `wpe-frontend/src/utils/macroLayout.ts`
- `wpe-frontend/src/store/useWorkflowStore.ts`
- `wpe-frontend/src/services/impl/HttpWorkflowService.ts`, `wpe-frontend/src/services/impl/http/graph.ts`
- Test: `mappers/__tests__/graphMapper.test.ts` (cập nhật theo hành vi mới), `utils/__tests__/macroLayout.test.ts` (mới, 4 test), `services/impl/__tests__/HttpWorkflowService.test.ts` (thêm 1 test), `services/mock/__tests__/mockProjectGraphStore.test.ts` (chỉ sửa kiểu)

**Kiểm tra**
- Test tự động: `npm run typecheck` sạch; `vitest run` 64 file / 461 test qua.
- Test tay: chờ test lại. Lưu ý phase đã tạo trước khi sửa vẫn giữ vị trí cũ đã lưu; kiểm bằng phase tạo mới hoặc dự án mới.
