# S03 — Tạo / sửa task không còn lag

Người làm: Người 1 (gói Realtime và tốc độ)
Người review: Thiện
Trạng thái: xong
Cần có trước: S01, S02
Mở khóa: không
Nhánh git: s03-tao-task-nhanh
Ước lượng: 1 ngày

## Vì sao cần task này (lỗi gốc #4)
Tạo 1 task trên server thật bị "siêu lag". TASK_69 đã sửa phần lớn nhất: mỗi lần tải đồ thị nay chỉ gọi 1 request thay vì N+2. Nhưng luồng tạo task vẫn còn thừa:
1. `POST /projects/{id}/nodes`.
2. Hộp tạo task **chỉ đóng sau khi** tải lại cả đồ thị (`resetPhaseTree` → `GET /graph`).
3. Cây đổi nên Kanban của phase tải lại `GET /phases/{id}/tasks`.
4. Sự kiện realtime của chính mình quay về, lại tải đồ thị và task thêm lần nữa. S02 bỏ qua sự kiện của mình nên phần này hết.
5. Backend `GET /phases/{id}/tasks` lấy artifact **từng task một** (N+1 query) trong `StateMachineService.toKanbanTaskWithArtifacts`.

Sửa, xóa, nối dây task cũng chờ tải lại cả đồ thị rồi mới thấy kết quả.

## Đang làm gì (tóm tắt cho người đọc)
1. **Cập nhật lạc quan**:
   - Có kết quả từ `POST`/`PUT`/`DELETE` thì cập nhật cây ngay và đóng hộp ngay.
   - Sau đó đồng bộ nền **1 lần** để lấy mã task, version chuẩn.
   - Lỗi thì hoàn lại và báo.
2. Kanban của phase không tải lại khi cây chỉ đổi lặt vặt (gộp, so chữ ký).
3. Backend lấy artifact của cả danh sách task bằng **1 query**.

## Kiến thức phải nắm
Optimistic update và rollback, debounce, N+1 query trong JPA (`findByXIn`), đọc tab Network của DevTools.

## Bước 0 — Đo trước (bắt buộc, 15 phút)
Trên stack thử (README mục 4), mở DevTools → Network, tạo 1 task trong phase có 5–10 task. Ghi vào "Ghi chép":
- số request phát sinh;
- thời gian từ lúc bấm "Create Task" tới lúc hộp đóng;
- thời gian tới lúc thẻ task hiện trên cây.

Làm lại y hệt sau khi sửa để so. Số liệu phải là số **đo thật**, không ước.

## Được đọc
- `wpe-frontend/src/**`, `wpe-backend/src/**`

## Được ghi
> `FE/` = `wpe-frontend/src/`, `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`
- `FE/store/useWorkflowStore.ts` (các action `addRootTask`, `addChildTask`, `updateNodeInfo`, `removeNode`, `connectNodes`, `removeDependency`)
- `FE/services/impl/HttpWorkflowService.ts` (trả về node đầy đủ sau khi tạo / sửa), `FE/services/contracts/IWorkflowService.ts` (chỉ nới kiểu trả về nếu cần, không đổi tên)
- `FE/mappers/graphMapper.ts` (export hàm đổi node backend → `BranchGraphNode`)
- `FE/components/workflow/PhaseDetailView.tsx` (đóng hộp ngay sau POST)
- `FE/hooks/usePhaseKanban.ts` (chỉ phần tải lại khi cây đổi)
- `BE/service/engine/StateMachineService.java`, `BE/repository/ArtifactRepository.java`
- Test liên quan trong `FE/**/__tests__/**`, `wpe-backend/src/test/**`
- File task này

## Đặc tả đã chốt
- Tạo task (gốc hoặc con):
  - Đổi response `POST` sang `BranchGraphNode` bằng hàm mapper (export từ `toBranch` hiện có).
  - Chèn ngay vào `trees[phaseId]`: `parentIds` = root hoặc các cha; cập nhật `%`/trạng thái phase bằng `withPhaseProgress`.
  - Đóng hộp, rồi gọi `resetPhaseTree(phaseId)` **chạy nền**, không `await` trong hộp.
