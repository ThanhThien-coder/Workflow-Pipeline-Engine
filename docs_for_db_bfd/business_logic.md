TÀI LIỆU ĐẶC TẢ KIẾN TRÚC VÀ YÊU CẦU HỆ THỐNG (SSOT)
DỰ ÁN: WORKFLOW PIPELINE ENGINE
(Tài liệu chuẩn hóa phục vụ nạp Context dự án Claude Code và sao chép vào Google Docs)
PHẦN 1: TỔNG QUAN HỆ THỐNG VÀ BỐI CẢNH KIẾN TRÚC
1.1 Mục tiêu và Tầm nhìn Nghiệp vụ
Hệ thống Workflow Pipeline Engine là nền tảng quản lý và điều phối dự án dựa trên mô hình đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph). Khác với các hệ thống quản lý tác vụ tuyến tính thông thường, hệ thống này tự động hóa việc mở khóa các công việc phụ thuộc thông qua một động cơ máy trạng thái (State Machine Engine), kiểm soát chặt chẽ quy trình nộp và nghiệm thu sản phẩm, đồng thời tích hợp trí tuệ nhân tạo để chẩn đoán điểm nghẽn tiến độ.
1.2 Cấu trúc 5 Phân hệ Nghiệp vụ (Bounded Contexts)
Hệ thống được tổ chức thành 5 phân hệ chức năng độc lập về mặt logic nghiệp vụ và giao diện người dùng dựa trên cấu trúc Navigation chuẩn gồm 4 mục chính (Overview, Workflow, My Tasks, Settings):
Phân hệ Xác thực & Quản lý Tài khoản (Auth Gateway): Quản lý đăng ký, đăng nhập, hồ sơ cá nhân, cấp phát JWT và điều phối Dynamic Topbar RBAC theo ngữ cảnh dự án.
Phân hệ Dự án & Thiết kế DAG (Project Workspace / Workflow): Khởi tạo dự án, thiết kế đồ thị kéo thả trên màn hình Workflow (trước đây là Canvas), quản lý thành viên và kiểm tra chu trình lặp.
Phân hệ Engine Điều phối & Thực thi Node (Execution Engine / My Tasks): Máy trạng thái điều phối mở khóa Node (AND/OR Join), quản lý bảng Kanban cá nhân hóa My Tasks (thay thế màn hình Tasks cũ, áp dụng Direct Push Model), nộp sản phẩm bàn giao (Artifacts) và nghiệm thu kết quả.
Phân hệ Cổng Đánh giá & AI Chẩn đoán (Overview & Review Portal): Cung cấp tổng quan dự án trên màn hình Overview, Public Audit & Share Gateway (Guest Link Token), tích hợp khối Feedback Queue 1 chiều (Feedback 1-way stream từ Giáo viên/Guest) và AI chẩn đoán rủi ro tiến độ.
Phân hệ Quản trị Nền tảng (Admin Portal): Quản lý tài khoản toàn hệ thống, dọn dẹp dự án không hoạt động và quản lý kho mẫu quy trình chuẩn.
PHẦN 2: CÂY PHÂN RÃ CHỨC NĂNG HỆ THỐNG (FUNCTIONAL DECOMPOSITION)
Hệ thống bao gồm 5 phân hệ lớn với 23 khối chức năng chi tiết:
Phân hệ 1: Phân hệ Xác thực & Tài khoản
1.1 Đăng ký tài khoản mới: Tạo tài khoản người dùng với các thông tin cơ bản.
1.2 Đăng nhập & Cấp phát JWT: Xác thực thông tin đăng nhập và sinh chuỗi mã thông báo JWT an toàn.
1.3 Quản lý hồ sơ cá nhân: Cập nhật thông tin người dùng, đổi mật khẩu và xem thông tin tài khoản.
Phân hệ 2: Phân hệ Dự án & Thiết kế DAG (GitHub Model)
2.1 Khởi tạo dự án & Clone Template: Tạo dự án mới từ đầu hoặc sao chép toàn bộ cấu trúc quy trình từ một mẫu chuẩn có sẵn.
2.2 Mời thành viên & Gán quyền ban đầu: Thêm thành viên vào dự án qua tài khoản hoặc email và chỉ định vai trò khởi điểm.
2.3 Điều chỉnh Role / Thu hồi quyền thành viên: Thay đổi vai trò (Owner, Collaborator, Viewer) hoặc loại thành viên khỏi dự án.
2.4 Màn hình Workflow (Thiết kế kéo thả Dual-View Phase Graph / Kanban): Giao diện tương tác trực quan cho phép chuyển đổi linh hoạt giữa Phase Graph (đồ thị DAG) và Phase Kanban, thêm các nút công việc, thiết lập đường liên kết phụ thuộc và cấu hình thuộc tính.
2.5 Kiểm tra chu trình lặp (Thuật toán Kahn): Giải thuật kiểm tra tính hợp lệ của đồ thị, chặn các trường hợp tạo vòng tròn phụ thuộc khép kín trước khi kích hoạt.
Phân hệ 3: Phân hệ Engine Điều phối & Thực thi Node
3.1 Engine tự mở khóa Node (AND / OR Join): Động cơ tự động tính toán điều kiện hoàn thành của các nút tiền nhiệm để chuyển trạng thái nút từ LOCKED sang To Do.
3.2 Bảng Kanban My Tasks (Direct Push Model): Màn hình My Tasks được cá nhân hóa tuyệt đối theo assignedUserId === currentUserId, tự động hiển thị các công việc được giao trực tiếp theo mô hình Direct Push (không qua bước Chấp nhận / Từ chối).
3.3 Bàn giao kết quả (Upload Artifact): Người phụ trách chuyển trạng thái từ In Progress sang In Review, bắt buộc đính kèm đường link hoặc tập tin minh chứng để chuyển sang bước chờ duyệt.
3.4 Đánh giá & Duyệt kết quả (Task State Machine & RBAC Approval Gate): Kiểm soát chặt chẽ việc chuyển trạng thái từ In Review sang Done qua cổng phê duyệt RBAC Gate (chỉ OWNER có quyền duyệt), hoặc từ chối kèm lý do sửa đổi.
3.5 Cảnh báo Deadline & Điều phối nhân lực: Tự động phát hiện các công việc trễ hạn thông qua tiến trình nền định kỳ, cho phép gia hạn hoặc chuyển người thực hiện.
3.6 Thống kê tiến độ & Task Metrics: Tổng hợp các chỉ số định lượng về khối lượng công việc, tỷ lệ hoàn thành và thời gian thực thi.
Phân hệ 4: Phân hệ Cổng Đánh giá & AI Chẩn đoán
4.1 Quản lý Public Audit & Share Gateway trên Header Overview: Sinh mã Token ngẫu nhiên (Generate New Token), thu hồi quyền truy cập (Revoke Link), cài đặt thời hạn hết hạn ngay tại Header của màn hình Overview để chia sẻ báo cáo công khai.
4.2 Xem trực quan đồ thị & Artifact (Read-only): Cung cấp giao diện chỉ xem cho Giáo viên hoặc Chuyên gia đánh giá tiến độ mà không cho phép chỉnh sửa dữ liệu.
4.3 Khối Feedback Queue 1 chiều trên màn hình Overview: Tích hợp trực tiếp khối Feedback Queue 1 chiều vào Overview, nhận dòng phản hồi tuyến tính từ TEACHER/GUEST gắn theo mã Node để nhóm thực thi tiếp thu mà không kéo dài tranh luận trực tiếp.
4.4 AI chẩn đoán điểm nghẽn tiến độ (Gemini): Tích hợp mô hình AI phân tích cấu trúc đồ thị và lịch sử thực thi để nhận diện rủi ro chậm trễ và đưa ra lời khuyên.
Phân hệ 5: Phân hệ Quản trị Nền tảng (Admin Portal)
5.1 Quản lý User & Khóa/Mở tài khoản: Quản trị viên xem danh sách toàn bộ người dùng và thao tác khóa hoặc mở khóa quyền truy cập.
5.2 CRUD Kho mẫu quy trình chuẩn: Quản trị viên tạo, sửa, xóa và duy trì các mẫu quy trình công việc tiêu chuẩn cho toàn hệ thống.
5.3 Giám sát hạ tầng & Dọn dẹp dự án rác: Giám sát tài nguyên hệ thống, thông báo cảnh báo và thực hiện lưu trữ hoặc dọn dẹp các dự án bị bỏ rơi.
PHẦN 3: TÁC NHÂN (ACTORS), MỐI QUAN HỆ VÀ MA TRẬN PHÂN QUYỀN
3.1 Danh sách Tác nhân (Actors)
A. Tác nhân Con người
Quản trị viên (System Admin): Quản trị hạ tầng kỹ thuật, tài khoản người dùng và kho mẫu dùng chung. Không can thiệp vào dữ liệu chi tiết nội bộ dự án.
Chủ dự án (Project Owner / Lead): Người tạo và sở hữu dự án, nắm toàn quyền thiết kế đồ thị, phân quyền, nghiệm thu và điều phối.
Cộng sự thực thi (Collaborator / Member): Thành viên trực tiếp tham gia làm việc, xử lý công việc được gán trên bảng Kanban My Tasks cá nhân hóa, nộp kết quả và phản hồi giải trình góp ý tại Feedback Queue.
Người xem (Project Viewer): Thành viên trong dự án chỉ được cấp quyền đọc đồ thị, xem sản phẩm bàn giao và xem số liệu thống kê.
Giáo viên / Người đánh giá ngoài (Guest via Token): Khách truy cập bên ngoài thông qua liên kết Token, có quyền xem đồ thị (chỉ đọc), ghim phản hồi góp ý và xem báo cáo AI.
Người dùng vãng lai (Anonymous): Người truy cập chưa xác thực, chỉ có quyền đăng ký tài khoản hoặc đăng nhập hệ thống.
B. Tác nhân Hệ thống (System Actors)
Authentication Service: Dịch vụ trung tâm xử lý xác thực, sinh và xác minh mã thông báo JWT và kiểm soát phiên làm việc.
Execution State Engine: Động cơ ngầm chịu trách nhiệm giám sát trạng thái, thẩm định điều kiện hội tụ và mở khóa các nút kế tiếp.
AI Engine: Đảm nhiệm việc tiếp nhận dữ liệu tiến độ, tính toán phân tích và sinh báo cáo chẩn đoán điểm nghẽn độc lập.
Notification Service: Hệ thống gửi thông báo, email mời tham gia dự án và thông báo cảnh báo hạn chót.
Storage Service: Dịch vụ tiếp nhận, kiểm soát định dạng, dung lượng và lưu trữ tập tin bàn giao (Artifacts).
3.2 Quan hệ Kế thừa Quyền giữa các Tác nhân
Quan hệ kế thừa: Project Owner kế thừa toàn bộ quyền thực thi của Collaborator. Collaborator kế thừa toàn bộ quyền xem của Project Viewer. Project Viewer là người dùng vãng lai (Anonymous) đã xác thực tài khoản thành công.
Ranh giới tách biệt: System Admin và Guest via Token hoạt động trên hai luồng chức năng riêng biệt, không kế thừa trực tiếp cấu trúc quyền nội bộ của dự án.
3.3 Ma trận Phân quyền Use Case (RBAC Matrix)
Đăng ký tài khoản: Anonymous.
Đăng nhập & Cấp phát JWT: Anonymous.
Quản lý hồ sơ cá nhân: Project Viewer, Collaborator, Project Owner, System Admin.
Khởi tạo dự án & Clone Template: Project Owner.
Mời thành viên & Gán Role: Project Owner.
Điều chỉnh quyền / Kick thành viên: Project Owner.
Thiết kế & Lưu tọa độ đồ thị DAG: Project Owner.
Kiểm tra chu trình lặp (Kahn DAG): Project Owner.
Sinh & Thu hồi Guest Link Token: Project Owner.
Duyệt bài / Yêu cầu làm lại Task: Project Owner.
Gia hạn Deadline / Đổi người phụ trách: Project Owner.
Quản lý & Thực thi công việc cá nhân (My Tasks - Direct Push Model): Collaborator, Project Owner.
Nộp kết quả (Upload Artifact): Collaborator, Project Owner.
Điều chuyển trạng thái Task (To Do ➔ In Progress ➔ In Review): Collaborator, Project Owner.
Xem Feedback (Feedback Queue 1 chiều trên Overview): Collaborator, Project Owner.
Xem đồ thị tiến độ & Artifact: Project Viewer, Collaborator, Project Owner.
Xem Dashboard thống kê Metrics: Project Viewer, Collaborator, Project Owner.
Truy cập qua URL Token: Guest via Token.
Xem trực quan đồ thị (Read-only): Guest via Token.
Ghim Feedback / Báo lỗi trên Node: Guest via Token.
Xem AI chẩn đoán điểm nghẽn: Guest via Token, Collaborator, Project Owner.
Quản lý User & Khóa/Mở tài khoản: System Admin.
CRUD Template quy trình chuẩn: System Admin.
Dọn dẹp / Lưu trữ dự án rác: System Admin.
3.4 Nguyên tắc Bảo mật và Vận hành Phiên làm việc
Giới hạn quyền đọc của Admin: Quản trị viên chỉ được quyền xem các trường thông tin chung (Metadata) của dự án, không được phép đọc hoặc can thiệp nội dung chi tiết của các nút và tài nguyên nội bộ nếu không có sự ủy quyền rõ ràng.
Cơ chế Token dành cho Guest: Mã truy cập của khách là một chuỗi ngẫu nhiên không dự đoán được, bắt buộc có thời điểm hết hạn cụ thể, có khả năng thu hồi tức thì và chỉ cho phép đọc những tài nguyên được cấu hình mở.
Thu hồi quyền truy cập tức thì: Khi một tài khoản bị khóa bởi Admin hoặc bị Owner loại khỏi dự án, toàn bộ phiên làm việc của người dùng đó đối với dự án tương ứng phải bị chấm dứt ngay lập tức.
PHẦN 4: ĐẶC TẢ CƠ SỞ DỮ LIỆU POSTGRESQL (DATA DICTIONARY)
Hệ thống sử dụng cơ sở dữ liệu quan hệ PostgreSQL với 8 bảng dữ liệu chuẩn hóa, tích hợp kiểu dữ liệu JSONB cho các cấu trúc động.
4.1 Bảng USER
Bảng lưu trữ danh tính và thông tin xác thực của người dùng hệ thống.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
username: Kiểu varchar(50), Duy nhất (UK), Bắt buộc nhập. Tên định danh tài khoản.
email: Kiểu varchar(100), Duy nhất (UK), Bắt buộc nhập. Địa chỉ thư điện tử xác thực.
password_hash: Kiểu varchar(255), Bắt buộc nhập. Chuỗi mật khẩu đã được mã hóa an toàn.
system_role: Kiểu varchar(20), Bắt buộc nhập, Giá trị mặc định là 'USER'. Các giá trị hợp lệ: 'ADMIN', 'USER'.
is_locked: Kiểu boolean, Bắt buộc nhập, Giá trị mặc định là FALSE. Cờ đánh dấu tài khoản bị khóa.
created_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm tạo tài khoản.
Quan hệ dữ liệu của bảng USER:
Một USER có thể sở hữu nhiều PROJECT (Quan hệ 1 - N qua owner_id).
Một USER có thể tạo nhiều PIPELINE_TEMPLATE (Quan hệ 1 - N qua created_by).
Một USER có thể tham gia nhiều dự án thông qua bảng trung gian PROJECT_MEMBER.
Một USER có thể được giao nhiều NODE công việc (Quan hệ 1 - N qua assigned_user_id).
Một USER có thể tải lên nhiều tập tin trong ARTIFACTS (Quan hệ 1 - N qua uploaded_by).
4.2 Bảng PROJECT
Bảng lưu trữ thông tin chung của từng dự án workflow.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
owner_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến trường id của bảng USER.
name: Kiểu varchar(150), Bắt buộc nhập. Tên hiển thị của dự án.
description: Kiểu text, Cho phép để trống. Mô tả phạm vi và mục tiêu của dự án.
status: Kiểu varchar(30), Bắt buộc nhập, Giá trị mặc định là 'DRAFT'. Các giá trị hợp lệ: 'DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'.
guest_access: Kiểu jsonb, Bắt buộc nhập, Giá trị mặc định là '{}'. Lưu trữ cấu hình truy cập cho người đánh giá ngoài.
latest_ai_analysis: Kiểu jsonb, Cho phép để trống. Lưu trữ bản ghi phân tích và lời khuyên gần nhất của AI.
created_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm khởi tạo dự án.
Chi tiết định dạng dữ liệu cột JSONB guest_access:
{
  "token": "chuỗi_mã_token_ngẫu_nhiên_an_toàn",
  "guest_name": "Tên người đánh giá ngoài",
  "expires_at": "2026-10-01T23:59:59Z",
  "is_revoked": false
}


