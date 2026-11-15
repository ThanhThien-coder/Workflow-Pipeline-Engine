# T6 — Hộp "Chi tiết task": nhãn trạng thái, nút hành động, mở khóa sớm

Sửa lỗi: G8 (phần thiết kế), G12
Trạng thái: xong, chờ test tay
Cần có trước: T1 (thành viên thật), T3 (lưu thông tin node qua API, khóa ô khi chỉ xem)
Mở khóa: không

## Vì sao cần task này
Hộp Node Properties hiện giống form điền dữ liệu thô: trạng thái là ô chọn tự do, không cho biết task đang chờ gì, không có hành động theo vai trò. Chủ dự án chưa mở khóa sớm được task; BE mở sớm xong thì sửa dây lại bị khóa, và không lưu ai mở. Chi tiết: `loi-dang-sua.md` mục G8, G12.

## Quyết định đã chốt (14/11/2026)
- Đổi hộp thành **"Chi tiết task"**. Bố cục từ trên xuống:
  1. Đầu hộp: `WPE-xxx · Tên task`, nhãn trạng thái (chỉ hiện), tên phase.
  2. **Khung điều kiện**: task LOCKED → "Chờ k/n task trước xong (cần tất cả | chỉ cần 1)" + danh sách task đứng trước, đánh dấu ✔ đã xong / ○ chưa xong. Task không có task trước → không hiện khung.
  3. **Giao việc**: Người làm (thành viên thật, theo id, có "Chưa giao"), Hạn chót.
  4. **Yêu cầu**: Tên task, Mô tả / sản phẩm cần nộp, Điều kiện mở khóa (radio "Cần tất cả" / "Chỉ cần 1").
  5. Chân hộp: Xóa task (trái) · Đóng · Lưu thay đổi.
- Nhãn trạng thái tiếng Việt: LOCKED "🔒 Đang khóa", TODO "Chờ làm", IN_PROGRESS "Đang làm", REVIEW "Chờ duyệt", DONE "Xong". Task mở sớm có thêm nhãn "Mở sớm".
- **Nút hành động** (đổi trạng thái qua API state machine, không qua ô chọn):
  - Chủ dự án + LOCKED: **Mở khóa sớm**.
  - Người được giao + TODO: **Bắt đầu**.
  - Người được giao + IN_PROGRESS: **Nộp để duyệt** (mở hộp nộp artifact sẵn có).
  - Chủ dự án + REVIEW: **Duyệt** / **Trả lại** (nhập lý do).
- **Mở khóa sớm**: chỉ chủ dự án, chỉ khi LOCKED. Còn task trước chưa xong thì hiện hộp xác nhận: "Lưu ý: task này còn chờ các việc sau chưa xong: WPE-006 c, WPE-007 d. Mở khóa sớm thì người làm có thể bắt đầu ngay. Vẫn mở?" → [Hủy] [Vẫn mở khóa]. Không còn task trước nào chưa xong thì không cần hỏi.
- Task đã mở sớm **không bị khóa lại** khi sửa dây hay đổi điều kiện mở khóa.

## Được đọc
- `wpe-frontend/src/**`
- `wpe-backend/src/main/java/com/pipeline/wpe/**`, `wpe-backend/src/main/resources/db/migration/**`, `wpe-backend/src/test/**`
- `docs/archive/sua_loi_workspace_dag/**`

## Được ghi
- DB: `wpe-backend/src/main/resources/db/migration/V15__node_force_unlock.sql` (mới)
- BE: `entity/NodeEntity.java`, `service/engine/StateMachineService.java` (chỉ `forceUnlock`), `service/WorkflowGraphService.java` (chỉ `recomputeNodeStatus`), `service/ProjectActivityService.java`, DTO node của đồ thị và Kanban + mapper node
- BE test: `wpe-backend/src/test/java/com/pipeline/wpe/**`
- FE: `components/mindmap/NodePropertiesModal.tsx` (có thể đổi tên `TaskDetailModal.tsx`), `components/workflow/MindmapDrawer.tsx`, `components/kanban/TaskCard.tsx`, `services/impl/**`, `services/contracts/IWorkflowService.ts`, `services/MockWorkflowService.ts` (khớp interface), `types/**`, `store/**`
- FE test: `wpe-frontend/src/**/__tests__/**`
- `docs/archive/sua_loi_workspace_dag/loi-dang-sua.md`, `tasks/README.md`

