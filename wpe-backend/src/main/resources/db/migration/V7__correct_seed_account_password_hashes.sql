-- The V2 seed hash did not match the documented Password123! credential.
-- Only replace rows that still have that original demo hash, preserving any
-- seed account password changed by a developer after initial setup.
UPDATE users
SET password_hash = '$2a$12$XbYBBKDYLYyOv8i8OZ5th.2QMUOLY3JWBGScxooJWHiphRWfD8y8O'
WHERE username IN ('admin', 'alex.kim', 'sarah.chen')
  AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG';
