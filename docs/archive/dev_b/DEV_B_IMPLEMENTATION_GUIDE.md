# HƯỚNG DẪN KỸ THUẬT & KẾ HOẠCH TRIỂN KHAI TOÀN DIỆN — THÀNH VIÊN B (DEV B)
## PHÂN HỆ: DAG CANVAS, PHASE MANAGEMENT, THUẬT TOÁN KAHN & TEMPLATE STUDIO (CỤM 4 & CỤM 10.3)

> **Dành cho**: Thành viên B (Dev B)  
> **Trạng thái**: Bản đặc tả chuẩn 100% (Đã thẩm định và khớp nối hoàn toàn với SSOT & Frontend React)  
> **Tài liệu căn cứ (SSOT)**: 
> * [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md)
> * [workflow-engine.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/workflow-engine.md)
> * [database-schema.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/database-schema.md)
> * [backend-architecture.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/backend-architecture.md)

---

## 1. TỔNG QUAN PHẠM VI & SỨ MỆNH CỦA DEV B

**Dev B** chịu trách nhiệm xây dựng **"Hạ tầng Đồ thị Định hướng không Chu trình (DAG Engine)"** và quản lý toàn bộ vòng đời thiết kế quy trình trên Canvas:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PHẠM VI CỦA DEV B (SPRING BOOT 3)                         │
│                                                                                        │
│  [CỤM 4: WORKFLOW CANVAS & DAG GRAPH]          [CỤM 10.3: ADMIN TEMPLATE STUDIO]       │
│  ├── 4.1 Lấy đồ thị 2 tầng (/graph)            ├── 10.3.1 Lấy danh mục Templates       │
│  ├── 4.2 Quản lý Phân kỳ (/phases)             ├── 10.3.2 Lấy chi tiết GraphData JSONB │
│  ├── 4.3 Quản lý Nút & Cạnh (/nodes, /deps)    ├── 10.3.3 Thêm / Sửa / Xóa Template    │
│  ├── 4.4 Lưu tọa độ kéo thả JSONB (/metadata)  └── 10.3.4 Thẩm định 2-Level Kahn       │
│  └── 4.5 Kích hoạt Publish dự án (Kahn O(V+E))                                         │
│                          │                                    │                        │
│                          ▼                                    ▼                        │
│             ┌──────────────────────────────────────────────────────┐                   │
│             │          TRÁI TIM THUẬT TOÁN: KahnDagService         │                   │
│             │  - Phát hiện chu trình lặp (Cycle Detection) O(V+E)  │                   │
│             │  - Tự động mở khóa Node gốc (LOCKED ➔ TODO)          │                   │
│             │  - Thẩm định 2 tầng: Macro Phase DAG & Node DAG      │                   │
│             └──────────────────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. BẢNG PHÂN TÍCH KHỚP NỐI LOGIC VỚI HỆ THỐNG (AUDIT LOGIC CHECK)

Để đảm bảo không bị xung đột với Frontend React và các phân hệ khác, dưới đây là các điểm mấu chốt kỹ thuật đã được chuẩn hóa:

| Thành phần | Đặc điểm trong SSOT & Frontend | Quy chuẩn Backend Dev B cần tuân thủ |
| :--- | :--- | :--- |
| **URL Prefix** | Frontend có chỗ gọi `/api/...`, có chỗ gọi `/api/v1/...`. | Controller cấu hình `@RequestMapping({"/api/v1", "/api"})` để hứng cả 2 đường dẫn mà không bị 404. |
| **Field Aliasing của Phase** | Frontend [CreatePhaseModal.tsx](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-frontend/src/components/workflow/CreatePhaseModal.tsx) gửi `sub` (thay vì `subTitle`) và `accent` (thay vì `accentColor`). | DTO Dùng `@JsonAlias({"sub", "subTitle"})` và `@JsonAlias({"accent", "accentColor"})` để tương thích 100%. |
| **Lỗi Chu trình (Cycle Error)** | Frontend [KahnCycleModal.tsx](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-frontend/src/components/workflow/KahnCycleModal.tsx) chờ trường `cycleNodes` trong mã lỗi HTTP 422. | File [CycleDetectedException.java](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-backend/src/main/java/com/pipeline/wpe/exception/CycleDetectedException.java) **ĐÃ CÓ SẴN** trong `exception/`, chỉ cần ném ra là [GlobalExceptionHandler.java](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-backend/src/main/java/com/pipeline/wpe/exception/GlobalExceptionHandler.java) tự trả về HTTP 422 + `cycleNodes`. |
| **Thẩm định Template 2 Tầng** | Frontend [TemplateStudioView.tsx](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-frontend/src/features/admin/templates/TemplateStudioView.tsx) kiểm tra chu trình ở 2 tầng: Tầng Phase (`scope: 'PHASE'`) và Tầng Node (`scope: 'NODE'`). | API `POST /templates/validate` trả về DTO đúng cấu trúc `DagValidationResult` với mảng `violations`. |
| **Cascade khi Xóa Phase** | Database có `ON DELETE SET NULL`, nhưng trong JPA nếu không cập nhật memory có thể gây lỗi. | Khi xóa Phase: gán `phase_id = null` cho các Node con, gán `parent_phase_id = null` cho các Phase con trước khi xóa. |
| **Mở khóa khi Publish** | Theo `workflow-engine.md`, khi Publish thành công sang `ACTIVE`, các Node gốc (`in-degree == 0`) phải được chuyển từ `LOCKED` sang `TODO`. | Duyệt qua danh sách bậc vào (In-Degree) của Kahn; node nào có `inDegree == 0` thì cập nhật `status = TODO`. |

---

## 3. MA TRẬN 11 API CONTRACTS CHI TIẾT

Controller phụ trách:
* `WorkflowGraphController.java`: Phụ trách Cụm 4.1 – 4.5.
* `PipelineTemplateController.java`: Phụ trách Cụm 10.3.

| STT | Endpoint | Method | Phân quyền (RBAC) | Mô tả nghiệp vụ | Mã HTTP |
| :-: | :--- | :---: | :---: | :--- | :---: |
| **1** | `/projects/{id}/graph` | `GET` | Member / Owner | Lấy toàn bộ đồ thị 2 tầng (Phases, PhaseEdges, Nodes, Dependencies). | `200 OK` |
| **2** | `/projects/{id}/phases` | `POST` | Owner | Tạo mới Macro Phase (hỗ trợ `sub`, `accent`, `parentPhaseId`). | `201 Created` |
| **3** | `/projects/{id}/phases/{phaseId}` | `PUT` | Owner | Cập nhật tên, tiêu đề phụ, màu sắc, thứ tự `orderIndex`. | `200 OK` |
| **4** | `/projects/{id}/phases/{phaseId}` | `DELETE`| Owner | Xóa Phase (chuyển Node về standalone an toàn, không cascade xóa task). | `204 No Content` |
| **5** | `/projects/{id}/nodes` | `POST` | Member / Owner | Tạo Node mới (tự sinh mã code nếu thiếu, gán `LOCKED` hoặc `TODO`). | `201 Created` |
| **6** | `/projects/{id}/dependencies` | `POST` | Member / Owner | Nối cạnh phụ thuộc (chặn self-loop, chặn nối ngược 2 chiều). | `201 Created` |
| **7** | `/projects/{id}/dependencies` | `DELETE`| Member / Owner | Gỡ bỏ liên kết phụ thuộc giữa 2 Node. | `204 No Content` |
| **8** | `/nodes/{id}/metadata` | `PATCH` | Member / Owner | Lưu tọa độ kéo thả chuột Canvas vào JSONB `NODE.ui_metadata`. | `200 OK` |
| **9** | `/projects/{id}/publish` | `POST` | **Chỉ Owner** | **Chạy thuật toán Kahn**: Chặn chu trình (422) hoặc chuyển `ACTIVE` & mở khóa (200). | `200` / `422` |
| **10**| `/templates` | `GET` | Tất cả | Lấy danh mục quy trình mẫu (hỗ trợ lọc `category`, `search`, `isSystemStandard`). | `200 OK` |
| **11**| `/templates/{id}` | `GET` | Tất cả | Lấy chi tiết Template gồm toàn bộ cấu trúc `graphData` JSONB. | `200 OK` |
| **12**| `/templates` | `POST` | **Chỉ Admin** | Tạo Template mẫu mới (Kahn validate trước khi lưu). | `201 Created` |
| **13**| `/templates/{id}` | `PUT` | **Chỉ Admin** | Cập nhật Template mẫu và cấu trúc `graphData`. | `200 OK` |
| **14**| `/templates/{id}` | `DELETE`| **Chỉ Admin** | Xóa Template mẫu khỏi Catalog. | `204 No Content` |
| **15**| `/templates/validate` | `POST` | **Chỉ Admin** | Thẩm định nhanh `graphData` 2 tầng bằng Kahn trước khi lưu. | `200 OK` |