## Việc cần làm
1. **DB.** `V15__node_force_unlock.sql`: `ALTER TABLE node ADD COLUMN force_unlocked_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL, ADD COLUMN force_unlocked_at TIMESTAMPTZ NULL;`. Không sửa migration cũ.
2. **BE entity + DTO.** `NodeEntity` thêm 2 trường. DTO node của `GET /projects/{id}/graph` và Kanban thêm `forceUnlocked: boolean`, `forceUnlockedBy`, `forceUnlockedAt`.
3. **BE forceUnlock.** Ghi `force_unlocked_by = actor`, `force_unlocked_at = now()`. Giữ nguyên kiểm tra (OWNER, LOCKED, dự án không lưu trữ). Test trước: mở sớm rồi thêm dây từ một task chưa xong → task vẫn TODO.
4. **BE recomputeNodeStatus.** Không đưa TODO → LOCKED nếu `force_unlocked_at != null`. Test: task thường TODO + thêm cha chưa xong → LOCKED (hành vi cũ giữ nguyên); task mở sớm → vẫn TODO.
5. **BE nhật ký.** `ProjectActivityService` thêm mục "`<tên>` mở khóa sớm `WPE-xxx`" dựng từ `force_unlocked_by/at`. Test có mục này.
6. **FE API.** Thêm `forceUnlockTask(taskId)` → `POST /nodes/{taskId}/force-unlock`; dùng lại API đổi trạng thái/nộp/duyệt mà Kanban đang dùng cho các nút hành động. Mapper đồ thị đọc `forceUnlocked`.
7. **FE hộp Chi tiết task.** Dựng lại `NodePropertiesModal` theo bố cục đã chốt. Khung điều kiện lấy task đứng trước từ cây/đồ thị đã tải (cạnh `node_dependency`, kể cả ghost khác phase). Nút hành động theo bảng vai trò ở trên. Chế độ chỉ xem: các ô khóa (T3), nút hành động vẫn hiện nếu đúng vai trò.
8. **FE mở khóa sớm.** Bấm "Mở khóa sớm" → nếu còn task trước chưa xong thì hộp xác nhận liệt kê mã + tên → gọi API → đọc lại cây (`resetPhaseTree`) và Kanban. Lỗi thì báo.
9. **FE nhãn "Mở sớm"** trên node của cây và thẻ Kanban (`TaskCard`).
10. Commit nhỏ: DB+BE (bước 1–5) và FE (bước 6–9) tách commit; chạy skill `kiem-contract` sau khi đổi DTO.

## Tiêu chí xong
- BE: `./mvnw test` BUILD SUCCESS; có test cho bước 3, 4, 5. Flyway chạy V15 khi khởi động, `\d node` có 2 cột mới.
- FE: typecheck 0 lỗi; vitest toàn bộ qua; có test cho: nhãn trạng thái (không còn ô chọn Status), nút hành động theo vai trò, hộp xác nhận mở khóa sớm liệt kê đúng task chưa xong.
- `grep -n "<option value=\"LOCKED\"" wpe-frontend/src/components/mindmap/*.tsx` → không còn.
- Test tay (chủ dự án, dự án đã Publish): task C chờ A, B (A xong, B chưa) → hộp hiện "Chờ 1/2 task trước xong", ✔ A, ○ B. Bấm Mở khóa sớm → hộp xác nhận nêu B → Vẫn mở → C thành "Chờ làm" + nhãn "Mở sớm". Thêm dây D → C → C **vẫn** "Chờ làm". Nhật ký hoạt động có "… mở khóa sớm WPE-…".
- Test tay (thành viên được giao C): thấy nút Bắt đầu, không thấy Mở khóa sớm, không sửa được ô nào.