Chi tiết định dạng dữ liệu cột JSONB latest_ai_analysis:
{
  "metrics": {
    "total_nodes": 10,
    "completed_nodes": 4,
    "overdue_nodes": 1,
    "completion_rate": 40.0
  },
  "advice": "Tập trung giải quyết nút thiết kế giao diện để mở khóa nhánh lập trình",
  "generated_at": "2026-09-24T08:30:00Z"
}


4.3 Bảng PROJECT_MEMBER
Bảng quản lý danh sách và quyền hạn của các thành viên bên trong từng dự án.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
project_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng PROJECT.
user_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng USER.
role: Kiểu varchar(30), Bắt buộc nhập. Các giá trị hợp lệ: 'OWNER', 'COLLABORATOR', 'VIEWER'.
joined_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm gia nhập dự án.
Ràng buộc duy nhất (Unique Constraint): Cặp (project_id, user_id) phải là duy nhất. Một người dùng chỉ có một vai trò trong một dự án.
4.4 Bảng PIPELINE_TEMPLATE
Bảng lưu trữ các mẫu quy trình chuẩn để tái sử dụng.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
name: Kiểu varchar(150), Bắt buộc nhập. Tên mẫu quy trình chuẩn.
description: Kiểu text, Cho phép để trống. Mô tả nghiệp vụ của mẫu.
created_by: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng USER.
is_system_standard: Kiểu boolean, Bắt buộc nhập, Giá trị mặc định là FALSE. Đánh dấu mẫu chuẩn của toàn hệ thống do Quản trị viên cấu hình.
graph_data: Kiểu jsonb, Bắt buộc nhập. Cấu trúc toàn bộ đồ thị mẫu bao gồm danh sách các nút, liên kết và thuộc tính ban đầu.
created_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm tạo mẫu.
Chi tiết cấu trúc cột JSONB graph_data:
{
  "nodes": [
    { "id": "temp-node-1", "title": "Phân tích yêu cầu", "join_policy": "ALL_COMPLETED" },
    { "id": "temp-node-2", "title": "Thiết kế hệ thống", "join_policy": "ALL_COMPLETED" }
  ],
  "edges": [
    { "parent_id": "temp-node-1", "child_id": "temp-node-2" }
  ],
  "metadata": { "category": "Software Engineering", "version": "1.0" }
}