---

## 4. CHI TIẾT ĐẶC TẢ HỢP ĐỒNG API & TẤT CẢ EDGE CASES

### 4.1 Lấy toàn bộ Đồ thị Dự án (`GET /projects/{id}/graph`)
* **URL**: `GET /api/v1/projects/{id}/graph` và `GET /api/projects/{id}/graph`
* **Xử lý Backend**:
  1. Thẩm định quyền: Người gọi phải là thành viên hoặc Owner của dự án (`projectAuthorizationService.verifyProjectMemberOrOwner(projectId, callerUserId)`).
  2. Nạp danh sách `WORK_PHASE` sắp xếp theo `order_index ASC`.
  3. Nạp danh sách `NODE` thuộc dự án.
  4. Nạp danh sách `NODE_DEPENDENCY` thuộc dự án.
  5. Xây dựng mảng `phaseEdges`: với mỗi phase có `parentPhaseId != null`, tạo cặp `[parentPhaseId.toString(), phase.id.toString()]`.
* **Response DTO (`WorkflowGraphResponse.java`)**:
  ```java
  public record WorkflowGraphResponse(
      List<PhaseResponse> phases,
      List<List<String>> phaseEdges,
      List<GraphNodeResponse> nodes,
      List<DependencyResponse> dependencies
  ) {}
  ```
* **PhaseResponse.java**:
  ```java
  public record PhaseResponse(
      String id,
      String name,
      String sub,
      String accent,
      int orderIndex,
      List<String> parentPhaseIds
  ) {}
  ```
* **GraphNodeResponse.java**:
  ```java
  public record GraphNodeResponse(
      String id,
      String phaseId,
      String code,
      String title,
      String description,
      String status,
      String joinPolicy,
      String assignedUserId,
      Instant dueDate,
      Integer estimatedHours,
      Long version,
      Object uiMetadata
  ) {}
  ```

---

### 4.2 Quản lý Phân kỳ lớn (`POST/PUT/DELETE /projects/{id}/phases`)
* **Tạo Phase mới (`POST /projects/{id}/phases`)**:
  - Request DTO (`CreatePhaseRequest.java`):
    ```java
    public record CreatePhaseRequest(
        @NotBlank(message = "Tên Phase không được để trống")
        String name,
        
        @JsonAlias({"sub", "subTitle"})
        String sub,
        
        @JsonAlias({"accent", "accentColor"})
        String accent,
        
        Long parentPhaseId,
        Integer orderIndex
    ) {}
    ```
  - **Edge Cases**:
    - Nếu `accent` để trống: mặc định gán `"slate"`.
    - Nếu `orderIndex` để trống: tự động gán bằng `MAX(order_index) + 1` trong dự án.
    - Nếu `parentPhaseId` được truyền: kiểm tra Phase cha phải thuộc về cùng dự án.
  - Trả về `PhaseResponse` với mã HTTP `201 Created`.

* **Xóa Phase an toàn (`DELETE /projects/{id}/phases/{phaseId}`)**:
  - **Edge Case chống lỗi Foreign Key Constraint**:
    1. Tìm tất cả Node có `phase_id == phaseId` ➔ cập nhật `phase_id = null` (chuyển thành các task độc lập Standalone, không xóa mất công việc của thành viên).
    2. Tìm tất cả Phase con có `parent_phase_id == phaseId` ➔ cập nhật `parent_phase_id = null`.
    3. Xóa bản ghi `WORK_PHASE`. Trả về `204 No Content`.

