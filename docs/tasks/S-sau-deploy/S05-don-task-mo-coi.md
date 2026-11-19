# S05 — Dọn task "mồ côi" cũ (Overview đếm dư node) và chặn tái phát

Người làm: Người 2 (gói Nghiệp vụ backend)
Người review: Thiện
Trạng thái: xong
Cần có trước: không
Mở khóa: không
Nhánh git: s05-don-task-mo-coi
Ước lượng: 0,5 ngày

## Vì sao cần task này (lỗi gốc #13)
Trước TASK_68, xóa phase **không xóa task** mà chỉ đặt `phase_id = NULL`.
- Các task đó không thuộc phase nào nên không hiện trên đồ thị.
- Nhưng chúng vẫn được đếm ở Overview ("1 task mà Overview hiện 3 node"), trang khách, AI, và vẫn giữ dây phụ thuộc. Task con ở phase khác có thể bị khóa mãi.

TASK_68 đã sửa cách xóa phase: chặn nếu còn task đang làm, còn lại xóa luôn task và dây. Nhưng **dữ liệu cũ trên server vẫn còn** các task mồ côi này.

## Đang làm gì (tóm tắt cho người đọc)
1. Một bước dọn chạy **một lần lúc backend khởi động**, chạy lại cũng không sao (idempotent):
   - task mồ côi chưa bắt đầu (LOCKED/TODO): xóa cùng dây nối, rồi tính lại trạng thái task con;
   - task mồ côi đã làm (IN_PROGRESS/REVIEW/DONE): chuyển vào phase "Recovered tasks" của dự án để còn thấy được, không mất công sức.
2. Chặn tái phát: API tạo task không cho `phaseId` rỗng nữa (nếu Bước 0 xác nhận không chỗ nào cần task không phase).

## Bước 0 — Kiểm trước (bắt buộc)
1. Trên DB server (nhờ Thiện chạy) hoặc stack thử, đếm task mồ côi:
   ```sql
   SELECT project_id, status, COUNT(*) FROM node WHERE phase_id IS NULL GROUP BY project_id, status;
   ```
2. Tìm mọi chỗ có thể tạo task không phase:
   - `grep -rn "phaseId" wpe-frontend/src/services/impl/http/graph.ts`;
   - `BE/service/TemplateCloneService.java` (khoảng dòng 320: node template thiếu `phaseId`);
   - dữ liệu mẫu `V2__seed_initial_data.sql`.

   Ghi kết luận: có luồng nào **cố ý** tạo task không phase không?
3. Nếu có luồng cố ý (ví dụ template có task không phase): **dừng**, báo Thiện, không làm mục 2 "Chặn tái phát".

## Được đọc
- `wpe-backend/src/**`, `wpe-frontend/src/services/**`

## Được ghi
> `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`
- `BE/service/maintenance/OrphanNodeCleanupService.java`, `BE/service/maintenance/OrphanNodeCleanupRunner.java` (MỚI)
- `BE/service/WorkflowGraphService.java` (đổi `recomputeNodeStatus` từ `private` sang package/public để dùng lại, và chặn `phaseId` null ở `createNode` nếu Bước 0 cho phép)
- `BE/service/TemplateCloneService.java` (chỉ nếu Bước 0 thấy clone có thể tạo node không phase: gán vào phase đầu tiên)
- `wpe-backend/src/main/resources/application.yml` (khóa `app.maintenance.cleanup-orphan-nodes`)
- Test trong `wpe-backend/src/test/**`, `docs/DEPLOY.md` (1 đoạn), file task này

## Đặc tả đã chốt
- Khóa cấu hình `app.maintenance.cleanup-orphan-nodes: ${CLEANUP_ORPHAN_NODES:true}`. Bằng `false` thì không chạy.
- `OrphanNodeCleanupRunner implements ApplicationRunner` gọi `OrphanNodeCleanupService.cleanup()` (`@Transactional`). Lỗi thì ghi log ERROR, **không** làm backend dừng.
- Với từng dự án có node `phase_id IS NULL`:
  - Node **LOCKED/TODO**: xóa mọi `node_dependency` có node đó là cha hoặc con, xóa node. Task con ở phase khác vừa mất cha: tính lại bằng `recomputeNodeStatus`, với cha còn lại = cha hiện tại trừ các node vừa xóa.
  - Node **IN_PROGRESS/REVIEW/DONE**: **Thiện chốt 19/11: xóa luôn** (dữ liệu hiện chỉ là dữ liệu test), cùng cách như node LOCKED/TODO. Không tạo phase "Recovered tasks".
  - Ghi log INFO: số node đã xóa theo từng dự án.
- Chạy lần 2 không làm gì (không còn node mồ côi).
- **Chặn tái phát** (chỉ khi Bước 0 cho phép): `createNode` với `phaseId == null` → 400 `PHASE_REQUIRED` "A task must belong to a phase." Template clone thiếu `phaseId` thì gán vào phase đầu tiên của dự án mới.

