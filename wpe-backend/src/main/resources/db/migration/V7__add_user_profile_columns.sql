-- =============================================================================
-- WORKFLOW PIPELINE ENGINE — V7__add_user_profile_columns.sql
-- BỔ SUNG CỘT HỒ SƠ CÁ NHÂN & AUDIT CHO BẢNG USERS (CỤM 2 & CỤM 10.1)
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50) DEFAULT '127.0.0.1';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NOW();

-- Cập nhật dữ liệu mẫu cho tài khoản seed V2 để giao diện hiển thị đẹp mắt
UPDATE users 
SET title = 'Principal Architect',
    bio = 'Designing robust distributed pipelines and state machines.',
    skills = '["TypeScript", "Spring Boot", "DAG", "PostgreSQL"]'::jsonb,
    links = '{"github": "https://github.com/alexkim", "linkedin": "https://linkedin.com/in/alexkim", "website": "https://alexkim.dev"}'::jsonb,
    last_login_ip = '172.16.0.42',
    last_login_at = NOW()
WHERE id = 2 AND title IS NULL;

UPDATE users 
SET title = 'Frontend Lead',
    bio = 'Building responsive and intuitive Kanban canvas interfaces.',
    skills = '["React", "TypeScript", "TailwindCSS", "Zustand"]'::jsonb,
    links = '{"github": "https://github.com/sarahchen"}'::jsonb,
    last_login_ip = '172.16.0.88',
    last_login_at = NOW()
WHERE id = 3 AND title IS NULL;

