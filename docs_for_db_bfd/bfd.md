graph TD
    ROOT["HỆ THỐNG<br/>QUẢN LÝ<br/>WORKFLOW"]

    %% Level 1
    ROOT --> M1["1. Phân hệ Xác<br/>thực & Tài khoản"]
    ROOT --> M2["2. Phân hệ Dự án<br/>& Thiết kế Quy<br/>trình (Nodes)"]
    ROOT --> M3["3. Phân hệ<br/>Engine Điều phối<br/>& Thực thi Node"]
    ROOT --> M4["4. Phân hệ Cộng<br/>tác & Giám sát<br/>Thời gian"]
    ROOT --> M5["5. Phân hệ Quản<br/>trị Hệ thống<br/>(Admin Portal)"]

    %% Level 2 - Phân hệ 1
    M1 --> M1_1["1.1 Đăng ký tài<br/>khoản mới"]
    M1 --> M1_2["1.2 Đăng nhập &<br/>Cấp phát JWT"]
    M1 --> M1_3["1.3 Quản lý hồ<br/>sơ cá nhân"]

    %% Level 2 - Phân hệ 2
    M2 --> M2_1["2.1 Khởi tạo dự<br/>án & Chọn<br/>Template"]
    M2 --> M2_2["2.2 Mời thành<br/>viên & Phân<br/>quyền vào d/a"]
    M2 --> M2_3["2.3 Điều chỉnh<br/>Flow / Thiết kế<br/>quy trình tĩnh"]
    M2 --> M2_4["2.4 Trực quan<br/>hóa Node & Edge<br/>(React Flow)"]
    M2 --> M2_5["2.5 Kiểm tra chu<br/>trình lặp (Thuật<br/>toán Kahn)"]

    %% Level 2 - Phân hệ 3
    M3 --> M3_1["3.1 Engine tự mở<br/>khóa Node (DAG<br/>/ Qfs Java)"]
    M3 --> M3_2["3.2 Nhận việc<br/>(State Scale /<br/>Optimistic<br/>Locking)"]
    M3 --> M3_3["3.3 Bàn giao kết<br/>quả Upload<br/>Artifact"]
    M3 --> M3_4["3.4 Đánh giá &<br/>Duyệt kết quả<br/>(Approve / Reject)"]
    M3 --> M3_5["3.5 Cảnh báo<br/>Deadline & Điều<br/>phối nhân lực"]
    M3 --> M3_6["3.6 Thống kê tiến<br/>độ & Task Metrics"]

    %% Level 2 - Phân hệ 4
    M4 --> M4_1["4.1 Quản lý<br/>Dead/Taken &<br/>Thời hạn trễ"]
    M4 --> M4_2["4.2 Xem trực<br/>quan đồ thị &<br/>Kanban (Read-<br/>only)"]
    M4 --> M4_3["4.3 Giao<br/>feedback &<br/>Phản hồi quy<br/>trình ( chat )"]
    M4 --> M4_4["4.4 Xuất/Nhận<br/>thông báo liên<br/>tục (Socket)"]

    %% Level 2 - Phân hệ 5
    M5 --> M5_1["5.1 Quản lý User<br/>& Khóa/Mở tài<br/>khoản"]
    M5 --> M5_2["5.2 CRUD Kho<br/>mẫu quy trình<br/>chuẩn"]
    M5 --> M5_3["5.3 Giám sát hạ<br/>tầng & Dọn dẹp<br/>dữ liệu rác"]

    %% Styling (Đồng bộ màu sắc theo hình)
    classDef rootStyle fill:#0b132b,stroke:#0b132b,stroke-width:2px,color:#fff,font-weight:bold;
    classDef subRootStyle fill:#1d4ed8,stroke:#1d4ed8,stroke-width:2px,color:#fff,font-weight:bold;
    classDef leafStyle fill:#ffffff,stroke:#94a3b8,stroke-width:1px,color:#000;

    class ROOT rootStyle;
    class M1,M2,M3,M4,M5 subRootStyle;
    class M1_1,M1_2,M1_3,M2_1,M2_2,M2_3,M2_4,M2_5,M3_1,M3_2,M3_3,M3_4,M3_5,M3_6,M4_1,M4_2,M4_3,M4_4,M5_1,M5_2,M5_3 leafStyle;