4.5 Bảng NODE
Bảng lưu trữ thông tin của từng công việc/tác vụ trong quy trình DAG.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
project_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng PROJECT.
title: Kiểu varchar(200), Bắt buộc nhập. Tiêu đề công việc.
description: Kiểu text, Cho phép để trống. Hướng dẫn và tiêu chuẩn kỹ thuật chi tiết.
status: Kiểu varchar(30), Bắt buộc nhập, Giá trị mặc định là 'LOCKED'. Các giá trị hợp lệ: 'LOCKED', 'To Do', 'In Progress', 'In Review', 'Done'.
assigned_user_id: Kiểu bigint, Khóa ngoại (FK), Cho phép để trống. Liên kết đến id của bảng USER. Định danh người đang thực hiện công việc.
join_policy: Kiểu varchar(30), Bắt buộc nhập, Giá trị mặc định là 'ALL_COMPLETED'. Các giá trị hợp lệ: 'ALL_COMPLETED' (điều kiện AND), 'ANY_COMPLETED' (điều kiện OR).
due_date: Kiểu timestamp with time zone, Cho phép để trống. Hạn chót phải hoàn thành công việc.
is_overdue: Kiểu boolean, Bắt buộc nhập, Giá trị mặc định là FALSE. Cờ đánh dấu công việc đã bị trễ hạn.
assigned_user_id: Kiểu bigint, Khóa ngoại (FK), Cho phép để trống. Liên kết đến id của bảng USER. Định danh người được giao việc trực tiếp (Direct Push Model) hiển thị trên My Tasks (assignedUserId === currentUserId).
ui_metadata: Kiểu jsonb, Bắt buộc nhập, Giá trị mặc định là '{}'. Lưu trữ tọa độ và thuộc tính giao diện trực quan.
updated_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm cập nhật dữ liệu gần nhất.
Chi tiết cấu trúc cột JSONB ui_metadata:
{
  "position": { "x": 120, "y": 240 },
  "style": { "fill": "#ffffff", "stroke": "#2563eb" },
  "color": "blue"
}


