stateDiagram-v2
    [*] --> LOCKED : Tạo mới trên đồ thị DAG

    LOCKED --> TODO : Engine mở khóa tự động\n(Tất cả Node cha DONE đối với AND-join\nhoặc 1 Node cha DONE đối với OR-join)
    note right of LOCKED
        Node bị khóa hoàn toàn.
        Thành viên không thể claim
        khi luồng cha chưa hoàn tất.
    end note

    TODO --> IN_PROGRESS : Collaborator / Owner bấm Claim việc\n(Gán assigned_user_id, tăng version lock)
    IN_PROGRESS --> TODO : Hủy nhận việc HOẶC Người làm bị kick khỏi dự án\n(Xóa assigned_user_id, giải phóng Task)

    IN_PROGRESS --> IN_PROGRESS : Scheduled Job quét thấy quá hạn\n(Bật cờ is_overdue = true, đổi cảnh báo đỏ)
    note right of IN_PROGRESS
        Owner có thể gia hạn due_date
        hoặc điều phối phân công lại
        người làm khác tại bước này.
    end note

    IN_PROGRESS --> REVIEW : Thành viên nộp kết quả công việc\n(Bắt buộc đính kèm link / file Artifact)
    REVIEW --> IN_PROGRESS : Owner từ chối nghiệm thu\n(Bắt buộc nhập lý do yêu cầu sửa lại)
    note right of REVIEW
        Chặn thành viên tự hoàn thành.
        Chỉ tài khoản giữ vai trò OWNER
        mới có quyền Approve sang DONE.
    end note

    REVIEW --> DONE : Owner duyệt đạt chất lượng\n(Ghi log hoàn thành, đóng băng Node)

    DONE --> [*] : Kích hoạt Engine kiểm tra điều kiện\nđể mở khóa các Node con tiếp theo