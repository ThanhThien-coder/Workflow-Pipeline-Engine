# C7 — Sơ đồ phân tích OOAD: mảng Chạy task & Realtime

Người làm: C
Người review: D
Trạng thái: chờ kiểm
Cần có trước: T1
Cần trước bước frontend: không
Mở khóa: C8
Nhánh git: c7-ooad-phan-tich
Ước lượng: 1 ngày

> ⚡ **Chế độ sprint:** Claude làm hết các bước, kể cả 🧠; bỏ qua Bước 0 và mục "Dành cho Claude". Luồng làm: [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 2–3.
> - **Claude tự chạy bằng dòng lệnh:** render các file `.puml` ra PNG.
> - **Dời về buổi kiểm chung (mục 7):** không có.
> - **Không làm trong sprint:** vẽ tay bản đầu trên giấy. Claude vẽ từ code thật; vòng hiểu là người làm giải thích lại 1 sơ đồ sequence (task số 7 thì 1 sơ đồ activity).

## Vì sao cần task này
Sơ đồ phân tích trả lời câu hỏi "hệ thống làm gì, cho ai", chưa bàn tới code. Mảng của C có luồng nghiệp vụ đậm nhất (nộp bài, duyệt, từ chối, tự mở khóa), nên sơ đồ của C thường là phần giảng viên hỏi nhiều nhất.

## Sản phẩm (lưu ở `docs/ooad/C-thuc-thi/`)
1. `uc-thuc-thi.puml` — sơ đồ use case của mảng.
   - Actor: Cộng sự, Chủ dự án (tổng quát hóa từ Cộng sự), Bộ hẹn giờ (actor thời gian, cho việc quét trễ hạn).
   - Use case gợi ý: Xem My Tasks, Bắt đầu làm, Hủy nhận việc, Nộp bài, Đính kèm minh chứng, Duyệt bài, Từ chối bài, Mở khóa cưỡng bức, Quản lý tài nguyên dự án, Xem thông báo, Quét task trễ hạn.
   - Bắt buộc có ít nhất 1 `<<include>>`, 1 `<<extend>>` (ví dụ "Đính kèm minh chứng" mở rộng "Nộp bài"), 1 tổng quát hóa giữa actor, và 1 actor không phải người.
2. `dac-ta-uc.md` — đặc tả 3 use case: **Nộp bài**, **Duyệt bài**, **Từ chối bài**. Luồng ngoại lệ khớp với lỗi trong code (409 sai version, 403 không phải owner, 400 thiếu lý do, 409 `PROJECT_ARCHIVED`).
3. `activity-vong-doi-task.puml` — activity "Vòng đời một task" với 3 làn Cộng sự | Chủ dự án | Hệ thống. Có rẽ nhánh duyệt/từ chối kèm vòng lặp quay lại làm, và fork sau khi DONE (mở khóa task con ‖ gửi thông báo).
4. `bce-thuc-thi.puml` — sơ đồ lớp phân tích BCE:
   - boundary: bảng Kanban, hộp thoại nộp bài, chuông thông báo;
   - control: điều khiển trạng thái task (FSM), bộ mở khóa phụ thuộc, bộ phát sự kiện, bộ quét trễ hạn;
   - entity: Công việc, Minh chứng, Thông báo, Phụ thuộc công việc.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1, 3.2, 3.3, 3.6; `docs/specs/system-overview.md` (Phân hệ 3, UC13–UC18); `docs/specs/workflow-engine.md`; integration map Cụm 5, 6.
Trả lời:
1. "Tự mở khóa task con" có phải use case không? Ai là actor? Vẽ nó ở sơ đồ nào thì hợp hơn?
2. Vì sao Bộ hẹn giờ được coi là actor?
3. Activity "Vòng đời task" khác sơ đồ state của task (C8) ở điểm nào?

## Được đọc
- `docs/**`, `wpe-backend/src/**`, `wpe-frontend/src/**`

## Được ghi
- `docs/ooad/C-thuc-thi/**`, `docs/ooad/png/C-*.png`
- `docs/tasks/C-thuc-thi/C7-ooad-phan-tich.md`

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 **Vẽ tay** (giấy hoặc draw.io) đủ 4 sản phẩm, không dùng AI. Chụp ảnh dán vào ghi chép.
3. 🧠 Tự chấm theo checklist của từng loại sơ đồ trong cẩm nang, ghi điểm.
4. 🤝 Đưa ảnh hoặc mô tả bản vẽ cho Claude soát. Claude chỉ ra lỗi, **bạn tự sửa**.
5. 🤝 Chép sang PlantUML (hoặc công cụ GV yêu cầu), render, xuất PNG vào `docs/ooad/png/` với tên `C-<tên file>.png`.
6. Mở PR. Người review (D) dò theo checklist và hỏi "Câu hỏi bảo vệ".

## Tiêu chí xong
- [ ] Đủ 4 sản phẩm, render được, có PNG.
- [ ] Checklist cẩm nang của từng sơ đồ đạt hết, hoặc mục nào không đạt thì có giải thích.
- [ ] Use case khớp ma trận RBAC (UC13–UC18), hoặc giải thích vì sao thêm hay gộp.
- [ ] Ghi chép có ảnh bản vẽ tay đầu tiên.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn tài liệu)
1. Chỉ vào sơ đồ: include nào, extend nào, điều kiện extend là gì?
2. Theo sơ đồ activity, task bị từ chối 2 lần thì luồng đi thế nào?
3. Trong sơ đồ BCE, "Duyệt bài" đi qua những lớp nào, theo thứ tự nào?

