# Sprint 2 ngày — làm xong trước, học kỹ lại sau

> Dùng file này khi cần **xong trong 1–2 ngày** (hạn nộp 15/11/2026). Bộ task đầy đủ vẫn giữ nguyên. Sprint chỉ chọn ra những task quan trọng nhất và nới quy tắc để làm nhanh. Sau khi nộp thì quay lại giai đoạn **Học lại** (cuối file).

## 1. Quy tắc của sprint (khác chế độ thường)
| Chế độ thường | Chế độ sprint |
| :--- | :--- |
| Bước 0 tự đọc, tự trả lời trước khi code | **Bỏ qua**, để dành cho giai đoạn Học lại |
| Bước 🧠 phải tự làm | **Claude được làm luôn**, nhưng phải giải thích ngắn gọn từng phần |
| Người review hỏi 3 câu bảo vệ | **Dời sang giai đoạn Học lại**. Review sprint chỉ kiểm 3 điều (mục 4) |
| Ghi chép đầy đủ | Chỉ điền **Nhật ký sprint** ở cuối file task (4 dòng, xem mục 3) |

**Giữ nguyên, không được bỏ:**
- Chỉ sửa file trong mục "Được ghi" của task → không đụng nhau.
- Không đọc, in, commit `.env*`, khóa, mật khẩu.
- Test phải chạy và dán **kết quả thật**.
- Số migration theo README mục 6.2 (A5 = V7, D2 = V8, B2 = V9).

## 2. Lệnh dán cho Claude ở chế độ sprint
Mở Claude Code trong repo rồi dán (thay đường dẫn task):

```text
Làm task docs/tasks/<thư mục>/<file>.md ở CHẾ ĐỘ SPRINT theo docs/tasks/SPRINT_2_NGAY.md.
- Bỏ qua Bước 0 và quy tắc 🧠: bạn làm hết các bước, kể cả bước 🧠.
- Chỉ sửa file trong mục "Được ghi". Gặp file ngoài danh sách thì dừng lại hỏi tôi.
- Làm từng phần nhỏ. Sau mỗi phần, giải thích cho tôi 2–3 câu: sửa file nào, để làm gì.
- Chạy test và cho tôi xem kết quả thật. Test lỗi thì nói rõ, không giấu.
- Cuối cùng: hỏi tôi đúng 1 câu để kiểm tra tôi đã nắm việc vừa làm, rồi giúp tôi điền mục
  "Nhật ký sprint" trong file task (tôi tự viết câu "Vì sao", bạn chỉ sửa cho đúng).
- Đổi trạng thái task thành "chờ kiểm". Không tự ghi "xong".
```

## 3. Nhật ký sprint (bắt buộc, khoảng 5 phút mỗi task)
Ở cuối mỗi file task có sẵn mục này. Điền **bằng lời của bạn**, để vẫn nắm mình đã làm gì:
- **Làm gì:** 1 câu.
- **File chính đã sửa:** 2–5 file.
- **Vì sao làm vậy:** 1–2 câu. Tự viết, không chép của Claude.
- **Cần học lại:** những chỗ còn chưa hiểu, ghi thật lòng.

Dòng `Đã học lại: chưa` sẽ được đổi thành `rồi` ở giai đoạn Học lại.

## 4. Review sprint (người review cố định, mỗi PR khoảng 10 phút)
1. CI hoặc test chạy xanh (xem output dán trong PR).
2. `git diff --stat` chỉ có file nằm trong mục "Được ghi".
3. Nhật ký sprint đã điền, và câu "Vì sao" do người làm tự viết.

Đạt thì đổi `Trạng thái: xong` rồi merge. Phần hỏi bảo vệ để dành giai đoạn Học lại.

## 5. Kế hoạch 2 ngày theo người
Mỗi người khoảng 7–8 giờ làm mỗi ngày, Claude làm phần lớn code.

### Ngày 1
| Giờ | A | B | C | D |
| :--- | :--- | :--- | :--- | :--- |
| Sáng sớm (1,5 giờ) | T0 rút gọn: bước 2–5 (chạy được hệ thống). T1 rút gọn: đọc cẩm nang OOAD mục 3 (30 phút) | T0, T1 rút gọn | T0, T1 rút gọn | T0, T1 rút gọn |
| Sáng | **A1** (mvnw và CI) → **A2** (bỏ fallback ngầm và apiClient; **chưa** cần tách file) | **B1** (KahnDagService) → **B3** (vá 4 lỗ hổng) | **C1** (gửi sự kiện sau commit, ARCHIVED, test) | **D1** (IDOR clone, DRAFT; phần backend) |
| Chiều | **A3** (đăng nhập, JWT) | **B4** (vá xuất bản) | **C2** (SSE nhiều tab, sự kiện lời mời) | **D3** (phân quyền template) → **D2** (thành viên, lời mời, V8) |
| Tối | merge A1, A2 | merge B1, B3 | merge C1 | merge D1, D3 |