## Việc cần làm
1. 🧠 Bước 0, ghi kết quả đếm và kết luận vào Ghi chép.
2. 🤝 Service dọn + runner + test:
   - dự án có 2 node mồ côi TODO và 1 node DONE → cả 3 node bị xóa;
   - task con ở phase khác chuyển LOCKED → TODO khi mất cha duy nhất;
   - chạy lại lần 2 không đổi gì;
   - tắt cờ thì không chạy.
3. 🤝 Chặn tái phát (nếu được) + test.
4. Ghi vào `docs/DEPLOY.md`: lần deploy kế tiếp backend tự dọn, cách tắt bằng `CLEANUP_ORPHAN_NODES=false`.

## Tiêu chí xong
- [ ] `./mvnw -q test` xanh.
- [ ] Kiểm tay trên stack thử: tạo node mồ côi bằng SQL (`UPDATE node SET phase_id = NULL WHERE id = ...`), khởi động lại backend → node biến mất; Overview "Total Nodes" bằng số task thấy trên đồ thị.

## Câu hỏi bảo vệ
1. Vì sao task mồ côi đã làm xong không xóa mà chuyển vào phase "Recovered tasks"?
2. "Idempotent" nghĩa là gì, vì sao bước dọn chạy lúc khởi động phải idempotent?
3. Vì sao phải tính lại trạng thái task con sau khi xóa task cha?

## Cấm
- Viết migration SQL xóa dữ liệu (dùng service Java để tính lại trạng thái đúng luật).
- Sửa migration cũ. Đọc `.env*`. Tự chạy lệnh trên DB server thật (nhờ Thiện). Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5.
- Bước 0 mục 2 tự tìm trong code và trình bày cho người làm. Nếu thấy luồng cố ý tạo task không phase thì dừng phần "Chặn tái phát" và hỏi.
- Không chạy SQL trên server thật. Làm xong: ghi chép, `chờ kiểm`, hỏi 3 câu bảo vệ.

## Ghi chép của người làm
Bước 0 (do Claude/Sonnet làm, không có người hỏi, 19/11):
- Mục 1 (đếm node mồ côi trên DB thật): KHÔNG làm được, bỏ qua. Số node mồ côi thật chưa biết; bước dọn tự xử lý lúc khởi động.
- Mục 2, kết luận: KHÔNG có luồng nào cố ý tạo task không phase.
  - FE `services/impl/http/graph.ts` khai báo `phaseId: number | null`, nhưng chỗ gọi `createNode` duy nhất là `addRootTask` và `addChildTask` (HttpWorkflowService.ts) đều luôn gửi phaseId.
  - `V2__seed_initial_data.sql`: 4 node mẫu đều có phase_id (1,2,2,3).
  - `DemoToolsService`: chỉ đọc theo phase, không tạo node.
  - `NodeEntity.builder()` chỉ có 2 nơi tạo: `WorkflowGraphService.createNode` và `TemplateCloneService`.
  - `TemplateCloneService`: node template thiếu `phaseId` hoặc phaseId không khớp phase nào thì `newPhaseId = null` (đây là chỗ tái phát thật). Đã sửa: gán vào phase đầu tiên vừa tạo.
  - Test cũ tạo node phaseId null chỉ là dữ liệu dựng (`standalone` ở dòng ~137) hoặc test từ chối quyền/archived; riêng test trùng code đã sửa để truyền phaseId.
  - Kết luận: đã chặn `createNode` khi `phaseId == null` -> 400 `PHASE_REQUIRED` "A task must belong to a phase."; initialStatus luôn LOCKED.
Đã làm: OrphanNodeCleanupService + OrphanNodeCleanupRunner (xóa hết node phase_id NULL kể cả đang làm/xong, cùng dây, tính lại task con bằng recomputeNodeStatus nay là public); khóa app.maintenance.cleanup-orphan-nodes; đoạn mục 11 trong docs/DEPLOY.md; test mới.
Test: ./mvnw -q test xanh, 1057 test, 0 lỗi (mốc đầu đợt 1037; gồm test của các task song song).
Chưa kiểm tay trên stack thử (Opus làm).
Câu hỏi bảo vệ (theo quyết định Thiện: xóa luôn, không có phase "Recovered tasks"):
1. Câu này lỗi thời: Thiện chốt xóa luôn vì dữ liệu hiện chỉ là dữ liệu test. Nếu là dữ liệu thật thì mới nên giữ lại, vì xóa task đã làm là mất công sức người làm.
2. Idempotent = chạy nhiều lần cho cùng kết quả như chạy một lần. Bước dọn chạy mỗi lần khởi động, nên lần 2 trở đi phải không làm gì (không còn node mồ côi), nếu không sẽ tác động lặp lại mỗi lần restart.
3. Task con có thể đang LOCKED vì chờ cha đã bị xóa; mất cha nên phải tính lại (hết cha thì coi như thỏa và mở sang TODO), nếu không nó bị khóa mãi.