## Cấm
- Dùng AI vẽ bản đầu tiên.
- Sửa file ngoài mục "Được ghi".
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ sơ đồ OOAD** cho mảng của họ.
1. Không vẽ hộ bản đầu tiên. Nếu được nhờ vẽ từ đầu, hãy hỏi lại họ đã vẽ tay chưa và đề nghị xem bản vẽ.
2. Khi họ đưa bản vẽ: chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`, chỉ ra lỗi ký hiệu, lỗi chiều mũi tên, chỗ không khớp với đặc tả hoặc code thật. Đặt câu hỏi để họ tự sửa.
3. Chỉ chuyển sang PlantUML sau khi họ đã chốt bản vẽ, và phải giữ đúng nội dung họ vẽ.
4. Cuối buổi, hỏi họ 3 câu trong "Câu hỏi bảo vệ".

## Ghi chép của người làm
### Trả lời Bước 0

### Ảnh bản vẽ tay đầu tiên

### Tự chấm theo checklist (điểm từng sơ đồ)
Claude chấm theo `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3 (chế độ sprint, không có bản vẽ tay):
- **Use case 10/10.** 13 use case. Ngoài ma trận RBAC có 4 use case, đều có ghi chú trên sơ đồ: Xem thông báo (C2/C3), Thêm link vào kho (C4), Mở khóa cưỡng bức (C1, chỉ Chủ dự án), Quét task trễ hạn (actor thời gian).
- **Đặc tả 6/7.** Chưa đạt "tiền điều kiện không lặp lại thành bước": bước 7 vẫn kiểm quyền, ARCHIVED, version. Giữ lại vì đó là chỗ code thật kiểm và là điểm bắt đầu của các luồng ngoại lệ E2–E6.
- **Activity 8/8.** 1 nút bắt đầu, 1 nút kết thúc; mọi hình thoi có điều kiện; fork sau DONE có join; mỗi hành động đúng làn.
- **BCE:** actor chỉ nối boundary; boundary → control → entity; association giữa các entity có bội số 2 đầu. Không chấm mục visibility/kiểu (chỉ áp cho class thiết kế, C8).

### Lỗi Claude hoặc người review chỉ ra và cách mình sửa
**Bản nháp do agy vẽ từ code thật (12/11/2026), Claude kiểm, làm TRƯỚC khi T1 xong** (người làm đồng ý làm trước). 4 file ở `docs/ooad/C-thuc-thi/`. Lần 1 Claude trả về 4 lỗi, agy đã sửa ở lần 2:
1. Use case và BCE ghi "bộ quét trễ hạn chưa có code" → sai, đã có `TaskOverdueScanner.scanOverdueTasks` (`@Scheduled` 15 phút). Đã sửa ghi chú.
2. Activity: các bước từ chối nằm trong thân `repeat` nên nhánh duyệt cũng chạy qua → thêm hình thoi "Bài nộp đạt yêu cầu?" sau "Xem xét bài nộp", chỉ nhánh không đạt mới có các bước từ chối.
3. BCE: Bộ hẹn giờ nối thẳng control, trái luật cẩm nang ("actor chỉ làm việc với boundary") → thêm boundary "Bộ lập lịch hệ thống".
4. Use case "Mở khóa công việc kế tiếp" không phải mục tiêu của actor → bỏ khỏi sơ đồ use case, ghi chú là thể hiện ở activity.

