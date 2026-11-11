# B3 — API node và phụ thuộc: vá 4 lỗ hổng trong code đã có (Cụm 4.3, 4.4)

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B1
Cần trước bước frontend: không
Mở khóa: B4, B5
Nhánh git: b3-nodes-deps
Ước lượng: 1,5 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `createNode`, `createDependency`, `deleteDependency`, `updateNodeMetadata` đã có trong `BE/service/WorkflowGraphService.java`. Task này sửa các lỗ hổng tìm thấy khi đọc code và thêm phần còn thiếu.

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
- [ ] 4 test tái hiện lỗ hổng: fail trước khi sửa (ghi lại), pass sau khi sửa.
- [ ] Swagger: vòng 4 node → 422, `cycleNodes` có đủ 4 mã.
- [ ] Viewer (vai trò VIEWER) gọi API ghi → 403.
- [ ] Gọi `PATCH metadata` 2 lần: `version` không đổi (kiểm bằng SQL).
- [ ] Toàn bộ test pass.

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

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
