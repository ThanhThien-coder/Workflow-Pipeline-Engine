# Đề xuất làm lại trang khách (guest link)

Bản 2, ngày 20/11/2026. Bản này đã qua một lượt phản biện của Gemini 4 Neon High, các ý hợp lý đã đưa thẳng vào nội dung. Chờ nhóm duyệt.

## 1. Kết luận

Trang khách đang là một **dashboard số liệu thu nhỏ**: vài con số, biểu đồ theo thứ trong tuần, thanh trạng thái. Người mở link là **thầy cô hoặc sếp cần đánh giá một nhóm trong 5 phút**, nhưng trang không trả lời được những câu họ thật sự hỏi: *nhóm có làm đúng hạn không, ai làm gì, sản phẩm nộp ở đâu, có làm dồn vào phút chót không.*

Đề xuất đổi trang khách từ "dashboard" thành **"hồ sơ tiến độ của nhóm"**, học theo trang Insights của GitHub Classroom và bản Status update của Asana: mở ra là đọc được ngay, in hoặc lưu PDF được để làm minh chứng chấm điểm.

Về AI: **bản chạy thật hiện không cho khách gọi AI**, nên khách không thể làm tốn token (mục 6). Nút "Generate AI report" trong ảnh chụp chỉ có ở bản mock; đề xuất bỏ khỏi cả bản mock. Rủi ro thật nằm chỗ khác: góp ý của khách được đưa vào prompt AI, nên khách có thể **lái nội dung** tóm tắt AI. Mục 6 có cách xử lý.

## 2. Ai mở link này, họ cần gì

| Người mở | Họ muốn biết trong 5 phút | Trang hiện tại |
|---|---|---|
| Giảng viên chấm đồ án | Nhóm đi tới đâu so với kế hoạch; đúng hạn không; ai đóng góp bao nhiêu; sản phẩm (repo, tài liệu, demo) ở đâu; có làm dồn cuối kỳ không | Trả lời được một phần câu đầu |
| Sếp, khách hàng | Dự án ổn không, rủi ro gì, khi nào xong phần tiếp theo, hạn cuối là bao giờ | Một phần (AI Summary nếu nhóm đã chạy AI) |
| Cả hai | Gửi nhận xét, biết nhóm đã xử lý nhận xét chưa, lưu bản chụp tiến độ | Chỉ gửi được nhận xét chung |

Họ **không** cần: biểu đồ Thứ 2 đến Chủ nhật của tuần này, chữ "node", "critical path".

## 3. Hiện trạng (đã đọc code)

Nguồn chính: [GuestView.tsx](../../wpe-frontend/src/views/GuestView.tsx), [GuestGatewayService.java](../../wpe-backend/src/main/java/com/pipeline/wpe/service/GuestGatewayService.java), [HttpGuestService.ts](../../wpe-frontend/src/services/impl/HttpGuestService.ts). Ảnh chụp người dùng gửi là **bản mock** (dữ liệu "Marketing Campaign Q4", có khối Evaluation). Bản thật đã khác sau S08.

### Điểm tốt

- **Khách không chạy được AI**: `GET /guest/{token}/ai-summary` chỉ đọc `project.latest_ai_analysis`. Chạy AI mới bắt buộc là thành viên, có cooldown 60 giây mỗi dự án.
- **Link an toàn**: token 64 ký tự hex ngẫu nhiên, thu hồi được, có hạn (1–365 ngày, mặc định 30), dự án lưu trữ thì link chết.
- **Có chống spam góp ý**: tối đa 10 góp ý mỗi giờ mỗi dự án.
- **Không lộ email**; đã có tiến độ từng phase và số thành viên (S08).

### Điểm dở

