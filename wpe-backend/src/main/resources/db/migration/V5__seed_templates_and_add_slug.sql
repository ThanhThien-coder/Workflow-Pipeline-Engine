-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V5__seed_templates_and_add_slug.sql
-- BỔ SUNG CỘT SLUG CHO PIPELINE_TEMPLATE VÀ SEED CÁC QUY TRÌNH MẪU CHUẨN
-- Phục vụ Admin Template Studio & Deep-Copy DAG Cloning
-- Target DB: PostgreSQL 15+
-- =============================================================================

-- 1. Bổ sung cột slug hỗ trợ tra cứu mẫu bằng định danh ký tự thân thiện
ALTER TABLE pipeline_template
ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- 2. Thêm chỉ mục tra cứu nhanh theo slug
CREATE INDEX IF NOT EXISTS idx_pipeline_template_slug ON pipeline_template(slug);

-- 3. Seed các quy trình mẫu chuẩn hệ thống (System Standard Templates)
INSERT INTO pipeline_template (id, name, slug, description, category, created_by, is_system_standard, clone_count, graph_data)
VALUES 
(
    1,
    'Standard Software Development (SDLC)',
    'tpl-sdlc',
    'Quy trình phát triển phần mềm chuẩn: từ phân tích yêu cầu, thiết kế kiến trúc, lập trình frontend/backend đến kiểm thử và phát hành.',
    'Software Engineering',
    1,
    TRUE,
    128,
    '{
        "schemaVersion": 2,
        "phases": [
            {
                "id": "ph-sdlc-1",
                "name": "Foundation",
                "order": 0,
                "rootNodeId": "nd-f-0",
                "uiMetadata": { "position": { "x": 40, "y": 60 } },
                "runsAfter": []
            },
            {
                "id": "ph-sdlc-2",
                "name": "Auth & Security Gateway",
                "order": 1,
                "rootNodeId": "nd-a-0",
                "uiMetadata": { "position": { "x": 420, "y": 60 } },
                "runsAfter": ["ph-sdlc-1"]
            },
            {
                "id": "ph-sdlc-3",
                "name": "Core Engine & Services",
                "order": 2,
                "rootNodeId": "nd-c-0",
                "uiMetadata": { "position": { "x": 800, "y": 60 } },
                "runsAfter": ["ph-sdlc-2"]
            },
            {
                "id": "ph-sdlc-4",
                "name": "Testing & QA Certification",
                "order": 3,
                "rootNodeId": "nd-t-0",
                "uiMetadata": { "position": { "x": 1180, "y": 60 } },
                "runsAfter": ["ph-sdlc-3"]
            }
        ],
        "phaseEdges": [
            { "parentPhaseId": "ph-sdlc-1", "childPhaseId": "ph-sdlc-2" },
            { "parentPhaseId": "ph-sdlc-2", "childPhaseId": "ph-sdlc-3" },
            { "parentPhaseId": "ph-sdlc-3", "childPhaseId": "ph-sdlc-4" }
        ],
        "nodes": [
            {
                "id": "nd-f-0",
                "phaseId": "ph-sdlc-1",
                "parentId": null,
                "trackId": null,
                "title": "Foundation Architecture",
                "description": "Thiết kế kiến trúc tổng thể và cơ sở dữ liệu",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            },
            {
                "id": "nd-f-req",
                "phaseId": "ph-sdlc-1",
                "parentId": "nd-f-0",
                "trackId": "nd-f-0",
                "title": "Database Schema 3NF",
                "description": "Thiết kế 13 bảng CSDL và migration Flyway",
                "level": 1,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 320, "y": 100 } }
            },
            {
                "id": "nd-a-0",
                "phaseId": "ph-sdlc-2",
                "parentId": null,
                "trackId": null,
                "title": "Security Layer Gateway",
                "description": "Tích hợp bộ lọc xác thực và phân quyền",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            },
            {
                "id": "nd-a-jwt",
                "phaseId": "ph-sdlc-2",
                "parentId": "nd-a-0",
                "trackId": "nd-a-0",
                "title": "JWT Rotation & Spring Filter",
                "description": "Xử lý xoay vòng Refresh Token an toàn",
                "level": 1,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 320, "y": 100 } }
            },
            {
                "id": "nd-c-0",
                "phaseId": "ph-sdlc-3",
                "parentId": null,
                "trackId": null,
                "title": "Workflow Core Engine",
                "description": "Xây dựng máy trạng thái FSM và thuật toán Kahn",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            },
            {
                "id": "nd-c-kahn",
                "phaseId": "ph-sdlc-3",
                "parentId": "nd-c-0",
                "trackId": "nd-c-0",
                "title": "Kahn Algorithm & DAG Sorter",
                "description": "Phát hiện chu trình và xếp hạng topo",
                "level": 1,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 320, "y": 100 } }
            },
            {
                "id": "nd-t-0",
                "phaseId": "ph-sdlc-4",
                "parentId": null,
                "trackId": null,
                "title": "E2E Testing Certification",
                "description": "Kiểm thử đầu cuối và bàn giao dự án",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            }
        ],
        "edges": [
            { "id": "e-f-1", "parentId": "nd-f-0", "childId": "nd-f-req", "kind": "DEPENDENCY" },
            { "id": "e-a-1", "parentId": "nd-a-0", "childId": "nd-a-jwt", "kind": "DEPENDENCY" },
            { "id": "e-c-1", "parentId": "nd-c-0", "childId": "nd-c-kahn", "kind": "DEPENDENCY" }
        ],
        "metadata": { "version": "1.0" }
    }'::jsonb
),
(
    2,
    'Digital Marketing & Product Launch',
    'tpl-marketing',
    'Quy trình triển khai chiến dịch Marketing và ra mắt sản phẩm: từ nghiên cứu thị trường, sáng tạo nội dung, chạy quảng cáo đến đánh giá KPI.',
    'Marketing',
    1,
    TRUE,
    45,
    '{
        "schemaVersion": 2,
        "phases": [
            {
                "id": "ph-mkt-1",
                "name": "Market Research",
                "order": 0,
                "rootNodeId": "nd-mkt-0",
                "uiMetadata": { "position": { "x": 40, "y": 60 } },
                "runsAfter": []
            },
            {
                "id": "ph-mkt-2",
                "name": "Campaign Execution",
                "order": 1,
                "rootNodeId": "nd-mkt-exec",
                "uiMetadata": { "position": { "x": 420, "y": 60 } },
                "runsAfter": ["ph-mkt-1"]
            }
        ],
        "phaseEdges": [
            { "parentPhaseId": "ph-mkt-1", "childPhaseId": "ph-mkt-2" }
        ],
        "nodes": [
            {
                "id": "nd-mkt-0",
                "phaseId": "ph-mkt-1",
                "parentId": null,
                "trackId": null,
                "title": "Target Audience Analysis",
                "description": "Khảo sát và xác định chân dung khách hàng",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            },
            {
                "id": "nd-mkt-exec",
                "phaseId": "ph-mkt-2",
                "parentId": null,
                "trackId": null,
                "title": "Social Media Ads & PR Launch",
                "description": "Chạy quảng cáo đa kênh và thông cáo báo chí",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            }
        ],
        "edges": [],
        "metadata": { "version": "1.0" }
    }'::jsonb
),
(
    3,
    'Cloud Infrastructure & CI/CD Pipeline',
    'tpl-devops',
    'Quy trình tự động hóa hạ tầng đám mây: từ thiết lập Terraform, cấu hình Kubernetes, CI/CD pipeline đến giám sát cảnh báo Prometheus/Grafana.',
    'DevOps & Infra',
    1,
    TRUE,
    89,
    '{
        "schemaVersion": 2,
        "phases": [
            {
                "id": "ph-ops-1",
                "name": "IaC Provisioning",
                "order": 0,
                "rootNodeId": "nd-ops-0",
                "uiMetadata": { "position": { "x": 40, "y": 60 } },
                "runsAfter": []
            },
            {
                "id": "ph-ops-2",
                "name": "CI/CD & Monitoring",
                "order": 1,
                "rootNodeId": "nd-ops-ci",
                "uiMetadata": { "position": { "x": 420, "y": 60 } },
                "runsAfter": ["ph-ops-1"]
            }
        ],
        "phaseEdges": [
            { "parentPhaseId": "ph-ops-1", "childPhaseId": "ph-ops-2" }
        ],
        "nodes": [
            {
                "id": "nd-ops-0",
                "phaseId": "ph-ops-1",
                "parentId": null,
                "trackId": null,
                "title": "Terraform AWS Cluster",
                "description": "Khởi tạo cụm EKS và RDS PostgreSQL qua Terraform",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            },
            {
                "id": "nd-ops-ci",
                "phaseId": "ph-ops-2",
                "parentId": null,
                "trackId": null,
                "title": "GitHub Actions & ArgoCD",
                "description": "Tự động hóa build Docker image và deploy Kubernetes",
                "level": 0,
                "joinPolicy": "ALL_COMPLETED",
                "uiMetadata": { "position": { "x": 50, "y": 100 } }
            }
        ],
        "edges": [],
        "metadata": { "version": "1.0" }
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    graph_data = EXCLUDED.graph_data,
    is_system_standard = EXCLUDED.is_system_standard;

-- 4. Đồng bộ sequence ID của pipeline_template
SELECT setval('pipeline_template_id_seq', (SELECT MAX(id) FROM pipeline_template));
