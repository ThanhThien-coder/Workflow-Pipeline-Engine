+ bảng project, nên xem lại thuộc tính updated_at hợp lý chưa, nếu lưu thì lưu lần update gần nhất hả, có lý do gì đặc biệt mà phải lưu khum, xem lại
+ bảng Project, nghĩ là nên có thuộc tính completed_at, xem lại thử có nên bổ sung không
+ bảng Notification, mục đích bảng này để làm gì vậy, yêu cầu làm rõ nha( LƯU Ý: Hiện tại các feedback sẽ hiện ra chung cho toàn project ở phần Overview, ai cũng sẽ có thể thấy, t nghĩ là bảng nayf đang nhầm lẫn nghiệp vụ là mỗi người sẽ được nhận Feedback riêng, xem lại )
+ bảng Project_invitation, tại sao có Token, Token ở đây là gì chưa hiểu
+ bảng Work_Phase, bảng này cần xem lại và tinh chỉnh nhiều cái, 1 là đề xuất bỏ thuộc tính code( phần code hiển thị 1,2a,2b,3,... sẽ do FrontEnd code tự động phân theo thứ tự, do các node phase có thể thêm xóa thoải mái, việc lưu cứng 2a, 2b, 2c không hợp lý. Ví dụ người dùng tạo 2a,2b,2c, xong xóa 2b, thì trên giao diện hiển thị 2a,2c thì không hay). 2 làm rõ các thuộc tính từ Subtitle -> Gate info, các thuộc tính này tác dụng là gì, lưu trữ để làm gì ( LƯU Ý: thuộc tính Gate info có vẻ là sai nghiệp vụ ở đây, tài liệu hiện tại lưu sẽ có kho chung cho toàn project chứ không gắn chặt ở từng phase nữa, nhất là ở đây có cả PR link github, xem lại)
+ bảng Guest_link có thuộc tính token, làm rõ
+ bảng Project_AI_Analyst, xem kỹ lại
+ bảng Node, phase ID
+Trường phase_id để nullable: Cho phép những Task độc lập, việc đột xuất hoặc việc xuyên suốt dự án (như "Họp nhóm hàng tuần", "Viết báo cáo") nằm tự do bên ngoài đồ thị mà không bắt buộc phải nhét vào một Phase cụ thể. 
+ nên làm thêm node phase riêng k có cha con 
+ có vấn đề k biết có nên làm task ở ngoài giao diện workflow k sợ rối mắt và cả yếu tố kĩ thuật
+ bảng Node, currunt_round, ui_metadata, version để làm gì xem lại
+ bảng guest_acceess_log, ip_address xem thử có khả thi oke không, session_id là gì làm rõ
+ bảng artifact, round_no và version để làm gì
+ bảng Node_Feedbakc, hiện tại Feedback đã không feedback theo node nữa mà của chung toàn project, nên thay bảng Project_Feedback để lưu cac feedback của Guest Link
+ Có nên bỏ hẳn quan hệ cha - con (dependencies / edges) giữa các Node để các task hoàn toàn riêng lẻ không? Liệu điều này có làm mất đi tính cá biệt của hệ thống (DAG Pipeline Engine) không, và thực chất quan hệ cha con có tác dụng cốt lõi gì ngoài việc chỉ để lock/unlock?