Đã kiểm: mã lỗi trong `dac-ta-uc.md` khớp `GlobalExceptionHandler` (409 `OPTIMISTIC_LOCK_CONFLICT`, 403 `ACCESS_DENIED`, 400 `BAD_REQUEST`, 409 `PROJECT_ARCHIVED`, 404 `RESOURCE_NOT_FOUND`); mỗi `.puml` có `@startuml`/`@enduml`; không còn actor nối thẳng control/entity.

**Lần 3 (12/11/2026 tối, Claude, theo code main sau #33 và C4 #49):**
1. **Thêm vai trò Quản lý** (#33: `canReview` = Chủ dự án hoặc `MANAGER` còn hiệu lực). Actor và chuỗi kế thừa lấy đúng như sơ đồ tổng quát X3 (`docs/ooad/he-thong/uc-tong-quat.puml`): Chủ dự án → Quản lý → Cộng sự → Người xem. Quản lý nối "UC13 Duyệt bài"; "Mở khóa cưỡng bức" vẫn chỉ Chủ dự án (code chặn 403 người khác). Activity đổi làn thành "Chủ dự án / Quản lý". Đặc tả UC2, UC3 đổi actor chính, tiền điều kiện, E6/E5 (câu báo lỗi mới), BR.
2. **"Từ chối bài" đổi thành `<<extend>>` "Duyệt bài"** [kết quả chưa đạt] cho khớp X3. Use case giờ có số UC13, UC15–UC19 như ma trận RBAC.
3. **Kho tài nguyên theo C4:** use case tách "UC19 Xem kho tài nguyên" (Người xem) và "Thêm link vào kho tài nguyên" (Cộng sự trở lên, Người xem → 403). BCE thêm control "Điều khiển kho tài nguyên" (`ArtifactService`), trước đây boundary kho nối nhầm vào điều khiển trạng thái.
4. **BCE thêm entity "Thành viên dự án"** (`ProjectMemberEntity`: vai trò, `joinedAt`, `removedAt`), vì quyền duyệt của Quản lý và quyền ghi kho đọc từ bảng này.
5. **Nộp bài theo C4:** link minh chứng sai → 400, task vẫn `IN_PROGRESS` (đặc tả thêm E6, activity thêm ghi chú); `is_public_for_guest` theo lựa chọn người nộp, mặc định `true`.
6. **Sửa chỗ sai so với code và checklist:** bỏ "dưới 50ms" (không có số đo); bỏ mô tả màu sắc giao diện (banner "đỏ" thật ra là vàng cam, "Toast xanh"; cẩm nang 3.2 cấm tả màu sắc); bỏ huy hiệu "Done / Approved" (không có trong code); E7 của Từ chối bài: task `TODO` nhận `status = IN_PROGRESS` là **Bắt đầu làm**, không lỗi, chỉ `LOCKED` mới 400.
7. **Render:** dùng `plantuml.jar` có sẵn trong extension PlantUML của VS Code (`jebbs.plantuml-2.18.1`), không tải gì: `java -jar plantuml.jar -charset UTF-8 -tpng`. BCE lỗi dòng 21 vì thiếu `allowmixing` (actor chung với class) → thêm như B làm. Đã xem cả 3 ảnh: đủ chữ, không lỗi. PNG: `docs/ooad/png/C-uc-thuc-thi.png`, `C-activity-vong-doi-task.png`, `C-bce-thuc-thi.png`.

**Mở PR theo yêu cầu người làm (12/11/2026). Người làm còn phải làm trước khi D merge:**
- T1 rút gọn: đọc `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.
- Vòng hiểu: giải thích lại sơ đồ activity (task bị từ chối 2 lần thì luồng đi thế nào).

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
