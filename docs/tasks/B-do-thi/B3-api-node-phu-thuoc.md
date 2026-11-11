# B3 — API node và phụ thuộc: vá 4 lỗ hổng trong code đã có (Cụm 4.3, 4.4)

Người làm: B
Người review: C
Trạng thái: chờ kiểm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: B4, B5
Nhánh git: b3-nodes-deps
Ước lượng: 1,5 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `createNode`, `createDependency`, `deleteDependency`, `updateNodeMetadata` đã có trong `BE/service/WorkflowGraphService.java`. Task này sửa các lỗ hổng tìm thấy khi đọc code và thêm phần còn thiếu.

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** nối WPE-004 → WPE-001 → 422 đủ 4 mã; Viewer gọi API ghi → 403; `PATCH metadata` 2 lần rồi kiểm `version` bằng SQL.
> - **Dời về buổi kiểm chung (mục 7):** nối tạo vòng trên giao diện → báo lỗi (bảng 7.2 dòng 5).
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
Đọc code thấy 4 lỗ hổng (đều **cần viết test tái hiện trước khi sửa**):
1. **Vòng dài lọt qua**: `createDependency` chỉ chặn vòng 2 node (`existsByParentNodeIdAndChildNodeId(childId, parentId)`). Nối A→B, B→C rồi C→A vẫn lưu được. Đồ thị có vòng sẽ chỉ bị phát hiện lúc xuất bản.
2. **Sai quyền**: `createNode`, `createDependency`, `deleteDependency`, `updateNodeMetadata` dùng `verifyProjectMemberOrOwner`, nên cả **Viewer** cũng sửa được đồ thị. Theo UC10 trong `system-overview.md`, chỉ OWNER được thiết kế đồ thị.
3. **Kéo thả làm hỏng Kanban**: `updateNodeMetadata` gọi `nodeRepository.save(node)`, mà `NodeEntity` có `@Version`, nên mỗi lần kéo thả là `version` tăng. Người đang thao tác task trên Kanban sẽ bị 409 oan.
4. **Trạng thái node không được tính lại**: thêm cha chưa DONE cho một node đang TODO thì node đó vẫn TODO; xóa cạnh làm node mất hết cha thì node vẫn LOCKED.

Ngoài ra chưa có API sửa và xóa node.

