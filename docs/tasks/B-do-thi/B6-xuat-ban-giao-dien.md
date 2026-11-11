# B6 — Xuất bản trên giao diện và đồng bộ Kahn FE/BE

Người làm: B
Người review: C
Trạng thái: chưa làm
Cần có trước: B4, B5
Cần trước bước frontend: không
Mở khóa: X1
Nhánh git: b6-publish-ui
Ước lượng: 1 ngày

> **Cập nhật 11/11/2026 (sau khi pull):** `publishPipeline` trong `HttpWorkflowService.ts` đã gọi `POST /projects/{id}/publish`, nhưng vẫn rơi về mock khi lỗi. Test Kahn backend hiện là `KahnDagServiceTest`.

> ⚡ **Chế độ sprint:** task này **để lại sau hạn nộp**, làm theo chế độ thường (xem [SPRINT_2_NGAY.md](../SPRINT_2_NGAY.md) mục 6).

## Vì sao cần task này
`publishPipeline` trên FE còn fallback ngầm, nên lỗi 422/409 từ backend có thể bị nuốt mất. FE có bản Kahn riêng ở `FE/lib/graph/kahn.ts`. Hai bản Kahn phải cho cùng kết quả, nếu không người dùng sẽ thấy FE báo hợp lệ mà BE lại báo lỗi.

## Kiến thức phải nắm
Dùng chung một bộ dữ liệu test (fixture) cho 2 ngôn ngữ, nguyên tắc "không tin client" (luôn kiểm lại ở BE), hiển thị lỗi nghiệp vụ.

## Bước 0 — Tự đọc, không dùng AI
Đọc: `FE/lib/graph/kahn.ts` và test của nó; test `KahnDagServiceTest` (B1); `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/settings/KahnCycleModal.tsx`; phần `publishPipeline` trong `FE/store/slices/settingsSlice.ts`.
Trả lời:
1. Chạy cùng một đồ thị qua `kahn.ts` và `KahnDagService`, kết quả có thể khác nhau ở đâu? (gợi ý: định nghĩa `cycleNodeCodes` ở B1)
2. FE đã kiểm chu trình rồi, vì sao BE vẫn phải kiểm?
3. Đặt fixture ở đâu để cả test Java và test TypeScript cùng đọc được?

## Được đọc
> Viết tắt: `BE/` = `wpe-backend/src/main/java/com/pipeline/wpe/`, `BE-test/` = `wpe-backend/src/test/java/com/pipeline/wpe/`, `FE/` = `wpe-frontend/src/`.
- `FE/**`, `wpe-backend/src/**`, `docs/**`

## Được ghi
- `shared/test-fixtures/dag-cases.json` (mới, ở gốc repo)
- `BE-test/service/engine/dag/**`
- `FE/lib/graph/**`
- `FE/components/settings/GeneralSettingsSection.tsx`, `FE/components/settings/KahnCycleModal.tsx`
- `FE/services/impl/http/graph.ts`, `FE/services/impl/HttpWorkflowService.ts` (chỉ `publishPipeline` và danh sách `METHODS_STILL_MOCKED`)
- `FE/store/slices/settingsSlice.ts` (**chỉ** phần `publishPipeline`; phần còn lại là của D)
- `docs/tasks/B-do-thi/B6-xuat-ban-giao-dien.md`

## Đặc tả đã chốt
- `publishPipeline` gọi `POST /projects/{id}/publish`. Gặp 422 thì `KahnCycleModal` hiển thị `cycleNodes`. Thành công thì cập nhật trạng thái ACTIVE trên màn Settings và hiện toast.
- Fixture chung `shared/test-fixtures/dag-cases.json`: mảng các case dạng `{ name, nodes, edges: [[parent, child]], expectedValid, expectedCycleNodes }`, lấy từ các case của B1. Test BE và test FE cùng đọc file này bằng đường dẫn tương đối.
- Case nào `kahn.ts` cho kết quả khác BE: sửa FE cho khớp BE (BE là chuẩn) và ghi lại case đó.

## Việc cần làm
1. 🧠 Bước 0.
2. 🧠 Chuyển các case của B1 sang file fixture JSON.
3. 🤝 Cho test BE và test FE cùng đọc fixture. Sửa `kahn.ts` nếu lệch.
4. 🤝 Nối `publishPipeline` với API thật, hiển thị modal và toast.
5. 🧠 Chạy thật: xuất bản dự án DRAFT hợp lệ; xuất bản dự án có chu trình (tạo bằng SQL như B4).

## Tiêu chí xong
- [ ] `./mvnw test` và `npm test` đều đọc cùng fixture và đều pass.
- [ ] Chạy thật: xuất bản thành công thì trạng thái thành ACTIVE; có chu trình thì modal hiện đúng mã node.

## Câu hỏi bảo vệ (người review hỏi, trả lời không nhìn code)
1. Vì sao cần fixture chung? Không có nó thì lỗi gì có thể lọt?
2. FE kiểm rồi mà BE vẫn kiểm: nêu một tình huống chỉ BE bắt được.
3. Muốn thêm một case mới cho cả hai bên thì làm những bước nào?

## Cấm
- Sửa file ngoài mục "Được ghi". File dùng chung thì báo nhóm trước (README mục 6).
- Đọc, in, commit `.env*`, khóa, mật khẩu thật, API key. Dùng `git add -f`.
- Sửa phần khác `publishPipeline` trong `settingsSlice.ts`.
- Tự ghi trạng thái `xong`. Chỉ người review ghi sau khi kiểm.

## Dành cho Claude (đọc trước khi làm)
Người dán file này là **người làm** task. Mục tiêu kép: task chạy đúng **và** người làm hiểu hết những gì đã làm.
1. Chưa sửa code vội. Yêu cầu người làm tóm tắt mục tiêu task và đọc câu trả lời Bước 0 của họ. Sai hoặc thiếu thì giải thích, rồi hỏi lại.
2. Bước 🧠: không viết hộ. Chỉ gợi ý, đặt câu hỏi dẫn dắt, chỉ chỗ sai.
3. Bước 🤝: làm từng phần nhỏ. Mỗi phần nói rõ sửa file nào, vì sao, chạy kiểm thế nào. Yêu cầu người làm tự chạy lệnh và đọc kết quả.
4. Chỉ sửa file trong "Được ghi". Cần đụng file khác, nhất là file dùng chung, thì dừng lại và nói lý do để người làm hỏi nhóm.
5. "Đặc tả đã chốt" là quyết định của nhóm, không tự đổi. Thấy đặc tả sai thì báo ra, không tự làm theo ý mình.
6. Không đọc hay in `.env*`, khóa, mật khẩu, API key.
7. Làm xong: hỏi người làm 3 câu trong "Câu hỏi bảo vệ", nhắc họ điền ghi chép bằng lời của họ, chỉ đổi trạng thái thành `chờ kiểm`.

## Ghi chép của người làm
> Viết bằng lời của bạn. Người review đọc phần này trước khi đọc code.

### Trả lời Bước 0

### Đã làm gì (file nào, vì sao)

### Kết quả test (dán output thật, không chép tay)

### Điều chưa chắc / cần nhóm quyết

## Nhật ký sprint (chế độ làm nhanh — xem `docs/tasks/SPRINT_2_NGAY.md`)
Đã học lại: chưa

- **Làm gì:**
- **File chính đã sửa:**
- **Vì sao làm vậy** (tự viết):
- **Cần học lại:**