---

### 4.3 Quản lý Nút & Nối Cạnh (`/projects/{id}/nodes`, `/dependencies`)
* **Thêm Node mới (`POST /projects/{id}/nodes`)**:
  - Request DTO (`CreateNodeRequest.java`):
    ```java
    public record CreateNodeRequest(
        Long phaseId,
        String code,
        @NotBlank(message = "Tiêu đề công việc không được để trống")
        String title,
        String description,
        String joinPolicy, // "ALL_COMPLETED" (mặc định) hoặc "ANY_COMPLETED"
        Long assignedUserId,
        Instant dueDate,
        Integer estimatedHours,
        Object uiMetadata
    ) {}
    ```
  - **Edge Cases**:
    - **Tự động sinh mã `code`**: Nếu `code` để trống, Backend tự động sinh mã dạng `WPE-` + format 3 số (ví dụ đếm số node hiện có + 1 để ra `WPE-005`).
    - **Kiểm tra trùng mã**: Nếu `code` đã tồn tại trong dự án đó, ném ngoại lệ `ConflictException("DUPLICATE_NODE_CODE", "Mã công việc '" + code + "' đã tồn tại trong dự án.")` (HTTP 409).
    - **Trạng thái ban đầu**:
      - Nếu `phaseId == null` (Task độc lập): gán `status = TODO`.
      - Nếu thuộc Phase: gán `status = LOCKED` (chờ nghiệm thu hoặc chạy Publish).
    - **UI Metadata khởi tạo**: Nếu client không truyền `uiMetadata`, gán mặc định `Map.of("position", Map.of("x", 200, "y", 150))`.

* **Nối Cạnh Phụ Thuộc (`POST /projects/{id}/dependencies`)**:
  - Request DTO (`CreateDependencyRequest.java`):
    ```java
    public record CreateDependencyRequest(
        @NotNull Long parentNodeId,
        @NotNull Long childNodeId
    ) {}
    ```
  - **Edge Cases**:
    - **Tự nối vào chính mình**: Nếu `parentNodeId.equals(childNodeId)` ➔ ném `BadRequestException("SELF_DEPENDENCY_NOT_ALLOWED", "Không thể nối một công việc phụ thuộc vào chính nó.")` (HTTP 400).
    - **Nối chéo dự án**: Kiểm tra cả 2 node phải thuộc cùng một `projectId`. Nếu khác nhau ➔ ném `BadRequestException("CROSS_PROJECT_NOT_ALLOWED", "Hai công việc phải thuộc cùng một dự án.")` (HTTP 400).
    - **Cạnh đã tồn tại (Idempotency)**: Nếu cặp `(parent, child)` đã tồn tại trong CSDL ➔ trả về `200 OK` hoặc `201 Created` luôn, không ném lỗi sập màn hình.
    - **Chặn chu trình 2 chiều tức thì**: Nếu đã tồn tại cạnh ngược `(child -> parent)` trong CSDL, việc thêm cạnh `(parent -> child)` sẽ tạo vòng lặp 2 đỉnh ngay lập tức ➔ ném `CycleDetectedException("Phát hiện chu trình lặp phụ thuộc 2 chiều.", List.of(parentNode.getCode(), childNode.getCode()))` (HTTP 422).

---

### 4.4 Lưu Tọa Độ Canvas vào JSONB (`PATCH /nodes/{id}/metadata`)
* **Endpoint**: `PATCH /api/v1/nodes/{id}/metadata`
* **Request DTO (`UpdateNodeMetadataRequest.java`)**:
  ```java
  public record UpdateNodeMetadataRequest(
      @NotNull Map<String, Object> metadata
  ) {}
  ```
* **Xử lý Backend**:
  1. Tìm Node theo `id`. Nếu không thấy ném `ResourceNotFoundException`.
  2. Gán `node.setUiMetadata(request.metadata())`.
  3. Lưu entity `nodeRepository.save(node)`.
  4. Trả về `200 OK` kèm `GraphNodeResponse`.

