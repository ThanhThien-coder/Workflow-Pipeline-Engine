# Đề xuất đợt 2: trang khách, AI, thông báo góp ý, artifact

Bản 2, ngày 21/11/2026. Đã qua một lượt phản biện của Gemini 4 Neon High, các ý hợp lý đã đưa thẳng vào nội dung. Chờ duyệt. Áp dụng trên nhánh `feat/trang-khach-moi` (PR chưa mở).

## Tóm tắt quyết định

| # | Việc | Kết luận | Mức |
|---|---|---|---|
| 1 | Thanh cuộn trang khách | **Lỗi nặng, sửa ngay**: trang không cuộn được bằng chuột | Bắt buộc |
| 2 | AI trên trang khách | Luồng đúng, không đổi. Gộp rủi ro trùng, thêm hướng dẫn bật AI để thử | Nhỏ |
| 3 | Phần 2 "Schedule" rối màu, định nghĩa trễ | **Giữ, làm gọn**: bỏ mini-Gantt, mỗi phase 1 dòng, tách "phase so với mốc" và "số task trễ" | Nên làm |
| 4 | Thông báo góp ý không rõ là gì | Hiện tiêu đề + nội dung, icon riêng cho góp ý | Nên làm |
| 5 | Artifact | Bỏ ô chọn loại, chỉ dán link; nút ẩn/hiện có chữ; icon trang web nhúng sẵn | Nên làm |

## 1. Thanh cuộn trang khách

**Hiện trạng (đã đo trên trình duyệt thật):** trang cao 3.373px, màn hình 900px. `index.css` đặt `body { overflow: hidden }` cho toàn app, các trang khác tự mở cuộn (bọc khung `h-screen overflow-y-auto`, hoặc trang chủ gắn class `landing-mode` lên `html`/`body`). Trang khách mới không làm cả hai, nên người chấm chỉ thấy phần đầu, không lăn chuột xuống được. Tool kiểm giao diện không bắt được vì nó chụp cả trang một lần (`captureBeyondViewport`) và cuộn bằng lệnh JS, không thử lăn chuột.

**Sửa:**
- Khi trang khách mới mở, gắn một class mở cuộn lên `html` và `body` (cùng cách trang chủ dùng `landing-mode`), gỡ khi rời trang. Không bọc khung `h-screen`, vì cách đó làm ảnh chụp toàn trang của tool bị cắt còn 900px và dễ cắt bản in.
- Thêm luật in: `@media print { body { overflow: visible } }` để bản PDF đủ trang.
- Tool `kiem-giao-dien.mjs`: thêm bước lăn chuột thật (CDP `Input.dispatchMouseEvent`, loại `mouseWheel`) và báo **lỗi nặng** khi trang dài hơn màn hình mà lăn chuột không cuộn được.

## 2. AI trên trang khách

**Hiện trạng (đã chạy thử đầu cuối trên máy):**
- Khách **không** gọi AI. Một thành viên dự án bấm **AI Diagnosis** ở trang Overview (backend hiện cho mọi thành viên, kể cả Viewer, chứ không riêng chủ dự án) → backend gọi `wpe-ai-service` (Python, cổng 8081) → kết quả lưu vào dự án. Trang khách chỉ đọc bản đã lưu.
- Chưa ai chạy AI: `/guest/{token}/ai-summary` trả 404, trang khách ẩn khối AI. Chạy xong: khối AI hiện tóm tắt, gợi ý, rủi ro và "Generated … ago"; quá 7 ngày ghi "may be outdated".
- Không có `GEMINI_API_KEY`: service dùng thuật toán nội bộ (`HEURISTIC_FALLBACK`, 0 token, khoảng 0,1 giây). Có khóa thì gọi Gemini. Backend còn chế độ `AI_MODE=mock` (dữ liệu mẫu trong Java, không cần Python).
- Lỗi nhỏ: danh sách rủi ro lặp mã task, vì backend ghép cả `bottlenecks` lẫn `taskTraps` (WPE-005 xuất hiện 2 lần).