| # | Vấn đề | Chỗ trong code |
|---|---|---|
| D1 | **Sản phẩm nộp không hiện.** Backend trả `publicArtifacts` nhưng FE không khai báo, không map, không vẽ. Đây là thứ thầy cần nhất. | `GuestOverviewResponse.publicArtifacts`; thiếu ở `http/guest.ts` và `guest.types.ts` |
| D2 | **Không biết đúng hạn hay trễ**, dù node có `dueDate`, `completedAt`. | `NodeEntity` |
| D3 | **Thẻ Overdue đếm sai.** Đếm theo cờ `isOverdue`, mà cờ này không bao giờ được gỡ khi task xong: task từng trễ rồi đã xong vẫn bị tính quá hạn mãi. Overview nội bộ thì đã loại task DONE, nên hai màn hình lệch nhau. | `GuestGatewayService` (`overdueCount`); `StateMachineService` không đụng `isOverdue`; `NodeRepository` dòng 42 chỉ bật cờ |
| D4 | **Không biết ai làm gì.** S08 cố ý bỏ tên người. Với thầy chấm nhóm, đây là câu hỏi số 1. | S08, "Đặc tả đã chốt" |
| D5 | **Weekly Velocity ít giá trị**: chỉ 7 ngày, theo thứ trong tuần, không thấy nhóm làm đều hay dồn cuối kỳ. Còn tính theo `updatedAt` nên sửa một task đã xong cũng làm cột nhảy. | `buildVelocity` |
| D6 | **Nhãn sai hoặc khó hiểu.** "2 blocking release" thực ra là số task `LOCKED` (đang chờ task trước, bình thường trong DAG). Nhãn phase trên đầu luôn là **phase đầu tiên**, không phải phase đang làm. "Last updated" lấy `project.updatedAt`, cột này không đổi khi task đổi trạng thái hay có bài nộp. | `GuestView.tsx` StatCard; `phaseLabel` dùng `findFirst()`; `lastUpdated` |
| D7 | **Không thấy cấu trúc công việc.** UC19 ghi khách "xem đồ thị tiến độ & tài nguyên", nhưng không có danh sách task, không có quan hệ phụ thuộc. | `docs/ooad/he-thong/uc-tong-quat.md` dòng 82 |
| D8 | **Màn hình hỏi tên chắn ngay cửa**, dù tên chỉ dùng khi gửi góp ý. Tên lại lưu trong RAM (`sessionNames`), tải lại trang là góp ý gửi với tên "Guest". Trang gọi `/overview` 2 lần lúc mở. | `EntryScreen`; `HttpGuestService.getLinkInfo`, `sessionNames` |
| D9 | **Góp ý chỉ gửi chung cả dự án**, dù backend nhận `nodeId` và `reviewerRole` (UC22). Khách không biết nhóm đã xử lý góp ý chưa. | `HttpGuestService.listFeedback` trả `[]` |
| D10 | **Tóm tắt AI không ghi lúc tạo**, có thể đã cũ cả tuần. | khối AI Summary không dùng `generatedAt` |
| D11 | **Khách không biết link còn hạn tới bao giờ**; owner không chọn được thời hạn (backend nhận `expiryDays`, FE không truyền). | `GuestAccessPopover.tsx` |
| D12 | **Không in hay lưu được** làm minh chứng. | — |
| D13 | **Artifact mặc định công khai và không tắt được.** Nộp bài: mặc định `true`, form nộp không có ô chọn. Thêm ở kho tài nguyên: gán cứng `true`. Không có API đổi cờ. Hiện chưa lộ vì FE chưa vẽ (D1), nhưng sửa D1 là lộ ngay. | `StateMachineService` dòng 491–492; `ArtifactService` dòng 91; `SubmitArtifactModal.tsx` |
| D14 | **Cổng góp ý cho dò ID task dự án khác**: ID không tồn tại trả 404, ID thuộc dự án khác trả 400. | `FeedbackQueueService.submitGuestFeedback` |
| D15 | **Giới hạn góp ý tính chung cả dự án**: một người gửi rác 10 lần là thầy bị chặn 1 giờ. | `FeedbackQueueService` dòng 63–64 |

## 4. Các hệ thống lớn làm gì

| Hệ thống | Cách chia sẻ cho người ngoài | Điều đáng học |
|---|---|---|
| **Jira Cloud** | Dashboard và filter chia sẻ "public"; admin có công tắc toàn site; dự án phải bật quyền Browse cho người ẩn danh, không thì dashboard trống | Cảnh báo rõ là link công khai; phải chọn **dữ liệu nào** lộ ra |
| **Notion** (Share to web) | Bật/tắt từng trang; hạn link (gói trả phí); cho bình luận (người xem phải đăng nhập); cho Google index hay không | Hạn link do người chia sẻ chọn; mặc định chỉ đọc, mặc định không index |
| **Google Drive** | Vai trò Viewer / Commenter / Editor cho "anyone with the link"; tắt tải, in, sao chép | Tách **xem** và **góp ý**; Google tự nhận chặn tải chỉ để ngăn bớt, không phải bảo mật |
| **monday.com** | Shareable view chỉ đọc, owner ẩn bớt cột; cộng đồng báo cột ẩn vẫn lộ qua biểu đồ | Lọc dữ liệu **ở backend**, đừng chỉ ẩn ở giao diện |
| **Asana** | Status update: On track / At risk / Off track + nội dung; AI (Smart status) **soạn nháp**, người trong nhóm chọn trạng thái và đăng | AI gợi ý, **người duyệt rồi mới công khai** |
| **GitHub Classroom** | Thầy xem nộp đúng hạn hay trễ; tab Insights có Pulse (dòng thời gian) và Contributors (đóng góp từng người) | **Đúng hạn/trễ** và **ai đóng góp gì** là 2 thứ thầy xem |

