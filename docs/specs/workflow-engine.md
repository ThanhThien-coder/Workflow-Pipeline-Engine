# Workflow Engine Specification (SSOT — State Machine & Kahn DAG)

> **Dự án**: Workflow-Pipeline-Engine  
> **Tài liệu**: Single Source of Truth (SSOT) — Đặc tả Động cơ Điều phối, Máy trạng thái & Thuật toán Đồ thị  
> **Lớp công nghệ**: Spring Boot 3 Engine Service (Backend) + HTML5 Drag & Drop & Zustand Store (Frontend)

---

## 1. Kiến trúc Máy trạng thái Tác vụ (Finite State Machine - FSM)

Động cơ điều phối quản lý vòng đời của từng nút công việc (`NODE`) thông qua máy trạng thái 5 trạng thái chuẩn:

```text
       [Khởi tạo Node trên đồ thị Workflow Canvas]
                          │
                          ▼
                     ┌──────────┐
                     │  LOCKED  │  <── Nút bị khóa hoàn toàn. Ẩn khỏi bảng My Tasks
                     └──────────┘      khi các công việc tiền nhiệm chưa hoàn tất.
                          │
                          │ (Engine tự động mở khóa theo AND-join hoặc OR-join)
                          ▼
                     ┌──────────┐
                     │   TODO   │  <── Tự động xuất hiện trên My Tasks của người phụ trách
                     └──────────┘      (Mô hình Direct Push: assignedUserId === currentUserId)
                          │
                          │ (Thành viên bắt đầu làm việc)
                          ▼
                 ┌─────────────────┐
                 │   IN_PROGRESS   │ ◄─────────────────────────────────────────────┐
                 └─────────────────┘                                               │
                   │             │                                                 │
                   │             └─► (Quét quá hạn định kỳ: gán is_overdue=TRUE    │
                   │                  Owner có quyền gia hạn hoặc đổi người làm)   │
                   │                                                               │
                   │ (Thành viên nộp kết quả: Đính kèm Artifact là TÙY CHỌN)       │
                   ▼                                                               │
                 ┌─────────────────┐                                               │
                 │     REVIEW      │                                               │
                 └─────────────────┘                                               │
                   │             │                                                 │
                   │             └─► (Owner TỪ CHỐI: bắt buộc nhập reject_reason) ─┘
                   │
                   │ (Chỉ OWNER có quyền DUYỆT: chấp thuận sản phẩm, đóng băng Node)
                   ▼
                 ┌─────────────────┐
                 │      DONE       │ ──► Kích hoạt Engine kiểm tra & mở khóa các
                 └─────────────────┘     Node con kế tiếp theo đồ thị DAG.
                          │
                          ▼
                 [Đóng băng trạng thái: draggable=false]
```

### 1.1 Chi tiết 5 Trạng thái của Node

