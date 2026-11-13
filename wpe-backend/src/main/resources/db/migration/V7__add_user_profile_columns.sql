-- A5: thêm các cột hồ sơ cá nhân cho bảng users (Cụm 2 integration map).
-- Chỉ ADD COLUMN; hai cột JSONB có DEFAULT nên các dòng users đã có tự nhận '[]' và '{}'.
ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(500),
    ADD COLUMN title      VARCHAR(150),
    ADD COLUMN bio        TEXT,
    ADD COLUMN skills     JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN links      JSONB NOT NULL DEFAULT '{}'::jsonb;
