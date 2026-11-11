# Thư mục ghi chép

Mỗi người chỉ sửa file của mình, nên không bao giờ bị đụng nhau khi merge.

| File | Ai tạo | Dùng cho |
| :--- | :--- | :--- |
| `T0-A.md`, `T0-B.md`, `T0-C.md`, `T0-D.md` | từng người | Ghi chép task T0 (mẫu ở cuối `../chung/T0-khoi-dong.md`) |
| `T1-A.md` … `T1-D.md` | từng người | Ghi chép task T1 (mẫu ở cuối `../chung/T1-hoc-ky-hieu-uml.md`) |
| `T1-hop-so-bai.md` | A | Biên bản buổi so bài T1 |
| `X4-bien-ban.md` | người ghi biên bản X4 | Biên bản thuyết trình, điểm luyện vẽ, vấn đáp |

Dòng đầu mỗi file `T0-*` và `T1-*` phải có `Trạng thái: …` để `node docs/tasks/tien-do.mjs` đọc được tiến độ.
