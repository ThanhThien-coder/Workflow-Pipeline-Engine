flowchart LR
    %% Actors
    subgraph ACTORS [" "]
        direction TB
        ADMIN["Quản trị viên<br/>(System Admin)"]
        GUEST["Giáo viên<br/>(Guest via Token)"]
        ANON["Người dùng<br/>vãng lai<br/>(Anonymous)"]
        VIEWER["Người xem<br/>(Project Viewer)"]
        COLLAB["Cộng sự thực thi<br/>(Collaborator)"]
        OWNER["Chủ dự án<br/>(Project Owner)"]
    end

    %% Quan hệ thừa kế giữa các Actor
    ANON -.->|"Đã đăng nhập"| VIEWER
    VIEWER -.->|"Kế thừa quyền đọc"| COLLAB
    COLLAB -.->|"Kế thừa toàn quyền"| OWNER

    %% System Boundary
    subgraph SYSTEM ["Ranh giới hệ thống Workflow Pipeline Engine"]
        direction TB
        UC1(["Quản lý User &<br/>Khóa tài khoản"])
        UC2(["CRUD Template<br/>quy trình chuẩn"])
        UC3(["Dọn dẹp / Lưu trữ<br/>dự án rác"])

        UC4(["Truy cập qua URL<br/>Token"])
        UC5(["Xem trực quan đồ<br/>thị (Read-only)"])
        UC6(["Giao Feedback /<br/>Báo lỗi trên Node"])
        UC7(["Xem AI chẩn đoán<br/>điểm nghẽn"])

        UC8(["Đăng ký tài khoản"])
        UC9(["Đăng nhập & Cấp<br/>JWT"])

        UC10(["Xem đồ thị tiến độ<br/>& Artifact"])
        UC11(["Xem Dashboard<br/>thống kê Metrics"])

        UC12(["Claim Task (Nhận<br/>việc)"])
        UC13(["Nộp kết quả<br/>(Upload Artifact)"])
        UC14(["Hủy nhận task<br/>(Trả về TODO)"])
        UC15(["Xem & Phản hồi<br/>giải trình Feedback"])

        UC16(["Khởi tạo dự án"])
        UC17(["Mời thành viên &<br/>Gán Role"])
        UC18(["Điều chỉnh quyền /<br/>Xóa thành viên"])
        UC19(["Thiết kế & Lưu tọa<br/>độ đồ thị DAG"])
        UC20(["Kiểm tra chu trình<br/>lặp (Kahn DAG)"])
        UC21(["Sinh & Thu hồi<br/>Guest Link Token"])
        UC22(["Duyệt bài / Yêu<br/>cầu làm lại Task"])
        UC23(["Gia hạn Deadline /<br/>Đổi người phụ<br/>trách"])
    end

    %% Kết nối System Admin
    ADMIN --- UC1
    ADMIN --- UC2
    ADMIN --- UC3

    %% Kết nối Guest via Token
    GUEST --- UC4
    GUEST --- UC5
    GUEST --- UC6
    GUEST --- UC7

    %% Kết nối Anonymous
    ANON --- UC8
    ANON --- UC9

    %% Kết nối Project Viewer
    VIEWER --- UC10
    VIEWER --- UC11

    %% Kết nối Collaborator
    COLLAB --- UC12
    COLLAB --- UC13
    COLLAB --- UC14
    COLLAB --- UC15

    %% Kết nối Project Owner
    OWNER --- UC16
    OWNER --- UC17
    OWNER --- UC18
    OWNER --- UC19
    OWNER --- UC20
    OWNER --- UC21
    OWNER --- UC22
    OWNER --- UC23

    %% Styling
    style SYSTEM fill:#fff5f7,stroke:#f43f5e,stroke-width:1.5px
    style ACTORS fill:none,stroke:none
    classDef actorStyle fill:#eef2ff,stroke:#6366f1,stroke-width:1.5px,color:#1e1b4b;
    classDef ucStyle fill:#ffffff,stroke:#64748b,stroke-width:1.2px,color:#0f172a;

    class ADMIN,GUEST,ANON,VIEWER,COLLAB,OWNER actorStyle;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14,UC15,UC16,UC17,UC18,UC19,UC20,UC21,UC22,UC23 ucStyle;