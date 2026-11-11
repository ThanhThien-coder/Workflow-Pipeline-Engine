# C4 — Kho tài nguyên dự án (Cụm 6) và minh chứng nộp bài

Người làm: C
Người review: D
Trạng thái: chưa làm
Cần có trước: A2, C1
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: c4-artifacts
Ước lượng: 1 ngày

## Vì sao cần task này
Đọc code thấy các vấn đề sau:
- `BE/controller/ArtifactController.java` có chỗ `getCurrentUserId().orElse(1L)`: không đăng nhập vẫn tạo được artifact, và artifact bị ghi là của admin (user 1).
- Khi nộp bài, `StateMachineService.submitTaskArtifact` luôn đặt `isPublicForGuest(true)`, bỏ qua lựa chọn người dùng gửi lên.
- Chưa kiểm URL, nên link `javascript:` cũng lưu được.
- Chưa phân quyền rõ: Viewer chỉ được đọc, nhưng chưa có chỗ nào chặn Viewer thêm link.

## Kiến thức phải nắm
Kiểm URL bằng `java.net.URI`, XSS qua URL `javascript:`, phân quyền theo vai trò trong dự án (`project_member.role`), quy tắc "không tin client".

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 6.1, 6.2, 5.3; `ArtifactController.java`, `BE/service/ArtifactService.java`, `BE/entity/ArtifactEntity.java`, `BE/dto/request/node/SubmitTaskArtifactRequest.java`; `FE/components/workspace/WorkflowArtifactsDrawer.tsx`, `WorkflowArtifactsIsland.tsx`, `FE/hooks/useProjectArtifacts.ts`, `FE/store/slices/artifactsSlice.ts`, `FE/components/settings/ProjectResourcesSection.tsx`.
Trả lời:
1. Vì sao dự án chỉ lưu link mà không lưu file trên server?
2. `is_in_repository` khác `is_public_for_guest` ở đâu? Khách thấy được artifact nào?
3. Ai được xóa một artifact?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/controller/ArtifactController.java`, `BE/service/ArtifactService.java`, `BE/repository/ArtifactRepository.java` (chỉ thêm method), `BE/dto/artifact/**`
- `BE/service/engine/StateMachineService.java` (chỉ hàm `submitTaskArtifact`), `BE/dto/request/node/SubmitTaskArtifactRequest.java`
- `BE-test/**` (test artifact, test nộp bài)
- `FE/services/impl/http/artifacts.ts`, `FE/components/workspace/WorkflowArtifacts*.tsx`, `FE/hooks/useProjectArtifacts.ts`, `FE/store/slices/artifactsSlice.ts`, `FE/components/settings/ProjectResourcesSection.tsx`, `FE/types/artifact.types.ts`, test FE
- `docs/tasks/C-thuc-thi/C4-kho-tai-nguyen.md`

## Đặc tả đã chốt
- Tạo artifact: dùng `requireCurrentUserId()`, bỏ `orElse(1L)`.
  - Chỉ Owner và Collaborator được tạo. Viewer → 403. Kiểm vai trò bằng `ProjectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull` (đã có sẵn), không sửa `ProjectAuthorizationService` (của D).
  - URL phải là `http` hoặc `https` hợp lệ, dài tối đa 500 ký tự, nếu không → 400 `VALIDATION_FAILED`. `type` không hợp lệ → `OTHER_LINK`.
- Xóa: người đã đăng hoặc OWNER → 204. Người khác → 403.
- Nộp bài: `isPublicForGuest` lấy từ request (`artifact.isPublicForGuest`), không gửi thì mặc định `true`. Sửa trong `submitTaskArtifact` và `SubmitTaskArtifactRequest`.
- `GET …/artifacts?nodeId=&inRepo=`: giữ hành vi hiện có, bổ sung test.
- FE: artifacts gọi qua `FE/services/impl/http/artifacts.ts` (A2 đã tách). Lỗi hiện toast theo `ApiError`.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Tự viết hàm kiểm URL kèm test: `javascript:alert(1)`, `ftp://…`, thiếu host, chuỗi 501 ký tự, `https://github.com/org/repo/pull/42` hợp lệ.
3. 🤝 Phần còn lại, kèm test.
4. 🧠 Chạy thật: thêm và xóa link bằng sarah (Collaborator) và bằng một Viewer (tạo bằng lời mời vai trò VIEWER hoặc bằng SQL).

## Tiêu chí xong
- [ ] Test pass.
- [ ] `grep -n "orElse(1L)" wpe-backend/src/main/java/com/pipeline/wpe/controller/ArtifactController.java` không còn kết quả.
- [ ] Gửi URL `javascript:alert(1)` → 400.
- [ ] Trang khách (`GET /api/v1/guest/{token}/overview`) chỉ thấy artifact có `isPublicForGuest = true` (kiểm bằng tay, ghi kết quả).

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao phải chặn URL `javascript:`? Chặn ở BE thôi đã đủ chưa, FE hiển thị link thế nào cho an toàn?
2. Vì sao lấy vai trò từ `project_member` mà không tin thông tin FE gửi lên?
3. Nộp bài mà không kèm link có hợp lệ không? Chỉ ra chỗ code xử lý.

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa `ProjectAuthorizationService.java` (của D).
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