4.6 Bảng NODE_DEPENDENCY
Bảng biểu diễn các cạnh (Edges) định hướng mối quan hệ phụ thuộc giữa các công việc.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
project_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng PROJECT.
parent_node_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của nút đứng trước trong bảng NODE.
child_node_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của nút đứng sau trong bảng NODE.
Ràng buộc duy nhất (Unique Constraint): Cặp (parent_node_id, child_node_id) phải là duy nhất. Không được phép tạo hai đường nối giống hệt nhau giữa hai nút.
4.7 Bảng NODE_FEEDBACK
Bảng lưu trữ thông tin đánh giá và góp ý 1 chiều từ người đánh giá/giáo viên cho từng công việc.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
node_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng NODE.
reviewer_name: Kiểu varchar(100), Bắt buộc nhập. Tên của người đưa ra nhận xét hoặc chỉ lỗi.
content: Kiểu text, Bắt buộc nhập. Nội dung chi tiết của phản hồi hoặc yêu cầu chỉnh sửa.
status: Kiểu varchar(30), Bắt buộc nhập, Giá trị mặc định là 'OPEN'. Các giá trị hợp lệ: 'OPEN', 'RESOLVED'.
note: Kiểu text, Cho phép để trống. Ghi chú tiếp thu hoặc theo dõi nội bộ của nhóm dự án.
created_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm tạo phản hồi.
4.8 Bảng ARTIFACTS
Bảng lưu trữ thông tin sản phẩm và minh chứng bàn giao công việc.
id: Kiểu bigint, Khóa chính (PK), Khóa tự tăng.
node_id: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng NODE.
uploaded_by: Kiểu bigint, Khóa ngoại (FK), Bắt buộc nhập. Liên kết đến id của bảng USER.
file_url: Kiểu varchar(500), Bắt buộc nhập. Đường dẫn trực tiếp đến tập tin lưu trữ hoặc tài nguyên minh chứng.
file_type: Kiểu varchar(50), Bắt buộc nhập. Định dạng của tập tin bàn giao (ví dụ: pdf, zip, docx, link).
version: Kiểu int, Bắt buộc nhập, Giá trị mặc định là 1. Số phiên bản của tài liệu bàn giao.
is_public_for_guest: Kiểu boolean, Bắt buộc nhập, Giá trị mặc định là TRUE. Cờ cho phép người đánh giá ngoài (Guest) được xem hoặc tải tập tin này.
uploaded_at: Kiểu timestamp with time zone, Bắt buộc nhập, Giá trị mặc định là NOW(). Thời điểm tải sản phẩm lên hệ thống.
PHẦN 5: ĐẶC TẢ MÁY TRẠNG THÁI VÀ ENGINE ĐIỀU PHỐI (STATE MACHINE)
5.1 Vòng đời Trạng thái của Node
Trạng thái của từng công việc trên màn hình Workflow và bảng Kanban cá nhân hóa My Tasks chuyển đổi theo quy trình 4 cột chuẩn (To Do ➔ In Progress ➔ In Review ➔ Done) như sau:

[Khởi tạo Node trên đồ thị Workflow]
           |
           v
       +--------+
       | LOCKED |  <--- Nút bị khóa hoàn toàn. Không xuất hiện trên My Tasks
       +--------+       khi các luồng công việc phía trước chưa hoàn tất.
           |
           | (Engine tự động mở khóa theo AND-join hoặc OR-join)
           v
        +-------+
        | To Do |  <--- Xuất hiện trên My Tasks của người được gán (assignedUserId === currentUserId)
        +-------+       (Theo mô hình Phân công trực tiếp - Direct Push Model, không cần chấp nhận)
           |
           | (Thành viên bắt đầu thực hiện tác vụ)
           v
    +-------------+
    | In Progress |
    +-------------+
      |         |
      |         +--> (Tiến trình quét quá hạn: gán is_overdue = true, báo đỏ;
      |               Owner có quyền gia hạn due_date hoặc phân công lại)
      |
      | (Thành viên nộp kết quả công việc:
      |  Bắt buộc đính kèm link hoặc tập tin Artifact để chuyển trạng thái)
      v
     +-----------+
     | In Review |
     +-----------+
        |    ^
        |    | (Owner từ chối nghiệm thu: bắt buộc nhập lý do yêu cầu sửa đổi)
        |    +----------------------------------------------------------+
        |
        | (Chỉ OWNER mới có quyền duyệt: chấp thuận sản phẩm, đóng băng Node)
        v
       +------+
       | Done | ---> Kích hoạt Engine kiểm tra điều kiện để mở khóa các Node con tiếp theo.
       +------+
           |
           v
       [Kết thúc luồng Node]