Rút ra 5 nguyên tắc:

1. **Chỉ đọc là mặc định**; góp ý là quyền riêng.
2. **Owner chọn phần nào lộ ra, backend lọc luôn** (không trả rồi để FE ẩn). Từng artifact phải tắt được.
3. **Khách không bao giờ kích hoạt AI.** Khách đọc bản đã lưu, ghi rõ tạo lúc nào.
4. **Trả lời câu hỏi của người đánh giá**: đúng hạn không, ai làm gì, sản phẩm đâu, nhịp làm việc ra sao, hạn cuối khi nào.
5. **Mở là xem được**, không bắt khai tên trước.

## 5. Màn hình mới

Thứ tự từ trên xuống theo thứ tự câu hỏi của người đánh giá.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Pipeline Engine          Read-only · Link valid until 20 Dec   [Print] │
├──────────────────────────────────────────────────────────────────────┤
│ Đồ án OOAD nhóm 3                         [Active]  Phase 2 of 4: Design │
│ Mô tả dự án (1–2 dòng)                                                │
│ Started 01 Oct · Target deadline 15 Dec · 5 members · Last activity 2h │
├───────────────┬───────────────┬───────────────┬──────────────────────┤
│ Completion    │ On time       │ Overdue       │ Waiting for review   │
│ 72% (17/24)   │ 79% (15/19)   │ 2 tasks       │ 3 tasks              │
├───────────────┴───────────────┴───────────────┴──────────────────────┤
│ ████████████░░░░░░  Done 17 · Review 3 · In progress 2 · To do 1 · Locked 1 │
├──────────────────────────────────────────────────────────────────────┤
│ Progress over time (burn-up)                                          │
│   đường "đã xong" cộng dồn so với đường "tổng task"                    │
├────────────────────────────────────────┬─────────────────────────────┤
│ Phases & tasks                         │ Team contribution           │
│ ▸ Phase 1 Analysis   100%  ✓           │ An    6 done · 40h · 6 on time│
│ ▾ Phase 2 Design      60%              │ Bình  5 done · 32h · 4 on time│
│   WPE-07 Class diagram Done · on time 📎│ Chi   0 done                │
│   WPE-08 Sequence  Overdue 2d          │ Unassigned 1                │
│   WPE-09 State     Waiting on WPE-08   ├─────────────────────────────┤
│ ▸ Phase 3 Build        0%              │ Deliverables                │
├────────────────────────────────────────┤ 📄 SRS v2 · WPE-03 · 12 Oct  │
│ AI summary · generated 2 days ago       │ 🔗 GitHub repo · WPE-10     │
│ AI-generated, may be inaccurate         ├─────────────────────────────┤
│                                        │ Send feedback               │
│                                        │ Team resolved 3 of 4 items  │
│                                        │ Name · role · task (optional)│
└────────────────────────────────────────┴─────────────────────────────┘
```

| Khối | Nội dung | Nguồn / cách tính |
|---|---|---|
| Đầu trang | Tên, **mô tả**, **trạng thái dự án** (Active, Draft, Paused, Completed), **phase đang làm "X of N"**, ngày bắt đầu, **hạn cuối dự toán**, số thành viên, **hoạt động gần nhất**, **hạn link** | `project.description`, `project.status`, `guest_link.expiresAt` có sẵn. Phase đang làm = phase đầu tiên còn `IN_PROGRESS`, không có thì phase `TODO` kế tiếp, hết thì "All phases completed". Hạn cuối = `dueDate` muộn nhất (giống `docs/specs/ai-diagnostics.md`). Hoạt động gần nhất = mốc mới nhất trong `project.updatedAt`, `node.updatedAt`, `artifact.createdAt` |
| 4 thẻ số | **Completion**; **On time**; **Overdue**; **Waiting for review** (task `REVIEW`, vì hệ thống có cổng duyệt nên đây là chỗ hay kẹt) | Xem "Công thức" dưới bảng |
| Thanh trạng thái | Một dòng gọn thay cho khối Task Status Breakdown: Done · Review · In progress · To do · Locked | Có sẵn |
| Burn-up | Đường "đã xong" cộng dồn so với đường "tổng task". Thay biểu đồ Mon–Sun. Nhìn là biết làm đều hay dồn cuối | Xem "Công thức" |
| Phases & tasks | Mỗi phase một dòng, bấm mở danh sách task: mã, tên, trạng thái, hạn, ngày xong, nhãn đúng hạn/trễ, 📎 nếu có artifact công khai (task DONE không có thì ghi "No link"), "Waiting on WPE-xx" cho task `LOCKED`, nhãn "Reopened" nếu `reopenedAt` có giá trị. Task không thuộc phase nào gom vào nhóm "No phase" để tổng luôn khớp | `node_dependency`, `reopenedAt` có sẵn. Đáp ứng UC19 ở mức danh sách; vẽ DAG chỉ đọc để sau |
| Đóng góp thành viên | Mỗi thành viên có quyền làm việc (OWNER, MANAGER, COLLABORATOR đang active): tên hiển thị, số task xong, **tổng giờ ước tính đã xong**, số đúng hạn, số đang làm. Người 0 task vẫn hiện. Thêm dòng "Former members" và "Unassigned" nếu có. Ghi chú "Based on current assignee". **Không email** | `assignedUserId`, `estimatedHours`; tên dùng `fullName`, rỗng thì `username` (như `ProjectService.displayNameOf`). **Cần nhóm quyết** (mục 9, câu 1) |
| Sản phẩm nộp | Artifact công khai: tên, loại, link, mã task, ngày nộp. Chỉ hiện link `http(s)`; mở bằng `rel="noopener noreferrer"` để token không lọt qua `Referer` | Backend đã trả 4 field; thêm `nodeCode`, `createdAt` |
| AI summary | Như S08, thêm "generated X ago" và dòng "AI-generated, may be inaccurate"; cũ hơn 7 ngày ghi "may be outdated" | Có sẵn `generatedAt` |
| Góp ý | Hỏi tên và vai trò (Teacher / Guest) **trong form**; chọn task (tùy chọn); dòng "Team resolved X of Y feedback items" (chỉ số đếm, không lộ nội dung góp ý của người khác); góp ý mình đã gửi lưu ở `sessionStorage` (đóng tab là xóa, máy dùng chung không lộ cho người sau) | Backend nhận sẵn `reviewerRole`, `nodeId`; thêm `feedbackStats { total, resolved }` |
| In / lưu PDF | Nút Print: lúc in tự mở hết các phase, ẩn form và nút, thêm dòng đầu "Snapshot at <giờ Việt Nam>", không in token | Chỉ FE |

**Công thức** (backend tính, FE chỉ hiện):

- `doneAt` của task DONE = `completedAt`, nếu rỗng (dữ liệu trước V17) thì `updatedAt`. Dùng chung cho On time, burn-up, đóng góp.
- **Overdue** = task chưa DONE có `dueDate < now`. Không dùng cờ `isOverdue`. Kèm sửa `StateMachineService` gỡ cờ `isOverdue` khi task sang DONE.
- **On time** = task DONE có `doneAt ≤ dueDate` chia cho (task DONE có `dueDate` + task chưa DONE đã quá hạn). Task quá hạn chưa xong kéo tỷ lệ xuống, tránh cảnh 19 task trễ mà vẫn "100%". Ghi chú dưới thẻ: số task không đặt hạn, và "on time = approved before due date" (`completedAt` là lúc duyệt, không phải lúc nộp).
- **Burn-up**: đường "tổng task" là số task cộng dồn theo `node.createdAt`; đường "đã xong" cộng dồn theo `doneAt`. Mốc đầu là hoạt động sớm nhất (`startedAt` hoặc `doneAt` nhỏ nhất), không có thì `project.createdAt`, để dự án để Draft lâu không trông như "dồn cuối". Khoảng dưới 14 ngày chia theo ngày, từ 14 ngày chia theo tuần. Task bị reopen thì mất mốc xong cũ, chấp nhận và ghi rõ trong tài liệu.

Bỏ khỏi trang khách:

- Màn hình hỏi tên (EntryScreen) và nút "Change identity"; luồng `getLinkInfo` / `createSession` gộp lại để chỉ gọi `/overview` một lần.
- Khối Recent Activity (trùng với danh sách task và burn-up).
- Khối Task Status Breakdown dạng to (thay bằng thanh 1 dòng).
- Khối Evaluation và nút Generate AI report **ở bản mock**.

## 6. AI và chuyện tốn token

**Hiện trạng ở bản thật** (đã đọc code):

- Khách chỉ gọi được `GET /guest/{token}/ai-summary`, đọc JSON đã lưu, không gọi service AI.
- `HttpGuestService.generateAiReport` từ chối ngay ở FE; backend **không có** endpoint nào cho khách chạy AI.
- Chạy AI mới bắt buộc đăng nhập, là thành viên dự án, cooldown 60 giây mỗi dự án.

Vậy **khách không thể làm tốn token**. Đề xuất ghi thành luật trong đặc tả: *khách không bao giờ kích hoạt AI*. Đây cũng là cách Asana làm: AI soạn nháp cho người trong nhóm, người ngoài đọc bản đã đăng.

**Rủi ro còn lại là nội dung.** Khi thành viên bấm chạy AI, backend gửi kèm mọi góp ý đang mở (`openFeedbacks` trong `AiDiagnosisRequest`). Người có link có thể gửi góp ý chứa câu lệnh gài (prompt injection) hoặc nội dung xấu; lần chạy AI sau, nội dung đó có thể hiện lại trong tóm tắt AI mà thầy đọc. Cách xử lý:

- Đợt 1: trong prompt gửi AI, bọc phần góp ý của khách thành dữ liệu có rào rõ ràng và dặn AI không làm theo chỉ dẫn trong đó; trên trang khách ghi "AI-generated, may be inaccurate".
- Đợt 2: owner bật/tắt việc chia sẻ khối AI trên link khách (mục 7).

## 7. Phía owner

| Việc | Đợt | Ghi chú |
|---|---|---|
| Chọn thời hạn khi tạo link: 7 / 30 / 90 ngày | 1 | Backend đã nhận `expiryDays`; FE phải nối qua `GuestAccessPopover → OverviewHeader → OverviewView → overviewSlice → IWorkflowService → HttpWorkflowService, MockWorkflowService` |
| Nút "Preview as guest" mở trang khách ở tab mới | 1 | Chỉ FE |
| Bật/tắt "Visible on guest link" cho từng artifact: ô chọn ở form nộp bài và ở kho tài nguyên | 1 | Cột `is_public_for_guest` đã có; thêm API đổi cờ. Có nên đổi mặc định sang tắt không: mục 9, câu 2 |
| Cảnh báo trong popover: "Anyone with this link can see task names, member names and public deliverables" | 1 | Chỉ FE |
| Chọn phần chia sẻ: tên thành viên, tóm tắt AI, cho phép góp ý | 2 | Cột mới trong `guest_link` → **migration** |
| Thấy "Link opened 3 times, last yesterday" | 2 | `last_viewed_at`, `view_count` → **migration**. Nhóm biết thầy đã xem hay chưa |

## 8. Riêng tư và an toàn

- Không bao giờ trả email, số điện thoại, ID người dùng ra API khách.
- Lọc ở **backend**: phần nào không chia sẻ thì response không có field đó.
- Trang `/guest` thêm `<meta name="robots" content="noindex, nofollow">` và `<meta name="referrer" content="no-referrer">`; popover owner không hiện chuỗi token thô, chỉ hiện link.
- Cổng góp ý: gộp "task không tồn tại" và "task của dự án khác" thành một lỗi `400 Invalid task reference`.
- Giới hạn góp ý 2 tầng: theo IP (khoảng 5 mỗi giờ, đọc IP thật theo cấu hình proxy lúc deploy) **cộng với** trần chung mỗi dự án nâng lên khoảng 30 mỗi giờ. Không bỏ trần dự án, vì nhiều thầy cô ngồi chung một mạng trường có cùng IP.
- Đóng góp thành viên tính theo người đang được giao. Owner hoặc manager hiện đổi được người làm của task đã DONE (`WorkflowGraphService.updateNode`), nên số liệu có thể bị chỉnh. Nên chặn việc này; việc đó đụng luồng sửa đồ thị của mảng khác nên cần hỏi người phụ trách trước, không gộp vào task trang khách.

## 9. Cần nhóm quyết

1. **Hiện tên thành viên trên trang khách?** S08 (Thiện chốt 19/11) đã quyết không hiện tên người. Đề xuất này đổi lại: hiện **tên hiển thị** (không email) trong khối đóng góp, vì thầy chấm nhóm cần biết ai làm gì; popover owner có cảnh báo. Nếu không đồng ý thì khối đóng góp hiện "Member A, B, C", vẫn thấy chia việc có đều không.
2. **Artifact mới nộp mặc định hiện cho khách hay không?** Hiện là có. Đề xuất giữ mặc định là có (nộp bài là để thầy xem) nhưng thêm ô chọn để tắt.
3. **Đợt 2 có làm không**, hay dừng ở đợt 1 cho kịp hạn đồ án.

## 10. Chia đợt và task

**Đợt 1, không cần migration:**

| Task | Nội dung | Ước lượng |
|---|---|---|
| G1 — Backend số liệu | Thêm field cuối vào `GuestOverviewResponse` (giữ field cũ): `description`, `projectStatus`, `startedAt`, `targetDeadline`, `lastActivityAt`, `linkExpiresAt`, `currentPhase`, `onTime { onTime, base, noDueDate }`, `reviewCount`, `burnup[]`, `phases[].tasks[]` (kèm `waitingOn`, `reopened`, `hasArtifact`), `contributors[]` (theo câu 1), `artifacts` thêm `nodeCode` và `createdAt`, `feedbackStats`. Sửa `overdueCount`, `phaseLabel`; gỡ `isOverdue` khi DONE. Cập nhật `docs/FRONTEND_BACKEND_INTEGRATION_MAP.md`. Test | ~5 file + test, 400–500 dòng |
| G1b — Backend an toàn | API đổi cờ `isPublicForGuest`; sửa nhánh nộp lại artifact trùng trong `StateMachineService` cho cập nhật cờ; gộp lỗi `nodeId`; giới hạn góp ý 2 tầng; bọc góp ý khách trong prompt AI. Test | ~5 file + test, ~250 dòng |
| G2a — Frontend dữ liệu và bố cục | `guest.types.ts`, `http/guest.ts`, `HttpGuestService.ts`, mock; bỏ EntryScreen, gọi `/overview` một lần; đầu trang, 4 thẻ, thanh trạng thái, Phases & tasks, Đóng góp, Sản phẩm nộp, AI, form góp ý mới; meta noindex/no-referrer. Test | ~7 file + test, 600–800 dòng |
| G2b — Frontend burn-up và in | Biểu đồ burn-up (SVG tự vẽ, không thêm thư viện), chế độ in. Test | ~3 file, ~300 dòng |
| G3 — Phía owner | Chọn thời hạn link (chuỗi 7 file), Preview, cảnh báo, ẩn token thô; ô "Visible on guest link" ở form nộp bài và kho tài nguyên | ~9 file + test, ~250 dòng |

Thứ tự: G1 và G1b song song (khác file) → G2a → G2b; G3 làm song song với G2a sau khi G1b xong. Theo luật nhóm, các task này đều đủ lớn và đã rõ đặc tả, giao agy làm, Claude kiểm.

**Để sau, không cần migration:** vẽ DAG chỉ đọc trên trang khách.

**Đợt 2, cần migration** (dừng hỏi nhóm trước): owner chọn phần chia sẻ theo từng link, đếm lượt xem.

## Nguồn

- Jira Cloud: [Allow anonymous access to projects](https://confluence.atlassian.com/adminjiracloud/allowing-anonymous-access-to-your-project-779172888.html), [cộng đồng Atlassian về dashboard công khai](https://community.atlassian.com/t5/Jira-questions/Anonymously-viewable-dashboard-and-filters/qaq-p/2190694)
- Notion: [Publish Notion pages to the web](https://www.notion.com/help/guides/publish-notion-pages-to-the-web), [Sharing & permissions](https://www.notion.com/help/sharing-and-permissions)
- Google Drive: [Stop, limit, or change sharing](https://support.google.com/drive/answer/2494893), [Download/print/copy protection](https://bughunters.google.com/learn/invalid-reports/google-products/5300109711245312/download-print-copy-protection-bypasses-in-drive)
- monday.com: [Permissions](https://support.monday.com/hc/en-us/articles/360019222479-Permissions-on-monday-com), [cột ẩn lộ qua dashboard](https://community.monday.com/t/hidden-columns-visible-in-shared-dashboard-charts/120669)
- Asana: [Smart status](https://help.asana.com/s/article/smart-status), [Project progress and status updates](https://help.asana.com/s/article/project-progress-and-status-updates)
- GitHub Classroom: [deadlines](https://github.blog/news-insights/github-classroom-now-supports-deadlines-and-class-rosters), [group assignments và Insights](https://github.blog/developer-skills/career-growth/how-to-use-group-assignments-in-github-classroom)