- Sửa / xóa / nối / gỡ dây: cập nhật cây ngay, gọi API, lỗi thì trả cây về bản trước và ném lỗi để UI báo như cũ. Thành công thì đồng bộ nền 1 lần.
- `usePhaseKanban`: chỉ tải lại `GET /phases/{id}/tasks` khi "chữ ký" cây đổi. Chữ ký = danh sách `id:status:version` của task trong phase. Gộp trong 300ms.
- Backend: thêm `ArtifactRepository.findByNodeIdIn(Collection<Long>)`. `getPhaseTasks`, `getMyTasks`, `getReviewTasks` lấy artifact 1 lần rồi nhóm theo `nodeId`. Kết quả JSON giữ y hệt.
- **Mục tiêu đo được** (so với Bước 0):
  - tạo 1 task chỉ còn `POST` + tối đa 1 `GET /graph` + tối đa 1 `GET /phases/{id}/tasks`;
  - hộp đóng ngay khi `POST` trả về.

## Việc cần làm
1. 🧠 Đo Bước 0, ghi số.
2. 🤝 Backend: `findByNodeIdIn` + sửa 3 hàm, test (kết quả giống trước, số lần gọi repository = 1).
3. 🤝 Frontend: cập nhật lạc quan cho tạo task; test (thẻ xuất hiện trước khi `GET /graph` trả về; lỗi `POST` thì không có thẻ và hộp báo lỗi).
4. 🤝 Cập nhật lạc quan cho sửa / xóa / nối / gỡ dây; test rollback khi API lỗi.
5. 🤝 Chữ ký cây trong `usePhaseKanban`; test (đổi tọa độ, không đổi task → không tải lại).
6. 🧠 Đo lại như Bước 0, ghi số trước/sau.

## Tiêu chí xong
- [ ] `npx tsc -b` sạch, `npx vitest run` xanh; `./mvnw -q test` xanh.
- [ ] Bảng đo trước/sau trong "Ghi chép" đạt mục tiêu ở Đặc tả.
- [ ] Kiểm tay: tạo 5 task liên tiếp nhanh trong 1 phase → đủ 5 thẻ, đúng tên, không thẻ trùng; F5 vẫn đủ 5.

## Câu hỏi bảo vệ
1. Cập nhật lạc quan sai lúc nào? Code xử lý trường hợp đó ra sao?
2. N+1 query là gì, ở đây đã sửa thế nào?
3. Vì sao vẫn cần đồng bộ nền 1 lần sau khi đã cập nhật lạc quan?

## Cấm
- Tạo id giả rồi gửi lên backend: chỉ chèn thẻ sau khi `POST` trả id thật.
- Đổi định dạng JSON của API task. Đọc `.env*`. Tự ghi `xong`.

## Dành cho Claude (đọc trước khi làm)
- Đọc `docs/tasks/S-sau-deploy/README.md` mục 3–5. Test frontend chạy từ `C:\...` viết hoa.
- Yêu cầu người làm tự đo Bước 0 trên trình duyệt và đưa số cho bạn. Không tự bịa số đo.
- Làm theo thứ tự, test sau mỗi bước. Làm xong: ghi chép, trạng thái `chờ kiểm`, hỏi 3 câu bảo vệ.

## Ghi chép của người làm

Xem báo cáo đầy đủ ở `.kb/tasks/TASK_77.report.md`. Đã làm: findByNodeIdIn (1 query artifact), chèn thẻ lạc quan khi tạo task, lạc quan + hoàn lại khi sửa/xóa/nối/gỡ, chữ ký cây ở usePhaseKanban (gộp 300ms). tsc sạch, vitest 950 xanh, mvn 1097 test 1 lỗi ở ProjectMemberServiceTest (file của TASK_81). Chưa đo Bước 0/6 và chưa kiểm tay (Opus làm).
