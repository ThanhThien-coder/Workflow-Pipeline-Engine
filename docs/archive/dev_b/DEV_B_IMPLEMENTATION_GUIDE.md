# HƯỚNG DẪN KỸ THUẬT & KẾ HOẠCH TRIỂN KHAI — THÀNH VIÊN B (DEV B)
## PHÂN HỆ: DAG CANVAS, PHASE MANAGEMENT, THUẬT TOÁN KAHN & TEMPLATE STUDIO (CỤM 4 & CỤM 10.3)

> **Dành cho**: Thành viên B (Dev B)  
> **Trạng thái**: Kế hoạch chi tiết & Tài liệu hướng dẫn thực chiến  
> **Tài liệu căn cứ (SSOT)**: 
> * [FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md)
> * [workflow-engine.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/workflow-engine.md)
> * [database-schema.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/database-schema.md)
> * [backend-architecture.md](file:///c:/Users/Minh%20Dang/Desktop/Ky_thuat_phan_mem/nam_3/HKI/OOAD/PROJECT/Workflow-Pipeline-Engine/docs/specs/backend-architecture.md)

---

## 1. TỔNG QUAN PHẠM VI CÔNG VIỆC CỦA DEV B

Theo phân công trong đội ngũ, **Dev B** nắm giữ phần "linh hồn đồ thị" của dự án Workflow Pipeline Engine:
1. **Quản lý Đồ thị Quy trình 2 tầng (Dual-View DAG Canvas - Cụm 4)**:
   * **Tầng Macro**: Quản lý các Phân kỳ lớn (`WORK_PHASE`), thứ tự `order_index`, màu sắc (`accent_color`) và quan hệ phụ thuộc cha-con giữa các Phase.
   * **Tầng Micro**: Quản lý nút công việc (`NODE`), gán Phase, chính sách hội tụ `join_policy` (`ALL_COMPLETED` / `ANY_COMPLETED`), và nối các cạnh phụ thuộc (`NODE_DEPENDENCY`).
   * **Lưu tọa độ Canvas**: Cập nhật tọa độ vị trí kéo thả (`x, y, w, h, color`) vào trường JSONB `NODE.ui_metadata`.
2. **Trái tim Thuật toán Kahn (Topological Sorting & Cycle Detection - O(V+E))**:
   * Xây dựng thuật toán Kahn để kiểm tra tính toàn vẹn của đồ thị có hướng (DAG).
   * Áp dụng khi kích hoạt dự án từ `DRAFT` sang `ACTIVE` (`POST /api/v1/projects/{id}/publish`): nếu phát hiện vòng lặp kín ($A \to B \to C \to A$), chặn đứng và ném lỗi HTTP `422 Unprocessable Entity` kèm danh sách `cycleNodes` vi phạm.
   * Khi hợp lệ: tự động mở khóa các Node gốc (`in-degree == 0`) từ `LOCKED` sang `TODO`.
3. **Quản trị Quy trình Mẫu Hệ thống (Admin Template Studio - Cụm 10.3)**:
   * CRUD kho mẫu quy trình (`PIPELINE_TEMPLATE`) với danh mục đa dạng (Software Engineering, DevOps, Marketing, General).
   * Lưu trữ cấu trúc đồ thị mẫu 2 tầng vào cột JSONB `PIPELINE_TEMPLATE.graph_data`.
   * Tái sử dụng thuật toán Kahn để thẩm định đồ thị mẫu (`POST /api/v1/templates/validate`) trước khi lưu.

---

## 2. MA TRẬN 11 API CẦN TRIỂN KHAI (API CONTRACTS)

| STT | Phân hệ | HTTP Method | Endpoint URL | RBAC / Quyền | Mục đích nghiệp vụ | Status Code |
| :-: | :--- | :---: | :--- | :---: | :--- | :---: |
| **1** | Cụm 4.1 | `GET` | `/api/v1/projects/{id}/graph` | `MEMBER` / `OWNER` | Lấy toàn bộ đồ thị 2 tầng (Phases, PhaseEdges, Nodes, Dependencies). | `200 OK` |
| **2** | Cụm 4.2 | `POST` | `/api/v1/projects/{id}/phases` | `OWNER` | Tạo mới một Macro Phase (gán màu, tên, phase cha). | `201 Created` |
| **3** | Cụm 4.2 | `PUT` | `/api/v1/projects/{id}/phases/{phaseId}` | `OWNER` | Cập nhật thông tin và thứ tự hiển thị `order_index` của Phase. | `200 OK` |
| **4** | Cụm 4.2 | `DELETE`| `/api/v1/projects/{id}/phases/{phaseId}` | `OWNER` | Xóa Phase (chuyển Node con thành standalone an toàn). | `204 No Content` |
| **5** | Cụm 4.3 | `POST` | `/api/v1/projects/{id}/nodes` | `MEMBER` / `OWNER` | Tạo Node mới trên Canvas (sinh mã code, trạng thái khởi tạo). | `201 Created` |
| **6** | Cụm 4.3 | `POST` | `/api/v1/projects/{id}/dependencies` | `MEMBER` / `OWNER` | Nối cạnh phụ thuộc giữa 2 Node (`parentNodeId` -> `childNodeId`). | `201 Created` |
| **7** | Cụm 4.3 | `DELETE`| `/api/v1/projects/{id}/dependencies` | `MEMBER` / `OWNER` | Gỡ bỏ dây nối phụ thuộc giữa 2 Node. | `204 No Content` |
| **8** | Cụm 4.4 | `PATCH`| `/api/v1/nodes/{id}/metadata` | `MEMBER` / `OWNER` | Lưu tọa độ kéo thả Canvas vào JSONB `ui_metadata`. | `200 OK` |
| **9** | Cụm 4.5 | `POST` | `/api/v1/projects/{id}/publish` | **`OWNER` (Strict)** | **Chạy thuật toán Kahn**: Chặn chu trình lặp (422) hoặc kích hoạt sang `ACTIVE` (200). | `200` / `422` |
| **10**| Cụm 10.3| `GET` | `/api/v1/templates` | Public / `USER` | Lấy danh mục quy trình mẫu (hỗ trợ lọc theo `category`, `search`). | `200 OK` |
| **11**| Cụm 10.3| `GET` | `/api/v1/templates/{id}` | Public / `USER` | Lấy chi tiết Template gồm toàn bộ cấu trúc `graphData` JSONB. | `200 OK` |
| **12**| Cụm 10.3| `POST` | `/api/v1/templates` | `ADMIN` | Tạo template mẫu mới (Kahn validate đồ thị `graphData` trước khi lưu). | `201 Created` |
| **13**| Cụm 10.3| `PUT` | `/api/v1/templates/{id}` | `ADMIN` | Cập nhật template mẫu và cấu trúc `graphData`. | `200 OK` |
| **14**| Cụm 10.3| `DELETE`| `/api/v1/templates/{id}` | `ADMIN` | Xóa template mẫu khỏi catalog hệ thống. | `204 No Content` |
| **15**| Cụm 10.3| `POST` | `/api/v1/templates/validate` | `ADMIN` | Kiểm tra tính hợp lệ của `graphData` bằng Kahn trước khi lưu. | `200 OK` |

---

## 3. CHI TIẾT ĐẶC TẢ TỪNG CHỨC NĂNG & DTO CHUẨN (SSOT CONTRACTS)

### 3.1 Cụm 4.1: Lấy cấu trúc Đồ thị 2 tầng (`GET /api/v1/projects/{id}/graph`)
* **Mục tiêu**: Frontend gọi API này để render toàn bộ sơ đồ Canvas (các cột Phân kỳ Macro, các thẻ Node bên trong từng cột, và các đường cong Bézier kết nối giữa các Node).
* **Bảng CSDL tác động**: `WORK_PHASE`, `NODE`, `NODE_DEPENDENCY`.
* **Response DTO (`WorkflowGraphResponse.java`)**:
  ```java
  public record WorkflowGraphResponse(
      List<PhaseResponse> phases,
      List<List<String>> phaseEdges, // e.g. [["p1", "p2"]]
      List<GraphNodeResponse> nodes,
      List<DependencyResponse> dependencies
  ) {}
  ```
* **Chi tiết PhaseResponse**:
  ```java
  public record PhaseResponse(
      Long id,
      String name,
      String subTitle,
      String accentColor,
      int orderIndex,
      List<Long> parentPhaseIds
  ) {}
  ```
* **Chi tiết GraphNodeResponse**:
  ```java
  public record GraphNodeResponse(
      Long id,
      Long phaseId,
      String code,
      String title,
      String status,
      String joinPolicy,
      Long assignedUserId,
      Instant dueDate,
      Object uiMetadata
  ) {}
  ```
* **Chi tiết DependencyResponse**:
  ```java
  public record DependencyResponse(
      Long parentNodeId,
      Long childNodeId
  ) {}
  ```

---

### 3.2 Cụm 4.2: Thêm / Sửa / Xóa Macro Phase (`WORK_PHASE`)
* **Bảng CSDL tác động**: `WORK_PHASE`.
* **Tạo Phase mới (`POST /api/v1/projects/{id}/phases`)**:
  - Request DTO (`CreatePhaseRequest.java`):
    ```java
    public record CreatePhaseRequest(
        @NotBlank(message = "Tên giai đoạn không được để trống")
        String name,
        String subTitle,
        @Pattern(regexp = "^(emerald|blue|slate|violet|amber|rose)$", message = "Màu sắc không hợp lệ")
        String accentColor,
        Long parentPhaseId,
        Integer orderIndex
    ) {}
    ```
  - Logic Backend:
    1. Kiểm tra caller có quyền `OWNER` trong dự án (gọi qua `ProjectAuthorizationService`).
    2. Chèn bản ghi vào bảng `WORK_PHASE`.
    3. Trả về `PhaseResponse` với mã HTTP `201 Created`.
* **Cập nhật Phase (`PUT /api/v1/projects/{id}/phases/{phaseId}`)**:
  - Request DTO (`UpdatePhaseRequest.java`):
    ```java
    public record UpdatePhaseRequest(
        @NotBlank String name,
        String subTitle,
        String accentColor,
        Integer orderIndex
    ) {}
    ```
* **Xóa Phase (`DELETE /api/v1/projects/{id}/phases/{phaseId}`)**:
  - Chuyển toàn bộ các Node đang thuộc `phaseId` về `phase_id = NULL` (thành các task độc lập) trước khi xóa Phase để tránh lỗi khóa ngoại Foreign Key Constraint.
  - Xóa bản ghi `WORK_PHASE`. Trả về `204 No Content`.

---

### 3.3 Cụm 4.3: Thêm Node & Nối cạnh phụ thuộc (`NODE_DEPENDENCY`)
* **Thêm Node mới (`POST /api/v1/projects/{id}/nodes`)**:
  - Request DTO (`CreateNodeRequest.java`):
    ```java
    public record CreateNodeRequest(
        Long phaseId, // nullable nếu là standalone task
        @NotBlank(message = "Mã node không được để trống")
        String code,  // e.g. "WPE-005"
        @NotBlank(message = "Tiêu đề node không được để trống")
        String title,
        String description,
        String joinPolicy, // "ALL_COMPLETED" hoặc "ANY_COMPLETED"
        Long assignedUserId,
        Instant dueDate,
        Integer estimatedHours
    ) {}
    ```
  - Logic Backend:
    1. Kiểm tra mã `code` là duy nhất trong dự án (`project_id` + `code`). Nếu trùng ném lỗi `400 DUPLICATE_NODE_CODE`.
    2. Gán trạng thái khởi tạo: Nếu task độc lập (`phaseId == null`) ➔ gán `status = 'TODO'`. Nếu thuộc Phase hoặc chưa kết nối ➔ gán `status = 'LOCKED'`.
    3. Gán `version = 0` (Optimistic locking cho Dev C).
    4. Trả về `GraphNodeResponse` với mã `201 Created`.

* **Nối cạnh phụ thuộc (`POST /api/v1/projects/{id}/dependencies`)**:
  - Request DTO (`CreateDependencyRequest.java`):
    ```java
    public record CreateDependencyRequest(
        @NotNull Long parentNodeId,
        @NotNull Long childNodeId
    ) {}
    ```
  - Logic Backend:
    1. Kiểm tra `parentNodeId != childNodeId` (không cho phép tự nối vào chính mình, nếu vi phạm ném `400 SELF_DEPENDENCY_NOT_ALLOWED`).
    2. Kiểm tra cả 2 node đều thuộc về cùng một `project_id`.
    3. Kiểm tra cặp `(parent_node_id, child_node_id)` chưa từng tồn tại trong bảng `NODE_DEPENDENCY`.
    4. Chèn vào `NODE_DEPENDENCY`. Trả về `201 Created`.

* **Xóa cạnh phụ thuộc (`DELETE /api/v1/projects/{id}/dependencies`)**:
  - Query Params: `?parentNodeId=1&childNodeId=3`.
  - Xóa liên kết khỏi `NODE_DEPENDENCY`. Trả về `204 No Content`.

---

### 3.4 Cụm 4.4: Lưu tọa độ Canvas vào JSONB (`PATCH /api/v1/nodes/{id}/metadata`)
* **Mục tiêu**: Khi người dùng kéo thả thẻ Node trên giao diện và thả chuột, Frontend bắn tọa độ để lưu lại vị trí vẽ.
* **Bảng CSDL tác động**: `NODE.ui_metadata` (Cột JSONB).
* **Request DTO (`UpdateNodeMetadataRequest.java`)**:
  ```java
  public record UpdateNodeMetadataRequest(
      @NotNull Object metadata // Object chứa position: {x, y}, width, height, color
  ) {}
  ```
* **Logic Backend**:
  1. Tìm Node theo `id`. Nếu không thấy ném `404 RESOURCE_NOT_FOUND`.
  2. Gán `node.setUiMetadata(request.metadata())`.
  3. Lưu entity `NodeRepository.save(node)`.
  4. Trả về `200 OK` kèm `GraphNodeResponse`.

---

### 3.5 Cụm 4.5: Kích hoạt dự án & Chạy thuật toán Kahn (`POST /api/v1/projects/{id}/publish`)
* **Mục tiêu Nghiệp vụ**: Đây là chốt chặn quan trọng nhất của Dev B! Khi Project Owner bấm nút **"Publish Pipeline"** trên giao diện Settings, Backend phải kiểm tra đồ thị quy trình. Nếu đồ thị bị vòng lặp kín (chu trình), tuyệt đối không cho phép vận hành.
* **Quyền hạn**: Duy nhất Chủ dự án (`OWNER`) mới được quyền publish.
* **Quy trình xử lý của Thuật toán Kahn**:
  ```text
  1. Lấy toàn bộ Nodes thuộc project_id (tập đỉnh V, số lượng N).
  2. Lấy toàn bộ Dependencies thuộc project_id (tập cạnh E).
  3. Khởi tạo In-Degree (Bậc vào) cho từng node:
     - inDegree[nodeId] = số lượng cạnh trỏ trực tiếp vào nodeId.
  4. Đưa tất cả node có inDegree == 0 vào hàng đợi (Queue).
  5. Khởi tạo visitedCount = 0.
  6. Trong khi Queue không rỗng:
     - Lấy node u ra khỏi Queue.
     - Tăng visitedCount lên 1.
     - Với mỗi node v là con của u (cạnh u -> v):
       + Giảm inDegree[v] -= 1.
       + Nếu inDegree[v] == 0: Đưa v vào Queue.
  7. Đánh giá kết quả:
     - NẾU visitedCount < N:
       => TỒN TẠI CHU TRÌNH LẶP (CYCLE DETECTED)!
       => Thu thập các node còn inDegree > 0 (các node bị kẹt trong vòng lặp kín).
       => Ném ngoại lệ CycleDetectedException(cycleNodeCodes).
       => GlobalExceptionHandler bắt lỗi và trả về HTTP 422 Unprocessable Entity!
     - NẾU visitedCount == N:
       => ĐỒ THỊ DAG HỢP LỆ 100%!
       => Cập nhật PROJECT.status = 'ACTIVE'.
       => Mở khóa các Node có inDegree ban đầu == 0 từ LOCKED -> TODO.
       => Trả về HTTP 200 OK kèm số lượng task đã mở khóa.
  ```

* **Cấu trúc Response khi Thành công (`200 OK`)**:
  ```java
  public record PublishPipelineResponse(
      boolean success,
      String status, // "ACTIVE"
      Instant publishedAt,
      int unlockedTaskCount
  ) {}
  ```
* **Cấu trúc Response khi Thất bại do có chu trình (`422 Unprocessable Entity`)**:
  ```json
  {
    "timestamp": "2026-10-23T11:00:00Z",
    "status": 422,
    "error": "CYCLE_DETECTED",
    "message": "Phát hiện chu trình lặp phụ thuộc trong đồ thị quy trình. Không thể xuất bản.",
    "cycleNodes": ["WPE-002", "WPE-004"]
  }
  ```
  *(Khi nhận mã lỗi 422 này, Frontend sẽ tự động mở modal `KahnCycleModal.tsx` và đánh dấu đỏ các Node bị lỗi).*

---

### 3.6 Cụm 10.3: Quản trị Template Studio (`PIPELINE_TEMPLATE`)
* **Bảng CSDL tác động**: `PIPELINE_TEMPLATE`.
* **Lấy danh sách Template (`GET /api/v1/templates`)**:
  - Hỗ trợ Query Params: `?category=Software Engineering&search=agile`.
  - Response DTO (`TemplateSummaryResponse.java`):
    ```java
    public record TemplateSummaryResponse(
        Long id,
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
  - Response DTO (`TemplateDetailResponse.java`):
    ```java
    public record TemplateDetailResponse(
        Long id,
        String name,
        String description,
        String category,
        boolean isSystemStandard,
        int phaseCount,
        int nodeCount,
        int cloneCount,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Object graphData // Cột JSONB lưu toàn bộ cấu trúc đồ thị 2 tầng
    ) {}
    ```
* **Tạo / Sửa Template (`POST/PUT /api/v1/templates`)**:
  - Request DTO (`CreateTemplateRequest.java`):
    ```java
    public record CreateTemplateRequest(
        @NotBlank String name,
        String description,
        @NotBlank String category,
        boolean isSystemStandard,
        @NotNull Object graphData
    ) {}
    ```
  - Logic Backend:
    1. Kiểm tra quyền `ADMIN`.
    2. Chạy thuật toán Kahn trên cấu trúc `graphData` gửi lên để thẩm định đồ thị không chứa chu trình lặp. Nếu có chu trình, ném `422 CYCLE_DETECTED`.
    3. Lưu bản ghi vào bảng `PIPELINE_TEMPLATE` (cột `graph_data` được lưu dạng JSONB).
    4. Trả về `TemplateDetailResponse` với mã `201 Created` / `200 OK`.
* **Thẩm định nhanh đồ thị mẫu (`POST /api/v1/templates/validate`)**:
  - Request DTO: `{ "graphData": { ... } }`
  - Response DTO (`DagValidationResponse.java`):
    ```java
    public record DagValidationResponse(
        boolean valid,
        int visitedCount,
        int totalCount,
        List<String> cycleNodeIds
    ) {}
    ```

---

## 4. BẢN THIẾT KẾ DỊCH VỤ THUẬT TOÁN KAHN (`KahnDagService.java`)

Để code gọn gàng, tái sử dụng được ở cả Cụm 4.5 (`PublishPipeline`) và Cụm 10.3 (`ValidateTemplate`), Dev B cần tách riêng thuật toán Kahn vào một Service chuyên trách:

```java
package com.pipeline.wpe.service.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
public class KahnDagService {

    public record Edge<T>(T parent, T child) {}

    public record KahnResult<T>(
        boolean isValid,
        int visitedCount,
        int totalNodes,
        List<T> sortedOrder,
        List<T> cycleNodes
    ) {}

    /**
     * Thuật toán Kahn kiểm tra chu trình đồ thị có hướng (O(V + E))
     *
     * @param allNodes Danh sách tất cả các đỉnh (Nodes)
     * @param edges    Danh sách các cạnh phụ thuộc (parent -> child)
     * @return KahnResult chứa trạng thái isValid và danh sách các node gây chu trình nếu có
     */
    public <T> KahnResult<T> validateDag(Collection<T> allNodes, Collection<Edge<T>> edges) {
        if (allNodes == null || allNodes.isEmpty()) {
            return new KahnResult<>(true, 0, 0, Collections.emptyList(), Collections.emptyList());
        }

        Map<T, Integer> inDegree = new HashMap<>();
        Map<T, List<T>> adjacencyList = new HashMap<>();

        for (T node : allNodes) {
            inDegree.put(node, 0);
            adjacencyList.put(node, new ArrayList<>());
        }

        for (Edge<T> edge : edges) {
            if (inDegree.containsKey(edge.child())) {
                inDegree.put(edge.child(), inDegree.get(edge.child()) + 1);
            }
            if (adjacencyList.containsKey(edge.parent())) {
                adjacencyList.get(edge.parent()).add(edge.child());
            }
        }

        Queue<T> queue = new ArrayDeque<>();
        for (Map.Entry<T, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        List<T> sortedOrder = new ArrayList<>();
        int visitedCount = 0;

        while (!queue.isEmpty()) {
            T current = queue.poll();
            sortedOrder.add(current);
            visitedCount++;

            List<T> neighbors = adjacencyList.getOrDefault(current, Collections.emptyList());
            for (T neighbor : neighbors) {
                int newDegree = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, newDegree);
                if (newDegree == 0) {
                    queue.add(neighbor);
                }
            }
        }

        boolean isValid = (visitedCount == allNodes.size());
        List<T> cycleNodes = new ArrayList<>();

        if (!isValid) {
            for (Map.Entry<T, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() > 0) {
                    cycleNodes.add(entry.getKey());
                }
            }
            log.warn("Kahn Cycle Detection: Phát hiện chu trình lặp tại {} nodes: {}", cycleNodes.size(), cycleNodes);
        }

        return new KahnResult<>(isValid, visitedCount, allNodes.size(), sortedOrder, cycleNodes);
    }
}
```

---

## 5. DANH SÁCH FILE CẦN TẠO MỚI (CHECKLIST FILE BLUEPRINT)

Dev B cần tạo các file sau đây theo chuẩn kiến trúc phân tầng Spring Boot 3 của dự án:

### 📁 5.1 Tầng Controller (2 files):
1. `controller/WorkflowGraphController.java` — Chứa các endpoint Cụm 4.1 đến 4.5 (`/api/v1/projects/{id}/graph`, `/phases`, `/nodes`, `/dependencies`, `/metadata`, `/publish`).
2. `controller/PipelineTemplateController.java` — Chứa các endpoint Cụm 10.3 (`/api/v1/templates`, `/templates/{id}`, `/templates/validate`).

### 📁 5.2 Tầng Service (3 files):
1. `service/engine/KahnDagService.java` — Service thuần túy chạy giải thuật Kahn $O(V+E)$ (như mục 4).
2. `service/WorkflowGraphService.java` — Nghiệp vụ quản lý Phase, Node, Dependency, lưu metadata và điều phối Publish.
3. `service/PipelineTemplateService.java` — Nghiệp vụ CRUD template mẫu và thẩm định `graphData` JSONB.

### 📁 5.3 Tầng Exception (1 file):
1. `exception/CycleDetectedException.java` — Kế thừa `RuntimeException`, lưu giữ danh sách `List<String> cycleNodes` để `GlobalExceptionHandler` trả về HTTP 422.

### 📁 5.4 Tầng DTO Requests (6 files):
1. `dto/request/graph/CreatePhaseRequest.java`
2. `dto/request/graph/UpdatePhaseRequest.java`
3. `dto/request/graph/CreateNodeRequest.java`
4. `dto/request/graph/CreateDependencyRequest.java`
5. `dto/request/graph/UpdateNodeMetadataRequest.java`
6. `dto/request/template/CreateTemplateRequest.java`

### 📁 5.5 Tầng DTO Responses (7 files):
1. `dto/response/graph/WorkflowGraphResponse.java`
2. `dto/response/graph/PhaseResponse.java`
3. `dto/response/graph/GraphNodeResponse.java`
4. `dto/response/graph/DependencyResponse.java`
5. `dto/response/graph/PublishPipelineResponse.java`
6. `dto/response/template/TemplateSummaryResponse.java`
7. `dto/response/template/TemplateDetailResponse.java`

---

## 6. LỘ TRÌNH THỰC HIỆN 5 BƯỚC CHO DEV B

```text
[BƯỚC 1: DTO & EXCEPTION]
  Tạo các Java record trong dto/request/graph, dto/response/graph, dto/template
  và CycleDetectedException.
      │
      ▼
