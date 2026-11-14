-- FA1: hash seed V2 không khớp Password123!. Chỉ đổi khi còn hash cũ để không ghi đè mật khẩu đã đổi.
UPDATE users
SET password_hash = '$2a$10$k3h0Yz1p9Bdt1ZD/sUHOlOQU60GO0uzP7Aj/.qDk0yrAGJbOiQGOu'
WHERE username IN ('admin', 'alex.kim', 'sarah.chen')
  AND password_hash = '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi59M117z182rWc4ZqNqQ9g2P5jX1lG';