---

### 4.5 Kích Hoạt Dự Án & Thuật toán Kahn (`POST /projects/{id}/publish`)
* **Endpoint**: `POST /api/v1/projects/{id}/publish`
* **Phân quyền**: Bắt buộc là Chủ dự án (`OWNER`). Nếu người khác gọi ➔ ném `ForbiddenException` (HTTP 403).
* **Quy trình Thực thi Chi tiết**:
  ```text
  1. Kiểm tra trạng thái dự án: Nếu đã là ACTIVE, ném BadRequestException("Dự án đã được xuất bản trước đó.").
  2. Nạp toàn bộ danh sách Node trong dự án (N nodes).
  3. Nạp toàn bộ danh sách NodeDependency trong dự án.
  4. Chạy Thuật toán Kahn:
     - Tính In-Degree cho từng Node.
     - Khởi tạo Queue gồm các Node có In-Degree == 0.
     - Duyệt BFS, đếm visitedCount, giảm In-Degree của các node con.
  5. Đánh giá:
     - NẾU visitedCount < N:
       => TỒN TẠI CHU TRÌNH LẶP!
       => Thu thập các Node còn In-Degree > 0 (ví dụ: ["WPE-002", "WPE-004"]).
       => Ném CycleDetectedException(message, cycleCodes).
       => GlobalExceptionHandler bắt lỗi và trả về HTTP 422 Unprocessable Entity!
     - NẾU visitedCount == N:
       => ĐỒ THỊ DAG HỢP LỆ HOÀN TOÀN!
       => Cập nhật PROJECT: status = 'ACTIVE', updated_at = NOW().
       => Tự động MỞ KHÓA các Node gốc (inDegree ban đầu == 0):
          Nếu đang là LOCKED ➔ chuyển sang TODO (bàn giao cho Dev C hiển thị trên My Tasks).
       => Lưu toàn bộ các Node thay đổi trạng thái vào DB.
       => Trả về HTTP 200 OK kèm PublishPipelineResponse.
  ```

* **Response Thành công (`PublishPipelineResponse.java`)**:
  ```java
  public record PublishPipelineResponse(
      boolean success,
      String status, // "ACTIVE"
      Instant publishedAt,
      int unlockedTaskCount
  ) {}
  ```

---

### 4.6 Template Studio & Validate Đồ thị Mẫu (Cụm 10.3)
* **Lấy danh mục Template (`GET /api/v1/templates`)**:
  - Query Params: `category` (All, Software Engineering, Marketing, DevOps & Infra, General), `search`, `isSystemStandard`.
  - Response DTO (`TemplateSummaryResponse.java`):
    ```java
    public record TemplateSummaryResponse(
        String id,
        String name,
        String description,
        String category,
        boolean isSystemStandard,
        int phaseCount,
        int nodeCount,
        int cloneCount,
        String createdBy,
        Instant createdAt,
        Instant updatedAt
    ) {}
    ```
* **Lấy chi tiết Template (`GET /api/v1/templates/{id}`)**:
  - Response DTO (`TemplateDetailResponse.java`): kế thừa các trường Summary + trường `Map<String, Object> graphData`.
* **Thẩm định Đồ thị Mẫu 2 Tầng (`POST /api/v1/templates/validate`)**:
  - Frontend [TemplateStudioView.tsx](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/wpe-frontend/src/features/admin/templates/TemplateStudioView.tsx) gửi payload `graphData` và đợi kết quả cấu trúc:
  - **Response DTO (`DagValidationResponse.java`)**:
    ```java
    public record DagValidationResponse(
        boolean valid,
        int visitedCount,
        int totalCount,
        List<DagViolationItem> violations
    ) {
        public record DagViolationItem(
            String scope, // "PHASE" hoặc "NODE"
            String phaseId,
            List<String> nodeIds
        ) {}
    }
    ```

---

## 5. CÀI ĐẶT MẪU CHUẨN: `KahnDagService.java`

Đây là file xử lý thuật toán cốt lõi. Bạn chỉ việc đặt tại `service/engine/KahnDagService.java`:

```java
package com.pipeline.wpe.service.engine;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class KahnDagService {

    public record ProjectKahnResult(
        boolean isValid,
        int visitedCount,
        int totalNodes,
        Set<Long> rootNodeIds,       // Các node có in-degree ban đầu == 0 (cần mở khóa)
        List<String> cycleNodeCodes   // Mã các node bị kẹt trong chu trình lặp (nếu có)
    ) {}

    /**
     * Thẩm định đồ thị dự án khi Publish Pipeline (O(V + E))
     */
    public ProjectKahnResult validateProjectDag(List<NodeEntity> nodes, List<NodeDependencyEntity> dependencies) {
        if (nodes == null || nodes.isEmpty()) {
            return new ProjectKahnResult(true, 0, 0, Collections.emptySet(), Collections.emptyList());
        }

        Map<Long, Integer> inDegree = new HashMap<>();
        Map<Long, List<Long>> adjacencyList = new HashMap<>();
        Map<Long, String> nodeCodeMap = new HashMap<>();

        for (NodeEntity node : nodes) {
            inDegree.put(node.getId(), 0);
            adjacencyList.put(node.getId(), new ArrayList<>());
            nodeCodeMap.put(node.getId(), node.getCode());
        }

        for (NodeDependencyEntity dep : dependencies) {
            Long parent = dep.getParentNodeId();
            Long child = dep.getChildNodeId();

            if (inDegree.containsKey(child)) {
                inDegree.put(child, inDegree.get(child) + 1);
            }
            if (adjacencyList.containsKey(parent)) {
                adjacencyList.get(parent).add(child);
            }
        }

        // Tìm các node gốc ban đầu (In-Degree == 0)
        Set<Long> rootNodeIds = new HashSet<>();
        Queue<Long> queue = new ArrayDeque<>();
        for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                rootNodeIds.add(entry.getKey());
                queue.add(entry.getKey());
            }
        }

        int visitedCount = 0;
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            visitedCount++;

            List<Long> neighbors = adjacencyList.getOrDefault(current, Collections.emptyList());
            for (Long neighbor : neighbors) {
                int newDegree = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, newDegree);
                if (newDegree == 0) {
                    queue.add(neighbor);
                }
            }
        }

        boolean isValid = (visitedCount == nodes.size());
        List<String> cycleNodeCodes = new ArrayList<>();

        if (!isValid) {
            for (Map.Entry<Long, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() > 0) {
                    cycleNodeCodes.add(nodeCodeMap.getOrDefault(entry.getKey(), "NODE-" + entry.getKey()));
                }
            }
            log.warn("Kahn Cycle Detected in project: {} cycle nodes: {}", cycleNodeCodes.size(), cycleNodeCodes);
        }

        return new ProjectKahnResult(isValid, visitedCount, nodes.size(), rootNodeIds, cycleNodeCodes);
    }

    /**
     * Thuật toán Kahn cơ bản cho tập đỉnh và tập cạnh (Dùng cho Template Studio 2 tầng)
     */
    public KahnBasicResult validateGraph(Collection<String> vertices, Collection<Map.Entry<String, String>> edges) {
        Map<String, Integer> inDegree = new HashMap<>();
        Map<String, List<String>> adj = new HashMap<>();
        Set<String> vertexSet = new HashSet<>(vertices);

        for (String v : vertices) {
            inDegree.put(v, 0);
            adj.put(v, new ArrayList<>());
        }

        for (Map.Entry<String, String> edge : edges) {
            String from = edge.getKey();
            String to = edge.getValue();
            if (vertexSet.contains(from) && vertexSet.contains(to)) {
                inDegree.put(to, inDegree.get(to) + 1);
                adj.get(from).add(to);
            }
        }

        Queue<String> queue = new ArrayDeque<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        int visited = 0;
        while (!queue.isEmpty()) {
            String u = queue.poll();
            visited++;
            for (String neighbor : adj.getOrDefault(u, Collections.emptyList())) {
                int next = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, next);
                if (next == 0) {
                    queue.add(neighbor);
                }
            }
        }

        List<String> cycleNodes = new ArrayList<>();
        if (visited != vertices.size()) {
            for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() > 0) {
                    cycleNodes.add(entry.getKey());
                }
            }
        }

        return new KahnBasicResult(visited == vertices.size(), visited, vertices.size(), cycleNodes);
    }

    public record KahnBasicResult(boolean isValid, int visitedCount, int totalCount, List<String> cycleNodes) {}
}
```