**Đề xuất:**
- Giữ nguyên luồng: khách không làm tốn token, người trong nhóm quyết định khi nào phân tích.
- `getGuestAiSummary`: phần rủi ro chỉ lấy `bottlenecks`, bỏ dòng `taskTraps` trùng mã task.
- Hướng dẫn bật AI để thử (đưa vào phần cách chạy thử):
  - Chạy `wpe-ai-service` ở cổng 8081 (backend mặc định `AI_MODE=http`, `AI_SERVICE_URL=http://localhost:8081`).
  - Muốn dùng Gemini thật: tạo `wpe-ai-service/.env` từ `.env.example`, điền `GEMINI_API_KEY`; khi có khóa cần kiểm tên model mặc định `GEMINI_MODEL` còn đúng không, sai tên thì service tự rơi về chế độ nội bộ.
  - Bấm phân tích nhiều lần liền: đặt `AI_COOLDOWN_SECONDS=0` cho backend (mặc định chờ 60 giây giữa 2 lần).

## 3. Phần 2 "Schedule & deadlines"

**Hiện trạng:**
- Cột timeline vẽ 2 đoạn: đoạn trong mốc tô **xanh lục nếu phase đã xong, xanh dương nếu đang chạy**; đoạn vượt mốc tô cam (đã xong) hoặc đỏ (đang chạy). Chú thích dưới bảng chỉ ghi xanh lục, không có xanh dương. Cột "Done" còn một thanh màu riêng. Một dòng có tới 3 hệ màu nên rối.
- Phase **không có hạn riêng** trong DB (`work_phase` không có cột hạn). "Planned end" là hạn trễ nhất trong các task của phase.
- Câu hỏi: task không phải task cuối mà trễ thì sao? Hiện task đó có đếm vào dòng phụ "N late", nhưng chip kết quả của phase vẫn có thể ghi "Finished on time" nếu phase xong trước mốc. Người xem dễ thấy mâu thuẫn vì chưa có chữ nào giải thích.

**Hệ thống lớn làm gì:**
- Microsoft Project đo trễ **ở từng task** (Finish Variance = ngày xong dự kiến − ngày xong theo kế hoạch gốc). Dòng tổng hợp chỉ lệch khi task trên đường găng lệch. Danh sách task trễ là báo cáo riêng ("Late Tasks", "Slipping Tasks").
- Jira Plans cảnh báo **từng task** quá hạn còn mở; một release chỉ "off track" khi lịch dự kiến vượt ngày release.
- Asana, Linear: trạng thái On track / At risk / Off track của dự án do người quản lý **tự chọn** khi viết cập nhật, không tự tính; milestone chỉ là mốc có ngày đích.

Rút ra: các hệ thống lớn tách 2 câu hỏi, **phase có xong đúng mốc không** và **task nào trễ**. Task trễ là nguồn sự thật, nằm ở danh sách riêng. Trang khách đã có danh sách đó (khối Deadlines), chỉ cần phần 2 nói rõ 2 câu hỏi này.