### Ngày 2
| Giờ | A | B | C | D |
| :--- | :--- | :--- | :--- | :--- |
| Sáng | **A4** (đăng nhập trên giao diện) | **B7** → **B8** (OOAD) | **C4** (artifact: chỉ phần backend) → **C7** | **D2** (nếu chưa xong) → **D7** |
| Chiều | **A7** → **A8** (OOAD) | **B2** (lưu vị trí phase, V9) nếu còn giờ; X3: class miền, ERD | **C8** (OOAD); X3: component | **D8** (OOAD); X3: use case tổng quát |
| Cuối chiều | X3: deployment, package | | | |
| Tối (cả nhóm, 2 giờ) | **Chạy thử toàn hệ thống** (mục 6) → **X3** ráp sơ đồ → **X4 rút gọn**: mỗi người tập trình bày mảng mình 5 phút | | | |

**T0, T1 rút gọn:** làm xong phần rút gọn thì ghi `Trạng thái: xong` trong `ghi-chep/T0-<chữ>.md`, `ghi-chep/T1-<chữ>.md`, để tool mở khóa các task sau. Phần còn lại của T0, T1 làm ở giai đoạn Học lại.

**X4 trong sprint** chỉ là bản rút gọn (tập trình bày mảng mình), không cần chờ X2. Trạng thái X4 vẫn để `chưa làm`; X4 đầy đủ làm sau.

**Để lại sau hạn nộp:** A5, A6, B5, B6, C3, C5, C6, D4, D5, D6, X1, X2; bài luyện chung của T1; phần tách file `HttpWorkflowService` của A2; phần frontend của C4 và D1.

**Vì sao không bị chờ nhau:** ngày 1 mỗi người chỉ sửa backend của mảng mình. A2 là người duy nhất sửa `HttpWorkflowService.ts` trong sprint, vì các task frontend khác đã dời lại sau. Các task OOAD chỉ thêm file mới trong `docs/ooad/<mảng>/`.

## 6. Chạy thử toàn hệ thống trước khi nộp (tối ngày 2)
Một người thao tác, cả nhóm xem. Ghi kết quả vào `docs/tasks/ghi-chep/sprint-chay-thu.md`:
1. `docker compose down -v && docker compose up -d` (**xóa dữ liệu local**), chạy backend, chạy frontend ở chế độ API thật.
2. Đăng nhập alex.kim trên giao diện (A3, A4).
3. Vào dự án mẫu, xem đồ thị. Thử nối tạo vòng → phải báo lỗi (B3).
4. Đóng vai sarah: bắt đầu làm, nộp bài WPE-003. Alex duyệt → WPE-004 tự mở khóa (C1, C2).
5. Tạo dự án mới từ template → trạng thái DRAFT → xuất bản → ACTIVE (D1, B4).
6. Dùng user thường thử tạo template → bị từ chối (D3).
7. Chạy toàn bộ test: `./mvnw test` và `npm test`.
Bước nào hỏng thì sửa ngay hoặc ghi rõ vào báo cáo. Không giấu.

## 7. Giai đoạn Học lại (sau khi nộp)
Với **mỗi task đã làm trong sprint**, người làm:
1. Mở file task, làm **Bước 0** (tự đọc, tự trả lời).
2. Đọc lại diff của PR. Mỗi file đã sửa, tự giải thích bằng lời được thì mới qua.
3. Hẹn người review hỏi **3 câu bảo vệ**. Trả lời được thì đổi `Đã học lại: rồi` trong nhật ký sprint.
4. Thấy chỗ nào làm chưa hợp lý thì ghi vào "Điều chưa chắc" và mở task sửa tiếp.

Sau đó làm tiếp các task đã để lại, **theo chế độ thường** (có Bước 0, có bước 🧠).

`node docs/tasks/tien-do.mjs` có dòng **"Xong nhưng chưa học lại"** cho từng người, để không bỏ sót.
