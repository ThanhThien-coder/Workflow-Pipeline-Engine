## Audit Report — 27/09/2026

### Kết luận trước refactor

- **10/28 — Mockup, cần refactor.**
- `frontend/src/App.tsx` và `frontend/src/store/useWorkflowStore.ts` phụ thuộc trực tiếp vào `frontend/src/data/mockData.ts`.
- Chưa có `frontend/src/services/`, `IWorkflowService`, API implementation hoặc cơ chế `VITE_USE_MOCK`.
- Quest Map dùng tọa độ cố định và chưa có Dagre.

### Bảng kiểm định sau refactor

| Hạng mục | Đạt/Tổng | Bằng chứng |
|---|---:|---|
| 1.1 Kiến trúc phân tầng | 3/4 | `frontend/src/components/` và `frontend/src/views/` không import mock data/network; Store gọi service; một số UI state vẫn nằm trong component theo đúng phạm vi presentation. |
| 1.2 Dependency Inversion | 6/6 | `frontend/src/types/services.ts`, `frontend/src/services/mockWorkflowService.ts`, `frontend/src/services/apiWorkflowService.ts`, `frontend/src/services/index.ts`, `frontend/src/store/useWorkflowStore.ts`. |
| 1.3 Cấu trúc thư mục | 6/7 | Đã có `types`, `services`, `store`, canvas/quest-map components và các view riêng, bao gồm `OverviewView.tsx`; `components/layout/` chưa tách vì layout hiện vẫn là shell đặc thù của ứng dụng. |
| 1.4 React Flow & Dagre | 6/6 | Canvas group/parent/extent/resizer và explicit handles được giữ; Quest Map layout qua `dagre.layout()` trong `useMemo`. |
| 1.5 TypeScript & Tailwind | 5/5 | `strict: true`, không có `any`, `TaskStatus` và `JoinLogic` dùng union chuẩn. |
| **Tổng** | **26/28** | **Production-ready Base** theo ngưỡng audit; toàn bộ mục 1.2 đạt. |

### Thay đổi chính

- Mock data chỉ còn được import bởi `MockWorkflowService`.
- Store nhận `workflowService` từ factory và chịu trách nhiệm load, transition, dirty layout và save layout.
- `VITE_USE_MOCK` chọn Mock/API; `VITE_API_BASE_URL` cấu hình endpoint Spring Boot.
- Chuẩn hóa `TaskStatus` và `JoinLogic` theo domain contract.
- Quest Map tính lại vị trí bằng Dagre khi subgraph/trạng thái thay đổi.

### Kiểm tra hồi quy

- `npm run build` — **đạt**, TypeScript và Vite production build không lỗi.
- Không có test runner/test file hiện hữu trong repository; hành vi UI được giữ qua các component và store hiện tại.
- Runtime smoke check trên dev server xác nhận React Flow render đủ **6 edges ở Canvas** và **4 edges ở Quest Map**; các endpoint đều tồn tại và handle `source`/`target` khớp.
