# Sprint 2 ngày — Claude làm code, người làm hiểu ngay trước khi merge

> Dùng file này khi cần **xong trong 1–2 ngày** (hạn nộp 15/11/2026). Bộ task đầy đủ vẫn giữ nguyên. Sprint chỉ chọn ra những task quan trọng nhất và nới quy tắc để làm nhanh.
>
> **Khác bản sprint trước:** phần học không dời hết ra sau hạn nộp nữa. Mỗi task có một **vòng hiểu** 15–20 phút ngay trước khi merge (mục 3). Lý do: dời hết phần học ra sau thì dễ lặp lại đúng lỗi "có code mà không hiểu code".

## 1. Quy tắc của sprint (khác chế độ thường)
| Chế độ thường | Chế độ sprint |
| :--- | :--- |
| Bước 0 tự đọc, tự trả lời trước khi code | **Bỏ qua** |
| Bước 🧠 phải tự làm | **Claude làm luôn**, không dừng giữa chừng để giải thích |
| Mục "Dành cho Claude" trong file task | **Bỏ qua**, làm theo câu lệnh ở mục 2 |
| Bước kiểm bằng Swagger, SQL | **Claude tự chạy** bằng dòng lệnh, ghi kết quả thật vào file task |
| Bước kiểm cần trình duyệt (giao diện, 2 tab) | **Dời về buổi kiểm chung** (mục 7) |
| Người review hỏi 3 câu bảo vệ | Người làm trả lời **1 câu** với Claude trong vòng hiểu. Người review không hỏi |
| Ghi chép đầy đủ, nhật ký sprint | **Không bắt buộc.** Chỉ cần mục "Kết quả test" do Claude ghi |

**Giữ nguyên, không được bỏ:**
- Chỉ sửa file trong mục "Được ghi" của task → 4 người chạy song song không đụng nhau.
- Viết test tái hiện lỗi và chạy thấy **fail trước**, rồi mới sửa. Test không fail nghĩa là lỗi không có thật.
- Test phải chạy và dán **kết quả thật**.
- Không đọc, in, commit `.env*`, khóa, mật khẩu.
- Số migration theo README mục 6.2 (A5 = V7, D2 = V8, B2 = V9).
- "Đặc tả đã chốt" trong task là quyết định của nhóm, không tự đổi.

## 2. Lệnh dán cho Claude ở chế độ sprint
Mở Claude Code trong repo rồi dán (thay đường dẫn task):

```text
Làm task docs/tasks/<thư mục>/<file>.md ở CHẾ ĐỘ SPRINT theo docs/tasks/SPRINT_2_NGAY.md.

Phần bạn tự làm, không cần hỏi tôi giữa chừng:
- Bỏ qua Bước 0, quy tắc 🧠 và mục "Dành cho Claude" trong file task: bạn làm hết các bước.
- Với mỗi lỗi trong task: viết test tái hiện, chạy cho thấy fail, rồi mới sửa cho pass.
- Chỉ sửa file trong mục "Được ghi". Làm đúng "Đặc tả đã chốt".
- Chạy toàn bộ test. Các bước kiểm bằng Swagger, SQL thì bạn tự chạy bằng dòng lệnh.
- Ghi kết quả thật vào mục "Kết quả test" của file task. Test lỗi thì nói rõ, không giấu.
- Bước nào cần trình duyệt thì không làm, liệt kê lại ở cuối để tôi đưa vào buổi kiểm chung.

Chỉ dừng lại hỏi tôi khi:
- cần sửa file ngoài mục "Được ghi";
- test tái hiện không fail (lỗi trong task không có thật);
- không bật được Docker hoặc backend để chạy bước Swagger, SQL.

Khi code xong, làm VÒNG HIỂU với tôi (mục 3 của SPRINT_2_NGAY.md):
1. Giải thích từng thay đổi 2–3 câu: sửa gì, vì sao, không sửa thì hỏng ở đâu.
2. Hỏi tôi 1 câu trong mục "Câu hỏi bảo vệ" của task, chấm câu trả lời của tôi: đúng, thiếu hay sai.
   Thiếu hoặc sai thì giải thích rồi hỏi lại.

Cuối cùng đổi trạng thái task thành "chờ kiểm". Không tự ghi "xong". Chỉ commit, push, mở PR khi tôi bảo.
```

Chưa có `./mvnw` (A1 chưa merge) thì chạy test backend bằng `mvn test` nếu máy đã cài Maven.

## 3. Vòng hiểu (bắt buộc, 15–20 phút mỗi task, làm trước khi mở PR)
Mục đích: người làm nói lại được task vừa xong bằng lời của mình.

