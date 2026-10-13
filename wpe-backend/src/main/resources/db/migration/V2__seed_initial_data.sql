-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V2__seed_initial_data.sql
-- DỮ LIỆU MẪU BAN ĐẦU ĐỂ TEAM TEST NGAY KHI BẬT HỆ THỐNG
-- Mật khẩu mặc định của tất cả tài khoản mẫu: Password123!
-- BCrypt Hash: $2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG
-- =============================================================================

-- 1. TẠO TÀI KHOẢN MẪU
INSERT INTO users (id, username, email, full_name, password_hash, system_role, is_locked, token_version)
VALUES 
(1, 'admin', 'admin@pipeline.engine', 'System Administrator', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG', 'ADMIN', FALSE, 0),
(2, 'alex.kim', 'alex.kim@pipeline.engine', 'Alex Kim', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG', 'USER', FALSE, 0),
(3, 'sarah.chen', 'sarah.chen@pipeline.engine', 'Sarah Chen', '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG', 'USER', FALSE, 0)
ON CONFLICT (id) DO NOTHING;

-- Đặt lại sequence id cho users
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 2. TẠO DỰ ÁN MẪU
INSERT INTO project (id, owner_id, name, description, status)
VALUES
(1, 2, 'Core Banking Pipeline', 'Next-generation microservices banking workflow engine', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

SELECT setval('project_id_seq', (SELECT MAX(id) FROM project));

-- 3. GÁN THÀNH VIÊN DỰ ÁN
INSERT INTO project_member (project_id, user_id, role)
VALUES
(1, 2, 'OWNER'),
(1, 3, 'COLLABORATOR')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 4. TẠO MACRO PHASES
INSERT INTO work_phase (id, project_id, name, sub_title, accent_color, order_index)
VALUES
(1, 1, 'FOUNDATION', 'Architecture & Database Setup', 'emerald', 0),
(2, 1, 'AUTH GATEWAY', 'Identity & Security Layer', 'blue', 1),
(3, 1, 'CORE ENGINE', 'Workflow State Machine & Execution', 'slate', 2)
ON CONFLICT (id) DO NOTHING;

SELECT setval('work_phase_id_seq', (SELECT MAX(id) FROM work_phase));

-- 5. TẠO CÁC NÚT CÔNG VIỆC MẪU (NODES)
INSERT INTO node (id, project_id, phase_id, code, title, description, status, assigned_user_id, join_policy, version)
VALUES
(1, 1, 1, 'WPE-001', 'Database Schema 3NF', 'Thiết kế 12 bảng chuẩn hóa và migration Flyway', 'DONE', 2, 'ALL_COMPLETED', 1),
(2, 1, 2, 'WPE-002', 'JWT Token Rotation', 'Cài đặt Access Token và Refresh Token Rotation', 'IN_PROGRESS', 3, 'ALL_COMPLETED', 0),
(3, 1, 2, 'WPE-003', 'Spring Security Filter', 'Tích hợp bộ lọc bảo mật JwtAuthFilter', 'TODO', 3, 'ALL_COMPLETED', 0),
(4, 1, 3, 'WPE-004', 'Kahn Algorithm DAG', 'Cài đặt giải thuật phát hiện chu trình đồ thị', 'LOCKED', 2, 'ALL_COMPLETED', 0)
ON CONFLICT (id) DO NOTHING;

SELECT setval('node_id_seq', (SELECT MAX(id) FROM node));

-- 6. TẠO LIÊN KẾT PHỤ THUỘC (DAG EDGES)
-- WPE-001 (DONE) -> WPE-002 (IN_PROGRESS)
-- WPE-002 -> WPE-003 (TODO)
-- WPE-003 -> WPE-004 (LOCKED)
INSERT INTO node_dependency (project_id, parent_node_id, child_node_id)
VALUES
(1, 1, 2),
(1, 2, 3),
(1, 3, 4)
ON CONFLICT (parent_node_id, child_node_id) DO NOTHING;