## Kiến thức phải nắm
Chặn chu trình trước khi lưu, phân quyền theo vai trò, câu `UPDATE` trực tiếp không qua `@Version` (JPQL hoặc native query), join policy AND/OR.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.3, 4.4; `docs/specs/workflow-engine.md` mục 3 và 5.2; UC10 trong `docs/specs/system-overview.md`; các hàm node/dependency/metadata trong `WorkflowGraphService.java`; `NodeEntity.java`; hàm `unlockDownstreamTasks` trong `BE/service/engine/StateMachineService.java` (chỉ đọc, file của C).
Trả lời:
1. Chỉ dòng code của từng lỗ hổng 1–4.
2. Vì sao kiểm chu trình ngay lúc lưu cạnh, không đợi tới lúc xuất bản?
3. Một node TODO được thêm một cha chưa DONE: với `ALL_COMPLETED` thì thành gì, với `ANY_COMPLETED` mà đã có một cha DONE thì sao?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `BE/service/WorkflowGraphService.java` (phần node, dependency, metadata), `BE/controller/WorkflowGraphController.java`
- `BE/dto/request/graph/**` (thêm `UpdateNodeRequest`), `BE/dto/response/graph/**`
- `BE/repository/NodeRepository.java`, `BE/repository/NodeDependencyRepository.java` (chỉ thêm method)
- `BE-test/service/WorkflowGraphServiceTest.java`
- `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.3–4.4), `docs/tasks/B-do-thi/B3-api-node-phu-thuoc.md`

## Đặc tả đã chốt
- **Giữ nguyên** hành vi đang có mà FE dựa vào: `createDependency` lũy đẳng (cạnh đã có thì trả về luôn, không báo lỗi); mã node trùng → 409 `DUPLICATE_NODE_CODE`.
- Lỗ hổng 1: trước khi lưu cạnh, gọi `KahnDagService.wouldCreateCycle(...)` (B1). Tạo vòng → 422 `CYCLE_DETECTED`, `cycleNodes` là mã các node trên vòng.
- Lỗ hổng 2: mọi thao tác **ghi** (tạo/sửa/xóa node, nối/gỡ cạnh, lưu tọa độ) dùng `verifyProjectOwner`. Đọc đồ thị vẫn cho thành viên.
- Lỗ hổng 3: lưu `ui_metadata` bằng câu `UPDATE` trực tiếp, **không** làm tăng `version`.
- Lỗ hổng 4: sau khi thêm hoặc gỡ cạnh, tính lại trạng thái node con theo `joinPolicy`:
  - con đang TODO mà điều kiện hội tụ không còn thỏa → `LOCKED`;
  - con đang LOCKED mà không còn cha hoặc điều kiện đã thỏa → `TODO`, gửi `TASK_UNLOCKED` qua `SseEmitterService.sendToUser` (gọi hàm có sẵn, không sửa file của C);
  - con đang IN_PROGRESS trở lên → không cho thêm cha, 409 `NODE_IN_USE`.
- Thêm `PUT /api/v1/nodes/{id}` (sửa title, description, phaseId, joinPolicy, assignedUserId, dueDate, estimatedHours; bắt buộc gửi `version`, sai → 409; người phụ trách phải là thành viên → nếu không 400 `ASSIGNEE_NOT_MEMBER`; dời `dueDate` sang tương lai → `isOverdue = false`). **Không** cho sửa `status` ở đây.
- Thêm `DELETE /api/v1/nodes/{id}`: chỉ khi node LOCKED hoặc TODO, ngược lại 409 `NODE_IN_USE`.
- Dự án ARCHIVED → 409 `PROJECT_ARCHIVED` (exception này B2 cũng dùng: task nào làm trước thì tạo, task sau dùng lại).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Viết 4 test **đỏ** tái hiện 4 lỗ hổng (chạy thấy fail) trước khi sửa.
3. 🧠 Tự viết hàm "tính lại trạng thái con sau khi đổi cạnh". Đọc logic join trong `unlockDownstreamTasks` để làm cho giống, nhưng không sửa file đó.
4. 🤝 Sửa 4 lỗ hổng cho test xanh; thêm PUT/DELETE node và test.
5. 🧠 Thử bằng Swagger: nối WPE-004 → WPE-001 (tạo vòng 1→2→3→4→1) → phải 422.
6. Cập nhật integration map 4.3–4.4.

## Tiêu chí xong
- [x] 4 test tái hiện lỗ hổng: fail trước khi sửa (ghi lại), pass sau khi sửa.
- [x] Swagger: vòng 4 node → 422, `cycleNodes` có đủ 4 mã.
- [x] Viewer (vai trò VIEWER) gọi API ghi → 403.
- [x] Gọi `PATCH metadata` 2 lần: `version` không đổi (kiểm bằng SQL).
- [x] Toàn bộ test pass.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao tọa độ không được làm tăng `version`? Có tăng thì chuyện gì xảy ra với người đang duyệt task?
2. Kiểm vòng 2 node khác kiểm bằng Kahn ở đâu? Vẽ ví dụ lọt qua.
3. Xóa cạnh có thể làm node tự mở khóa. Ai gửi SSE, vì sao không sửa file của C?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa `StateMachineService.java`, `SseEmitterService.java` (của C).
- Đổi URL các endpoint đang có.
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
> Chế độ sprint, Claude ghi ngày 11/11/2026. Nhánh `b3-nodes-deps` tạo từ `b2-graph-phases` (B2 chưa merge; B3 dùng lại hàm chặn ARCHIVED của B2). **PR B2 phải merge trước PR B3.**

- `WorkflowGraphService`:
  - Lỗ hổng 1: `createDependency` gọi `KahnDagService.wouldCreateCycle` trước khi lưu; tạo vòng thì chạy `validateProjectDag` trên đồ thị giả định có cạnh mới để lấy mã các node trên vòng.
  - Lỗ hổng 2: `createNode`, `createDependency`, `deleteDependency`, `updateNodeMetadata` đổi sang `verifyProjectOwner`.
  - Lỗ hổng 3: `updateNodeMetadata` gọi `NodeRepository.updateUiMetadata` (câu `UPDATE` trực tiếp), không gọi `save()`, không sửa entity.
  - Lỗ hổng 4: thêm `recomputeNodeStatus` (cùng luật hội tụ với `unlockDownstreamTasks`), gọi sau khi nối cạnh, gỡ cạnh, xóa node, đổi `joinPolicy`. Mở khóa thì gửi `TASK_UNLOCKED` qua `SseEmitterService.sendToUser`.
  - Thêm `updateNode`, `deleteNode`. Mọi hàm ghi node chặn dự án ARCHIVED.
- `WorkflowGraphController`: thêm `PUT /nodes/{id}`, `DELETE /nodes/{id}`; sửa mô tả Swagger. Không đổi URL cũ.
- `UpdateNodeRequest` (mới), `NodeRepository.updateUiMetadata` (thêm method).
- `WorkflowGraphServiceTest`: 28 → 44 test.
- Integration map 4.3–4.4 viết lại theo code thật.
- Không sửa `StateMachineService`, `SseEmitterService`, `NodeDependencyRepository`.

### Kết quả test (dán output thật, không chép tay)
> Claude chạy ngày 11/11/2026 trên máy của B (Maven 3.9, JDK 17, Postgres 15 trong Docker, backend cổng 8081).

**1. Test tái hiện 4 lỗ hổng, chạy trước khi sửa (đỏ):**
```text
[ERROR] Tests run: 33, Failures: 5, Errors: 0, Skipped: 0 <<< FAILURE! -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[ERROR]   WorkflowGraphServiceTest.testCreateDependencyLocksTodoChildWhenNewParentNotDone:588 expected: <LOCKED> but was: <TODO>
[ERROR]   WorkflowGraphServiceTest.testCreateDependencyLongCycle:532 Expected com.pipeline.wpe.exception.CycleDetectedException to be thrown, but nothing was thrown.
[ERROR]   WorkflowGraphServiceTest.testDeleteDependencyUnlocksChildWithoutParents:604 expected: <TODO> but was: <LOCKED>
[ERROR]   WorkflowGraphServiceTest.testNodeWriteApisRequireOwner:547 Multiple Failures (4 failures)
[ERROR]   WorkflowGraphServiceTest.testUpdateNodeMetadataDoesNotBumpVersion:571
[INFO] BUILD FAILURE
```
Lỗ hổng 1 → `testCreateDependencyLongCycle`; lỗ hổng 2 → `testNodeWriteApisRequireOwner` (cả 4 API); lỗ hổng 3 → `testUpdateNodeMetadataDoesNotBumpVersion` (dòng 571 là `verify(nodeRepository, never()).save(any())`); lỗ hổng 4 → 2 test còn lại (thêm cha, gỡ cạnh).

**2. Sau khi sửa, `mvn -B test` toàn bộ (xanh):**
```text
[INFO] Tests run: 44, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.373 s -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[INFO] Tests run: 189, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**3. Nối WPE-004 → WPE-001 (khép vòng 1→2→3→4→1), alex:**
```text
POST /api/v1/projects/1/dependencies  {"parentNodeId":4,"childNodeId":1}
{"status":422,"error":"CYCLE_DETECTED","message":"Không thể nối: tạo chu trình lặp phụ thuộc giữa các công việc.","path":"/api/v1/projects/1/dependencies","cycleNodes":["WPE-001","WPE-002","WPE-003","WPE-004"]}
HTTP 422
SQL đếm cạnh 4->1 sau đó: 0
```

