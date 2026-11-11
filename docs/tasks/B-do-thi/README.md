# Thư mục của B — Thiết kế quy trình DAG

> ⚡ **Chế độ sprint 2 ngày** ([../SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md)): T0, T1 rút gọn → B1 → B3 → B4 (ngày 1); B7 → B8 → B2 nếu còn giờ, class miền/ERD (ngày 2). Bảng dưới là thứ tự đầy đủ, dùng khi làm theo chế độ thường.

Người review của B: **C**. B review cho: **A**. Kế hoạch chung: [../README.md](../README.md).

Làm theo thứ tự (T0, T1 nằm ở [../chung/](../chung/README.md)):

| Thứ tự | Task | Cần có trước | Ghi chú |
| :--- | :--- | :--- | :--- |
| 1 | [B1 — Kahn backend dùng chung](B1-kahn-backend.md) | T0 | **Ưu tiên số 1**: D3, D6 đang chờ |
| 2 | [B2 — API đồ thị và giai đoạn](B2-api-do-thi-giai-doan.md) | B1 | Migration V9 (chỉ thêm `work_phase.ui_metadata`) |
| 3 | [B7 — OOAD phân tích](B7-ooad-phan-tich.md) | T1 | |
| 4 | [B3 — API node, phụ thuộc, tọa độ](B3-api-node-phu-thuoc.md) | B1 | |
| 5 | [B4 — Xuất bản dự án](B4-xuat-ban-du-an.md) | B3 | |
| 6 | [B5 — Canvas gọi API thật](B5-canvas-goi-api-that.md) | A2, B3 | |
| 7 | [B6 — Xuất bản trên giao diện](B6-xuat-ban-giao-dien.md) | B4, B5 | |
| 8 | [B8 — OOAD thiết kế](B8-ooad-thiet-ke.md) | B7, B4 | |
| cuối kỳ | [X1](../chung/X1-bat-bao-mat-that.md) (rà controller mảng B), [X2](../chung/X2-kiem-thu-cheo.md) (chạy kịch bản của D), [X3](../chung/X3-rap-bo-so-do-ooad.md) (class miền, ERD, object), [X4](../chung/X4-bao-ve-va-luyen-ve.md) (trình bày mảng A) | | |
