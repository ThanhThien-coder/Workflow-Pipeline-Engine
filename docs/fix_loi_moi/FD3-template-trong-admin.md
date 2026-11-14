# FD3 — Template trong admin: chỉ hiện template công khai, admin lưu được, template mẫu sửa được

Người làm: D
Trạng thái: chờ kiểm
Lỗi xử lý: L23, L24
Nhánh git: fix-fd3-template-admin
Làm trước: FA1 (đăng nhập admin, chặn `/admin`)

> Viết tắt như FA1.

## Lỗi người dùng thấy
- meo (user thường) lưu dự án thành template, vào `/admin` thấy template đó trong catalog. Đăng xuất, vào lại bằng tài khoản khác thì template đó mất.
- Vào admin bấm lưu template thì bị từ chối vì không có role ADMIN.

## Nguyên nhân (đã đọc code)
- Route `/admin` không kiểm quyền (FA1 sửa), nên meo vào được trang admin.
- `BE/service/PipelineTemplateService.getTemplates` lọc theo `canView`: trả template PUBLIC **và** template PRIVATE của chính người gọi. Catalog admin gọi chung API này nên khi meo đăng nhập thì thấy template riêng của meo; đổi người thì không thấy nữa. Template **không mất**, chỉ là PRIVATE của meo.
- Không đăng nhập được `admin` (L1), nên người test dùng tài khoản thường → `createTemplate` gọi `requireAdmin` → 403. Đúng hành vi, lỗi gốc là L1.

## Cách sửa (đã chốt)
1. **Catalog admin chỉ quản lý template PUBLIC.** `FE/features/admin/templates/TemplateCatalogView.tsx` lọc `visibility === 'PUBLIC'` (hoặc gọi `GET /templates?visibility=PUBLIC` nếu thêm tham số ở backend: chọn thêm tham số ở backend, vì lọc ở FE vẫn tải template riêng của người khác về). Template PRIVATE của user chỉ hiện ở màn chọn template khi tạo dự án của chính user đó.
2. **Kiểm admin sửa/xóa được 3 template mẫu** (id slug `tpl-sdlc`, `tpl-marketing`, `tpl-devops`): `HttpTemplateService.updateTemplate/deleteTemplate` gọi `/templates/{slug}`, backend đã có `updateTemplateBySlugOrId`. Viết test xác nhận; lỗi thì sửa.
3. **Báo lỗi rõ ràng** trong Template Studio: 403 → "Chỉ quản trị viên mới lưu được template"; 422 (đồ thị có chu trình) → hiện danh sách node trong chu trình; lỗi khác → message từ backend. Không nuốt lỗi.
4. **(Tùy chọn, làm sau khi FA3 merge)** Ghi nhật ký `TEMPLATE_CREATED/UPDATED/DELETED` bằng `AdminAuditService.record(...)` trong `PipelineTemplateService`.

## Được sửa
- `BE/controller/PipelineTemplateController.java`, `BE/service/PipelineTemplateService.java` (thêm tham số lọc `visibility`; mục 4 nếu làm)
- `BE-test/**/PipelineTemplate*`
- `FE/features/admin/templates/**`, `FE/hooks/useTemplateStudio.ts`, `FE/services/template/HttpTemplateService.ts`, `FE/services/template/ITemplateService.ts`, test FE

## Test phải có
- `GET /templates?visibility=PUBLIC` khi meo có 1 template PRIVATE: không có template của meo.
- Admin `PUT /templates/tpl-sdlc` đổi tên → 200; user thường → 403.
- Test FE: catalog admin không hiện template PRIVATE.

## Kiểm bằng tay
1. Đăng nhập meo, lưu một dự án thành template. Vào màn tạo dự án của meo → thấy template đó.
2. Đăng nhập admin → Templates: không thấy template của meo; thấy 3 template mẫu; sửa tên `tpl-sdlc` rồi lưu → thành công; tạo template mới → thành công.

## Kết quả (ThanhThien-coder ghi)
- Đã hoàn tất sửa đổi các file theo yêu cầu:
  + `wpe-backend/src/main/java/com/pipeline/wpe/service/PipelineTemplateService.java`: Thêm overload `getTemplates(..., visibility)`. Hỗ trợ lọc PUBLIC/PRIVATE, ném `IllegalArgumentException` khi giá trị không hợp lệ. Giữ nguyên overload 4 và 3 tham số.
  + `wpe-backend/src/main/java/com/pipeline/wpe/controller/PipelineTemplateController.java`: Thêm query parameter `visibility` cho endpoint `GET /templates`.
  + `wpe-backend/src/test/java/com/pipeline/wpe/service/PipelineTemplateServiceTest.java`: Bổ sung 3 unit tests kiểm tra lọc visibility PUBLIC/PRIVATE, ngoại lệ khi visibility sai và kiểm tra admin cập nhật theo slug `tpl-sdlc` thành công (user thường nhận 403 Forbidden).
  + `wpe-frontend/src/types/template.types.ts`: Bổ sung `visibility?: 'PUBLIC' | 'PRIVATE'` vào `TemplateFilter`.
  + `wpe-frontend/src/services/template/HttpTemplateService.ts`: Bổ sung gửi `query.visibility` khi có `filter.visibility`.
  + `wpe-frontend/src/services/template/MockTemplateService.ts`: Bổ sung lọc trong bộ nhớ `(t.visibility ?? 'PUBLIC') === filter.visibility`.
  + `wpe-frontend/src/features/admin/templates/TemplateCatalogView.tsx`: Gọi `getTemplates({ visibility: 'PUBLIC' })` và thêm dòng mô tả dưới tiêu đề.
  + `wpe-frontend/src/features/admin/templates/TemplateStudioView.tsx`: Cập nhật `describeSaveError` với thông báo 403 "Chỉ quản trị viên mới lưu được template", 422 hiển thị danh sách tên phase/node bị lặp từ `nameOf`.
  + `wpe-frontend/src/services/template/__tests__/HttpTemplateService.test.ts`: Bổ sung test gửi query `visibility=PUBLIC`.
  + `wpe-frontend/src/services/template/__tests__/MockTemplateService.test.ts`: Bổ sung test lọc `visibility: 'PUBLIC'` loại bỏ template PRIVATE.
  + `wpe-frontend/src/features/admin/templates/__tests__/TemplateStudioView.test.tsx`: Cập nhật kiểm tra message 403 mới và test 422 với `nameOf`.
  + `wpe-frontend/src/features/admin/templates/__tests__/TemplateCatalogView.test.tsx`: Tạo mới test xác nhận gọi `getTemplates({ visibility: 'PUBLIC' })` và hiển thị template PUBLIC.
- Mục 4 (nhật ký template) đã làm trong FA3.
- Ghi chú: Nhóm quyết 14/11: admin xóa được cả template mẫu (bỏ khóa của TASK_03).
