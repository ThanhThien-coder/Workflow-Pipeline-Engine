# FN4 — Đăng xuất thì console báo lỗi tải hồ sơ (nhỏ)

Người làm: chưa chia (đề xuất: C, vì nối tiếp FC1)
Trạng thái: chờ nhóm xem
Lỗi xử lý: L28 (phát hiện khi kiểm tay 14/11; người dùng không thấy, chỉ có trong console)
Nhánh git: fix-fn4-profile-dang-xuat
Làm trước: FC1

> Viết tắt như FN1.

## Lỗi người dùng thấy
Bấm Logout ở menu góc trên: giao diện bình thường, nhưng console có
`Failed to load profile for the header ApiError: Chưa đăng nhập.`

## Nguyên nhân (đã đọc code, sau FC1)
- `FE/components/common/GlobalProfileMenu.tsx`, `useEffect` ở dòng ~42: tải lại hồ sơ khi `currentUserId` đổi. Lúc đăng xuất, `currentUserId` đổi thành `undefined` và `profile` bị `reset()` về `null`. Effect vẫn gọi `loadProfile()`, nên `HttpProfileService.getMyProfile()` ném lỗi "Chưa đăng nhập" (đúng thiết kế FC1).

## Cách sửa (đề xuất)
1. Trong effect: không có `currentUserId` (chưa đăng nhập hoặc vừa đăng xuất) thì **không** gọi `loadProfile()`.
2. Kiểm luôn `FE/views/ProfileView.tsx` (effect tải lại khi `currentUserId` đổi) có cùng lỗi không; nếu có thì chặn tương tự.

## Được sửa
- `FE/components/common/GlobalProfileMenu.tsx`, `FE/views/ProfileView.tsx` (chỉ điều kiện trong effect), test FE

## Test phải có
- `GlobalProfileMenu` khi `currentUserId` đổi từ `'101'` sang `undefined` thì không gọi `loadProfile` (trước khi sửa phải fail).

## Kiểm bằng tay
1. Mở DevTools → Console, đăng nhập rồi Logout: không còn lỗi "Failed to load profile".

## Kết quả (Claude ghi, dán output thật)