**Đề xuất (giữ phần này, làm gọn):**
- Bỏ mini-Gantt (nguồn rối màu chính). Thay bằng chữ: "Worked 03 Oct → 20 Oct" và "Planned end 18 Oct", để không mất khoảng chạy và ngày xong thực tế của từng phase (biểu đồ Burn-up chỉ là tổng cả dự án).
- Mỗi phase một dòng, **chỉ số và ngày, không thanh màu**: **Phase** · **Done** (`done/total`) · **Task trễ** (số gồm quá hạn + xong trễ, đỏ khi > 0) · **Ngày** (worked / planned end) · **Kết quả**. Bấm dòng phase vẫn mở phần 4 như hiện tại.
- Phân vai với phần 4 (đã chốt 21/11/2026): phần 2 là **bảng điểm** để so mọi phase cùng lúc và in ra được; phần 4 là **sơ đồ** để xem thứ tự phụ thuộc và đi vào task của một phase. Thanh tiến độ chỉ còn ở phần 4; chip kết quả dùng chung một bộ nhãn ở cả hai nơi để không lệch nhau. Phương án gộp bảng vào thẻ phase ở phần 4 đã cân nhắc và bỏ: mất chỗ so mọi phase thành hàng, bản in mất bảng, dự án nhiều phase phải kéo ngang.
- Chip **Kết quả** giữ nguyên nhãn đang dùng ở phần 4 và trong test: `Not started`, `On track`, `Behind · N overdue`, `Finished on time`, `Finished Nd late`, `No tasks`. Chỉ sửa 2 ca biên đang báo sai:
  - Phase xong hết nhưng không task nào có hạn: đổi từ "Finished on time" thành **"Completed"** (không có mốc để so).
  - Phase đang chạy nhưng không task nào có hạn: đổi từ "On track" thành **"In progress"**.
- Ví dụ của bạn: phase xong trước mốc nhưng có 1 task giữa chừng trễ → chip "Finished on time" (xanh lục) và cột Task trễ ghi "1" (đỏ). Thêm một dòng chú thích dưới bảng: "Planned end = due date of the latest task in the phase. Late tasks are counted separately and listed in Deadlines."

**Phương án đã cân nhắc và bỏ:**
- Xóa hẳn phần 2: mất câu trả lời nhanh "phase nào trễ"; phần 4 là sơ đồ, khó dò từng dòng.
- Thêm cột "hạn phase" vào DB: cần migration, giao diện nhập và luật khóa mới; không kịp ngày chấm, lại trùng nghĩa với hạn task trễ nhất.
- Bấm cột "Task trễ" để lọc danh sách Deadlines theo phase: thêm trạng thái mới, dính ca "No phase" và dự án đã xong (tab Needs attention bị ẩn). Cắt.

## 4. Thông báo góp ý

**Hiện trạng:** backend lưu tiêu đề "New feedback from {tên} ({vai trò})" và nội dung là lời góp ý. Chuông thông báo và trang Notifications hiện `text || message || title`, tức chỉ hiện lời góp ý, mất tiêu đề. Bảng thông báo trong DB không lưu loại; frontend đoán loại từ tiêu đề. Chỉ chủ dự án nhận thông báo góp ý.

**Đề xuất:**
- Chuông (`NotificationBell`) và trang Notifications hiện 2 dòng: tiêu đề in đậm, nội dung xám cắt 2 dòng. Chỉ hiện dòng 2 khi nội dung khác tiêu đề, để không lặp chữ. Áp cho mọi loại thông báo.
- Đoán loại góp ý bằng `title` có chữ "feedback", hiện icon tin nhắn.
- Giữ tiêu đề backend bắt đầu bằng "New feedback from …" (để luật đoán loại không trượt), thêm phạm vi ở cuối: "New feedback from Dr. Tran (Teacher) on WPE-005" hoặc "… on the project".

## 5. Artifact

**Hiện trạng:**
- Nộp minh chứng ở Kanban (`SubmitArtifactModal`, `TaskDetailModal`, dùng chung cho My Tasks) bắt chọn loại (PR / Figma / Docs / Zip), mặc định PR. Backend không có loại `ZIP`. Khi nộp kèm task mà không có loại, backend gán cứng `PR`; còn API thêm artifact thì tự nhận loại theo link.
- Ẩn/hiện với khách đã có, nhưng chỉ là icon con mắt nhỏ trong ngăn Artifacts (owner/manager). Người dùng không tìm ra.
- Minh chứng nộp kèm task tự vào kho Artifacts, trừ khi trùng y hệt (cùng tên, cùng link) với bản đã có trong kho.

