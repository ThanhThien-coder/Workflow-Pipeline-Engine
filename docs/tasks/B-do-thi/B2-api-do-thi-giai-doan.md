# B2 — API đồ thị và giai đoạn: kiểm thử, lưu vị trí phase, chặn dự án lưu trữ (Cụm 4.1, 4.2)

Người làm: B
Người review: C
Trạng thái: chờ kiểm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: không
Nhánh git: b2-graph-phases
Ước lượng: 1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** đã có `BE/controller/WorkflowGraphController.java`, `BE/service/WorkflowGraphService.java`, `BE/service/engine/PhaseProgressCalculator.java`, bảng `phase_dependency` (migration **V6** do Dev B viết) và test `WorkflowGraphServiceTest`, `PhaseProgressCalculatorTest`. Task này: đọc hiểu, kiểm thử, rồi làm 2 phần còn thiếu.

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** khởi động app để lấy log Flyway V9; `PUT /phases/{id}` rồi `GET /graph`; ghi vào dự án ARCHIVED → 409; đếm số câu SQL của `GET graph`.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** không có.

## Vì sao cần task này
Phần đọc đồ thị và quản lý phase đã chạy. Đọc code thấy còn thiếu:
1. **Vị trí phase trên canvas không được lưu**: `work_phase` không có cột tọa độ; `CreatePhaseRequest`, `UpdatePhaseRequest`, `PhaseResponse` không có trường vị trí. Kéo phase rồi F5 là mất. (FE đã có `updatePhasePosition` nhưng backend chưa có chỗ lưu.)
2. **Dự án `ARCHIVED` vẫn sửa được đồ thị** (theo `workflow-engine.md` 5.1, ARCHIVED là chỉ đọc).

## Kiến thức phải nắm
Quan hệ nhiều-nhiều tự tham chiếu (`phase_dependency`), migration Flyway thêm cột JSONB, DTO record, BFS kiểm tới được (dùng trong `addPhaseEdge`), lỗi N+1 query.

## Bước 0 — Tự đọc, không dùng AI
Đọc: integration map 4.1, 4.2; `docs/archive/dev_b/DEV_B_IMPLEMENTATION_GUIDE.md` mục 3–4.2; `V6__create_phase_dependency.sql`; trong `WorkflowGraphService.java` các hàm `getGraph`, `createPhase`, `updatePhase`, `deletePhase`, `connectPhases`, `disconnectPhases`, `addPhaseEdge`; `PhaseProgressCalculator.java`.
Trả lời:
1. `addPhaseEdge` chặn vòng giữa các phase bằng cách nào? Vì sao cách đó đúng mà không cần chạy Kahn cả đồ thị?
2. Vì sao vẫn giữ cột `work_phase.parent_phase_id` sau khi có bảng `phase_dependency`? `disconnectPhases` xử lý cột cũ thế nào?
3. `getGraph` chạy bao nhiêu câu SQL? Có bị N+1 không? (bật `spring.jpa.show-sql` trên máy bạn để đếm, không commit)

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `wpe-backend/src/**`, `FE/**`, `docs/**`

## Được ghi
- `wpe-backend/src/main/resources/db/migration/V9__work_phase_ui_metadata.sql` (số V9 đã cấp cho B)
- `BE/entity/WorkPhaseEntity.java`
- `BE/service/WorkflowGraphService.java` (phần phase và đọc đồ thị), `BE/controller/WorkflowGraphController.java`
- `BE/dto/request/graph/CreatePhaseRequest.java`, `UpdatePhaseRequest.java`, `BE/dto/response/graph/PhaseResponse.java`
- `BE-test/service/WorkflowGraphServiceTest.java`
- `docs/specs/database-schema.md` (WORK_PHASE, PHASE_DEPENDENCY), `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` (4.1–4.2), `docs/tasks/B-do-thi/B2-api-do-thi-giai-doan.md`

