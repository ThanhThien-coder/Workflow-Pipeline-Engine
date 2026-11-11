# D2 — Thành viên và lời mời: đổi vai trò, chuyển quyền sở hữu, xóa mềm (Cụm 3.3, 3.4)

Người làm: D
Người review: A
Trạng thái: chưa làm
Cần có trước: D1
Cần trước bước frontend: không
Mở khóa: D8, X1
Nhánh git: d2-members
Ước lượng: 1,5–2 ngày

## Vì sao cần task này
Đọc code thấy các vấn đề sau (2 lỗi đầu **cần tái hiện để xác nhận**):
- Ràng buộc `uq_pending_project_invitation UNIQUE (project_id, invitee_id, status)` trong V4: mời → từ chối → mời lại → từ chối lần 2 sẽ đụng unique với bản ghi REJECTED cũ.
- `acceptInvitation` chỉ tìm thành viên **chưa bị xóa** (`findByProjectIdAndUserIdAndRemovedAtIsNull`). Người từng bị xóa mềm được mời lại rồi chấp nhận thì có thể chèn trùng, vi phạm `uq_project_member (project_id, user_id)`.
- `sendInvitation` cho COLLABORATOR gửi lời mời, trong khi SSOT (UC8, mục 3.3) chỉ cho OWNER.
- Chưa có `PATCH/DELETE /projects/{id}/members/{userId}`, chưa có API lấy danh sách thành viên.