[BƯỚC 2: SERVICE KAHN DAG & UNIT TEST]
  Viết KahnDagService.java. Viết Unit Test kiểm thử 2 kịch bản:
  (1) Đồ thị DAG hợp lệ (A -> B -> C).
  (2) Đồ thị có chu trình lặp (A -> B -> C -> A) => Báo lỗi chính xác.
      │
      ▼
[BƯỚC 3: CỤM 4 - GRAPH, PHASE, NODE, DEPENDENCY & PUBLISH]
  Viết WorkflowGraphService.java và WorkflowGraphController.java.
  Triển khai logic mở khóa nodes khi Publish thành công.
      │
      ▼
[BƯỚC 4: CỤM 10.3 - TEMPLATE STUDIO]
  Viết PipelineTemplateService.java và PipelineTemplateController.java.
  Kiểm tra lưu cột JSONB graph_data an toàn.
      │
      ▼
[BƯỚC 5: KIỂM THỬ TRÊN SWAGGER UI]
  Mở http://localhost:8080/swagger-ui.html:
  - Bấm thử GET /graph trên Project #1 có sẵn trong seed data.
  - Bấm thử tạo chu trình nối ngược WPE-004 -> WPE-001 rồi bấm Publish xem có ra lỗi 422 không!
```

---

> 🎯 **Lời khuyên thực chiến cho Dev B**:
> * Toàn bộ Entity (`WorkPhaseEntity`, `NodeEntity`, `NodeDependencyEntity`, `PipelineTemplateEntity`) và Repository tương ứng **đã có sẵn 100% trong code**! Bạn không cần sửa database hay tạo entity mới, chỉ cần tiêm (@Autowired / @RequiredArgsConstructor) vào Service để dùng.
> * Với phân quyền kiểm tra Owner, bạn có thể tiêm sẵn `ProjectAuthorizationService` và `CurrentUserProvider` như Dev D đã làm ở Cụm 7, 8, 9.
> * Khi code xong, bạn có thể tự hào vì đã hoàn thành phân hệ đồ thị cốt lõi nhất của cả hệ thống!
