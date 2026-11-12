# Sơ đồ Use Case Tổng quát Toàn hệ thống (WPE System Overview Use Case)

> **Mã sơ đồ**: `docs/ooad/he-thong/uc-tong-quat.puml`  
> **Tài liệu tham chiếu SSOT**: [docs/specs/system-overview.md](file:///c:/Users/THIEN/Desktop/HocTap/Workflow_Pipeline/docs/specs/system-overview.md) (Mục 4 — Ma trận phân quyền RBAC UC1..UC23), [docs/specs/workflow-engine.md](file:///c:/Users/THIEN/Desktop/HocTap/Workflow_Pipeline/docs/specs/workflow-engine.md), [docs/FRONTEND_BACKEND_INTEGRATION_MAP.md](file:///c:/Users/THIEN/Desktop/HocTap/Workflow_Pipeline/docs/FRONTEND_BACKEND_INTEGRATION_MAP.md)  
> **Người thực hiện**: ThanhThien-coder (Mảng D — X3)

---

## 1. Giới thiệu & Phạm vi Sơ đồ

Sơ đồ Use Case tổng quát toàn hệ thống cung cấp góc nhìn kiến trúc chức năng hoàn chỉnh của **Workflow-Pipeline-Engine (WPE)** từ góc độ tác nhân người dùng (Actors) và ranh giới hệ thống (System Boundary). 

Sơ đồ bao quát toàn bộ **23 Use Case nghiệp vụ cốt lõi (UC1 – UC23)** được chuẩn hóa trong ma trận RBAC tại tài liệu SSOT `docs/specs/system-overview.md`, phản ánh đầy đủ:
- 7 vai trò tác nhân con người theo ma trận RBAC: `Anonymous` (Khách vãng lai), `System Admin` (Quản trị viên), `Guest (Token)` (Khách/Giáo viên qua liên kết), `Project Viewer` (Người xem dự án), `Collaborator` (Cộng sự), **`Project Manager` (Quản lý dự án)**, và `Project Owner` (Chủ dự án).
- 2 tác nhân khái quát hóa trung gian: `Authenticated User` (Người dùng đã đăng nhập) và `Project Member` (Thành viên dự án).
- Các quan hệ liên kết nghiệp vụ chuẩn UML: Association, Generalization (Kế thừa tác nhân con → cha), `<<include>>` (bắt buộc) và `<<extend>>` (mở rộng có điều kiện).
- Ranh giới hệ thống `rectangle "WPE - Workflow Pipeline Engine"` với toàn bộ Actor đặt bên ngoài ranh giới.

---

## 2. Mô hình Kế thừa Tác nhân (Actor Role Generalization)

Để tối ưu hóa sơ đồ, giảm thiểu số lượng đường liên kết chéo gây rối mắt mà vẫn đảm bảo tính chính xác tuyệt đối theo ma trận RBAC, hệ thống áp dụng mô hình kế thừa phân cấp nghiêm ngặt:

```text
[Authenticated User] <────────────────────── [System Admin]
        ▲
        │ (Kế thừa thông tin cá nhân Profile - UC3)
[Project Member]
        ▲
        │ (Quyền đọc dự án - UC19, UC20, UC21)
[Project Viewer]
        ▲
        │ (Quyền nhận & thực thi task cá nhân - UC15, UC16, UC17, UC18)
[Collaborator]
        ▲
        │ (Quyền quản lý điều phối, duyệt bài & xử lý góp ý - UC13, UC14, UC23)
[Project Manager]
        ▲
        │ (Quyền tối cao: quản trị dự án, thành viên, thiết kế DAG - UC7, UC8, UC9, UC10, UC11, UC12)
[Project Owner]

[Anonymous]           ─── (Khách vãng lai chưa đăng nhập: UC1, UC2)
[Guest via Token]     ─── (Khách/Giáo viên truy cập bằng token tạm thời: UC19, UC20, UC21, UC22)
```

### Giải thích nguyên tắc kế thừa:
1. **`System Admin --|> Authenticated User`**: Quản trị viên hệ thống là tài khoản đã đăng nhập, có quyền cập nhật hồ sơ cá nhân (UC3), đồng thời nắm giữ các chức năng quản trị nền tảng độc lập với dữ liệu dự án (UC4, UC5, UC6).
2. **`Project Member --|> Authenticated User`**: Mọi thành viên trong một dự án bắt buộc phải là người dùng đã đăng nhập và được cấp phiên xác thực hợp lệ (UC3).
3. **`Project Viewer --|> Project Member`**: Người xem nội bộ có quyền đọc toàn bộ dữ liệu dự án công khai nội bộ gồm đồ thị DAG & kho Artifacts (UC19), Dashboard chỉ số KPI (UC20) và Báo cáo chẩn đoán sự cố AI (UC21).
4. **`Collaborator --|> Project Viewer`**: Cộng sự kế thừa toàn bộ quyền xem của Viewer, đồng thời được cấp quyền thực thi các công việc được phân công riêng trên bảng My Tasks (UC15, UC16, UC17, UC18).
5. **`Project Manager --|> Collaborator`**: Quản lý kế thừa toàn bộ quyền thực thi công việc của Cộng sự (nếu được phân công task), đồng thời được Chủ dự án ủy quyền điều phối: Phê duyệt nghiệm thu (`REVIEW` ➔ `DONE`) hoặc trả lại bài (UC13), Gia hạn hạn chót / điều chuyển người phụ trách node (UC14), và Đánh dấu `RESOLVED` cho hàng đợi góp ý (UC23).
6. **`Project Owner --|> Project Manager`**: Chủ dự án kế thừa toàn bộ thẩm quyền điều phối của Manager, đồng thời là người duy nhất nắm quyền sở hữu và cấu hình dự án: Khởi tạo dự án (UC7), Mời thành viên (UC8), Đổi vai trò / Xóa thành viên (UC9), Thiết kế & lưu đồ thị DAG (UC10), Kiểm tra chu trình Kahn (UC11), và Sinh/thu hồi link chia sẻ khách ngoài (UC12).
7. **`Guest via Token` (Tác nhân độc lập)**: Khách ngoài hoặc Giáo viên chấm đồ án truy cập qua URL Token ngẫu nhiên (độ dài 64+ ký tự). Đây là tác nhân **độc lập**, **không có tài khoản** (không kế thừa `Authenticated User`), chỉ xem được các tài nguyên được đánh dấu `is_public_for_guest = true` (UC19, UC20, UC21) và gửi góp ý phản hồi một chiều (UC22).

---

## 3. Bảng Đối Chiếu Use Case Toàn Hệ Thống (UC1 – UC23) với Ma Trận RBAC

Bảng dưới đây đối chiếu chi tiết 23 use case trong sơ đồ `docs/ooad/he-thong/uc-tong-quat.puml` với bảng phân quyền RBAC tại `docs/specs/system-overview.md` mục 4:

| Mã UC | Tên trong sơ đồ Use Case | Actor được nối trực tiếp | Kế thừa bởi các Actor | Khớp cột nào trong ma trận RBAC SSOT |
| :---: | :--- | :--- | :--- | :--- |
| **UC1** | UC1 Đăng ký tài khoản mới | `Anonymous` (Khách vãng lai) | *(Không có)* | Khớp cột **Anonymous** (✅) |
| **UC2** | UC2 Đăng nhập hệ thống | `Anonymous` (Khách vãng lai) | *(Không có)* | Khớp cột **Anonymous** (✅) |
| **UC3** | UC3 Xem & cập nhật hồ sơ cá nhân | `User` (Authenticated User) | `Admin`, `Member` (`Viewer`, `Collab`, `Manager`, `Owner`) | Khớp cột **System Admin** (✅), **Project Viewer** (✅), **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC4** | UC4 Quản lý người dùng & khóa tài khoản | `Admin` (System Admin) | *(Không có)* | Khớp cột **System Admin** (✅) |
| **UC5** | UC5 CRUD mẫu quy trình chuẩn | `Admin` (System Admin) | *(Không có)* | Khớp cột **System Admin** (✅) |
| **UC6** | UC6 Giám sát hạ tầng & lưu trữ dự án rác | `Admin` (System Admin) | *(Không có)* | Khớp cột **System Admin** (✅) |
| **UC7** | UC7 Khởi tạo dự án mới | `Owner` (Project Owner) | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC8** | UC8 Mời thành viên tham gia & gán vai trò | `Owner` (Project Owner) | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC9** | UC9 Điều chỉnh vai trò & loại bỏ thành viên | `Owner` (Project Owner) | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC10** | UC10 Thiết kế đồ thị DAG | `Owner` (Project Owner) | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC11** | UC11 Kiểm tra chu trình đồ thị (Kahn DAG) | `Owner` (Project Owner) *(và include bởi UC10, UC5)* | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC12** | UC12 Sinh mới & thu hồi token chia sẻ (Guest Link) | `Owner` (Project Owner) | *(Không có)* | Khớp cột **Project Owner** (✅) |
| **UC13** | UC13 Phê duyệt kết quả công việc | `Manager` (Project Manager) | `Owner` (Project Owner) | Khớp cột **Project Manager** (✅), **Project Owner** (✅) |
| **UC14** | UC14 Gia hạn hạn chót & điều chuyển công việc | `Manager` (Project Manager) | `Owner` (Project Owner) | Khớp cột **Project Manager** (✅), **Project Owner** (✅) |
| **UC15** | UC15 Xem công việc cá nhân (My Tasks) | `Collab` (Collaborator) | `Manager`, `Owner` | Khớp cột **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC16** | UC16 Bắt đầu thực hiện công việc | `Collab` (Collaborator) | `Manager`, `Owner` | Khớp cột **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC17** | UC17 Hủy nhận công việc | `Collab` (Collaborator) | `Manager`, `Owner` | Khớp cột **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC18** | UC18 Nộp kết quả công việc | `Collab` (Collaborator) | `Manager`, `Owner` | Khớp cột **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC19** | UC19 Xem đồ thị tiến độ & tài nguyên | `Viewer` (Project Viewer), `Guest` (Guest via Token) | `Collab`, `Manager`, `Owner` | Khớp cột **Guest (Token)** (✅), **Project Viewer** (✅), **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC20** | UC20 Xem Dashboard chỉ số & KPI dự án | `Viewer` (Project Viewer), `Guest` (Guest via Token) | `Collab`, `Manager`, `Owner` | Khớp cột **Guest (Token)** (✅), **Project Viewer** (✅), **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC21** | UC21 Xem báo cáo chẩn đoán sự cố AI | `Viewer` (Project Viewer), `Guest` (Guest via Token) | `Collab`, `Manager`, `Owner` | Khớp cột **Guest (Token)** (✅), **Project Viewer** (✅), **Collaborator** (✅), **Project Manager** (✅), **Project Owner** (✅) |
| **UC22** | UC22 Gửi phản hồi một chiều | `Guest` (Guest via Token) | *(Không có)* | Khớp cột **Guest (Token)** (✅ - Gửi mới) |
| **UC23** | UC23 Xem danh sách & xử lý hàng đợi góp ý | `Manager` (Project Manager) | `Owner` (Project Owner) | Khớp cột **Project Manager** (✅), **Project Owner** (✅) *(Collab chỉ xem)* |

---

## 4. Phân Tích Quan Hệ `<<include>>` và `<<extend>>`

Nhằm tuân thủ các quy tắc UML chuẩn mực trong tài liệu `docs/ooad/CAM_NANG_VE_SO_DO.md` mục 3.1:

### 4.1 Quan hệ `<<include>>` (Bắt buộc phải thực hiện)
* **`UC10 Thiết kế đồ thị DAG` .> `UC11 Kiểm tra chu trình đồ thị (Kahn DAG)` : `<<include>>`**:
  - *Ý nghĩa*: Khi Chủ dự án thiết kế, nối dây phụ thuộc giữa các công việc hoặc thao tác Xuất bản dự án (Publish), hệ thống bắt buộc kích hoạt thuật toán Kahn để kiểm tra tính hợp lệ không chu trình. Nếu phát hiện chu trình, hệ thống chặn lưu và trả về danh sách các node gây lỗi.
* **`UC5 CRUD mẫu quy trình chuẩn` .> `UC11 Kiểm tra chu trình đồ thị (Kahn DAG)` : `<<include>>`**:
  - *Ý nghĩa*: Khi Quản trị viên hệ thống thiết kế và lưu trữ các mẫu quy trình chuẩn trong System Template Studio, thuật toán Kahn bắt buộc phải chạy thẩm định đồ thị trước khi template được công bố cho toàn hệ thống.

### 4.2 Quan hệ `<<extend>>` (Mở rộng có điều kiện)
* **`Khởi tạo từ mẫu quy trình` .> `UC7 Khởi tạo dự án mới` : `<<extend>> [chọn sao chép từ mẫu]`**:
  - *Ý nghĩa*: Trong luồng khởi tạo dự án, hành vi mặc định là tạo một dự án trắng (Blank Project). Chỉ khi người dùng kích hoạt tùy chọn chọn mẫu từ kho Catalog, luồng sao chép sâu toàn bộ Phase, Node và PhaseDependency mới được thực thi.
* **`Từ chối duyệt bài kèm lý do` .> `UC13 Phê duyệt kết quả công việc` : `<<extend>> [kết quả chưa đạt]`**:
  - *Ý nghĩa*: Khi nghiệm thu bài nộp (`REVIEW`), luồng thành công chính là duyệt sang `DONE`. Trường hợp sản phẩm bàn giao chưa đạt yêu cầu, người duyệt (Owner/Manager) kích hoạt nhánh từ chối, bắt buộc nhập lý do vào `reject_reason` để chuyển task trở lại trạng thái `IN_PROGRESS`.
* **`Đính kèm liên kết minh chứng (Artifact)` .> `UC18 Nộp kết quả công việc` : `<<extend>> [có đính kèm artifact]`**:
  - *Ý nghĩa*: Khi Cộng sự hoàn thành công việc và nộp bài (`IN_PROGRESS` ➔ `REVIEW`), việc đính kèm URL sản phẩm bàn giao (GitHub PR, Figma, Swagger, Docs) là tùy chọn (Optional) theo đúng đặc tả SSOT (không lưu file vật lý trên máy chủ).

> [!IMPORTANT]
> **Tuyệt đối không vẽ "Đăng nhập" thành `<<include>>` của mọi Use Case**:  
> Thao tác đăng nhập là **tiền điều kiện (Precondition)** của phiên làm việc, được quản lý tại tầng Auth Gateway và JWT Filter. Việc biến đăng nhập thành include của mọi use case là lỗi ký hiệu UML kinh điển cần tránh.

---

## 5. Đối Chiếu & Đồng Bộ Tên Use Case với Sơ Đồ Các Mảng (A, B, C, D)

Để chuẩn bị cho buổi kiểm nhất quán X3, bảng dưới đây liệt kê sự tương ứng giữa tên use case trong sơ đồ tổng quát cấp hệ thống với sơ đồ use case của từng mảng nghiệp vụ:

| Use Case Cấp Hệ Thống | Sơ đồ Mảng Tương Ứng | Tên Use Case trong Mảng Con | Trạng thái Đồng bộ & Ghi chú |
| :--- | :---: | :--- | :--- |
| **UC1 Đăng ký tài khoản mới** | Mảng A (`A-tai-khoan`) | Đăng ký tài khoản | Đồng bộ hoàn toàn |
| **UC2 Đăng nhập hệ thống** | Mảng A (`A-tai-khoan`) | Đăng nhập hệ thống, Nhận Access/Refresh Token | Đồng bộ hoàn toàn |
| **UC3 Xem & cập nhật hồ sơ cá nhân** | Mảng A (`A-tai-khoan`) | Xem hồ sơ, Cập nhật hồ sơ, Đổi mật khẩu | Ở mảng A tách chi tiết thành các thao tác nhỏ; ở sơ đồ tổng quát gom thành UC3 theo đúng mã RBAC |
| **UC4 Quản lý người dùng & khóa tài khoản** | Mảng A (`A-tai-khoan`) | Quản lý người dùng, Khóa/Mở khóa tài khoản | Ở mảng A tách riêng Khóa và Mở khóa |
| **UC5 CRUD mẫu quy trình chuẩn** | Mảng D (`D-du-an`), Mảng A | `UC_ManageTemplate` ("Quản lý template") | Mảng D thể hiện `UC_ManageTemplate` của Admin, include `UC_CheckCycle` |
| **UC6 Giám sát hạ tầng & lưu trữ dự án rác** | Mảng A (`A-tai-khoan`) | Giám sát hạ tầng, Lưu trữ workspace/dự án rác | Đồng bộ với chức năng Background Job quét 7 ngày |
| **UC7 Khởi tạo dự án mới** | Mảng D (`D-du-an`) | `UC_Create` ("Tạo dự án"), `UC_Clone` ("Tạo từ template") | Mảng D tách `UC_Clone` extend `UC_Create`; sơ đồ hệ thống thể hiện đúng quan hệ extend này |
| **UC8 Mời thành viên tham gia & gán vai trò** | Mảng D (`D-du-an`) | `UC_Invite` ("Mời thành viên") | Đồng bộ. Mảng D có thêm `UC_RespondInvite` (Chấp nhận/Từ chối) dành cho Người được mời |
| **UC9 Điều chỉnh vai trò & loại bỏ thành viên** | Mảng D (`D-du-an`) | `UC_ChangeRole` ("Đổi vai trò"), `UC_RemoveMember` ("Xóa thành viên") | Mảng D tách 2 UC và có extend Chuyển quyền sở hữu; sơ đồ tổng quát gom thành UC9 theo mã RBAC |
| **UC10 Thiết kế đồ thị DAG** | Mảng B (`B-do-thi`) | Thêm/sửa công việc, nối phụ thuộc, lưu bố cục canvas | Mảng B chi tiết hóa thao tác đồ thị canvas; cấp hệ thống định danh là UC10 |
| **UC11 Kiểm tra chu trình đồ thị (Kahn DAG)** | Mảng B (`B-do-thi`), Mảng D | `UC_CheckCycle` ("Kiểm tra chu trình") | Dùng chung thuật toán KahnDagService giữa mảng B và D |
| **UC12 Sinh mới & thu hồi token chia sẻ (Guest Link)** | Mảng D (`D-du-an`) | `UC_CreateGuestLink`, `UC_RevokeGuestLink` | Mảng D tách Tạo và Thu hồi; sơ đồ tổng quát gom thành UC12 |
| **UC13 Phê duyệt kết quả công việc** | Mảng C (`C-thuc-thi`) | Duyệt bài (`REVIEW` ➔ `DONE`), Từ chối bài | Phân quyền cập nhật cho cả `Project Manager` và `Project Owner` |
| **UC14 Gia hạn hạn chót & điều chuyển công việc** | Mảng C (`C-thuc-thi`) | Gia hạn deadline, Đổi người phụ trách node | Phân quyền cập nhật cho cả `Project Manager` và `Project Owner` |
| **UC15 Xem công việc cá nhân (My Tasks)** | Mảng C (`C-thuc-thi`) | Xem My Tasks cá nhân | Lọc chính xác `assignedUserId === currentUserId` |
| **UC16 Bắt đầu thực hiện công việc** | Mảng C (`C-thuc-thi`) | Bắt đầu làm (`TODO` ➔ `IN_PROGRESS`) | Đồng bộ FSM |
| **UC17 Hủy nhận công việc** | Mảng C (`C-thuc-thi`) | Hủy nhận việc (`IN_PROGRESS` ➔ `TODO`) | Đồng bộ FSM |
| **UC18 Nộp kết quả công việc** | Mảng C (`C-thuc-thi`) | Nộp bài (`IN_PROGRESS` ➔ `REVIEW`) | Kèm extend Đính kèm artifact minh chứng |
| **UC19 Xem đồ thị tiến độ & tài nguyên** | Mảng B (`B-do-thi`), Mảng C | Xem đồ thị, Xem kho tài nguyên Artifacts | Đồng bộ |
| **UC20 Xem Dashboard chỉ số & KPI dự án** | Mảng D (`D-du-an`) | Xem Dashboard Overview Screen | Đồng bộ |
| **UC21 Xem báo cáo chẩn đoán sự cố AI** | Mảng D (`D-du-an`) | `UC_ViewAiDiag` ("Xem chẩn đoán AI") | Đồng bộ |
| **UC22 Gửi phản hồi một chiều** | Mảng D (`D-du-an`) | `UC_SendFeedback` ("Gửi góp ý") | Dành riêng cho Guest qua token, không có luồng tranh luận ngược |
| **UC23 Xem danh sách & xử lý hàng đợi góp ý** | Mảng D (`D-du-an`) | `UC_ViewFeedback`, `UC_ResolveFeedback` | Phân quyền cho `Project Manager` và `Project Owner`. Collaborator chỉ xem |

---

## 6. Danh Sách Điểm Khác Ma Trận RBAC (Kèm Lý Do Kỹ Thuật)

Trong quá trình tổng hợp và đối chiếu giữa mã nguồn thực tế và tài liệu SSOT, ghi nhận 2 điểm lưu ý:
1. **Quyền hạn của Collaborator đối với UC23**:
   - *Ma trận RBAC*: Tại dòng UC23, cột Collaborator ghi `- *(chỉ xem)*`, cột Project Manager và Project Owner ghi `✅`.
   - *Thể hiện trên sơ đồ*: UC23 có tên là *"Xem danh sách & xử lý hàng đợi góp ý"*. Do hành động chính có tính tác động trạng thái là chuyển từ `OPEN` sang `RESOLVED`, sơ đồ use case nối trực tiếp UC23 vào `Project Manager` (và `Project Owner` thừa kế). Quyền "chỉ xem" của Collaborator là quyền đọc thông tin tiếp thu, không được bấm `RESOLVED`.
2. **Quyền truy cập AI của Khách ngoài (UC21)**:
   - *Ma trận RBAC*: Cho phép `Guest (Token)` xem báo cáo chẩn đoán sự cố AI.
   - *Mã nguồn*: Hiện tại API backend AI chẩn đoán chủ yếu gắn với xác thực thành viên dự án, tuy nhiên giao diện Frontend đã hỗ trợ hiển thị dữ liệu đệm từ `PROJECT.latest_ai_analysis` (JSONB) cho khách truy cập. Sơ đồ use case tổng quát giữ đúng chuẩn SSOT nối `Guest` vào UC21.