**4. Viewer gọi API ghi (tạm đổi sarah sang VIEWER bằng SQL, `X-Debug-User-Id: 3`):**
```text
{"status":403,"error":"ACCESS_DENIED","message":"Chỉ Chủ dự án (Project Owner) mới có quyền thực hiện hành động này.","path":"/api/v1/projects/1/nodes"}
createNode HTTP 403
createDependency HTTP 403
deleteDependency HTTP 403
patchMetadata HTTP 403
updateNode HTTP 403
deleteNode HTTP 403
GET graph (doc) HTTP 200
node/dep sau khi viewer thu:|4|3        (không đổi)
```

**5. `PATCH /nodes/3/metadata` 2 lần, kiểm `version` bằng SQL:**
```text
truoc:      3|WPE-003|0|{}
sau lan 1:  0|{"width": 220, "height": 90, "position": {"x": 111, "y": 222}}
sau lan 2:  0|{"width": 220, "height": 90, "position": {"x": 333, "y": 444}}
SQL Hibernate sinh ra:  update node set ui_metadata=? where id=?      (không có cột version)
```

**6. Tính lại trạng thái (tạo 2 node standalone X = WPE-005, Y = WPE-006, cả hai TODO):**
```text
noi X->Y HTTP 201                 -> Y: LOCKED   (cha chưa DONE)
noi lai X->Y (luy dang) HTTP 201
go X->Y HTTP 204                  -> Y: TODO     (mất hết cha)
noi X -> WPE-002 (IN_PROGRESS) HTTP 409  {"error":"NODE_IN_USE","message":"Công việc WPE-002 đang ở trạng thái IN_PROGRESS, không thể thêm tiền đề mới."}
```

