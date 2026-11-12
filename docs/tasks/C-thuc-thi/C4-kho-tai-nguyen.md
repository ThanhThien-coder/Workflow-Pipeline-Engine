# C4 — Kho tài nguyên dự án (Cụm 6) và minh chứng nộp bài

Người làm: C
Người review: D
Trạng thái: chờ kiểm
Cần có trước: A2, C1
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: c4-artifacts
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** thêm và xóa link bằng sarah và bằng một Viewer qua API; gửi URL `javascript:alert(1)` → 400; `GET /api/v1/guest/{token}/overview` chỉ thấy artifact công khai.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** phần frontend.

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
Chế độ sprint: bỏ qua phần tự đọc. Đọc code thấy khác mô tả "Vì sao cần task này" ở 1 điểm: `CreateArtifactRequest` **đã có** `@Pattern("^https?://.+")` nên `javascript:` khi thêm link đã bị 400, nhưng regex này lọt link thiếu host (`http:///abc`), và **đường nộp bài không kiểm URL nào** (lưu được `javascript:`). Ngoài ra: `type` là enum nên giá trị lạ làm JSON lỗi (không thành `OTHER_LINK`); xóa và bật/tắt kho dùng `orElse(null)` nên không đăng nhập thì service **bỏ qua kiểm quyền**. Trang khách (`GuestGatewayService`) đã lọc đúng `findByProjectIdAndIsPublicForGuestTrue`.

### Đã làm gì (file nào, vì sao)
Làm theo chế độ sprint ngày 12/11/2026, nhánh `c4-artifacts` từ main (đã có A2, C1, C2). Không làm phần FE (sprint).
- `BE/dto/artifact/ArtifactUrlValidator.java` (mới): phân tích bằng `java.net.URI`, chỉ nhận `http`/`https` (không phân biệt hoa thường), bắt buộc có host, tối đa 500 ký tự. Vừa là `ConstraintValidator` vừa có hàm tĩnh `isValid` cho chỗ không có `@Valid`.
- `BE/dto/artifact/ValidArtifactUrl.java` (mới): annotation dùng validator trên.
- `BE/dto/artifact/CreateArtifactRequest.java`: `url` dùng `@ValidArtifactUrl` thay regex; `type` đổi từ enum sang chuỗi (JSON gửi lên không đổi).
- `BE/controller/ArtifactController.java`: thêm, xóa, bật/tắt kho đều dùng `requireCurrentUserId()` (bỏ `orElse(1L)`, `orElse(null)`). Xem danh sách giữ nguyên.
- `BE/service/ArtifactService.java`: `requireWriter` (thành viên dự án và là Chủ dự án hoặc OWNER/MANAGER/COLLABORATOR trong `project_member`; VIEWER → 403) cho thêm link và bật/tắt kho; `uploadedBy` = người gọi; `resolveType` (rỗng → nhận diện theo URL, đúng tên loại → loại đó, lạ → `OTHER_LINK`); xóa không còn bỏ qua kiểm quyền khi không có người gọi.
- `BE/service/engine/StateMachineService.java` (chỉ `submitTaskArtifact` + 1 import): `isPublicForGuest` lấy từ `artifact.isPublicForGuest` (không gửi → `true`); link minh chứng sai → 400 **trước** khi đổi trạng thái, nên task không sang REVIEW. `SubmitTaskArtifactRequest` đã có sẵn trường `isPublicForGuest`, không cần sửa.
- Test mới: `ArtifactUrlValidatorTest` (16), `ArtifactServiceTest` (19), `ArtifactControllerTest` (6), `SubmitTaskArtifactTest` (4).