## Kiến thức phải nắm
Partial unique index của PostgreSQL, xóa mềm (soft delete), transaction nhiều bảng, optimistic lock `@Version` trên lời mời, chuyển quyền sở hữu.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 3.3, 3.4; UC8, UC9 trong `docs/specs/system-overview.md`; bảng PROJECT_MEMBER và PROJECT_INVITATION trong `docs/specs/database-schema.md`; `V4__create_project_invitation.sql`; `BE/service/ProjectInvitationService.java`, `BE/controller/ProjectInvitationController.java`, `BE/service/ProjectAuthorizationService.java`, `BE/repository/ProjectMemberRepository.java` cùng test hiện có; `FE/components/settings/WorkspaceMembersSection.tsx`, `InviteMemberModal.tsx`, `KickMemberModal.tsx`, `FE/components/workspace/ProjectInviteAcceptModal.tsx`, `FE/store/slices/settingsSlice.ts`.
Trả lời:
1. 🧠 Viết từng câu SQL của kịch bản "từ chối 2 lần" và chỉ ra câu nào vi phạm unique.
2. Partial unique index `… WHERE status = 'PENDING'` khác unique constraint thường ở đâu?
3. Vì sao nhóm chọn "đổi vai trò thành OWNER nghĩa là chuyển quyền sở hữu" (xem đặc tả)? Lựa chọn này ảnh hưởng thế nào tới cổng duyệt bài của C?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `wpe-backend/src/main/resources/db/migration/V6__fix_invitation_unique.sql` (số V6 đã cấp cho D)
- `BE/service/ProjectInvitationService.java`, `BE/controller/ProjectInvitationController.java`, `BE/entity/ProjectInvitationEntity.java`
- `BE/controller/ProjectMemberController.java` (mới), `BE/service/ProjectMemberService.java` (mới)
- `BE/service/ProjectAuthorizationService.java`
- `BE/repository/ProjectMemberRepository.java`, `ProjectInvitationRepository.java`, `NodeRepository.java` (chỉ thêm method)
- `BE/dto/request/project/**`, `BE/dto/response/project/**`
- `BE-test/service/ProjectInvitationServiceTest.java`, `BE-test/service/ProjectMemberServiceTest.java` (mới), test controller
- `FE/components/settings/WorkspaceMembersSection.tsx`, `InviteMemberModal.tsx`, `KickMemberModal.tsx`, `FE/components/workspace/ProjectInviteAcceptModal.tsx`
- `FE/store/slices/settingsSlice.ts` (trừ `publishPipeline`, của B), `FE/services/impl/http/invitations.ts`, `FE/services/impl/http/workspace.ts`, `FE/types/settings.types.ts`, test FE
- `docs/specs/database-schema.md`, `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (3.3–3.4), `docs/tasks/D-du-an/D2-thanh-vien-loi-moi.md`

## Đặc tả đã chốt
- **Mỗi dự án chỉ có 1 chủ, là `project.owner_id`.** `PATCH /api/v1/projects/{id}/members/{userId}`, body `{ role }`:
  - `COLLABORATOR` hoặc `VIEWER`: đổi vai trò thành viên. Không áp dụng cho owner hiện tại → 400 `OWNER_ROLE_LOCKED`.
  - `OWNER`: **chuyển quyền sở hữu**. Trong 1 transaction: `project.owner_id = userId`, thành viên đó nhận role OWNER, owner cũ thành COLLABORATOR. Nhờ vậy mọi chỗ đang kiểm `project.getOwnerId()` (của B, C, D) vẫn đúng.
- `DELETE /api/v1/projects/{id}/members/{userId}` (chỉ OWNER): đặt `removed_at = now()`, gỡ người này khỏi mọi node mình đang phụ trách trong dự án, trả `{ unassignedTaskCount }`. Không xóa được owner → 400 `CANNOT_REMOVE_OWNER`.
- `GET /api/v1/projects/{id}/members` (thành viên): danh sách khớp kiểu `ProjectMemberDetail` (`FE/types/settings.types.ts`).
- Lời mời: chỉ OWNER được gửi (bỏ quyền của COLLABORATOR và ADMIN cho đúng SSOT). Nhóm muốn khác thì phải sửa SSOT trước.
- V6:
  - `ALTER TABLE project_invitation DROP CONSTRAINT uq_pending_project_invitation;`
  - `CREATE UNIQUE INDEX uq_pending_invitation ON project_invitation (project_id, invitee_id) WHERE status = 'PENDING';`
  - Bỏ `@UniqueConstraint` tương ứng trong `ProjectInvitationEntity`.
- Người đã bị xóa mềm chấp nhận lời mời mới: **cập nhật bản ghi cũ** (`removed_at = NULL`, gán role mới), không chèn bản ghi mới.
- FE: màn thành viên và lời mời chạy API thật qua `invitations.ts` và `workspace.ts`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Tái hiện 2 lỗi đầu bằng Swagger trên DB Docker (từ chối 2 lần; mời lại người đã bị xóa). Ghi response và log thật **trước khi sửa**.
3. 🤝 V6, phần code và test.
4. 🧠 Tự viết logic chuyển quyền sở hữu (1 transaction) kèm test.
5. 🤝 Phần FE.
6. 🧠 Chạy lại các kịch bản ở bước 2 sau khi sửa.

## Tiêu chí xong
- [ ] Kịch bản "từ chối 2 lần": trước khi sửa có lỗi (ghi lại), sau khi sửa vẫn tạo được lời mời mới.
- [ ] Xóa sarah → `unassignedTaskCount` đúng bằng số node sarah đang phụ trách (seed có WPE-002 và WPE-003; đối chiếu bằng SQL nếu dữ liệu đã đổi).
- [ ] Mời lại sarah, sarah chấp nhận thành công, không chèn trùng.
- [ ] Chuyển quyền cho sarah → sarah duyệt được task, vì cổng duyệt dùng `owner_id` mới.
- [ ] Test pass.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Partial index là gì? Vì sao nó sửa được lỗi "từ chối 2 lần"?
2. Vì sao chọn chuyển quyền sở hữu thay vì cho phép nhiều OWNER?
3. Người được mời bấm Accept đúng lúc owner bấm Revoke: optimistic lock trả kết quả gì cho mỗi bên?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa V4 (phải sửa bằng V6).
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
