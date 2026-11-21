# Kế hoạch làm lại trang khách (bản chốt theo mock v6)

Thay cho phần "cách làm" trong `de-xuat-lam-lai-trang-khach.md`. Giao diện chuẩn: `docs/frontend/prototypes/guestLinkDemo-claude-v6.html` (mở với `?data=new|normal|done|large`, bật "Explain numbers" để xem cách tính từng số).

## 1. Mục tiêu và giới hạn

- Người đọc trang: giáo viên hoặc sếp chấm nhanh một dự án. Họ cần biết dự án đang tới đâu, trễ bao nhiêu, ai làm gì, bằng chứng ở đâu.
- **Sắp tới ngày chấm.** Mọi bước phải để lại một trang chạy được. Không có bước nào làm hỏng trang khách đang có.
- Không sửa database, không thêm thư viện.

## 2. Ba quyết định giữ an toàn

1. **Trang cũ là đường lùi.**
   - Trang mới viết ở thư mục riêng `src/views/guest-report/`.
   - Không sửa `GuestView.tsx` và các component của trang sửa đồ thị (`PhaseCard`, `MindmapTree`, `MacroWorkflow`, `usePanZoom`).
   - `App.tsx` thay `<GuestView />` bằng `<GuestRouteGate />`, một component mỏng:
     - Hằng `GUEST_REPORT_ENABLED` (file `src/views/guest-report/flag.ts`) là `false` thì hiện thẳng `<GuestView />`.
     - Hằng là `true` thì gọi `fetchGuestOverview(token)` một lần. Có `report` thì hiện trang mới.
     - Các trường hợp sau đều quay về `<GuestView />`, vì trang cũ đã có sẵn màn báo lỗi và màn nhập tên:
       - lỗi mạng;
       - token hỏng hoặc hết hạn;
       - backend trả `report: null`;
       - ErrorBoundary bắt được lỗi khi trang mới đang chạy.
   - Cần quay lại trang cũ thì chỉ sửa 1 dòng (đổi hằng về `false`).
2. **Backend chỉ thêm, không đổi.**
   - `GET /api/v1/guest/{token}/overview` giữ nguyên mọi trường cũ, chỉ thêm một trường `report` (mục 3).
   - Lỗi ở phần `report` thì backend ghi log và trả `report: null`. Trang cũ vẫn chạy.
   - `getGuestOverview` chạy trong `@Transactional(readOnly = true)`. Vì vậy mọi truy vấn DB đặt **ngoài** `try`, chỉ phần đổi dữ liệu nằm trong `try`. Bắt lỗi DB ngay trong transaction sẽ làm cả request lỗi `UnexpectedRollbackException`.
3. **Số liệu tính ở frontend bằng hàm thuần, có test.**
   - Backend trả dữ liệu thô: đồ thị, thành viên, artifact.
   - Frontend tính KPI, đánh giá phase, burn-up, danh sách trễ hạn, bảng thành viên trong `src/domain/guestReport.ts`. Cách tính chép lại từ hàm `prepare` và `computeMetrics` của mock v6 (cách tính đã chốt).
   - Kiểm bằng vitest trên 4 bộ dữ liệu mẫu.
   - Lý do không tính ở backend: khách vẫn xem được toàn bộ task trên trang, nên tính ở đâu cũng không lộ thêm dữ liệu. Tính ở frontend thì dùng lại được mock, test nhanh, và chỉ đổi một chỗ khi chỉnh luật.

## 3. Dữ liệu `report` (backend thêm vào overview)

```
report: {
  serverNow: Instant,
  project: { name, description, status, createdAt, linkExpiresAt },   // ProjectEntity + GuestLinkEntity.expiresAt
  graph: { phases, phaseEdges, nodes, dependencies },                  // phases/phaseEdges/dependencies như GET /projects/{id}/graph
  members: [{ id, name, role }],                                       // role: OWNER|MANAGER|COLLABORATOR|VIEWER|FORMER
  artifacts: [{ id, name, type, url, nodeId, createdAt }],             // chỉ isPublicForGuest = true, url phải là http(s)
  feedback: { total, resolved }                                        // đếm, không trả nội dung
}
```