5.2 Quy tắc Nghiệp vụ Điều phối và Chuyển đổi Trạng thái
Điều kiện mở khóa tự động của Engine (Join Policies):
Đối với chính sách ALL_COMPLETED (AND-join): Nút ở trạng thái LOCKED chỉ được chuyển sang To Do khi TẤT CẢ các nút cha trực tiếp trỏ vào nó đều đã đạt trạng thái Done.
Đối với chính sách ANY_COMPLETED (OR-join): Nút ở trạng thái LOCKED sẽ được chuyển sang To Do ngay khi CÓ ÍT NHẤT MỘT nút cha trực tiếp đạt trạng thái Done.
Mô hình Phân công trực tiếp (Direct Push Model) & Bảng My Tasks cá nhân hóa:
Công việc sau khi mở khóa hoặc được gán sẽ đẩy trực tiếp vào bảng My Tasks của người phụ trách theo điều kiện lọc cá nhân hóa tuyệt đối (assignedUserId === currentUserId).
Loại bỏ hoàn toàn bước trung gian "Chấp nhận / Từ chối" công việc, giúp đơn giản hóa luồng thực thi tác vụ.
Nghiệm thu sản phẩm nghiêm ngặt (Strict Review Constraint):
Để chuyển từ In Progress sang In Review, hệ thống bắt buộc phải có ít nhất một bản ghi sản phẩm bàn giao (Artifact) được liên kết với nút đó.
Thành viên thực thi không thể tự ý chuyển trạng thái sang Done. Thao tác duyệt chấp thuận chuyển từ In Review sang Done hoặc từ chối quay về In Progress là đặc quyền duy nhất của tài khoản sở hữu vai trò OWNER trong dự án.
Xử lý tác vụ trễ hạn (Overdue Handling):
Một tiến trình chạy ngầm (Scheduled Job) quét liên tục các nút có trạng thái In Progress hoặc In Review mà thời gian hiện tại đã vượt quá due_date.
Tiến trình sẽ cập nhật trường is_overdue thành TRUE để hiển thị chỉ báo cảnh báo trên giao diện. Tại thời điểm này, Owner có toàn quyền thay đổi người phụ trách hoặc thiết lập lại hạn nộp mới.
5.3 Vòng đời Trạng thái của Dự án (Project Lifecycle)
Toàn bộ dự án tuân theo 4 trạng thái vòng đời:
DRAFT: Giai đoạn xây dựng cấu trúc đồ thị, thêm bớt công việc và thiết lập mối quan hệ phụ thuộc. Engine điều phối chưa hoạt động trong giai đoạn này.
ACTIVE: Dự án đã vượt qua bước kiểm tra chu trình và được xuất bản chính thức. Các nút gốc không có phụ thuộc sẽ chuyển sang To Do, tự động xuất hiện trên My Tasks của người phụ trách và Engine bắt đầu kích hoạt tự động.
INACTIVE: Dự án không phát sinh bất kỳ tương tác hoặc chuyển đổi trạng thái nào trong khoảng thời gian quy định (ví dụ: 30 ngày). Hệ thống sẽ gửi cảnh báo trước khi tiến hành đóng băng.
ARCHIVED: Trạng thái lưu trữ do Quản trị viên dọn dẹp hoặc Chủ dự án chủ động đóng băng. Toàn bộ dữ liệu chuyển sang chế độ chỉ đọc (Read-only). Chủ dự án có thể thực hiện khôi phục trong thời gian ân hạn quy định.
PHẦN 6: THUẬT TOÁN ĐỒ THỊ VÀ KIỂM TRA CHU TRÌNH (KAHN DAG)
Để đảm bảo quy trình không bị rơi vào tình trạng bế tắc (Deadlock) do phụ thuộc vòng tròn, hệ thống áp dụng thuật toán sắp xếp Topo của Kahn (Kahn's Algorithm).
6.1 Thời điểm Thực thi
Thuật toán được tự động kích hoạt tại hai thời điểm:
Khi Chủ dự án nhấn lưu hoặc kiểm tra hợp lệ bản vẽ đồ thị trên giao diện.
Trước thời điểm chuyển trạng thái dự án từ DRAFT sang ACTIVE. Nếu phát hiện có chu trình lặp, hệ thống ngăn chặn việc kích hoạt và đánh dấu các nút vi phạm.
6.2 Logic Thuật toán
Bắt đầu:
  1. Khởi tạo mảng Bậc Vào (In-degree) cho tất cả các nút trong dự án với giá trị 0.
  2. Với mỗi cạnh phụ thuộc trong danh sách NODE_DEPENDENCY:
       Tăng Bậc Vào của nút con (child_node_id) lên 1 đơn vị.
       Thêm nút con vào danh sách kề của nút cha (parent_node_id).
  3. Khởi tạo một Hàng Đợi (Queue). Đưa tất cả các nút có Bậc Vào bằng 0 vào Hàng Đợi.
  4. Khởi tạo biến đếm Số Nút Đã Duyệt bằng 0.
  5. Trong khi Hàng Đợi không rỗng:
       Lấy một nút ra khỏi Hàng Đợi.
       Tăng Số Nút Đã Duyệt lên 1.
       Với mỗi nút kế tiếp nằm trong danh sách kề của nút vừa lấy:
         Giảm Bậc Vào của nút kế tiếp đi 1.
         Nếu Bậc Vào của nút kế tiếp giảm về 0:
           Đưa nút kế tiếp vào Hàng Đợi.
  6. Kiểm tra kết quả:
       Nếu Số Nút Đã Duyệt bằng Tổng Số Nút của dự án:
         -> Đồ thị hợp lệ, không có chu trình. Cho phép kích hoạt dự án.
       Ngược lại:
         -> Đồ thị bị lỗi chu trình lặp (Circular Dependency). 
         -> Lọc ra tất cả các nút có Bậc Vào lớn hơn 0 để cảnh báo cho người dùng xử lý.
Kết thúc.


PHẦN 7: ĐẶC TẢ TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI ENGINE SPECIFICATION)
7.1 Cơ chế Tóm tắt Tiến độ và Chẩn đoán Điểm nghẽn
Vấn đề giải quyết: Tránh việc gửi yêu cầu trực tiếp đến dịch vụ AI (Gemini) mỗi khi người dùng tải trang, hạn chế độ trễ và tiết kiệm hạn mức tài nguyên.
Giải pháp vận hành:
Một tiến trình xử lý ngầm (Background Job) thu thập dữ liệu cấu trúc đồ thị, danh sách nút quá hạn, thời gian chờ tại bước In Review và các phản hồi trong Feedback Queue chưa giải quyết.
Dữ liệu được đóng gói và gửi đến AI Engine để nhận dạng các điểm tắc nghẽn trọng yếu.
Kết quả trả về gồm danh sách các nút gây chậm trễ luồng đi kèm lời khuyên hành động cụ thể, sau đó được lưu trực tiếp vào cột latest_ai_analysis của bảng PROJECT.
Giao diện của Chủ dự án, Thành viên và Người đánh giá ngoài chỉ truy xuất dữ liệu bản ghi từ bộ nhớ đệm cơ sở dữ liệu này.
7.2 Quy trình Sinh Đồ thị Tự động có Con người Kiểm soát (Human-in-the-loop)
Khi mở rộng tính năng tự động tạo quy trình từ mô tả tự nhiên của người dùng, hệ thống bắt buộc phải áp dụng quy trình kiểm duyệt nghiêm ngặt:

[Mô tả của Người dùng]
          |
          v
    [AI Engine]
          |
          v
[Đề xuất Đồ thị (PENDING_REVIEW)]
          |
          v
[Người dùng Xem xét, Chỉnh sửa Tọa độ & Xác nhận]
          |
          v
[Hệ thống chạy Thuật toán Validate DAG]
          |
          v
[Ghi nhận vào Cơ sở dữ liệu chính thức]


Nguyên tắc cốt lõi: AI chỉ đóng vai trò đề xuất bản thảo, tuyệt đối không được cấp quyền ghi đè trực tiếp dữ liệu chính thức vào cơ sở dữ liệu nếu chưa qua bước xác nhận của người dùng và thẩm định của thuật toán kiểm tra chu trình.
PHẦN 8: BẢNG TỔNG HỢP THIẾU SÓT VÀ LỘ TRÌNH TRIỂN KHAI
8.1 Danh mục Xử lý Thiếu sót Kiến trúc (Gap Analysis)
G0-01 (Đăng ký / Đăng nhập / Quản lý Phiên): Tiếp nhận bởi Auth Gateway. Đề xuất bổ sung mới dịch vụ xác thực tập trung và quản lý mã thông báo JWT an toàn.
G0-02 (Quản lý Guest Link Token): Tiếp nhận bởi Auth Gateway và Project Workspace. Đề xuất bổ sung cơ chế kiểm soát thời hạn hết hiệu lực và tính năng thu hồi tức thời mã truy cập của khách.
G1-01 (Cảnh báo Dọn dẹp Dự án): Tiếp nhận bởi Admin Portal. Đề xuất quy trình chuyển sang trạng thái lưu trữ (Archive) kèm thông báo cảnh báo trước 7 ngày thay vì thao tác xóa cứng tức thời.
G2-01 (Kiểm tra Hợp lệ Đồ thị): Tiếp nhận bởi Project Workspace. Đề xuất tích hợp bắt buộc giải thuật phát hiện chu trình lặp trước khi cho phép xuất bản dự án.
G2-02 (Tích hợp Feedback Queue 1 chiều vào Overview): Tiếp nhận bởi Overview & Review Portal. Tích hợp trực tiếp khối Feedback Queue 1 chiều trên màn hình Overview hiển thị góp ý tuyến tính kèm mã Node, chuẩn hóa Topbar RBAC scoping và Public Audit Gateway.
G3-01 (Bộ nhớ đệm Kết quả AI): Tiếp nhận bởi Review Portal và Execution Engine. Đề xuất chuyển logic tính toán AI về tiến trình ngầm và lưu đệm trên cơ sở dữ liệu để tối ưu tốc độ đọc.
8.2 Phân định Phạm vi Triển khai
Giai đoạn 1: Phạm vi Khả thi Tối thiểu (MVP Scope)
Hiện thực dịch vụ xác thực trung tâm và quản lý quyền người dùng (Auth Gateway).
Hiện thực chức năng thiết kế đồ thị hai pha (bản nháp Draft và bản chính thức Published).
Xây dựng giải thuật Kahn kiểm tra tính hợp lệ của đồ thị DAG.
Xây dựng máy trạng thái của nút với đầy đủ cơ chế mở khóa theo quy tắc AND-join và OR-join.
Thực hiện bảng My Tasks cá nhân hóa theo mô hình Direct Push và quy trình nộp Artifact, nghiệm thu 4 cột chuẩn.
Cung cấp cổng truy cập chỉ xem bằng mã Token tạm thời cho khách đánh giá.
Giai đoạn 2: Phạm vi Mở rộng (Post-MVP Roadmap)
Tích hợp tính năng AI tự động sinh cấu trúc quy trình từ văn bản mô tả tự nhiên theo cơ chế kiểm soát có con người duyệt.
Xây dựng lịch sử thay đổi chi tiết của đồ thị phục vụ công tác đối soát và khôi phục phiên bản cũ (Audit Log & Rollback).
Bổ sung tính năng quản trị nâng cao cho phép khóa hoặc mở tài khoản hàng loạt và xuất dữ liệu báo cáo chuyên sâu.
PHẦN 9: QUY TẮC KỸ THUẬT DÀNH CHO CLAUDE CODE VÀ NHÀ PHÁT TRIỂN
Khi sử dụng tài liệu này để sinh mã nguồn, xây dựng API hoặc viết kiểm thử, cần tuân thủ các quy chuẩn sau:
Ánh xạ Kiểu dữ liệu Chuẩn: Các trường khóa chính id và khóa ngoại _id trong cơ sở dữ liệu đều có kiểu bigint, tương ứng với kiểu Long trong ngôn ngữ Java hoặc kiểu số nguyên lớn trong các framework khác. Các trường thời gian phải được định dạng theo chuẩn chuỗi ISO-8601 có múi giờ.
Quản lý Thuộc tính JSONB: Các trường lưu trữ dạng JSONB bao gồm guest_access, latest_ai_analysis, graph_data và ui_metadata phải được ánh xạ qua các lớp cấu trúc dữ liệu hoặc đối tượng DTO cụ thể, tránh xử lý dạng chuỗi thô không an toàn.
Bảo toàn Luồng Máy trạng thái: Mọi hành động chuyển trạng thái của nút đều phải được kiểm tra điều kiện tiên quyết và xác thực quyền hạn của vai trò người thực hiện thông qua lớp dịch vụ trung gian, tuyệt đối không cập nhật trạng thái trực tiếp mà bỏ qua kiểm tra nghiệp vụ.
