# FC4 — Lưu trữ (archive) và xóa dự án không làm được

Người làm: C
Trạng thái: chờ kiểm
Lỗi xử lý: L17, L18
Nhánh git: fix-fc4-archive-delete
Làm trước: không

> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.

## Lỗi người dùng thấy
- Settings → Danger zone → "Archive project" báo lỗi, dự án không chuyển sang lưu trữ.
- "Delete project" bắt gõ đúng tên dự án (vd "abcd") mới bấm được; gõ xong vẫn không xóa được.

## Nguyên nhân (đã đọc code)
- `BE/service/ProjectService.java` dòng 40–45, `ALLOWED_TRANSITIONS` chỉ có: ACTIVE → {PAUSED, ARCHIVED, COMPLETED}; PAUSED → {ACTIVE, ARCHIVED}; INACTIVE → {ARCHIVED}; ARCHIVED → {ACTIVE}. **Không có DRAFT, PLANNING, COMPLETED → ARCHIVED.** Dự án mới luôn là DRAFT (tạo trống hoặc clone) nên không archive được.
- Xóa:
  - `FE/components/settings/DeleteProjectModal.tsx` dòng 18–31, 93–120: nút xóa chỉ bật khi `confirmText.trim() === projectName.trim()`.
  - `FE/services/impl/HttpWorkflowService.ts` dòng 59, 468–469: `deleteProject` vẫn mock.
  - Backend **không có** `DELETE /api/v1/projects/{id}` (`ProjectController` chỉ có GET, POST, PATCH `/status`, POST `/clone-template`).

## Cách sửa (đã chốt)
**Lưu trữ**
1. `ALLOWED_TRANSITIONS` thêm: DRAFT → ARCHIVED, PLANNING → ARCHIVED, COMPLETED → ARCHIVED; thêm ARCHIVED → DRAFT.
2. Khôi phục: FE gọi PATCH `/status` với `ACTIVE`. Backend: nếu dự án **chưa từng xuất bản** (mọi node đều LOCKED hoặc không có node) thì khôi phục về `DRAFT` thay vì ACTIVE (không cho bỏ qua bước xuất bản). Ghi rõ luật này trong comment.
3. Chỉ OWNER được archive/khôi phục (kiểm đang có; viết test).

**Xóa**
4. Backend `DELETE /api/v1/projects/{id}`: chỉ OWNER (`ProjectAuthorizationService.verifyProjectOwner`), trả 204. Xóa thật cùng dữ liệu con. Kiểm FK trong `V1__init_schema.sql` và các migration sau: bảng nào chưa `ON DELETE CASCADE` (node, node_dependency, phase_dependency, artifacts, guest_link, project_feedback, project_invitation, notification…) thì xóa thủ công trước theo đúng thứ tự trong một transaction. `pipeline_template.source_project_id` đã `ON DELETE SET NULL`.
5. FE `deleteProject` gọi API thật, xóa khỏi `METHODS_STILL_MOCKED`. Xóa xong: bỏ dự án khỏi danh sách workspace, chuyển về `/workspaces`, toast "Đã xóa dự án".
6. `DeleteProjectModal`: **bỏ ô gõ tên**. Thay bằng hộp xác nhận: tên dự án in đậm, cảnh báo "Không thể hoàn tác", nút "Hủy" và nút đỏ "Xóa vĩnh viễn". Đang xóa thì khóa nút. Lỗi → hiện message backend trong modal.

## Được sửa
- `BE/service/ProjectService.java`, `BE/controller/ProjectController.java`
- `BE/repository/*.java` (chỉ thêm method xóa theo project nếu cần)
- `BE-test/**/ProjectService*`, `BE-test/**/ProjectController*`
- `FE/services/impl/HttpWorkflowService.ts` (chỉ `deleteProject`, `archiveProject`, `restoreProject`, dòng `deleteProject` trong `METHODS_STILL_MOCKED`), `FE/services/impl/http/workspace.ts`
- `FE/components/settings/DeleteProjectModal.tsx`, `FE/components/settings/DangerZoneSection.tsx`, `FE/components/views/SettingsView.tsx` (chỉ phần xóa/lưu trữ), `FE/store/slices/settingsSlice.ts` (chỉ `archiveProject`, `restoreProject`, `deleteProject`), test FE