- `graph.phases`, `phaseEdges` và `dependencies` dùng lại cách dựng của `WorkflowGraphService.getGraph`:
  - tách phần dựng thành `buildGraph(...)`, nhận danh sách phase, node và dependency đã nạp sẵn, để không truy vấn lại;
  - `getGraph` kiểm quyền rồi gọi `buildGraph`.
- `graph.nodes` dùng DTO gọn riêng cho khách:
  - gồm `id`, `phaseId`, `code`, `title`, `description`, `status`, `joinPolicy`, `assignedUserId`, `dueDate`, `estimatedHours`, `createdAt`, `completedAt`, `startedAt`, `reopenedAt`, `isOverdue`;
  - **không** có `version`, `uiMetadata`, `forceUnlockedBy`;
  - `isOverdue` tính trực tiếp từ `dueDate` và trạng thái, không đọc cột cũ.
- `members`:
  - Thành viên đã rời dự án mà vẫn còn là người được giao task thì có role `FORMER`.
  - Không trả email.
  - Bảng thành viên bỏ dòng `VIEWER` nếu người đó không có task.
- Loại artifact: frontend tự suy ra từ URL theo đúng luật của `ArtifactService.detectArtifactType`, chép sang TypeScript. Lý do: cột `type` không bao giờ rỗng, nhưng nhiều bản ghi có type sai, ví dụ Kanban mặc định là `PR`.
- Ngày dự án xong = `completedAt` muộn nhất của task, frontend tự tính khi `status = COMPLETED`. Không thêm cột.
- Response overview thêm header `Cache-Control: no-store`.

## 4. Các task và thứ tự

| Task | Việc | Ai làm | Phụ thuộc |
|---|---|---|---|
| G1 | Backend: thêm `report`, tách `buildGraph`, `Cache-Control: no-store`, test | agy Hydrogen high | — |
| G2 | Backend: khóa hạn đã qua, chặn xóa task quá hạn, API bật/tắt artifact cho khách, gộp lỗi feedback thành `INVALID_NODE` | agy Hydrogen high | G1 |
| G3 | Frontend nền: types của `report`, `domain/guestReport.ts` và test, luật nhận loại artifact, `flag.ts`, file khung `GuestPhaseExplorer.tsx` (trả về null), `apiClient` thêm `skipAuth` cho `/guest/**` | agy Hydrogen high | — |
| G4 | Frontend: `GuestRouteGate`, ErrorBoundary, trang mới gồm phần 1, 2, 3, 5 (tổng quan, lịch và hạn, đội và bằng chứng, góp ý), CSS in, nối `App.tsx` | agy Neon high | G3 |
| G5 | Frontend: phần 4 "Phases & tasks" theo 3 mức (mục 5) | agy Neon high | G3 |
| G6 | Frontend phía owner: công tắc ẩn/hiện từng artifact, báo lỗi khi đổi hạn đã khóa | agy Hydrogen high | G2 |
| G7 | Rà toàn hệ thống: chạy tool kiểm giao diện, chạy toàn bộ test, vá chỗ sót | Claude | tất cả |

- G1 và G3 chạy song song.
- G2 chạy sau G1, vì cả hai cùng sửa `WorkflowGraphService` và cùng chạy Maven. `ArtifactService` chỉ G2 được sửa.
- Đã có 4 bộ dữ liệu mẫu trong `wpe-frontend/src/domain/__fixtures__/`, gồm overview, AI và kết quả tính đúng. Các file này do mock v6 xuất ra bằng `.kb/tools/xuat-mau-trang-khach.mjs`.
- Sau G3 thì G4 và G5 chạy song song: G4 chỉ import `GuestPhaseExplorer`, không sửa file đó; G5 là người duy nhất sửa nó.

**Thứ tự ưu tiên nếu thiếu thời gian:**
1. G1, G3, G4 cùng G5 mức A: đủ một trang chấm điểm hoàn chỉnh.
2. G5 mức B, rồi G2.
3. G5 mức C, rồi G6.

## 5. Phần 4 làm theo 3 mức (đường lùi cho sơ đồ)