## Đặc tả đã chốt
- Giữ nguyên các endpoint đang có (FE đã gọi): `GET /projects/{id}/graph`, `POST/PUT/DELETE /projects/{id}/phases`, `POST /projects/{id}/phases/connect`, `POST /projects/{id}/phases/disconnect`.
- V9: `ALTER TABLE work_phase ADD COLUMN ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`
- `CreatePhaseRequest`, `UpdatePhaseRequest` thêm `Map<String, Object> uiMetadata` (tùy chọn). `PhaseResponse` thêm `uiMetadata`. Dạng dữ liệu: `{ "x": 280, "y": 140, "w": 250, "h": 220 }`.
- Mọi thao tác **ghi** trên dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED` (nếu B3 chưa tạo exception này thì tạo mới, handler thêm ở cuối `GlobalExceptionHandler`).
- Cập nhật `database-schema.md`: bảng `phase_dependency` (V6) và cột mới (V9). Cập nhật integration map 4.1–4.2 theo endpoint thật (`phases/connect`, `phases/disconnect`).

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Đọc `WorkflowGraphServiceTest`, lập bảng case đã có và case còn thiếu (phase nhiều cha, nối tạo vòng, xóa phase còn node, không phải owner, dự án ARCHIVED…).
3. 🧠 Tự viết V9. Claude review.
4. 🤝 Lưu `uiMetadata` cho phase, chặn ARCHIVED, bổ sung test.
5. 🤝 Cập nhật 2 file docs.

## Tiêu chí xong
- [x] V9 chạy được trên DB đã có V1–V6 (dán log Flyway).
- [x] `PUT /phases/{id}` với `uiMetadata` rồi `GET /graph` trả lại đúng tọa độ.
- [x] Ghi đồ thị của dự án ARCHIVED → 409.
- [x] Test pass, có case cho phase nhiều cha và nối tạo vòng.
- [x] Ghi chép có số câu SQL đếm được của `GET graph`.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao `phase_dependency` cần cả `UNIQUE` và `CHECK`?
2. Rule tính trạng thái phase trong `PhaseProgressCalculator`: phase có node LOCKED và TODO thì ra gì?
3. N+1 query là gì? `getGraph` có mắc không?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Sửa V1–V6.
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
> Chế độ sprint, Claude ghi ngày 11/11/2026. Nhánh `b2-graph-phases` tạo từ `b1-kahn` vì PR #15 chưa merge.

- `V9__work_phase_ui_metadata.sql`: thêm cột `work_phase.ui_metadata JSONB NOT NULL DEFAULT '{}'`.
- `WorkPhaseEntity`: thêm trường `uiMetadata` (map JSONB, mặc định map rỗng).
- `CreatePhaseRequest`, `UpdatePhaseRequest`, `PhaseResponse`: thêm `uiMetadata`.
- `WorkflowGraphService`: `createPhase`, `updatePhase` lưu `uiMetadata` (PUT không gửi thì giữ vị trí cũ); `getGraph` trả lại. Thêm `ensureNotArchived` cho 5 hàm ghi Phase (`createPhase`, `updatePhase`, `deletePhase`, `connectPhases`, `disconnectPhases`) → 409 `PROJECT_ARCHIVED`.
- `WorkflowGraphController`: chỉ sửa mô tả Swagger của `PUT /phases/{phaseId}`. Không đổi URL nào.
- `WorkflowGraphServiceTest`: thêm 14 test (14 → 28): 5 test ARCHIVED, 5 test `uiMetadata`, 4 test case còn thiếu.
- `database-schema.md`: cột `ui_metadata`, bảng `PHASE_DEPENDENCY` (mục 3.6.1 và ERD). `FRONTEND_BACKEND_INTEGRATION_MAP.md`: viết lại 4.1, 4.2 theo endpoint thật.

**Bảng case của `WorkflowGraphServiceTest` (phần phase và đọc đồ thị):**

| Case | Trước B2 | Sau B2 |
| :--- | :--- | :--- |
| `getGraph` trả đủ phases, nodes, dependencies | có | có |
| `getGraph` tính tiến độ và trạng thái từng phase | có | có |
| Phase nhiều cha (cột cũ + bảng nối) | có | có |
| `connectPhases` thêm cha thứ 2 không ghi đè cha cũ | có | có |
| `connectPhases` nối tạo vòng → `CycleDetectedException` | có | có |
| `updatePhase` đặt `parentPhaseId` tạo vòng | thiếu | thêm |
| Xóa phase còn node → node thành standalone | có | có |
| `disconnectPhases` gỡ cả bảng nối và cột cũ | thiếu | thêm |
| Không phải owner → `ForbiddenException` | thiếu | thêm |
| Dự án ARCHIVED: 5 hàm ghi → `PROJECT_ARCHIVED` | thiếu | thêm (5 test) |
| Dự án ARCHIVED vẫn đọc được `getGraph` | thiếu | thêm |
| `createPhase` lưu và trả `uiMetadata`; không gửi → `{}` | thiếu | thêm (2 test) |
| `updatePhase` ghi đè `uiMetadata`; không gửi → giữ cũ | thiếu | thêm (2 test) |
| `getGraph` trả `uiMetadata` | thiếu | thêm |

### Kết quả test (dán output thật, không chép tay)
> Claude chạy ngày 11/11/2026 trên máy của B (Maven 3.9, JDK 17, Postgres 15 trong Docker, backend cổng 8081).

**1. Test tái hiện, chạy trước khi sửa (đỏ):**

Lỗi "ARCHIVED vẫn sửa được": 5 test mới fail, code đi qua bước kiểm quyền rồi chạy tiếp.
```text
[ERROR] Tests run: 19, Failures: 5, Errors: 0, Skipped: 0
[ERROR]   WorkflowGraphServiceTest.testConnectPhasesArchivedProject:361->assertProjectArchived:325 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <com.pipeline.wpe.exception.ResourceNotFoundException>
[ERROR]   WorkflowGraphServiceTest.testCreatePhaseArchivedProject:334->assertProjectArchived:325 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <java.lang.NullPointerException>
[ERROR]   WorkflowGraphServiceTest.testDeletePhaseArchivedProject:352->assertProjectArchived:325 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <com.pipeline.wpe.exception.ResourceNotFoundException>
[ERROR]   WorkflowGraphServiceTest.testDisconnectPhasesArchivedProject:370->assertProjectArchived:325 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <com.pipeline.wpe.exception.ResourceNotFoundException>
[ERROR]   WorkflowGraphServiceTest.testUpdatePhaseArchivedProject:343->assertProjectArchived:325 Unexpected exception type thrown, expected: <com.pipeline.wpe.exception.ConflictException> but was: <com.pipeline.wpe.exception.ResourceNotFoundException>
```
Lỗi "vị trí phase không được lưu": test không biên dịch được vì trường chưa tồn tại (đỏ ở mức biên dịch, không phải assertion). Cả lớp test báo lỗi:
```text
[ERROR] Tests run: 28, Failures: 0, Errors: 28, Skipped: 0
The method getUiMetadata() is undefined for the type WorkPhaseEntity
The method uiMetadata() is undefined for the type PhaseResponse
The constructor CreatePhaseRequest(String, null, null, null, int, Map<String,Object>) is undefined
```

**2. Sau khi sửa, `mvn -B test` toàn bộ (xanh):**
```text
[INFO] Tests run: 31, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.engine.KahnDagServiceTest
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.engine.PhaseProgressCalculatorTest
[INFO] Tests run: 28, Failures: 0, Errors: 0, Skipped: 0 -- in com.pipeline.wpe.service.WorkflowGraphServiceTest
[INFO] Tests run: 140, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**3. Log Flyway V9 trên DB đã có V1–V6:**
```text
DbValidate : Successfully validated 7 migrations (execution time 00:00.067s)
DbMigrate  : Current version of schema "public": 6
DbMigrate  : Migrating schema "public" to version "9 - work phase ui metadata"
DbMigrate  : Successfully applied 1 migration to schema "public", now at version v9 (execution time 00:00.033s)
```
Sau migration, 3 phase có sẵn nhận `ui_metadata = {}`.

