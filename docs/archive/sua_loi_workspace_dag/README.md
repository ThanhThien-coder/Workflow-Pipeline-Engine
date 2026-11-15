# Sửa lỗi Workspace DAG

Thư mục này dùng cho đợt sửa lỗi khi test tay với backend thật (`VITE_USE_MOCK=false`). Gặp lỗi thì ghi lại trước (tái hiện, nguyên nhân đã kiểm, hướng sửa); chỉ sửa code khi được bảo. Không theo bộ task `docs/fix_loi_moi`.

Danh sách lỗi và tiến độ: [loi-dang-sua.md](loi-dang-sua.md).

## Quy tắc khi sửa

1. **Xem cả FE và BE trước khi sửa.** Lần theo lỗi từ giao diện qua service FE (`wpe-frontend/src/services/impl/http/`), tới controller, service và repository ở BE. Ghi rõ lỗi nằm ở bên nào, không đoán.
2. **Sửa cả hai bên khi lỗi dính cả hai.** Không vá một bên để che lỗi của bên kia (ví dụ không để FE tự bù dữ liệu sai từ BE, không để BE nới kiểm tra vì FE gửi sai).
3. **Lỗi dính DB thì thêm migration Flyway mới** trong `wpe-backend/src/main/resources/db/migration/`, lấy số kế tiếp (đang tới V14). Không sửa migration đã chạy.
4. **Giữ hợp đồng FE–BE khớp nhau.** Đổi DTO, mã lỗi hay endpoint ở BE thì cập nhật kiểu và hàm gọi ở FE cùng lúc, và cập nhật tài liệu hợp đồng nếu có.
5. **Sửa chuẩn, sạch:**
   - Sửa đúng nguyên nhân gốc, không thêm cờ hay nhánh `if` để né.
   - Không để lại code chết, `console.log`, code comment-out hay dữ liệu mock thay cho API thật.
   - Theo đúng cấu trúc và cách đặt tên đang có trong dự án.
   - Mỗi lỗi một commit nhỏ, message rõ ràng.
6. **Kiểm tra trước khi đánh dấu xong:**
   - BE: `./mvnw test` (hoặc test của phần vừa sửa) chạy qua.
   - FE: `npm run typecheck` và `npm test` chạy qua.
   - Test tay lại đúng các bước tái hiện, thấy hết lỗi.
7. **Ghi lại vào [loi-dang-sua.md](loi-dang-sua.md)**: tái hiện, nguyên nhân, cách sửa từng bên (FE/BE/DB), file đã sửa, kết quả kiểm tra; rồi cập nhật trạng thái trong bảng.