Mỗi mức là một trang dùng được. Làm xong và qua kiểm mức trước thì mới sang mức sau.

- **Mức A (bắt buộc), không có sơ đồ.**
  - Danh sách phase: mỗi dòng gồm tên, kết quả đánh giá, tiến độ, số artifact. Bấm vào một dòng để chọn phase.
  - Dưới đó là danh sách task của phase:
    - bộ lọc All / Late or overdue / Waiting / Has deliverable;
    - mỗi task có nhãn "Blocks N tasks";
    - bấm vào task để mở chi tiết, gồm mô tả, phụ thuộc, artifact, nút góp ý.
  - Có thêm nhóm "Tasks without a phase".
- **Mức B, có sơ đồ phase.**
  - `GuestPhaseMap` chép từ `PhaseMap` của mock v6:
    - xếp cột theo đường dài nhất;
    - cạnh nhảy cột đi theo làn dưới thẻ;
    - tự cuộn tới phase đang chọn.
  - Kéo và phóng to dùng hook riêng `useGuestPanZoom`, chép từ `useDragZoom` của mock:
    - kéo chuột để di chuyển;
    - giữ Ctrl rồi lăn chuột để phóng to;
    - lăn chuột thường vẫn cuộn trang.
- **Mức C, có sơ đồ task.**
  - Thêm nút chuyển "Task graph / Task list". `GuestTaskGraph` chép từ `layoutTaskGraph` và `TaskGraph` của mock:
    - task ở phase khác hiện dạng thẻ mờ, có nút bật/tắt;
    - cạnh đỏ cho task đang bị chặn.
  - **Điều kiện bỏ mức C:** nếu sau 1 lần trả lại mà vẫn còn lỗi giao diện hoặc lỗi test, thì dừng ở mức B và giữ chế độ Task list. Không sửa tiếp.
- **Vì sao không dùng lại `PhaseCard` và `MindmapTree` của trang sửa đồ thị:**
  - Cả hai đọc `useWorkflowStore`, nên khách không có dữ liệu trong store.
  - `PhaseCard` cố định cỡ 380x180 và vẫn vẽ cổng nối.
  - `usePanZoom` chặn mọi lần lăn chuột, nên khách không cuộn được trang.
  - `MindmapTree` có các vấn đề sau:
    - không chặn gộp task khi `readOnly`;
    - `BranchCard` tự đổi trạng thái thành LOCKED;
    - `GhostCard` đọc store;
    - `graphMapper` gán cứng `refPhase '1'`.
  - Vá chúng có nguy cơ làm hỏng trang của owner ngay trước ngày chấm. Code trong mock đã chạy đúng với cả 4 bộ dữ liệu và không đụng tới store.

## 6. Cách kiểm (không cần người dùng dò lại)

1. **Test:**
   - backend: `mvnw test` cho các lớp bị sửa;
   - frontend: `npm test`, `npm run typecheck`.
2. **Giao diện:** chạy tool `.kb/tools/kiem-giao-dien.mjs` trên `npm run dev`.
   - API được chặn và trả 4 file dữ liệu mẫu cho cả `/overview` lẫn `/ai-summary`, nên không cần backend.
   - Mỗi bộ dữ liệu chụp ở cỡ 1280, 390 và bản in.
   - Tool báo lỗi JS, tràn ngang, nút bị che, chữ chồng chữ, chữ bị cắt, chữ nhỏ hơn 10px.
   - Claude tự xem ảnh chụp, so với mock v6.
   - Một task chỉ đạt khi tool không báo lỗi nặng.
3. **Bảo mật** (G1, G7 kiểm):
   - token sai, hết hạn hoặc bị thu hồi vẫn trả đúng mã lỗi như hiện tại (ví dụ `403 REVOKED_GUEST`);
   - artifact ẩn không có trong `report`;
   - chỉ gắn link artifact khi URL bắt đầu bằng `http://` hoặc `https://`, kiểm ở cả backend lẫn frontend;
   - `nodeId` của dự án khác khi gửi góp ý trả cùng một lỗi `INVALID_NODE`;
   - nội dung AI hiển thị dạng chữ thường, không render HTML.