**4. `PUT /phases/{id}` rồi `GET /graph` (alex, `X-Debug-User-Id: 2`):**
```text
PUT /api/v1/projects/1/phases/2  body {"name":"AUTH GATEWAY","uiMetadata":{"x":280,"y":140,"w":250,"h":220}}
HTTP 200  ... "uiMetadata":{"x":280,"h":220,"y":140,"w":250}}

GET /api/v1/projects/1/graph  -> phase 2
{"id":"2","name":"AUTH GATEWAY",...,"uiMetadata":{"h":220,"w":250,"x":280,"y":140}}

SQL: select id,name,ui_metadata from work_phase where id=2
2|AUTH GATEWAY|{"h": 220, "w": 250, "x": 280, "y": 140}

PUT lần 2 không gửi uiMetadata (chỉ gửi name, sub) -> HTTP 200, uiMetadata vẫn {"h":220,"w":250,"x":280,"y":140}
PUT bằng sarah (X-Debug-User-Id: 3) -> HTTP 403 ACCESS_DENIED
```

**5. Phase nhiều cha và nối tạo vòng qua API:**
```text
connect 1->2 HTTP 200
connect 2->3 HTTP 200
connect 1->3 HTTP 200          (phase 3 có 2 cha: 1 và 2)
connect 3->1 HTTP 422  {"status":422,"error":"CYCLE_DETECTED","message":"Không thể nối Phase: tạo chu trình lặp giữa các Phase.","cycleNodes":["CORE ENGINE","FOUNDATION"]}
GET graph: "phaseEdges":[["1","2"],["2","3"],["1","3"]]
```