## Test phải có
- BE: archive dự án DRAFT → 200, ARCHIVED (trước khi sửa phải fail); khôi phục dự án chưa xuất bản → DRAFT; dự án đã xuất bản → ACTIVE; người không phải owner → 403.
- BE: DELETE bởi owner → 204, không còn dòng nào của dự án trong `node`, `work_phase`, `project_member`…; người khác → 403; không tồn tại → 404.
- FE: modal không còn ô nhập; bấm "Xóa vĩnh viễn" gọi API.

## Kiểm bằng tay
1. Tạo dự án mới (DRAFT) → Archive → thành công, thấy ở tab Archived; khôi phục → về DRAFT.
2. Xóa dự án → không phải gõ tên; dự án biến mất khỏi Workspace, F5 vẫn không còn.

## Kết quả (Claude ghi, dán output thật)

**File đã sửa**
- `BE/service/ProjectService.java`:
  - `ALLOWED_TRANSITIONS` thêm DRAFT/PLANNING/COMPLETED → ARCHIVED và ARCHIVED → DRAFT.
  - Khôi phục (ARCHIVED → ACTIVE) mà dự án chưa xuất bản (không có node, hoặc mọi node LOCKED) thì về DRAFT; luật này có ghi comment trong code.
  - Thêm `deleteProject` (chỉ OWNER qua `verifyProjectOwner`, `@Transactional`): xóa node, work_phase, project_member rồi xóa project; các bảng con khác đã `ON DELETE CASCADE`.
- `BE/controller/ProjectController.java`: `DELETE /api/v1/projects/{id}` → 204.
- `BE/repository/NodeRepository.java`, `WorkPhaseRepository.java`, `ProjectMemberRepository.java`: thêm `deleteByProjectId`.
- `FE/services/impl/http/workspace.ts`: thêm `deleteProject` (DELETE). `FE/services/impl/HttpWorkflowService.ts`: `deleteProject` gọi API thật, xóa dòng `deleteProject` khỏi `METHODS_STILL_MOCKED`.
- `FE/components/settings/DeleteProjectModal.tsx`: bỏ ô gõ tên; tên dự án in đậm, cảnh báo "Không thể hoàn tác", nút "Hủy" và nút đỏ "Xóa vĩnh viễn"; khóa nút khi đang xóa; lỗi backend hiện trong modal (`role="alert"`).
- `FE/store/slices/settingsSlice.ts`: `restoreProject` dùng status backend trả về (DRAFT hoặc ACTIVE); `deleteProject` xóa dự án khỏi danh sách workspace, toast "Đã xóa dự án", lỗi thì giữ message và ném lại cho modal. `SettingsView` (không đổi) chuyển về `/workspaces` khi xóa xong.
- `FE/components/settings/DangerZoneSection.tsx`: nút "Restore to Active" đổi thành "Restore Project".

**Test đã thêm**
- BE `ProjectServiceTest`: archive DRAFT/PLANNING/COMPLETED; khôi phục dự án chưa xuất bản → DRAFT, đã xuất bản → ACTIVE; người không phải owner → 403; DELETE bởi owner, người khác → 403, không tồn tại → 404.
- BE `ProjectControllerTest`: DELETE → 204 / 403 / 404.
- FE: `components/settings/__tests__/DeleteProjectModal.test.tsx` (không còn ô nhập; bấm "Xóa vĩnh viễn" gọi xóa ngay; lỗi hiện trong modal), 3 test FC4 trong `settingsSlice.test.ts`, 2 test trong `workspace.test.ts` (DELETE thật, restore giữ DRAFT).

**Output test thật** (13/11/2026)
- Trước khi sửa (chỉ có test mới):
  - BE `ProjectServiceTest`: `Tests run: 27, Failures: 1, Errors: 5` ("Không thể chuyển dự án từ DRAFT sang ARCHIVED"…).
  - FE: `DeleteProjectModal.test.tsx` 3 fail, `workspace.test.ts` 2 fail.
- Sau khi sửa:
```text
./mvnw test       → 448 test, Failures 0, Errors 0, Skipped 1
npm run typecheck → tsc -b, exit 0
npm test          → Test Files 48 passed (48) | Tests 369 passed (369)
```
