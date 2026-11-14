# Task sửa lỗi Workspace DAG

Các task sửa lỗi G3–G11 trong [../loi-dang-sua.md](../loi-dang-sua.md). Quy tắc sửa chung: [../README.md](../README.md) (xem cả FE và BE, sửa cả hai bên nếu dính, dính DB thì thêm migration, sửa sạch, mỗi lỗi một commit nhỏ).

> Viết tắt: `FE/` = `wpe-frontend/src/`, `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`.

| Task | Lỗi | Nội dung | Cần có trước | Trạng thái |
|---|---|---|---|---|
| [T1](T1-thanh-vien-va-du-an-that.md) | G5, G9 | Thành viên và thông tin dự án lấy từ API thật | không | Xong, chờ test tay |
| [T2](T2-artifact-du-lieu-that-va-giao-dien.md) | G4, G6 | Artifact dữ liệu thật + drawer tông sáng | không | Xong, chờ test tay |
| [T3](T3-ghi-do-thi-qua-api.md) | G7, G8, G11 | Mọi thao tác sửa cây task đi qua API; khóa ô khi chỉ xem | không | Xong, chờ test tay |
| [T4](T4-kanban-phase.md) | G10 | Kanban phase hiện đúng người làm, cột riêng "Đang khóa" | T1, T3 | Xong, chờ test tay |
| [T5](T5-day-noi-phase.md) | G3 | Phase xếp theo cột DAG, dây vuông góc trong khe, mũi tên, nổi khi chọn | không | Xong, chờ test tay |
| [T6](T6-chi-tiet-task-va-mo-khoa-som.md) | G8, G12 | Hộp "Chi tiết task" (nhãn trạng thái, nút hành động theo vai trò), chủ dự án mở khóa sớm có cảnh báo; FE + BE + DB (V15) | T1, T3 | Chờ làm |

Thứ tự gợi ý: T1 → T3 → T4 / T6, song song T2 và T5.

## Kiểm tra chung cho mọi task
- FE: `cd wpe-frontend && npm run typecheck && npx vitest run` → 0 lỗi, mọi test qua.
- BE (chỉ khi đụng BE): `cd wpe-backend && ./mvnw test` → BUILD SUCCESS.
- Chạy app với `VITE_USE_MOCK=false`, làm lại đúng các bước tái hiện của lỗi trong `loi-dang-sua.md`, không còn thấy lỗi.
- Không còn dữ liệu giả ở chế độ API: `grep` các tên giả (`Alex Kim`, `Marketing Campaign Q4`, `DEV_PERSONAS`, `INITIAL_PROJECT_ARTIFACTS`…) chỉ còn trong mock/dev/test.
- Cập nhật trạng thái lỗi trong `loi-dang-sua.md` và bảng trên.