**6. Ghi vào dự án ARCHIVED (tạm đổi dự án 2 sang ARCHIVED bằng SQL):**
```text
POST /api/v1/projects/2/phases
{"status":409,"error":"PROJECT_ARCHIVED","message":"Dự án đã được lưu trữ, chỉ có thể xem. Không thể chỉnh sửa đồ thị.","path":"/api/v1/projects/2/phases"}
createPhase HTTP 409
updatePhase HTTP 409
deletePhase HTTP 409
connect HTTP 409
disconnect HTTP 409
GET graph (doc) HTTP 200
so phase project 2 truoc/sau: 0 / 0
```

**7. Số câu SQL của `GET /graph` (bật `--spring.jpa.show-sql=true` trên dòng lệnh, không commit):**
- Owner gọi: **5 câu** — `project` (kiểm quyền), `work_phase`, `node`, `node_dependency`, `phase_dependency`.
- Thành viên gọi (sarah): **6 câu** — thêm 1 câu kiểm tra `project_member`.
- Số câu cố định, không tăng theo số phase hay node → không bị N+1. Dự án 1 lúc đo có 3 phase, 4 node.

**Dọn dẹp sau khi kiểm:** dự án 2 trả về `PLANNING`; gỡ 3 cạnh phase vừa nối; `ui_metadata` phase 2 trả về `{}`; đã tắt backend cổng 8081. Cột `ui_metadata` (V9) vẫn nằm trong DB local.

**Bước cần trình duyệt:** không có.

### Điều chưa chắc / cần nhóm quyết
1. **Frontend chưa dùng `uiMetadata`.** `HttpWorkflowService` chưa cài `updatePhasePosition` và tự tính `x` theo `orderIndex`. Backend đã lưu được, nhưng ở chế độ API thật kéo phase rồi F5 **vẫn mất vị trí** cho tới khi frontend gọi `PUT` kèm `uiMetadata` và đọc lại. File frontend nằm ngoài "Được ghi" của B2; phần này đã có trong đặc tả của **B5** (người B làm, sau hạn nộp, sau khi A2 tách file `HttpWorkflowService`).
2. **Không tạo exception mới.** Đặc tả cho phép tạo exception và thêm handler vào `GlobalExceptionHandler`, nhưng 2 file đó không có trong "Được ghi". Dùng `ConflictException("PROJECT_ARCHIVED", ...)` có sẵn: handler hiện tại đã trả đúng 409 và mã `PROJECT_ARCHIVED`. B3, B4 dùng lại cùng cách này được.
3. **Mới chặn ARCHIVED ở phần phase.** `createNode`, `createDependency`, `deleteDependency`, `updateNodeMetadata` thuộc B3; `publishPipeline` thuộc B4. Hiện các hàm đó vẫn ghi được vào dự án ARCHIVED.
4. **Thứ tự migration.** DB nào đã chạy V9 trước khi V7 (A5), V8 (D2) được merge thì Flyway sẽ báo lỗi validate khi gặp V7, V8 ("detected resolved migration not applied"), vì `application.yml` không bật `out-of-order`. Cách xử lý local: `docker compose down -v && docker compose up -d` (đúng như bước chuẩn bị buổi kiểm chung). Nhóm cần biết trước.
5. **`PUT` bắt buộc `name`.** Muốn chỉ lưu vị trí vẫn phải gửi kèm `name` (ràng buộc `@NotBlank` có từ trước, không đổi).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
