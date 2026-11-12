# B6 — Xuất bản trên giao diện và đồng bộ Kahn FE/BE

Người làm: B
Người review: C
Trạng thái: xong
Cần có trước: B4, B5
Cần trước bước frontend: không
Mở khóa: X1, B9
Nhánh git: b6-publish-ui
Ước lượng: 1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `publishPipeline` trong `HttpWorkflowService.ts` đã gọi `POST /projects/{id}/publish`, nhưng vẫn rơi về mock khi lỗi. Test Kahn backend hiện là `KahnDagServiceTest`.

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
`publishPipeline` trên FE còn fallback ngầm, nên lỗi 422/409 từ backend có thể bị nuốt mất. FE có bản Kahn riêng ở `FE/lib/graph/kahn.ts`. Hai bản Kahn phải cho cùng kết quả, nếu không người dùng sẽ thấy FE báo hợp lệ mà BE lại báo lỗi.

## Kiến thức phải nắm
Dùng chung một bộ dữ liệu test (fixture) cho 2 ngôn ngữ, nguyên tắc "không tin client" (luôn kiểm lại ở BE), hiển thị lỗi nghiệp vụ.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/lib/graph/kahn.ts` và test của nó; test `KahnDagServiceTest` (B1); `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/settings/KahnCycleModal.tsx`; phần `publishPipeline` trong `FE/store/slices/settingsSlice.ts`.
Trả lời:
1. Chạy cùng một đồ thị qua `kahn.ts` và `KahnDagService`, kết quả có thể khác nhau ở đâu? (gợi ý: định nghĩa `cycleNodeCodes` ở B1)
2. FE đã kiểm chu trình rồi, vì sao BE vẫn phải kiểm?
3. Đặt fixture ở đâu để cả test Java và test TypeScript cùng đọc được?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `wpe-backend/src/**`, `docs/**`

## Được ghi
- `shared/test-fixtures/dag-cases.json` (mới, ở gốc repo)
- `BE-test/service/engine/dag/**`
- `FE/lib/graph/**`
- `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/settings/KahnCycleModal.tsx`
- `FE/services/impl/http/graph.ts`, `FE/services/impl/HttpWorkflowService.ts` (chỉ `publishPipeline` và danh sách `METHODS_STILL_MOCKED`)
- `FE/store/slices/settingsSlice.ts` (**chỉ** phần `publishPipeline`; phần còn lại là của D)
- `docs/tasks/B-do-thi/B6-xuat-ban-giao-dien.md`

## Đặc tả đã chốt
- `publishPipeline` gọi `POST /projects/{id}/publish`. Gặp 422 thì `KahnCycleModal` hiển thị `cycleNodes`. Thành công thì cập nhật trạng thái ACTIVE trên màn Settings và hiện toast.
- Fixture chung `shared/test-fixtures/dag-cases.json`: mảng các case dạng `{ name, nodes, edges: [[parent, child]], expectedValid, expectedCycleNodes }`, lấy từ các case của B1. Test BE và test FE cùng đọc file này bằng đường dẫn tương đối.
- Case nào `kahn.ts` cho kết quả khác BE: sửa FE cho khớp BE (BE là chuẩn) và ghi lại case đó.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Chuyển các case của B1 sang file fixture JSON.
3. 🤝 Cho test BE và test FE cùng đọc fixture. Sửa `kahn.ts` nếu lệch.
4. 🤝 Nối `publishPipeline` với API thật, hiển thị modal và toast.
5. 🧠 Chạy thật: xuất bản dự án DRAFT hợp lệ; xuất bản dự án có chu trình (tạo bằng SQL như B4).

## Tiêu chí xong
- [x] `./mvnw test` và `npm test` đều đọc cùng fixture và đều pass.
- [ ] Chạy thật: xuất bản thành công thì trạng thái thành ACTIVE; có chu trình thì modal hiện đúng mã node. (**Store chạy thật với backend đã đạt**, xem "Kết quả test" mục 3; lỗi xuất bản nhầm dự án đã sửa ở mục 4. Bấm trên trình duyệt chưa làm.)

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao cần fixture chung? Không có nó thì lỗi gì có thể lọt?
2. FE kiểm rồi mà BE vẫn kiểm: nêu một tình huống chỉ BE bắt được.
3. Muốn thêm một case mới cho cả hai bên thì làm những bước nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa phần khác `publishPipeline` trong `settingsSlice.ts`.
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

> Làm ngày 12/11/2026 ở **chế độ sprint** theo yêu cầu của người B (sprint xếp B6 sau hạn nộp), nhánh `b6-publish-ui` tách từ main `44b47cd` (đã có B4, B5). Phần này do Claude ghi; người B đọc lại ở giai đoạn Học lại.

### Trả lời Bước 0
1. **Khác ở danh sách node lỗi.** Từ B1, backend (`validateProjectDag`) bóc bỏ node chỉ đứng **sau** vòng lặp, `cycleNodeCodes` chỉ còn node nằm trên vòng. `validateDag` ở frontend trả mọi node còn in-degree > 0, gồm cả node đứng sau vòng. Chạy fixture thấy lệch đúng 5/17 case (mục 1 phần Kết quả test). Còn `valid` (có vòng hay không) thì hai bên luôn khớp.
2. **Không tin client.** Frontend chỉ kiểm dữ liệu nó đang thấy. Dữ liệu có thể vào DB không qua giao diện: seed, clone template, SQL gõ tay, gọi thẳng API bằng curl/Swagger, hoặc 2 người cùng sửa và mỗi người thấy một nửa đồ thị. Chỉ backend có toàn bộ đồ thị ngay lúc lưu.
3. **Ở gốc repo:** `shared/test-fixtures/dag-cases.json`, ngoài cả `wpe-backend/` lẫn `wpe-frontend/`, nên không bên nào "sở hữu" nó. Test Java đọc `../shared/...` (Maven và CI chạy trong `wpe-backend/`). Test TypeScript `import` file JSON bằng đường dẫn tương đối (tsconfig đã bật `resolveJsonModule`, không cần `node:fs`).

### Đã làm gì (file nào, vì sao)
1. **`shared/test-fixtures/dag-cases.json` (mới):** 17 case dạng `{ name, nodes, edges: [[cha, con]], expectedValid, expectedCycleNodes }`. 15 case chuyển từ `KahnDagServiceTest` (B1), 2 case lấy từ test Kahn có sẵn ở frontend. `nodes` là mã node; `expectedCycleNodes` theo thứ tự trong `nodes`. Không chuyển các case chỉ có ở backend (thứ tự topo `sortedOrder`, mã thay thế `NODE-<id>`, `wouldCreateCycle`), vì fixture chỉ so tính hợp lệ và danh sách node lỗi.
2. **`BE-test/service/engine/dag/DagFixtureCasesTest.java` (mới):** đọc fixture bằng Jackson, chạy `validateProjectDag` cho từng case (`@ParameterizedTest`). Id node = vị trí + 1, nên thứ tự id trùng thứ tự trong file.
3. **`FE/lib/graph/kahn.ts`:** `validateDag` trả thêm `cycleNodes`, tính bằng `peelNodesBehindCycle` (cùng thuật toán với backend). **Giữ nguyên** `violations` (mọi node bị chặn), vì Template Studio dùng nó và nó khớp phần kiểm template của backend (`validateSimpleDag` cũng không bóc đuôi). Nghĩa là backend có 2 cách tính, frontend giờ có đủ cả 2.
4. **`FE/lib/graph/__tests__/dagFixtureCases.test.ts` (mới):** đọc cùng fixture, so `valid` và `cycleNodes`.
5. **`FE/store/slices/settingsSlice.ts` (chỉ `publishProject`):** bỏ mã giả `['WPE-009', 'WPE-014', 'WPE-009']` khi máy chủ không gửi danh sách node, thay bằng `[]`.
6. **`FE/components/settings/GeneralSettingsSection.tsx`:** nút Publish hiện cho dự án `DRAFT` **hoặc `PLANNING`** (khớp backend B4). Trước đây chỉ `DRAFT`.
7. **`FE/components/settings/KahnCycleModal.tsx`:** sửa tiêu đề "(HTTP 400)" thành 422 `CYCLE_DETECTED`, câu chữ dùng được cho cả xuất bản lẫn nối node (B5 cũng dùng modal này). Hiện mã node thành từng thẻ thay vì nối bằng "→": danh sách xếp theo id, không phải đường đi của vòng. Danh sách rỗng vẫn mở modal và giải thích; `null` mới là đóng.
8. **`HttpWorkflowService.publishPipeline` và `graph.ts`: không cần sửa.** Từ A2/B5 hàm này đã gọi `POST /projects/{id}/publish` qua `graph.ts`, không còn mock: 422 trả `violatingNodeIds = cycleNodes`, lỗi khác ném `ApiError`.
9. **`FE/store/slices/__tests__/settingsPublish.test.tsx` (mới):** 13 test cho `publishProject`, nút Publish và modal.
10. **`FE/components/views/SettingsView.tsx` (ngoài "Được ghi", người B đồng ý):** truyền `projectId` của trang vào `publishProject(projectId)`, để không xuất bản nhầm dự án 1 (xem "Điều chưa chắc" 1).

### Kết quả test (dán output thật, không chép tay)

**1. Fixture: frontend lệch backend trước khi sửa.** Backend chạy fixture pass 18/18 (17 case + 1 test đọc file). Frontend so `violations` (thứ nó đang trả ra) với fixture:
```
Tests  5 failed | 13 passed (18)
[LECH] vong-kem-duoi: A -> B -> C -> A, C -> D -> E (D, E chi dung sau vong) | BE: ["A","B","C"] | FE violations: ["A","B","C","D","E"]
[LECH] vong-kem-duoi-va-node-dung-truoc: ROOT -> A, A -> B -> C -> A, C -> D -> E | BE: ["A","B","C"] | FE violations: ["A","B","C","D","E"]
[LECH] hai-vong-roi: A <-> B va C -> D -> E -> C, E -> F | BE: ["A","B","C","D","E"] | FE violations: ["A","B","C","D","E","F"]
[LECH] vong-giua-co-dau-va-duoi: A -> B <-> C -> D | BE: ["B","C"] | FE violations: ["B","C","D"]
[LECH] tu-noi-chinh-no: A -> A | BE: ["A"] | FE violations: ["A","B"]
```
Cả 5 case lệch đều có node đứng sau vòng lặp. Sửa bằng `cycleNodes` (mục 3 phần Đã làm gì).

**2. Xuất bản trên giao diện, trước khi sửa** (`settingsPublish.test.tsx`):
```
× chu trình mà máy chủ không gửi danh sách node: KHÔNG hiện mã node bịa (WPE-009, WPE-014…)
× dự án PLANNING: owner thấy nút Publish Pipeline
× ghi đúng mã 422 (không phải HTTP 400) và liệt kê từng mã node
× danh sách rỗng (máy chủ không gửi mã) vẫn hiện modal kèm lời giải thích
AssertionError: expected [ 'WPE-009', 'WPE-014', 'WPE-009' ] to not include 'WPE-009'
AssertionError: expected null not to be null
AssertionError: expected 'Cycle Detected! (HTTP 400)Pipeline va…' not to contain 'HTTP 400'
AssertionError: expected '' to contain '422'
Tests  4 failed | 7 passed (11)
```
7 test pass sẵn là các hành vi vốn đã đúng (lấy đúng danh sách máy chủ gửi, lỗi 409 hiện toast, DRAFT có nút, ACTIVE/ARCHIVED/không phải owner không có nút, `null` đóng modal). Lần chạy đầu có thêm 2 test đỏ do **test viết sai** (spy vào service truyền vào store, trong khi `settingsSlice` gọi `workflowService` lấy thẳng từ `container`; và đọc nhầm tên trường `toastMessage` thay vì `toast`). Đã sửa test, không phải lỗi code.

**Sau khi sửa:**
```
$ ./mvnw -B test
[INFO] Tests run: 18, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.engine.dag.DagFixtureCasesTest
[INFO] Tests run: 31, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.engine.KahnDagServiceTest
[WARNING] Tests run: 307, Failures: 0, Errors: 0, Skipped: 1
[INFO] BUILD SUCCESS

$ npm run typecheck && npm test
> tsc -b
 Test Files  35 passed (35)
      Tests  277 passed (277)
```
Trước B6: backend 289, frontend 248. B6 thêm 18 test backend và 31 test frontend (18 fixture + 13 xuất bản; con số 277 ở trên là trước khi thêm 2 test của mục 4). 1 skip có sẵn (`SeedPasswordHashTest`).

**3. Chạy thật `settings.publishProject` vào backend** (cổng 8081). Test tạm, đã xóa. `vite.config` ép test chạy mock (A2), nên test tạm thay `workflowService` của `container` bằng `HttpWorkflowService` thật và đặt settings là dự án thử 6. Dự án 6 do alex tạo qua API, gồm T1 → T2 → T3, cộng cạnh T3 → T2 chèn bằng SQL (vượt lớp kiểm của B3):
```
== Lan 1 (co vong T2<->T3)
[LIVE] lan-1 | publishProject = false | kahnCycleErrors = ["T2","T3"] | status = DRAFT | toast = null
DRAFT
== Go canh tao vong bang SQL
DELETE 1
== Lan 2 (hop le)
[LIVE] lan-2 | publishProject = true | kahnCycleErrors = null | status = ACTIVE | toast = "Pipeline published successfully. Kahn's check passed."
== SQL sau lan 2
ACTIVE
T1|TODO
T2|LOCKED
T3|LOCKED
== Lan 3 (xuat ban lai)
[LIVE] lan-3 | publishProject = false | kahnCycleErrors = null | status = DRAFT | toast = "Chỉ xuất bản được dự án đang ở trạng thái DRAFT hoặc PLANNING. Trạng thái hiện tại: ACTIVE."
```
- Modal nhận `["T2","T3"]`. T1 đứng trước vòng nên không bị báo, khớp B1.
- (Lần 3 `status = DRAFT` vì đó là store mới đặt lại DRAFT; DB đã là ACTIVE nên backend trả 409.)

**Đã dọn:** xóa cạnh tạo vòng ngay sau lần 1, cuối cùng xóa hẳn dự án 6. DB về như trước (2 dự án, 3 cạnh, 0 thông báo). Đã tắt backend cổng 8081.

**4. Sửa lỗi xuất bản nhầm dự án** (người B đồng ý sửa `SettingsView.tsx`, ngoài "Được ghi", ngày 12/11/2026). Test đỏ trước khi sửa:
```
× B6: settingsSlice.publishProject > xuất bản đúng dự án đang mở (id từ trang), không lấy id của settings (đang là mock, luôn "1")
  → expected "publishPipeline" to be called with arguments: [ '5' ]
Tests  1 failed | 4 passed | 8 skipped (13)
```
Sau khi sửa (`npm run typecheck && npm test`):
```
> tsc -b
 Test Files  35 passed (35)
      Tests  279 passed (279)
```

**Chưa làm (cần trình duyệt, buổi kiểm chung):** alex mở Settings của một dự án DRAFT **mới tạo** (không phải dự án 1), bấm "Publish Pipeline", thấy toast thành công; F5 rồi kiểm bằng SQL là dự án đó thành ACTIVE. Với dự án có vòng (chèn bằng SQL) thì thấy modal ghi đúng mã node. Lưu ý: nhãn trạng thái và tên trên màn Settings vẫn là dữ liệu mock (xem "Điều chưa chắc" 1), nên **kiểm kết quả bằng SQL**, đừng nhìn nhãn.

### Điều chưa chắc / cần nhóm quyết
1. **Đã sửa tạm lỗi xuất bản nhầm dự án; gốc vấn đề vẫn còn.** Trước đây `publishProject` lấy id từ `settings.settings.id`. Ở chế độ API thật, `getProjectSettings` vẫn là mock (`METHODS_STILL_MOCKED`) nên id luôn là `'1'`: mở Settings của dự án 5 rồi bấm Publish sẽ gọi `POST /projects/1/publish`. **Đã sửa (cách b):** `publishProject(projectId?)` nhận id dự án đang mở; `SettingsView.tsx` truyền `projectId` lấy từ đường dẫn trang (`ProjectWorkspaceView` → `SettingsView`). Không truyền id thì vẫn dùng id của settings như cũ. `SettingsView.tsx` nằm **ngoài "Được ghi"**, người B đã đồng ý sửa (1 dòng). **Gốc vấn đề chưa sửa:** tên, mô tả, nhãn trạng thái, vai trò trên màn Settings vẫn là dữ liệu mock (xem mục "Cần báo ai").
2. **`ProjectStatus` trong `types/settings.types.ts` thiếu `PLANNING`, `PAUSED`, `COMPLETED`**, dù backend có trả. `GeneralSettingsSection` so trạng thái như chuỗi để vẫn nhận `PLANNING`. File kiểu là của D, chưa sửa. `STATUS_BADGE` cũng chưa có màu cho `PLANNING` (dùng màu DRAFT).
3. **Backend có 2 cách tính "node lỗi":** dự án (`validateProjectDag`, bóc đuôi) và template (`validateSimpleDag`, không bóc). Frontend giữ cả 2 (`cycleNodes`, `violations`). Nhóm có muốn template cũng bóc đuôi cho thống nhất không.
4. **Toast thành công chưa nói số công việc vừa mở khóa** (`unlockedTaskCount` của B4), vì `PublishPipelineResult` (file kiểu của D) chưa có trường này.
5. **B5 tự thay danh sách rỗng bằng một dòng chữ** trước khi mở modal (`useGraphErrorHandler`), nên trên canvas modal sẽ hiện dòng đó thành một thẻ. Giờ modal tự xử lý danh sách rỗng, nên nên bỏ đoạn thay thế ở `components/workflow/useGraphErrorHandler.ts` (file của B5, ngoài "Được ghi" của B6).
6. **File test mới `store/slices/__tests__/settingsPublish.test.tsx`** không ghi tên trong "Được ghi"; coi là test của các file được ghi (`settingsSlice`, `GeneralSettingsSection`, `KahnCycleModal`), giống cách làm ở B5.

### Cần báo ai, việc gì
| Báo ai | Việc gì | Vì sao |
| :--- | :--- | :--- |
| **Cả nhóm** (chọn người làm) | Nối `getProjectSettings` với backend thật (`GET /projects/{id}`), bỏ khỏi `METHODS_STILL_MOCKED`. A2 đã ghi hàm này "chưa có task nào nhận". | Màn Settings đang hiện tên, trạng thái, vai trò **giả** cho mọi dự án và mọi user. Kéo theo: khóa canvas theo vai trò (B5) không có tác dụng với sarah; nhãn trạng thái sau khi xuất bản không đúng sau F5. |
| **D** (D2 giữ `settingsSlice` ngoài phần xuất bản, và `types/settings.types.ts`) | (1) Thêm `PLANNING`, `PAUSED`, `COMPLETED` vào `ProjectStatus` của `settings.types.ts`. (2) Thêm `unlockedTaskCount?` vào `PublishPipelineResult` (B6 sẽ đưa con số vào toast). (3) Biết rằng `publishProject` giờ nhận tham số `projectId` (đổi chữ ký trong file của D2). | Backend trả các trạng thái này; giao diện đang phải so như chuỗi để chạy được. |
| **Người phụ trách `components/views/SettingsView.tsx`** (không task nào ghi file này; tạm báo D vì gần màn Settings) | B6 đã sửa 1 dòng: `onPublish={() => publishProject(projectId)}`. | Sửa ngoài "Được ghi", cần người giữ file biết khi review và khi merge. |
| **C** (người review B6) | Soát kỹ phần sửa `SettingsView.tsx` và đổi chữ ký `publishProject`; 2 cách tính "node lỗi" ở backend (mục 3). | Đụng file ngoài phạm vi; quyết định thống nhất cách tính. |
| **B (tự làm, task sau)** | Bỏ đoạn thay danh sách rỗng bằng dòng chữ trong `components/workflow/useGraphErrorHandler.ts` (B5). | Modal giờ tự xử lý danh sách rỗng. |

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**

## Review của C (12/11/2026, chế độ sprint)
Đạt 2 tiêu chí review sprint, kiểm trên main `7d5a5b1` (PR #37 đã merge):
1. **Test xanh:** `./mvnw test -Dtest=DagFixtureCasesTest` 18/18; `npx vitest run` 3 file (`dagFixtureCases`, `settingsPublish`, `projectSettings`) 39/39; `npm run typecheck` sạch. FE và BE đọc cùng `shared/test-fixtures/dag-cases.json` (18 case).
2. **File sửa:** 10 file. 8 file trong "Được ghi". 2 file ngoài: `components/views/SettingsView.tsx` (1 dòng `publishProject(projectId)`, người B đồng ý, có ghi lý do ở "Điều chưa chắc" 1) và `store/slices/__tests__/settingsPublish.test.tsx` (test của file được ghi). Chấp nhận cả 2.

Theo lời nhờ ở "Cần báo ai":
- **`SettingsView.tsx` và chữ ký `publishProject(projectId?)`:** đúng. `projectId` lấy từ đường dẫn trang; không truyền thì dùng id của settings như cũ, nên chỗ gọi cũ không vỡ. Phần sửa `settingsSlice.ts` chỉ đụng `publishProject` (9 dòng thêm, 4 dòng bỏ), đúng phạm vi. Bỏ danh sách node bịa (`'WPE-009', 'WPE-014'`) khi máy chủ không gửi là đúng.
- **2 cách tính "node lỗi" (mục 3):** không chặn B6. Ý của C: giữ như hiện tại trong sprint; sau hạn nộp nhóm quyết có cho template bóc đuôi giống dự án không.

Chưa kiểm: bấm Publish trên trình duyệt. Dời về buổi kiểm chung (`SPRINT_2_NGAY.md` mục 7.2, dòng 8).