---

## 6. DANH SÁCH FILE BLUEPRINT DEV B CẦN VIẾT

Toàn bộ Entity JPA và Repository đã có sẵn. Bạn chỉ cần viết các file sau:

### 📁 6.1 Tầng Controller (2 files):
1. `controller/WorkflowGraphController.java` (`@RequestMapping({"/api/v1", "/api"})`)
2. `controller/PipelineTemplateController.java` (`@RequestMapping({"/api/v1", "/api"})`)

### 📁 6.2 Tầng Service (3 files):
1. `service/engine/KahnDagService.java` (Thuật toán Kahn đã code mẫu ở Mục 5)
2. `service/WorkflowGraphService.java` (Điều phối Phase, Node, Dependency, Publish)
3. `service/PipelineTemplateService.java` (CRUD Template & thẩm định 2 tầng)

### 📁 6.3 Tầng Exception:
* File `exception/CycleDetectedException.java` **ĐÃ CÓ SẴN** (không cần tạo mới).
* File `exception/ConflictException.java` **ĐÃ CÓ SẴN** (dùng khi trùng code).
* File `exception/ResourceNotFoundException.java` **ĐÃ CÓ SẴN**.

### 📁 6.4 Tầng DTO Requests (6 files Java record):
1. `dto/request/graph/CreatePhaseRequest.java` (hỗ trợ `@JsonAlias({"sub", "subTitle"})`)
2. `dto/request/graph/UpdatePhaseRequest.java`
3. `dto/request/graph/CreateNodeRequest.java`
4. `dto/request/graph/CreateDependencyRequest.java`
5. `dto/request/graph/UpdateNodeMetadataRequest.java`
6. `dto/request/template/CreateTemplateRequest.java`

### 📁 6.5 Tầng DTO Responses (6 files Java record):
1. `dto/response/graph/WorkflowGraphResponse.java`
2. `dto/response/graph/PhaseResponse.java`
3. `dto/response/graph/GraphNodeResponse.java`
4. `dto/response/graph/PublishPipelineResponse.java`
5. `dto/response/template/TemplateSummaryResponse.java`
6. `dto/response/template/DagValidationResponse.java`

---

## 7. LỘ TRÌNH 5 BƯỚC THỰC HIỆN KHÔNG THỂ SAI

```text
[BƯỚC 1: TẠO DTOs & SERVICE KAHN]
  - Viết KahnDagService.java theo Mục 5.
  - Tạo các DTO Request & Response (đầy đủ @JsonAlias).
       │
       ▼
[BƯỚC 2: VIẾT WORKFLOW GRAPH SERVICE]
  - Triển khai getGraph(projectId), createPhase, updatePhase, deletePhase.
  - Triển khai createNode, createDependency, updateMetadata.
       │
       ▼
[BƯỚC 3: TRIỂN KHAI LOGIC PUBLISH PIPELINE]
  - Gọi KahnDagService.validateProjectDag().
  - Nếu isValid == false: ném new CycleDetectedException("...", cycleNodeCodes).
  - Nếu isValid == true: update project.status = ACTIVE, mở khóa các root nodes sang TODO.
       │
       ▼
[BƯỚC 4: VIẾT TEMPLATE SERVICE]
  - CRUD PIPELINE_TEMPLATE (đọc/ghi JSONB graphData).
  - Validate template 2 tầng với KahnBasicResult.
       │
       ▼
[BƯỚC 5: MỞ SWAGGER UI KIỂM THỬ TRỰC TIẾP]
  - Mở: http://localhost:8080/swagger-ui.html
  - Test GET /api/v1/projects/1/graph xem có ra dữ liệu Core Banking không.
  - Thử nối ngược WPE-004 ➔ WPE-001 rồi gọi /publish để ngắm mã lỗi 422 CYCLE_DETECTED!
```