1. **Nghe giải thích.** Claude đi qua từng thay đổi: sửa gì, vì sao, không sửa thì hỏng ở đâu. Chỗ nào chưa hiểu thì hỏi lại ngay.
2. **Trả lời 1 câu bảo vệ.** Claude chọn 1 câu trong mục "Câu hỏi bảo vệ" của task. Người làm trả lời không nhìn code. Sai hoặc thiếu thì nghe giải thích rồi trả lời lại.

Vòng hiểu diễn ra ngay trong phiên làm việc với Claude: không cần ghi lại, không cần hẹn ai. Không ai kiểm hộ, nên làm nghiêm túc hay không là do mỗi người.

**Task OOAD (số 7, 8):** Claude vẽ sơ đồ từ code thật. Vòng hiểu là người làm chọn 1 sơ đồ sequence và giải thích lại từng message ứng với hàm nào trong code.

## 4. Nhật ký sprint: không bắt buộc
Mục "Nhật ký sprint" ở cuối mỗi file task **không cần điền**. Ai muốn ghi lại chỗ mình chưa hiểu để học sau thì ghi vào dòng "Cần học lại". Dòng `Đã học lại: chưa` giữ nguyên, đổi thành `rồi` ở giai đoạn Học lại (mục 8).

## 5. Review sprint (người review cố định, mỗi PR vài phút)
1. CI hoặc test chạy xanh (xem output dán trong PR hoặc trong mục "Kết quả test" của file task).
2. `git diff --stat` chỉ có file nằm trong mục "Được ghi".

Đạt thì đổi `Trạng thái: xong` rồi merge. Người review không hỏi câu bảo vệ trong sprint.

**Thứ tự merge:** A1 trước tiên (cả nhóm cần `mvnw` để chạy test). B1 sớm (D3 đang chờ). C1 trước B4 (B4 dùng cách gửi sự kiện sau commit của C1).

## 6. Kế hoạch 2 ngày theo người
Mỗi người khoảng 7–8 giờ làm mỗi ngày, Claude làm phần lớn code.

### Ngày 1
| Giờ | A | B | C | D |
| :--- | :--- | :--- | :--- | :--- |
| Sáng sớm (1 giờ) | T0, T1 rút gọn | T0, T1 rút gọn | T0, T1 rút gọn | T0, T1 rút gọn |
| Sáng | **A1** (mvnw và CI) → **A2** (bỏ fallback ngầm và apiClient; **chưa** cần tách file) | **B1** (KahnDagService) → **B3** (vá 4 lỗ hổng) | **C1** (gửi sự kiện sau commit, ARCHIVED, test) | **D1** (IDOR clone, DRAFT; phần backend) |
| Chiều | **A3** (đăng nhập, JWT) | **B4** (vá xuất bản) | **C2** (SSE nhiều tab, sự kiện lời mời) | **D3** (phân quyền template) → **D2** (thành viên, lời mời, V8) |
| Tối | merge A1, A2 | merge B1, B3 | merge C1 | merge D1, D3 |
| Tối (cả nhóm, 30 phút) | **Kiểm ngắn** (mục 7.1) | | | |

### Ngày 2
| Giờ | A | B | C | D |
| :--- | :--- | :--- | :--- | :--- |
| Sáng | **A4** (đăng nhập trên giao diện) | **B7** → **B8** (OOAD) | **C4** (artifact: chỉ phần backend) → **C7** | **D2** (nếu chưa xong) → **D7** |
| Chiều | **A7** → **A8** (OOAD) | **B2** (lưu vị trí phase, V9) nếu còn giờ; X3: class miền, ERD | **C8** (OOAD); X3: component | **D8** (OOAD); X3: use case tổng quát |
| Cuối chiều | X3: deployment, package | | | |
| Tối (cả nhóm, 2 giờ) | **Kiểm đầy đủ** (mục 7.2) → **X3** ráp sơ đồ → **X4 rút gọn**: mỗi người tập trình bày mảng mình 5 phút | | | |

**T0 rút gọn:** chỉ cần máy mình chạy được Docker, backend và frontend (bước 2–5 của T0). Nhờ Claude chạy lệnh giúp được. Không làm 11 chặng và 10 câu hỏi.

