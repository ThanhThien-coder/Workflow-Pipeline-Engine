-- Dịch mô tả dữ liệu mẫu (V2, V5) sang tiếng Anh.
-- Mỗi UPDATE chỉ đổi khi cột còn đúng câu tiếng Việt gốc, để không ghi đè nội dung người dùng đã sửa.

UPDATE node SET description = 'Design the 12 normalized tables and Flyway migrations'
WHERE id = 1 AND code = 'WPE-001' AND description = 'Thiết kế 12 bảng chuẩn hóa và migration Flyway';

UPDATE node SET description = 'Implement access tokens and refresh token rotation'
WHERE id = 2 AND code = 'WPE-002' AND description = 'Cài đặt Access Token và Refresh Token Rotation';

UPDATE node SET description = 'Integrate the JwtAuthFilter security filter'
WHERE id = 3 AND code = 'WPE-003' AND description = 'Tích hợp bộ lọc bảo mật JwtAuthFilter';

UPDATE node SET description = 'Implement the graph cycle detection algorithm'
WHERE id = 4 AND code = 'WPE-004' AND description = 'Cài đặt giải thuật phát hiện chu trình đồ thị';

UPDATE pipeline_template SET description = 'Standard software development process: from requirements analysis and architecture design to frontend/backend development, testing, and release.'
WHERE slug = 'tpl-sdlc' AND description = 'Quy trình phát triển phần mềm chuẩn: từ phân tích yêu cầu, thiết kế kiến trúc, lập trình frontend/backend đến kiểm thử và phát hành.';

UPDATE pipeline_template SET description = 'Marketing campaign and product launch process: from market research and content creation to running ads and reviewing KPIs.'
WHERE slug = 'tpl-marketing' AND description = 'Quy trình triển khai chiến dịch Marketing và ra mắt sản phẩm: từ nghiên cứu thị trường, sáng tạo nội dung, chạy quảng cáo đến đánh giá KPI.';

UPDATE pipeline_template SET description = 'Cloud infrastructure automation process: from Terraform setup and Kubernetes configuration to CI/CD pipelines and Prometheus/Grafana alerting.'
WHERE slug = 'tpl-devops' AND description = 'Quy trình tự động hóa hạ tầng đám mây: từ thiết lập Terraform, cấu hình Kubernetes, CI/CD pipeline đến giám sát cảnh báo Prometheus/Grafana.';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Thiết kế kiến trúc tổng thể và cơ sở dữ liệu"', '"description": "Design the overall architecture and database"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Thiết kế kiến trúc tổng thể và cơ sở dữ liệu"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Thiết kế 13 bảng CSDL và migration Flyway"', '"description": "Design the 13 database tables and Flyway migrations"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Thiết kế 13 bảng CSDL và migration Flyway"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Tích hợp bộ lọc xác thực và phân quyền"', '"description": "Integrate authentication and authorization filters"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Tích hợp bộ lọc xác thực và phân quyền"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Xử lý xoay vòng Refresh Token an toàn"', '"description": "Handle refresh token rotation securely"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Xử lý xoay vòng Refresh Token an toàn"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Xây dựng máy trạng thái FSM và thuật toán Kahn"', '"description": "Build the FSM state machine and the Kahn algorithm"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Xây dựng máy trạng thái FSM và thuật toán Kahn"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Phát hiện chu trình và xếp hạng topo"', '"description": "Detect cycles and compute topological order"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Phát hiện chu trình và xếp hạng topo"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Kiểm thử đầu cuối và bàn giao dự án"', '"description": "End-to-end testing and project handover"')::jsonb
WHERE slug = 'tpl-sdlc' AND graph_data::text LIKE '%"description": "Kiểm thử đầu cuối và bàn giao dự án"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Khảo sát và xác định chân dung khách hàng"', '"description": "Survey and define customer personas"')::jsonb
WHERE slug = 'tpl-marketing' AND graph_data::text LIKE '%"description": "Khảo sát và xác định chân dung khách hàng"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Chạy quảng cáo đa kênh và thông cáo báo chí"', '"description": "Run multichannel ads and press releases"')::jsonb
WHERE slug = 'tpl-marketing' AND graph_data::text LIKE '%"description": "Chạy quảng cáo đa kênh và thông cáo báo chí"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Khởi tạo cụm EKS và RDS PostgreSQL qua Terraform"', '"description": "Provision the EKS cluster and RDS PostgreSQL with Terraform"')::jsonb
WHERE slug = 'tpl-devops' AND graph_data::text LIKE '%"description": "Khởi tạo cụm EKS và RDS PostgreSQL qua Terraform"%';

UPDATE pipeline_template
SET graph_data = replace(graph_data::text, '"description": "Tự động hóa build Docker image và deploy Kubernetes"', '"description": "Automate Docker image builds and Kubernetes deployments"')::jsonb
WHERE slug = 'tpl-devops' AND graph_data::text LIKE '%"description": "Tự động hóa build Docker image và deploy Kubernetes"%';