**Đề xuất:**
- **Bỏ ô chọn loại** ở 2 modal: chỉ dán link, giữ ô ghi chú. `type` trong dữ liệu gửi lên thành tùy chọn. Backend nhận loại theo link ở mọi đường: gom `detectArtifactType` thành hàm dùng chung, dùng cả trong `submitTaskArtifact` khi không có loại. Không cần migration; cột `type` vẫn giữ. Nhãn hiển thị ở Kanban lấy theo tên miền thay cho tên loại.
- **Chọn artifact nào lên link khách:** giữ chỗ bật/tắt ở ngăn Artifacts nhưng đổi icon con mắt thành nút có chữ **"Shown to guests" / "Hidden from guests"**, và thêm một dòng chỉ đường trong popup chia sẻ link: "Choose what guests see in Artifacts". Không đưa danh sách vào popup chia sẻ, vì popup đó chỉ dành cho chủ dự án (manager cũng được ẩn/hiện) và popup nhỏ.
- Ô "Show on guest link" ngay lúc nộp bài: **cắt** khỏi đợt này. Backend chỉ đọc cờ trong object lồng `artifact`, còn frontend gửi phẳng; làm đúng phải sửa cả 2 phía và ca nộp trùng. Ẩn/hiện sau khi nộp ở ngăn Artifacts là đủ cho ngày chấm.
- **Icon trang web:** một component `SiteIcon` dùng chung cho cả 3 chỗ (trang khách, chi tiết task, ngăn Artifacts), nhận diện theo `new URL(url).hostname`, SVG nhúng sẵn cho 8 trang hay gặp trong đồ án: GitHub, GitLab, Figma, Google Docs/Sheets/Slides/Drive (một icon Google Drive), Notion, YouTube, Canva, Vercel. Trang khác: icon link chung kèm chữ cái đầu của tên miền.
  - Không dùng dịch vụ favicon ngoài (Google, DuckDuckGo): CSP của bản deploy chỉ cho `img-src 'self' data: blob:` nên bị chặn; còn lộ tên miền và IP người xem cho bên thứ ba; bản in PDF có thể thiếu ảnh.
  - Không cho backend tự tải favicon: phải chống SSRF, cache, timeout; quá nặng so với lợi ích.
  - Nguồn SVG: Simple Icons (giấy phép CC0), chép path vào file, không thêm thư viện.

## Đã chốt (21/11/2026)

1. **Ai được chạy AI:** chỉ owner/manager (hiện mọi thành viên, kể cả Viewer, đều bấm được). Lý do: mỗi lần chạy có thể tốn token Gemini.
2. **Ai nhận thông báo góp ý:** chủ dự án và manager (hiện chỉ chủ dự án). Lý do: manager cũng xử lý được hàng chờ góp ý.

## Thứ tự làm và chia việc

1. Mục 1 (bắt buộc, nhỏ): Claude tự làm, kèm vá tool kiểm giao diện.
2. Mục 3 và phần frontend mục 5 (nhiều file): giao agy theo task, Claude kiểm bằng test và tool chụp ảnh.
3. Mục 4, mục 2 (gộp rủi ro), phần backend mục 5 (nhận loại khi nộp), 2 việc ở "Cần bạn quyết" nếu đồng ý: nhỏ, Claude tự làm.

Mọi thay đổi vẫn giữ đường lùi: cờ `GUEST_REPORT_ENABLED` và trang khách cũ.

## Nguồn tham khảo

- Microsoft Project, Finish Variance fields: https://support.microsoft.com/vi-VN/project/finish-variance-fields
- Microsoft Project, Review the progress of your schedule: https://support.microsoft.com/en-us/project/review-the-progress-of-your-schedule
- Jira Plans, Troubleshoot warnings on your timeline: https://support.atlassian.com/jira-software-cloud/docs/troubleshoot-warnings-on-your-timeline-in-advanced-roadmaps
- Asana, Project progress and status updates: https://help.asana.com/s/article/project-progress-and-status-updates
- Linear, Project milestones: https://linear.app/docs/project-milestones
