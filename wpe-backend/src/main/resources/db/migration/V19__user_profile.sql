ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(500),
    ADD COLUMN title VARCHAR(60),
    ADD COLUMN bio VARCHAR(280),
    ADD COLUMN skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN links JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN profile_privacy JSONB NOT NULL DEFAULT '{"visibility":"members","showEmail":false,"showStats":true}'::jsonb,
    ADD COLUMN public_project_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN deactivated_at TIMESTAMPTZ,
    ADD COLUMN deleted_at TIMESTAMPTZ;