### Kết quả test (dán output thật, không chép tay)
**1. Trước khi sửa** (có khung rỗng để biên dịch được):
```
[ERROR]   ArtifactControllerTest.create_missingHost_validationFailed:67 Status expected:<400> but was:<201>
[ERROR]   ArtifactControllerTest.create_unauthenticated_401:79 Status expected:<401> but was:<201>
[ERROR]   ArtifactControllerTest.create_valid_passesCurrentUser:91        (controller truyền userId = 1)
[ERROR]   ArtifactControllerTest.delete_unauthenticated_401:101 Status expected:<401> but was:<204>
[ERROR]   ArtifactControllerTest.toggle_unauthenticated_401:112 Status expected:<401> but was:<200>
[ERROR]   ArtifactUrlValidatorTest.invalidUrls:41  (x9), lengthLimit:59, nullUrl_invalid:47
[ERROR]   ArtifactServiceTest$Create.viewer_forbidden:101
[ERROR]   ArtifactServiceTest$Delete.nullUser_forbidden:181
[ERROR]   ArtifactServiceTest$ToggleRepository.viewer_forbidden:198
[ERROR]   SubmitTaskArtifactTest.javascriptUrl_rejected:111
[ERROR]   SubmitTaskArtifactTest.respectsPrivateChoice:97
[ERROR]   ArtifactServiceTest$Create.typeResolution:121 » IllegalArgument No enum constant ...ArtifactType.figma (x3)
[ERROR] Tests run: 45, Failures: 21, Errors: 3, Skipped: 0
```
`create_javascriptUrl_validationFailed` pass ngay từ đầu (regex cũ đã chặn `javascript:`).

**2. Sau khi sửa:** 45/45 pass; toàn bộ backend `./mvnw test`: `Tests run=470, Failures=0, Errors=0, Skipped=1`.

**3. Tiêu chí:** `grep -n "orElse(1L)" .../ArtifactController.java` → không còn kết quả.

**4. Chạy thật** (backend bật từ code C4, header `X-Debug-User-Id`; tạo tạm user 4 vai trò VIEWER trong dự án 1 bằng SQL, chạy xong đã xóa):
```
1) sarah thêm link GitHub -> 201 | "id":1 "uploadedBy":3 "type":"PR" "isPublicForGuest":true
2) sarah thêm javascript:alert(1) -> 400 | "error":"VALIDATION_FAILED"
3) sarah thêm http:///abc -> 400 | "error":"VALIDATION_FAILED"
4) sarah thêm type lạ -> 201 | "id":2 "uploadedBy":3 "type":"OTHER_LINK"
5) Viewer thêm link -> 403 | "error":"ACCESS_DENIED"
6) Viewer xóa link của sarah -> 403 | "error":"ACCESS_DENIED"
7) Viewer tắt kho chung -> 403 | "error":"ACCESS_DENIED"
8) Viewer xem danh sách -> 200 (2 link)
9) sarah bắt đầu WPE-003 -> 200
10) sarah nộp bài, link javascript: -> 400 | "error":"BAD_REQUEST" | WPE-003 vẫn IN_PROGRESS
11) sarah nộp bài, minh chứng KHÔNG công khai -> 200 | WPE-003 REVIEW
    Bảng artifacts: 1:PR 42(public=true), 2:Loai la(public=true), 3:Tai lieu noi bo(public=false)
12) Trang khách GET /guest/{token}/overview -> 200 | artifact khách thấy: "PR 42" "Loai la"
13) alex (Owner) xóa link của sarah -> 204
14) sarah xóa link của chính mình -> 204
```
Trang khách không thấy "Tai lieu noi bo" (không công khai). Sau đó đã trả DB về dữ liệu seed (0 artifact, WPE-003 TODO v0, 1 thông báo, 3 user, xóa user 4 và thành viên tạm).

### Điều chưa chắc / cần nhóm quyết
- **Manager được thêm link:** đặc tả ghi "chỉ Owner và Collaborator" (viết trước khi có vai trò MANAGER ở #33). Mình cho cả MANAGER thêm, vì Manager có quyền cao hơn Collaborator. Nhóm không đồng ý thì bỏ MANAGER khỏi `requireWriter`.
- **Admin hệ thống vẫn xóa được** link (giữ hành vi cũ và mô tả Swagger "người upload, Owner, Quản trị viên"); đặc tả chỉ ghi "người đã đăng hoặc OWNER".
- **Bật/tắt kho chung giờ cũng chặn Viewer** (đặc tả không nhắc, nhưng là thao tác ghi; "Viewer chỉ được đọc").
- Nộp bài với link sai trả 400 **`BAD_REQUEST`**, không phải `VALIDATION_FAILED`: `NodeController` không có `@Valid` cho request nộp bài và không thuộc "Được ghi" của C4, nên kiểm bằng code trong `submitTaskArtifact` (`IllegalArgumentException`).
- Ở chế độ dev (`X-Debug-User-Id`), request không có header được coi là user 2, nên 401 chỉ kiểm bằng test controller; bật bảo mật thật ở X1.
- FE chưa làm (sprint): FE cũng phải chỉ hiển thị link `http(s)` thành thẻ `<a>` có `rel="noopener noreferrer"` (câu bảo vệ 1).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