## Kết quả (14/11/2026)
Commit trên nhánh `fix/sua-loi-workspace-dag`:
- `b1594c9` (DB + BE)
  - `V15__node_force_unlock.sql`: `node.force_unlocked_by` (FK `users`, `ON DELETE SET NULL`), `node.force_unlocked_at`.
  - `forceUnlock` ghi 2 cột trên. `recomputeNodeStatus` không đưa TODO → LOCKED nếu task đã mở sớm.
  - `GraphNodeResponse`, `KanbanTaskResponse` thêm `forceUnlockedBy`, `forceUnlockedAt` (giữ constructor cũ). Gom 2 đoạn dựng `GraphNodeResponse` trùng nhau (`WorkflowGraphService`, `NodeAssignmentService`) thành `GraphNodeResponse.from(...)`; `KanbanTaskResponse.withArtifacts(...)` thay đoạn dựng lại 14 trường.
  - `ProjectActivityService`: mục `TASK_FORCE_UNLOCKED` "Đã mở khóa sớm task WPE-… khi task trước chưa xong" đúng người, đúng thời điểm.
  - 3 test mới (không khóa lại khi thêm cha chưa xong; ghi ai/lúc nào; nhật ký). `./mvnw test` 618 test, BUILD SUCCESS.
- `6103e32` (FE dữ liệu): kiểu `forceUnlocked` cho node/task; mapper đọc `forceUnlockedAt`; ghost kèm `status` và `sourceTaskCode` của task nguồn (trước đây ghost không có trạng thái nên luôn bị coi là chưa xong); `forceUnlockTask` (POST `/nodes/{id}/force-unlock`); store `forceUnlockNode` (chặn nếu không phải owner, xong thì đọc lại cây); `utils/taskPrerequisites.ts` (`prerequisitesOf`, `isUnlockSatisfied`).
- `a798fe5` (FE giao diện): `NodePropertiesModal` thành hộp **"Chi tiết task"**:
  - Đầu hộp: mã · tên, nhãn trạng thái tiếng Việt (🔒 Đang khóa / Chờ làm / Đang làm / Chờ duyệt / Xong), nhãn "Mở sớm".
  - Khung điều kiện: "Chờ k/n task trước xong (cần tất cả | chỉ cần 1)" + ✔/○ từng task (cùng phase và phase khác).
  - Nút hành động: Mở khóa sớm (chủ dự án + LOCKED; còn task trước chưa xong thì hộp xác nhận liệt kê mã + tên → "Vẫn mở khóa"), Bắt đầu / Nộp để duyệt (người được giao), Duyệt / Trả lại kèm lý do (chủ dự án / quản lý). Đổi trạng thái đi qua Kanban của phase (`moveTask`): cùng luật chuyển, sang Chờ duyệt thì mở hộp nộp minh chứng.
  - Hai mục Giao việc (người làm, hạn chót) và Yêu cầu (tên, mô tả, điều kiện mở khóa dạng radio "Cần tất cả" / "Chỉ cần 1").
  - Nhãn "Mở sớm" trên thẻ cây (`BranchCard`) và thẻ Kanban (`TaskCard`).

Kiểm tra tự động: FE typecheck sạch, `vitest run` 80 file / 539 test qua (thêm test helper, store, service, mapper, 7 test hộp Chi tiết task, nhãn).

Kiểm thử API thật (backend khởi động lại, Flyway chạy V15): mở sớm task C (LOCKED → TODO, ghi người 2 + thời điểm) → thêm dây từ task chưa xong vào C → C vẫn TODO; `/graph` và `/phases/{id}/tasks` trả `forceUnlockedBy/At`; nhật ký có "Alex Kim · Đã mở khóa sớm task WPE-002". Dự án nháp đã xóa.

Test tay: chờ người dùng.
