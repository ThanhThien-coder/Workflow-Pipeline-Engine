# T1 — Học ký hiệu UML và luyện chung một bài (môn OOAD)

Người làm: mỗi người (A, B, C, D) — vẽ riêng, sau đó họp so bài
Người review: cả nhóm (buổi so bài)
Trạng thái: theo từng người — ghi ở `docs/tasks/ghi-chep/T1-<A|B|C|D>.md`
Cần có trước: không (làm song song với T0)
Cần trước bước frontend: không
Mở khóa: A7, B7, C7, D7
Nhánh git: t1-<chữ của bạn>
Ước lượng: 1 ngày (gồm 45 phút họp so bài)

## Vì sao cần task này
Môn OOAD chấm cả việc vẽ đúng ký hiệu lẫn việc hiểu sơ đồ. Cả 4 người cùng vẽ **một chức năng nhỏ** một cách độc lập rồi so bài: sai ở đâu thấy ngay, và cả nhóm thống nhất một cách vẽ trước khi vẽ sơ đồ thật cho mảng của mình (A7–D8).

## Kiến thức phải nắm
Đọc `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 1–3: use case và đặc tả use case, activity, sequence, communication, class (phân tích BCE và thiết kế), state machine. Các mục component, deployment, package, object, ERD đọc lướt (dùng ở X3).

## Bài luyện chung: "Hàng đợi góp ý" (Cụm 8)
Chức năng nhỏ, có đủ actor, luồng, lớp và trạng thái. Đọc trước: `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md` Cụm 7 và 8, `wpe-backend/src/main/java/com/pipeline/wpe/controller/GuestGatewayController.java` (hàm nhận góp ý), `wpe-backend/src/main/java/com/pipeline/wpe/service/FeedbackQueueService.java`, `wpe-backend/src/main/java/com/pipeline/wpe/entity/ProjectFeedbackEntity.java`.

Mỗi người tự vẽ **trên giấy hoặc draw.io**, không xem bài nhau, không dùng AI:
1. Sơ đồ use case: Khách/Giáo viên gửi góp ý, thành viên xem và đánh dấu đã xử lý, Owner tạo/thu hồi link.
2. Đặc tả use case "Gửi góp ý qua link" theo mẫu trong cẩm nang (có luồng thay thế: token hết hạn hoặc bị thu hồi).
3. Sơ đồ activity "Gửi góp ý" có 2 làn: Khách | Hệ thống.
4. Sơ đồ sequence "Gửi góp ý": lifeline là lớp thật (`GuestGatewayController`, `FeedbackQueueService`, repository…), có `alt` cho token không hợp lệ.
5. Sơ đồ class (thiết kế) gồm các lớp ở câu 4 cùng `ProjectFeedbackEntity`, `FeedbackStatus`, `ReviewerRole`, `GuestLinkEntity`.
6. Sơ đồ state của góp ý: OPEN → RESOLVED.

## Việc cần làm
1. Tạo `docs/tasks/ghi-chep/T1-<chữ>.md` (mẫu ở cuối), `Trạng thái: đang làm`.
2. 🧠 Đọc cẩm nang mục 1–3.
3. 🧠 Vẽ đủ 6 sơ đồ của bài luyện (khoảng 2–3 giờ). Chụp ảnh dán vào ghi chép.
4. 🧠 Tự chấm bài mình theo checklist trong cẩm nang, ghi điểm từng sơ đồ.
5. **Họp so bài 45 phút (cả 4 người):** với mỗi loại sơ đồ, đặt 4 bài cạnh nhau, chỉ ra chỗ khác nhau, tra cẩm nang để chốt bản đúng. Mỗi người ghi **3 lỗi mình đã mắc** vào ghi chép.
6. Cài công cụ vẽ (mặc định PlantUML trong VS Code, hoặc công cụ GV yêu cầu — xem cẩm nang mục 1). Chép bản đã thống nhất sang file trong `docs/ooad/luyen-tap/`:
   - A: `uc-gop-y.puml` và `dac-ta-gop-y.md`
   - B: `activity-gop-y.puml`
   - C: `sequence-gop-y.puml`
   - D: `class-gop-y.puml` và `state-gop-y.puml`
7. Đổi `Trạng thái: chờ kiểm` trong ghi chép của mình.

## Tiêu chí xong
- [ ] Ghi chép có ảnh 6 sơ đồ tự vẽ, điểm tự chấm và 3 lỗi đã mắc.
- [ ] `docs/tasks/ghi-chep/T1-hop-so-bai.md` có biên bản họp: các điểm khác nhau và bản đã chốt. Người ghi biên bản: A.
- [ ] Các file trong `docs/ooad/luyen-tap/` render được (dán ảnh render vào PR).

## Câu hỏi bảo vệ
1. Trong bài luyện, quan hệ nào là include, quan hệ nào là extend? Vì sao không đảo ngược?
2. Message trong sequence của bạn ứng với phương thức nào trong class diagram?
3. "Đánh dấu đã xử lý" là một trạng thái hay một hành động? Vẽ ở sơ đồ state thế nào?

## Cấm
- Dùng AI để vẽ bản đầu tiên. AI chỉ được dùng ở bước 6 (chép sang PlantUML) và để soát lỗi sau khi bạn đã tự vẽ.

## Dành cho Claude (đọc trước khi làm)
Người dán file này đang **học vẽ UML**.
1. Không vẽ hộ bản đầu tiên. Nếu được nhờ vẽ, hãy hỏi lại họ đã vẽ tay chưa.
2. Khi họ đưa bản vẽ (ảnh hoặc mô tả): chấm theo checklist trong `docs/ooad/CAM_NANG_VE_SO_DO.md`, chỉ ra lỗi ký hiệu và chỗ chưa khớp với code thật. Để họ tự sửa.
3. Ở bước 6 mới được chuyển bản họ đã chốt sang PlantUML, và phải giữ đúng nội dung họ vẽ.

## Mẫu file ghi chép `docs/tasks/ghi-chep/T1-<chữ>.md`
```markdown
# T1 — Ghi chép của <chữ>
Trạng thái: đang làm

## 6 sơ đồ tự vẽ (ảnh)
## Tự chấm theo checklist (điểm từng sơ đồ)
## 3 lỗi mình đã mắc và cách đúng
```