**T1 rút gọn:** tự đọc `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3 (30 phút). Không vẽ 6 sơ đồ luyện, không họp so bài.

Làm xong phần rút gọn thì ghi `Trạng thái: xong` trong `ghi-chep/T0-<chữ>.md`, `ghi-chep/T1-<chữ>.md`, để tool mở khóa các task sau.

**X4 trong sprint** chỉ là bản rút gọn (tập trình bày mảng mình), không cần chờ X2. Trạng thái X4 vẫn để `chưa làm`; X4 đầy đủ làm sau.

**Để lại sau hạn nộp:** A5, A6, B5, B6, C3, C5, C6, D4, D5, D6, X1, X2; phần còn lại của T0, T1; phần tách file `HttpWorkflowService` của A2; phần frontend của C4 và D1.

**Vì sao không bị chờ nhau:** ngày 1 mỗi người chỉ sửa backend của mảng mình. A2 là người duy nhất sửa `HttpWorkflowService.ts` trong sprint, vì các task frontend khác đã dời lại sau. Các task OOAD chỉ thêm file mới trong `docs/ooad/<mảng>/`.

## 7. Buổi kiểm chung (gom mọi bước cần trình duyệt)
Một người thao tác, cả nhóm xem. Ghi kết quả vào `docs/tasks/ghi-chep/sprint-chay-thu.md`. Bước nào hỏng thì người của mảng đó sửa ngay hoặc ghi rõ vào báo cáo. Không giấu.

Chuẩn bị cho cả hai buổi: pull main mới nhất, `docker compose down -v && docker compose up -d` (**xóa dữ liệu local**), chạy backend.

### 7.1. Kiểm ngắn, tối ngày 1 (30 phút, phần backend đã merge)
1. Chạy toàn bộ test backend trên main sau khi merge: phải pass.
2. Kịch bản Swagger của T0 (sarah bắt đầu làm, nộp WPE-003; alex duyệt) → WPE-004 tự mở khóa (C1).
3. Nối WPE-004 → WPE-001 → phải trả 422 (B1, B3).
4. Dùng user thường tạo template → bị từ chối (D3).

### 7.2. Kiểm đầy đủ, tối ngày 2 (trước khi nộp)
Chạy thêm frontend ở chế độ API thật.

| # | Thao tác | Kết quả phải thấy | Task |
| :--- | :--- | :--- | :--- |
| 1 | Tắt backend, mở giao diện | Màn hình báo lỗi, không hiện dữ liệu giả | A2 |
| 2 | Đăng nhập alex.kim | Vào Workspace thấy "Core Banking Pipeline" lấy từ backend | A3, A4 |
| 3 | Chờ token hết hạn rồi thao tác tiếp (tạm đặt hạn 60 giây trên máy, không commit) | App tự làm mới token, tab Network chỉ có 1 request `/auth/refresh` | A4 |
| 4 | Đăng xuất rồi F5; đăng nhập sarah.chen | Không còn đăng nhập; sarah không thấy dữ liệu cũ của alex | A4 |
| 5 | Vào dự án mẫu, xem đồ thị, thử nối tạo vòng | Báo lỗi chu trình | B3 |
| 6 | Mở 2 tab cùng user sarah; tab thứ 3 alex duyệt task của sarah | Cả 2 tab của sarah nhận sự kiện; WPE-004 tự mở khóa | C1, C2 |
| 7 | Tạo dự án mới từ template | Trạng thái DRAFT | D1 |
| 8 | Mở 2 tab (owner và người phụ trách node gốc); owner xuất bản dự án ở bước 7 | Dự án thành ACTIVE; người phụ trách nhận `TASK_UNLOCKED` ngay | B4 |
| 9 | Dùng user thường thử tạo template | Bị từ chối | D3 |
| 10 | Chạy toàn bộ test: `./mvnw test` và `npm test` | Pass | tất cả |

Task nào trong sprint có thêm bước trình duyệt (Claude liệt kê ở cuối khi làm task) thì người làm bổ sung một dòng vào bảng này.

## 8. Giai đoạn Học lại (sau khi nộp)
Vòng hiểu đã làm phần chính, nên giai đoạn này ngắn. Với **mỗi task đã làm trong sprint**, người làm:
1. Đọc lại diff của PR. Mỗi file đã sửa, tự giải thích bằng lời được thì mới qua.
2. Hẹn người review hỏi **3 câu bảo vệ** của task. Trả lời được thì đổi `Đã học lại: rồi`.
3. Thấy chỗ nào làm chưa hợp lý thì ghi vào "Điều chưa chắc" và mở task sửa tiếp.

Sau đó làm phần còn lại của T0, T1 và các task đã để lại, **theo chế độ thường** (có Bước 0, có bước 🧠).

`node docs/tasks/tien-do.mjs` có dòng **"Xong nhưng chưa học lại"** cho từng người, để không bỏ sót.
