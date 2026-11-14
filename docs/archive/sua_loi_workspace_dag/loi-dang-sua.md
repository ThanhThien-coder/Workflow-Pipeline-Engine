# Sửa lỗi Workspace DAG

Lỗi phát hiện khi test tay với backend thật (`VITE_USE_MOCK=false`). Làm tới đâu sửa tới đó. Cách sửa theo [README.md](README.md).

| # | Lỗi | Khu vực | Trạng thái |
|---|---|---|---|
| G1 | Tạo dự án từ template mẫu (SDLC, Marketing, DevOps) bị lỗi, chỉ tạo được dự án trống | FE | Đã sửa, chờ test tay |

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