**7. `PUT /nodes/{id}` và `DELETE /nodes/{id}`:**
```text
PUT dung version HTTP 200   {"id":"6","code":"WPE-006","title":"B3 test Y sua",...,"dueDate":"2030-01-01T00:00:00Z","estimatedHours":4,"version":3,...}
PUT sai version HTTP 409    {"error":"OPTIMISTIC_LOCK_CONFLICT",...}
PUT assignee khong phai thanh vien HTTP 400   {"error":"BAD_REQUEST","message":"ASSIGNEE_NOT_MEMBER: Người phụ trách phải là thành viên của dự án."}
PUT thieu version HTTP 400
xoa WPE-002 (IN_PROGRESS) HTTP 409   {"error":"NODE_IN_USE","message":"Công việc WPE-002 đang ở trạng thái IN_PROGRESS, không thể xóa."}
noi X->Y lan nua HTTP 201   -> Y: LOCKED
xoa X (TODO) HTTP 204       -> Y: TODO; cạnh còn lại của X: 0
xoa Y HTTP 204
```

**8. Dự án ARCHIVED (tạm đổi dự án 2):** `POST /projects/2/nodes` → `HTTP 409 PROJECT_ARCHIVED`.

**Dọn dẹp sau khi kiểm:** sarah về `COLLABORATOR`, dự án 2 về `PLANNING`, `ui_metadata` node 3 về `{}`, đã xóa 2 node thử. Dự án 1 còn đúng 4 node, 3 cạnh như ban đầu. Đã tắt backend cổng 8081.

**Chưa kiểm:** sự kiện SSE `TASK_UNLOCKED` tới trình duyệt (lúc kiểm không có client nào mở kết nối SSE; chỉ có unit test xác nhận `sendToUser` được gọi).

**Bước cần trình duyệt (đưa vào buổi kiểm chung):**
1. Nối tạo vòng trên giao diện → báo lỗi chu trình (bảng 7.2 dòng 5, đã có sẵn).
2. Đăng nhập sarah (COLLABORATOR), mở canvas dự án mẫu, kéo một node hoặc thêm node → phải thấy báo lỗi không có quyền, giao diện không vỡ (trước B3 sarah làm được việc này).

### Điều chưa chắc / cần nhóm quyết
1. **Lệch đặc tả: mã lỗi `ASSIGNEE_NOT_MEMBER`.** Đặc tả ghi `400 ASSIGNEE_NOT_MEMBER`, thực tế trả `400` với `error = "BAD_REQUEST"` và `message` bắt đầu bằng `ASSIGNEE_NOT_MEMBER:`. Muốn đúng mã phải thêm exception mới và handler trong `GlobalExceptionHandler` (ngoài "Được ghi"). Người B đã chọn giữ trong phạm vi; nhóm quyết có mở file chung không.
2. **Thành viên COLLABORATOR mất quyền sửa đồ thị.** Đúng đặc tả (chỉ owner), nhưng frontend hiện cho mọi thành viên kéo thả và thêm node; các thao tác đó giờ nhận 403. Cần kiểm trên giao diện (bước trình duyệt số 2).
3. **Gỡ cạnh trong dự án DRAFT mở khóa node sớm.** Theo đặc tả, node LOCKED mất hết cha → TODO. Ở dự án chưa xuất bản, điều này làm node thành TODO trước khi publish. B4 nên xét lại khi vá `publishPipeline`.
4. **SSE gửi trước khi transaction commit.** `recomputeNodeStatus` gọi `sendToUser` ngay trong transaction, giống `unlockDownstreamTasks` hiện tại. C1 (gửi sự kiện sau commit) nên phủ luôn chỗ này.
5. **`PUT /nodes/{id}`: trường không gửi thì giữ nguyên** (cùng cách với `PUT /phases/{id}`). Hệ quả: chưa bỏ được người phụ trách, chưa đưa được node ra khỏi phase qua API này.
6. **`createNode` chưa kiểm người phụ trách là thành viên.** Đặc tả chỉ yêu cầu ở `PUT`; tôi không tự mở rộng.
7. **`publishPipeline` chưa chặn ARCHIVED** — thuộc B4.
8. **Dữ liệu mẫu lệch luật hội tụ:** WPE-003 đang TODO dù cha WPE-002 mới IN_PROGRESS (seed V2). Không sửa migration cũ; chỉ ghi nhận.

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