| Trạng Thái | Ý Nghĩa Kỹ Thuật | Hành Vi Trên Giao Diện | Điều Kiện Rời Khỏi |
| :--- | :--- | :--- | :--- |
| **`LOCKED`** | Đang chờ các nút tiền nhiệm hoàn thành. | Hiển thị biểu tượng Ổ Khóa trên Canvas; **hoàn toàn không xuất hiện trên bảng My Tasks**. | Engine tự động chuyển sang `TODO` khi thỏa mãn Join Policy, hoặc Owner bấm Force Unlock. |
| **`TODO`** | Đã sẵn sàng thực hiện. | Tự động xuất hiện tại cột TODO trên bảng My Tasks của người phụ trách theo mô hình Direct Push. | Thành viên bấm "Bắt đầu làm" hoặc kéo sang `IN_PROGRESS`. |
| **`IN_PROGRESS`** | Đang được thực hiện trực tiếp. | Hiển thị tại cột In Progress; nếu quá `due_date` sẽ hiển thị badge cảnh báo Đỏ (`is_overdue = TRUE`). | Thành viên nộp kết quả (`REVIEW`) hoặc hủy nhận (`TODO`). |
| **`REVIEW`** | Đã nộp bài, đang chờ nghiệm thu. | Hiển thị tại cột In Review; chờ phê duyệt từ Chủ dự án hoặc Quản lý. | Chủ dự án (`OWNER`) hoặc thành viên `MANAGER` còn hoạt động duyệt (`DONE`) hoặc từ chối (`IN_PROGRESS`) (Manager: PR #33). |
| **`DONE`** | Đã nghiệm thu hoàn thành. | Đóng băng (`draggable = false`); hiển thị badge xanh lá cây; kích hoạt Engine mở khóa downstream nodes. | **Trạng thái kết thúc (Terminal State)**, không cho phép kéo lùi. |

---

## 2. Quy tắc Điều phối & Ma trận Chuyển đổi Trạng thái

### 2.1 Ma trận Chuyển đổi Trạng thái (Strict State Transition Matrix)

| Từ Trạng Thái | Đến Trạng Thái | Collaborator (Người thực hiện) | Project Owner (Chủ dự án) | Quy Tắc Kiểm Định Kỹ Thuật |
| :--- | :--- | :---: | :---: | :--- |
| `TODO` | `IN_PROGRESS` | ✅ Trực tiếp | ✅ | Kiểm tra `version` (Optimistic Locking); bắt đầu tính thời gian làm việc. |
| `IN_PROGRESS` | `TODO` | ✅ | ✅ | Hủy nhận việc, giải phóng task về trạng thái sẵn sàng. |
| `IN_PROGRESS` | `REVIEW` | ✅ *(Qua Modal)* | ✅ *(Qua Modal)* | **Bắt buộc mở Modal nộp bài**; đính kèm Artifact là tùy chọn (Optional). |
| `REVIEW` | `DONE` | ❌ *(Bị chặn)* | ✅ *(Nghiệm thu)* | **Strict Review Constraint**: chỉ Owner hoặc `MANAGER` còn hoạt động được duyệt hoàn tất. |
| `REVIEW` | `IN_PROGRESS`| ❌ | ✅ *(Yêu cầu sửa)* | Owner hoặc `MANAGER` từ chối nghiệm thu, **bắt buộc nhập lý do vào `reject_reason`**. |

**Vai trò Manager (backend, PR #33; C1b kiểm 12/11/2026):** `MANAGER` còn hoạt động (bản ghi `project_member` có `removed_at = null`) được duyệt và từ chối như Owner. Manager **không** được bắt đầu, hủy nhận, nộp bài thay người phụ trách (403) và **không** được force unlock (403, vẫn chỉ Owner). Manager đã bị gỡ khỏi dự án thì mất quyền duyệt/từ chối (403). Manager duyệt thì `TaskCompletedEvent.completedByUserId` là id Manager, và Owner nhận SSE `TASK_STATUS_CHANGED`. Test: `StateMachineServiceMatrixTest` (cột Manager và lớp `ManagerRole`).

> ⚠️ **Lệch FE/BE (chưa sửa):** `wpe-frontend/src/domain/taskTransitions.ts` (`evaluateTransition`, đoạn mẫu ở dưới) vẫn chỉ cho `OWNER` duyệt/từ chối. Backend cho Manager duyệt nhưng giao diện chặn với thông báo "Chỉ Owner mới có quyền duyệt". Cần sửa FE (ngoài phạm vi C1, báo nhóm).
| `TODO` | `REVIEW` | ❌ | ❌ | Chặn: Phải bắt đầu làm việc trước khi nộp bài. |
| `TODO` / `IN_PROGRESS` | `DONE` | ❌ | ❌ | Chặn: Bắt buộc phải qua bước `REVIEW` trước khi hoàn thành. |
| `DONE` | Bất kỳ | ❌ | ❌ | Chặn: Trạng thái đóng băng, không cho phép kéo ngược lại. |

### 2.2 Hàm Đánh giá Chuyển đổi Trạng thái (`evaluateTransition`)

Mọi hành động kéo thả trên giao diện hoặc gọi API cập nhật trạng thái bắt buộc phải đi qua một bộ hàm đánh giá thuần túy (Pure Function) trước khi ghi nhận:

```typescript
export interface TransitionContext {
  task: {
    status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
    assignedUserId: string | null;
  };
  fromStatus: string;
  toStatus: string;
  actor: {
    userId: string;
    projectRole: 'OWNER' | 'COLLABORATOR' | 'VIEWER';
  };
}

export function evaluateTransition(ctx: TransitionContext): { allowed: boolean; reason?: string } {
  const { task, fromStatus, toStatus, actor } = ctx;
  const isOwner = actor.projectRole === 'OWNER';
  const isAssignee = task.assignedUserId === actor.userId;

  // 1. Không cho phép di chuyển task đã DONE
  if (fromStatus === 'DONE') {
    return { allowed: false, reason: 'Tác vụ đã hoàn tất và đóng băng, không thể thay đổi.' };
  }

  // 2. Không cho phép nhảy cóc bước REVIEW
  if (toStatus === 'DONE' && fromStatus !== 'REVIEW') {
    return { allowed: false, reason: 'Tác vụ bắt buộc phải được chuyển qua bước In Review trước khi nghiệm thu.' };
  }

  // 3. Strict Review Gate: Chỉ Owner mới có quyền duyệt sang DONE
  if (toStatus === 'DONE' && fromStatus === 'REVIEW') {
    if (!isOwner) {
      return { allowed: false, reason: 'Chỉ Chủ dự án (Project Owner) mới có thẩm quyền phê duyệt hoàn thành tác vụ.' };
    }
    return { allowed: true };
  }

  // 4. Owner từ chối task quay về IN_PROGRESS
  if (toStatus === 'IN_PROGRESS' && fromStatus === 'REVIEW') {
    if (!isOwner) {
      return { allowed: false, reason: 'Chỉ Chủ dự án mới có quyền yêu cầu làm lại tác vụ.' };
    }
    return { allowed: true };
  }

  // 5. Thành viên hoặc Owner bắt đầu làm việc
  if (toStatus === 'IN_PROGRESS' && fromStatus === 'TODO') {
    if (isAssignee || isOwner) return { allowed: true };
    return { allowed: false, reason: 'Bạn không phải là người được giao phụ trách tác vụ này.' };
  }

  // 6. Nộp bài lên REVIEW (bắt buộc qua modal nộp artifact)
  if (toStatus === 'REVIEW' && fromStatus === 'IN_PROGRESS') {
    if (isAssignee || isOwner) return { allowed: true };
    return { allowed: false, reason: 'Bạn không có quyền nộp bài cho tác vụ này.' };
  }

  return { allowed: false, reason: 'Luồng chuyển đổi trạng thái không hợp lệ.' };
}
```

---

## 3. Chính sách Mở khóa Tự động (Join Policies)

Khi một nút đạt trạng thái `DONE`, Engine kích hoạt luồng quét toàn bộ các nút con kế tiếp (`child_node_id` trong `NODE_DEPENDENCY`) và áp dụng chính sách hội tụ:

### 3.1 `ALL_COMPLETED` (AND-join Policy — Mặc định)
* Nút con chỉ được chuyển từ `LOCKED` sang `TODO` khi **TẤT CẢ** các nút cha trực tiếp trỏ vào nó đều đã đạt trạng thái `DONE`.
* Công thức điều kiện:
  $$\forall p \in \text{Parents}(u), \quad \text{status}(p) = \text{'DONE'}$$

### 3.2 `ANY_COMPLETED` (OR-join Policy)
* Nút con sẽ được chuyển từ `LOCKED` sang `TODO` ngay khi **CÓ ÍT NHẤT MỘT** nút cha trực tiếp đạt trạng thái `DONE`.
* Công thức điều kiện:
  $$\exists p \in \text{Parents}(u), \quad \text{status}(p) = \text{'DONE'}$$

### 3.3 Task Độc lập / Phi kỹ thuật (`phase_id = NULL`)
* Các công việc hành chính, họp nhóm, chuẩn bị tài liệu thuyết trình không có nút cha-con phụ thuộc.
* Khi tạo, task tự động nhận trạng thái `TODO` ngay lập tức (không bao giờ bị `LOCKED`).

### 3.4 Cơ chế Mở khóa Cưỡng bức (Force Unlock)
* Nhằm phục vụ kịch bản thành viên cần làm trước bằng mock data khi task cha chưa xong, Project Owner được cung cấp nút **"Force Unlock"**.
* Bấm Force Unlock lập tức chuyển task từ `LOCKED` sang `TODO` và ghi log audit mà không phá vỡ liên kết DAG.
* Cài đặt (C1, 12/11/2026): chỉ Owner; task phải đang `LOCKED` (khác → 400); dự án `ARCHIVED` → 409 `PROJECT_ARCHIVED`. Log mức `info` ghi id task, mã task, dự án và **userId người mở**. Nếu task có người phụ trách: tạo thông báo `FORCE_UNLOCKED` ("Tác vụ … được Chủ dự án mở khóa sớm") và đẩy SSE `TASK_UNLOCKED`, cả hai gửi sau commit (mục 3.6).

### 3.5 Đồng bộ Thời gian thực qua Server-Sent Events (SSE)
* Ngay khi nút con được chuyển trạng thái từ `LOCKED` sang `TODO` (qua hội tụ AND/OR Join hoặc Force Unlock), hệ thống tự động đẩy sự kiện `TASK_UNLOCKED` kèm `KanbanTaskResponse` qua `SseEmitterService` xuống trình duyệt của người phụ trách (`assigned_user_id`).
* Thẻ công việc tự động nạp vào cột TODO trên bảng Kanban của người dùng trong thời gian thực mà không yêu cầu tải lại trang (Zero-Reload Experience).

### 3.6 Gửi sự kiện RabbitMQ và SSE sau khi commit (C1, 12/11/2026)
* **Vấn đề trước đây:** `updateStatus` gọi `publishTaskCompleted` khi transaction còn mở. Consumer (`WorkflowEventConsumer.handleTaskCompleted`, chạy ở luồng listener riêng) có thể nhận sự kiện trước khi commit, đọc thấy task cha chưa `DONE`, nên **không mở khóa** task con. Thực nghiệm C1 (thêm tạm `Thread.sleep(2000)` sau lời gọi publish) tái hiện được: duyệt WPE-003 xong, WPE-004 vẫn `LOCKED`.
* **Quy tắc:** mọi hàm `publish*` của `WorkflowEventPublisher` kiểm `TransactionSynchronizationManager.isSynchronizationActive()`:
  * đang trong transaction → đăng ký một `TransactionSynchronization`, chỉ `convertAndSend` ở `afterCompletion(STATUS_COMMITTED)`; transaction rollback thì **không** gửi. Không dùng `afterCommit()` vì publish có thể bị gọi từ bên trong `afterCommit` của code khác (ví dụ `publishPipeline`), lúc đó một `afterCommit` đăng ký thêm sẽ không bao giờ chạy;
  * không có transaction → gửi ngay.
* SSE trong `StateMachineService` (`TASK_STATUS_CHANGED`, `TASK_REJECTED`, `TASK_SUBMITTED`, `TASK_UNLOCKED`) cũng gửi sau commit theo cùng cách, để trình duyệt không nhận trạng thái mà DB còn có thể rollback.
* Chữ ký các hàm `publish*` và `SseEmitterService.sendToUser` giữ nguyên; code của B và D gọi như cũ là tự được gửi sau commit.
* **Hạn chế đã biết:** việc gửi sau commit chạy trên chính luồng của request, sau khi commit xong. Nếu RabbitMQ lỗi đúng lúc đó thì dữ liệu đã lưu nhưng **sự kiện bị mất** (chỉ ghi log `ERROR`, request vẫn trả thành công). Muốn không mất sự kiện thì cần outbox pattern: ghi sự kiện vào một bảng trong cùng transaction, rồi một job đọc bảng đó để gửi lên RabbitMQ.

---

## 4. Thuật toán Sắp xếp Topo & Phát hiện Chu trình (Kahn's DAG Algorithm)

Nhằm triệt tiêu nguy cơ tắc nghẽn vô tận (Deadlock do phụ thuộc vòng tròn $A \to B \to C \to A$), hệ thống áp dụng **Thuật toán sắp xếp Topo của Kahn (Kahn's Algorithm)**:

```text
               [Khởi tạo Bậc vào In-degree cho toàn bộ Nodes]
                                     │
                                     ▼
                   [Tìm các Node có In-degree = 0]
                                     │
                                     ▼
                         [Đưa vào Hàng đợi Queue]
                                     │
                       ┌─────────────┴─────────────┐
                       ▼                           ▼
                 [Queue còn Node]             [Queue rỗng]
                       │                           │
         [Lấy Node u ra khỏi Queue]                ▼
                       │                    [So sánh count với]
             [Tăng count lên 1]             [Tổng số Node N]
                       │                           │
         [Giảm In-degree các Node v kế tiếp]       ├─────────────────────────┐
                       │                           ▼                         ▼
         [Nếu In-degree(v) == 0: Đưa v vào Queue] [count == N]             [count < N]
                       │                           │                         │
                       └───────────────────────────┘                         ▼
                                                   ▼                  [PHÁT HIỆN CHU TRÌNH]
                                            [DAG HỢP LỆ]              - Chặn lưu / kích hoạt
                                            - Cho phép xuất bản       - Bôi đỏ các Node lỗi
```

### 4.1 Thời điểm Kích hoạt Thuật toán
1. **Thiết kế Canvas**: Khi người dùng nối một dây mới giữa hai Node, hệ thống chạy Kahn cục bộ để ngăn chặn nối vòng tròn.
2. **Template Studio**: Trước khi bấm "Save & Publish" trong Admin Template Studio.
3. **Kích hoạt Dự án**: Trước khi chuyển trạng thái dự án từ `DRAFT` sang `ACTIVE`.

### 4.2 Mã Giả Thuật toán Kahn (Pseudo-code Chi tiết)

```typescript
export interface DagValidationResult {
  isValid: boolean;
  cycleNodeIds: string[];
  sortedOrder: string[];
}

export function validateKahnDag(nodes: { id: string }[], edges: { parentId: string; childId: string }[]): DagValidationResult {
  const inDegree: Map<string, number> = new Map();
  const adjacencyList: Map<string, string[]> = new Map();

  // 1. Khởi tạo bậc vào = 0 cho tất cả các node
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });

  // 2. Điền bậc vào và danh sách kề
  edges.forEach(edge => {
    const currentIn = inDegree.get(edge.childId) || 0;
    inDegree.set(edge.childId, currentIn + 1);

    const neighbors = adjacencyList.get(edge.parentId) || [];
    neighbors.push(edge.childId);
    adjacencyList.set(edge.parentId, neighbors);
  });

  // 3. Đưa tất cả các node có in-degree = 0 vào hàng đợi Queue
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sortedOrder: string[] = [];

  // 4. Duyệt hàng đợi
  while (queue.length > 0) {
    const u = queue.shift()!;
    sortedOrder.push(u);

    const neighbors = adjacencyList.get(u) || [];
    for (const v of neighbors) {
      const updatedDegree = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(v);
      }
    }
  }

  // 5. Kiểm tra chu trình
  if (sortedOrder.length === nodes.length) {
    return { isValid: true, cycleNodeIds: [], sortedOrder };
  } else {
    // Các node còn inDegree > 0 chính là các node nằm trong chu trình lặp
    const cycleNodeIds: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree > 0) cycleNodeIds.push(nodeId);
    });
    return { isValid: false, cycleNodeIds, sortedOrder: [] };
  }
}
```

> Mã giả trên là bản gốc, giữ để đối chiếu. Bản backend (`KahnDagService`) khác ở các điểm ghi trong mục 4.3.

### 4.3 Cài đặt Backend: `KahnDagService` (cập nhật 11/11/2026, task B1)

File: `wpe-backend/src/main/java/com/pipeline/wpe/service/engine/KahnDagService.java`.

**`validateProjectDag(nodes, dependencies)` trả về `ProjectKahnResult`:**

| Trường | Ý nghĩa |
| :--- | :--- |
| `isValid` | `true` nếu đồ thị không có chu trình |
| `visitedCount`, `totalNodes` | Số node duyệt được và tổng số node |
| `rootNodeIds` | Các node không có cha (in-degree 0 lúc đầu). Xuất bản dự án mở khóa các node này |
| `sortedOrder` | Thứ tự topo theo id node. **Rỗng nếu có chu trình** |
| `blockedNodeCodes` | Mã mọi node không duyệt được: node trên chu trình **và** node đứng sau chu trình |
| `cycleNodeCodes` | Mã các node nằm trên chu trình. Đây là danh sách trả cho người dùng trong lỗi 422 (`cycleNodes`) |

**Khác với mã giả ở mục 4.2:**

1. **Thứ tự ổn định.** Nhiều node cùng in-degree 0 thì node có id nhỏ hơn được lấy trước (dùng hàng đợi ưu tiên). Cùng một đồ thị luôn cho cùng một `sortedOrder`, không phụ thuộc thứ tự dữ liệu đưa vào.
2. **`cycleNodeCodes` không gồm node đứng sau chu trình.** Sau khi chạy Kahn, tập node còn in-degree > 0 (`blockedNodeCodes`) được "bóc ngược": lặp lại việc bỏ các node không còn cạnh đi ra tới node khác trong tập. Phần còn lại là `cycleNodeCodes`. Ví dụ `A→B→C→A, C→D, D→E`: `blockedNodeCodes = [A, B, C, D, E]`, `cycleNodeCodes = [A, B, C]`.
3. **Bỏ qua cạnh có đầu mút lạ.** Cạnh mà node cha hoặc node con không nằm trong danh sách `nodes` thì không được tính. Nếu tính, node con sẽ không bao giờ về in-degree 0 và bị báo chu trình giả.
4. Cạnh trùng (cùng cha, cùng con, xuất hiện nhiều lần) không làm sai kết quả.

**Hạn chế đã biết:** node nằm trên đường nối giữa 2 chu trình (ví dụ `A⇄B, B→X, X→C, C⇄D`: node `X`) vẫn bị đưa vào `cycleNodeCodes`, dù nó không nằm trên chu trình nào. Muốn tách chính xác cần thuật toán tìm thành phần liên thông mạnh (Tarjan), chưa làm.

**`wouldCreateCycle(nodes, dependencies, parentId, childId)`:** trả `true` nếu thêm cạnh `parentId → childId` vào đồ thị hiện có sẽ tạo chu trình, kể cả khi `parentId` bằng `childId`. Cách làm: thêm cạnh cha → con tạo vòng khi và chỉ khi đã có đường đi từ con tới cha, nên chỉ cần duyệt theo chiều rộng từ node con, gặp node cha thì trả `true`. Độ phức tạp O(V + E). Hàm này dùng để chặn vòng ngay lúc nối cạnh (mục 4.1, điểm 1), kể cả vòng dài như `A→B→C→A`.

**Chưa đổi:** `validateTemplateGraph` (kiểm template 2 tầng) vẫn báo mọi node còn in-degree > 0, chưa áp dụng "bóc ngược".

---

## 5. Vòng đời Dự án & Kiểm soát Xung đột Đồng thời

### 5.1 Vòng đời Dự án (Project Lifecycle)
1. **`DRAFT`**: Dự án đang trong giai đoạn phác thảo và vẽ đồ thị. Engine ngầm chưa tự động mở khóa.
2. **`ACTIVE`**: Dự án đã vượt qua thuật toán Kahn và được kích hoạt. Các nút gốc (In-degree = 0) chuyển sang `TODO` và tự động đẩy vào My Tasks của người phụ trách.
3. **`INACTIVE`**: Dự án không có tương tác nào trong 30 ngày; nhận cảnh báo trước khi chuyển lưu trữ.
4. **`ARCHIVED`**: Dự án đóng băng chỉ đọc (Read-only); có thể được khôi phục bởi Chủ dự án trong thời hạn quy định.
   * Mọi thao tác ghi trả 409 `PROJECT_ARCHIVED`: sửa đồ thị, phase, node, cạnh (B2, B3); đổi trạng thái task, duyệt hoặc từ chối bài, nộp bài, force unlock (C1). Đọc dữ liệu vẫn được.

**Luật xuất bản `POST /projects/{id}/publish` (cập nhật 12/11/2026, task B4):**
* Chỉ chuyển sang `ACTIVE` được từ `DRAFT` hoặc `PLANNING`. Dự án `ARCHIVED` trả 409 `PROJECT_ARCHIVED`; các trạng thái khác (`ACTIVE`, `PAUSED`, `COMPLETED`, `INACTIVE`) trả 409 `INVALID_PROJECT_STATUS`. Xuất bản lần 2 vì thế luôn bị từ chối, không mở khóa hay gửi sự kiện lặp lại.
* Thứ tự kiểm: quyền owner (403) → trạng thái dự án (409) → thuật toán Kahn toàn dự án (422 `CYCLE_DETECTED`, `cycleNodes` = `cycleNodeCodes`, xem mục 4.3).
* Node gốc (in-degree = 0) đang `LOCKED` chuyển sang `TODO`. Mỗi node vừa mở khóa có người phụ trách sinh 1 SSE `TASK_UNLOCKED` và 1 thông báo `TASK_READY`, gửi **sau khi transaction commit**. Rollback thì không gửi.
* Độ phức tạp: O(V + E) với V là số node, E là số cạnh của dự án (đọc node và cạnh 1 lần, Kahn O(V + E), duyệt node gốc O(V)).

### 5.2 Khóa Lạc quan (Optimistic Locking via JPA `@Version`)
* Khi nhiều nhánh phụ thuộc chạy song song hoàn thành cùng một lúc, các downstream tasks có thể bị gọi mở khóa đồng thời từ nhiều luồng (threads).
* Entity `Node` khai báo:
  ```java
  @Version
  private Long version;
  ```
* Nếu 2 tiến trình cùng cập nhật trạng thái một Node, Hibernate sẽ ném `OptimisticLockException`. Service Layer áp dụng cơ chế Retry tối đa 3 lần với exponential backoff, đảm bảo dữ liệu luôn nhất quán tuyệt đối.
