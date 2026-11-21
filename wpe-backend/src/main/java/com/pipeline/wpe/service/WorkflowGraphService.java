package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.request.graph.*;
import com.pipeline.wpe.dto.response.graph.*;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.PhaseDependencyEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.WorkPhaseEntity;
import com.pipeline.wpe.exception.BadRequestException;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.mapper.NodeMapper;
import com.pipeline.wpe.repository.PhaseDependencyRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import com.pipeline.wpe.service.event.SseEmitterService;
import com.pipeline.wpe.service.event.WorkflowEventPublisher;
import com.pipeline.wpe.dto.event.NotificationEvent;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.pipeline.wpe.service.engine.KahnDagService;
import com.pipeline.wpe.service.engine.KahnDagService.ProjectKahnResult;
import com.pipeline.wpe.service.engine.PhaseProgressCalculator;
import com.pipeline.wpe.service.engine.PhaseProgressCalculator.PhaseProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowGraphService {

    private final ProjectRepository projectRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final PhaseDependencyRepository phaseDependencyRepository;
    private final ProjectAuthorizationService authorizationService;
    private final KahnDagService kahnDagService;
    private final ProjectMemberRepository projectMemberRepository;
    private final SseEmitterService sseEmitterService;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;
    private final NodeMapper nodeMapper;
    private final WorkflowEventPublisher eventPublisher;

    /**
     * 4.1 Lấy toàn bộ đồ thị 2 tầng của dự án
     */
    @Transactional(readOnly = true)
    public WorkflowGraphResponse getGraph(Long projectId, Long currentUserId) {
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        List<WorkPhaseEntity> phaseEntities = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        List<NodeEntity> nodeEntities = nodeRepository.findByProjectId(projectId);
        List<NodeDependencyEntity> depEntities = nodeDependencyRepository.findByProjectId(projectId);
        Map<Long, Set<Long>> parentsByPhase = loadPhaseParents(projectId, phaseEntities);

        List<PhaseResponse> phases = phaseEntities.stream()
            .map(p -> mapToPhaseResponse(
                p,
                nodeEntities.stream().filter(n -> p.getId().equals(n.getPhaseId())).toList(),
                parentsByPhase.getOrDefault(p.getId(), Set.of())
            ))
            .toList();

        List<List<String>> phaseEdges = phaseEntities.stream()
            .flatMap(p -> parentsByPhase.getOrDefault(p.getId(), Set.of()).stream()
                .map(parentId -> List.of(String.valueOf(parentId), String.valueOf(p.getId()))))
            .toList();

        List<GraphNodeResponse> nodes = nodeEntities.stream()
            .map(this::mapToGraphNodeResponse)
            .toList();

        List<DependencyResponse> dependencies = depEntities.stream()
            .map(d -> new DependencyResponse(
                String.valueOf(d.getParentNodeId()),
                String.valueOf(d.getChildNodeId())
            ))
            .toList();

        return new WorkflowGraphResponse(phases, phaseEdges, nodes, dependencies);
    }

    /**
     * 4.2 Thêm Macro Phase mới
     */
    @Transactional
    public PhaseResponse createPhase(Long projectId, CreatePhaseRequest request, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        if (request.parentPhaseId() != null) {
            WorkPhaseEntity parent = workPhaseRepository.findById(request.parentPhaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Parent phase not found with ID: " + request.parentPhaseId()));
            if (!parent.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("The parent phase does not belong to this project.");
            }
        }

        // orderIndex mặc định = MAX(order_index) + 1 (không dùng size() để tránh trùng sau khi xóa Phase)
        int orderIndex = request.orderIndex() != null ? request.orderIndex() :
            workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId).stream()
                .mapToInt(WorkPhaseEntity::getOrderIndex)
                .max()
                .orElse(-1) + 1;

        WorkPhaseEntity entity = WorkPhaseEntity.builder()
            .projectId(projectId)
            .parentPhaseId(request.parentPhaseId())
            .name(request.name().trim())
            .subTitle(request.sub() != null ? request.sub().trim() : null)
            .accentColor(request.accent() != null ? request.accent().trim() : "slate")
            .orderIndex(orderIndex)
            .uiMetadata(request.uiMetadata() != null ? new HashMap<>(request.uiMetadata()) : new HashMap<>())
            .build();

        WorkPhaseEntity saved = workPhaseRepository.save(entity);

        // Phase mới chưa có con nên không thể tạo chu trình, ghi thẳng cạnh vào bảng nối
        Set<Long> parentIds = Set.of();
        if (request.parentPhaseId() != null) {
            phaseDependencyRepository.save(PhaseDependencyEntity.builder()
                .projectId(projectId)
                .parentPhaseId(request.parentPhaseId())
                .childPhaseId(saved.getId())
                .build());
            parentIds = Set.of(request.parentPhaseId());
        }
        projectRealtimeNotifier.notifyProjectChanged(projectId, "GRAPH", "PHASE_CREATED", currentUserId, saved.getId(), null);
        return mapToPhaseResponse(saved, Collections.emptyList(), parentIds);
    }

    /**
     * 4.2 Cập nhật Macro Phase
     */
    @Transactional
    public PhaseResponse updatePhase(Long projectId, Long phaseId, UpdatePhaseRequest request, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        WorkPhaseEntity entity = workPhaseRepository.findById(phaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Phase not found with ID: " + phaseId));

        if (!entity.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The phase does not belong to this project.");
        }

        if (request.parentPhaseId() != null) {
            if (request.parentPhaseId().equals(phaseId)) {
                throw new IllegalArgumentException("A phase can't depend on itself.");
            }
            WorkPhaseEntity parent = workPhaseRepository.findById(request.parentPhaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Parent phase not found with ID: " + request.parentPhaseId()));
            if (!parent.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("The parent phase does not belong to this project.");
            }
            // Thêm Phase tiền nhiệm (giữ các cha cũ), có kiểm tra chu trình
            addPhaseEdge(projectId, parent, entity);
        }

        entity.setName(request.name().trim());
        if (request.sub() != null) entity.setSubTitle(request.sub().trim());
        if (request.accent() != null) entity.setAccentColor(request.accent().trim());
        if (request.orderIndex() != null) entity.setOrderIndex(request.orderIndex());
        // Không gửi uiMetadata (ví dụ chỉ đổi tên) thì giữ nguyên vị trí cũ
        if (request.uiMetadata() != null) entity.setUiMetadata(new HashMap<>(request.uiMetadata()));

        WorkPhaseEntity saved = workPhaseRepository.save(entity);
        Set<Long> parentIds = loadPhaseParents(projectId, workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId))
            .getOrDefault(phaseId, Set.of());
        projectRealtimeNotifier.notifyProjectChanged(projectId, "GRAPH", "PHASE_UPDATED", currentUserId, phaseId, null);
        return mapToPhaseResponse(saved, nodeRepository.findByPhaseId(phaseId), parentIds);
    }

    /**
     * 4.2 Xóa Phase (Bảo toàn dữ liệu: chuyển node con sang standalone)
     */
    @Transactional
    public void deletePhase(Long projectId, Long phaseId, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        WorkPhaseEntity entity = workPhaseRepository.findById(phaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Phase not found with ID: " + phaseId));

        if (!entity.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The phase does not belong to this project.");
        }

        // Phase còn task đang làm / chờ duyệt / đã xong thì không cho xóa (xóa sẽ mất công việc thật)
        List<NodeEntity> nodesInPhase = nodeRepository.findByPhaseId(phaseId);
        List<NodeEntity> activeNodes = nodesInPhase.stream()
            .filter(n -> n.getStatus() == NodeStatus.IN_PROGRESS
                || n.getStatus() == NodeStatus.REVIEW
                || n.getStatus() == NodeStatus.DONE)
            .toList();
        if (!activeNodes.isEmpty()) {
            String codes = activeNodes.stream().limit(5).map(NodeEntity::getCode).collect(Collectors.joining(", "));
            int more = activeNodes.size() - 5;
            throw new ConflictException("PHASE_HAS_ACTIVE_TASKS",
                "Phase can't be deleted because it has tasks that are in progress, in review or done: "
                    + codes + (more > 0 ? " and " + more + " more" : "") + ".");
        }

        // Mọi task trong phase đều LOCKED/TODO: xóa cạnh phụ thuộc liên quan, rồi xóa task
        Set<Long> deletedIds = nodesInPhase.stream().map(NodeEntity::getId).collect(Collectors.toSet());
        Map<String, NodeDependencyEntity> edgesToDelete = new LinkedHashMap<>();
        Set<Long> externalChildIds = new LinkedHashSet<>();
        for (NodeEntity node : nodesInPhase) {
            for (NodeDependencyEntity e : nodeDependencyRepository.findByParentNodeId(node.getId())) {
                edgesToDelete.put(e.getParentNodeId() + ":" + e.getChildNodeId(), e);
                if (!deletedIds.contains(e.getChildNodeId())) {
                    externalChildIds.add(e.getChildNodeId());
                }
            }
            for (NodeDependencyEntity e : nodeDependencyRepository.findByChildNodeId(node.getId())) {
                edgesToDelete.put(e.getParentNodeId() + ":" + e.getChildNodeId(), e);
            }
        }
        nodeDependencyRepository.deleteAll(edgesToDelete.values());
        nodeRepository.deleteAll(nodesInPhase);

        // Task con nằm ngoài phase vừa mất cha: tính lại trạng thái theo các cha còn lại
        for (Long childId : externalChildIds) {
            nodeRepository.findById(childId).ifPresent(child -> {
                List<Long> remainingParentIds = nodeDependencyRepository.findByChildNodeId(childId).stream()
                    .map(NodeDependencyEntity::getParentNodeId)
                    .filter(id -> !deletedIds.contains(id))
                    .toList();
                List<NodeEntity> remaining = remainingParentIds.isEmpty() ? List.of() : nodeRepository.findAllById(remainingParentIds);
                recomputeNodeStatus(child, remaining);
            });
        }

        // Gỡ liên kết parent_phase_id cho các phase con
        List<WorkPhaseEntity> childPhases = workPhaseRepository.findByParentPhaseIdOrderByOrderIndexAsc(phaseId);
        for (WorkPhaseEntity cp : childPhases) {
            cp.setParentPhaseId(null);
        }
        workPhaseRepository.saveAll(childPhases);

        // Các cạnh trong bảng phase_dependency tự xóa theo ON DELETE CASCADE (V6)
        workPhaseRepository.delete(entity);
        projectRealtimeNotifier.notifyTasksChanged(projectId, phaseId, null, "PHASE_DELETED", currentUserId);
    }

    /**
     * 4.2 Nối quan hệ phụ thuộc giữa 2 Phase
     */
    @Transactional
    public void connectPhases(Long projectId, Long sourcePhaseId, Long targetPhaseId, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        if (sourcePhaseId.equals(targetPhaseId)) {
            throw new IllegalArgumentException("A phase can't depend on itself.");
        }

        WorkPhaseEntity target = workPhaseRepository.findById(targetPhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Target phase not found with ID: " + targetPhaseId));
        WorkPhaseEntity source = workPhaseRepository.findById(sourcePhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Source phase not found with ID: " + sourcePhaseId));

        if (!target.getProjectId().equals(projectId) || !source.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Both phases must belong to this project.");
        }

        // Thêm cạnh vào bảng nối (giữ nguyên các Phase cha đã có), chặn chu trình
        addPhaseEdge(projectId, source, target);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "GRAPH", "PHASE_LINKED", currentUserId, targetPhaseId, null);
    }

    /**
     * 4.2 Gỡ bỏ quan hệ phụ thuộc giữa 2 Phase
     */
    @Transactional
    public void disconnectPhases(Long projectId, Long sourcePhaseId, Long targetPhaseId, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        WorkPhaseEntity target = workPhaseRepository.findById(targetPhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Target phase not found with ID: " + targetPhaseId));

        if (!target.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The phase does not belong to this project.");
        }

        phaseDependencyRepository.deleteByParentPhaseIdAndChildPhaseId(sourcePhaseId, targetPhaseId);

        // Cạnh cũ có thể còn nằm ở cột parent_phase_id (dữ liệu trước V6 / clone template)
        if (target.getParentPhaseId() != null && target.getParentPhaseId().equals(sourcePhaseId)) {
            target.setParentPhaseId(null);
            workPhaseRepository.save(target);
        }
        projectRealtimeNotifier.notifyProjectChanged(projectId, "GRAPH", "PHASE_UNLINKED", currentUserId, targetPhaseId, null);
    }

    /**
     * 4.3 Tạo Node công việc mới
     */
    @Transactional
    public GraphNodeResponse createNode(Long projectId, CreateNodeRequest request, Long currentUserId) {
        // Chỉ owner được thiết kế đồ thị (UC10). Thành viên và Viewer chỉ được đọc.
        ProjectEntity project = authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId);
        ensureNotArchived(project);

        // Mọi task phải thuộc một phase: task không phase không hiện trên đồ thị nhưng vẫn bị đếm ở Overview (S05)
        if (request.phaseId() == null) {
            throw new BadRequestException("PHASE_REQUIRED", "A task must belong to a phase.");
        }
        WorkPhaseEntity phase = workPhaseRepository.findById(request.phaseId())
            .orElseThrow(() -> new ResourceNotFoundException("Phase not found with ID: " + request.phaseId()));
        if (!phase.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The phase does not belong to this project.");
        }

        // Task mới tạo hôm nay: hạn chót sớm nhất là hôm nay
        DueDateRules.requireNotBeforeCreation(request.dueDate(), null);

        // Tự động sinh mã code nếu để trống
        String code = request.code();
        if (code == null || code.isBlank()) {
            long count = nodeRepository.countByProjectId(projectId) + 1;
            code = String.format("WPE-%03d", count);
            while (nodeRepository.findByProjectIdAndCode(projectId, code).isPresent()) {
                count++;
                code = String.format("WPE-%03d", count);
            }
        } else {
            code = code.trim().toUpperCase();
            if (nodeRepository.findByProjectIdAndCode(projectId, code).isPresent()) {
                throw new ConflictException("DUPLICATE_NODE_CODE", "Task code '" + code + "' already exists in this project.");
            }
        }

        // Trạng thái ban đầu: dự án chưa publish (DRAFT) thì LOCKED, publish sẽ mở các task gốc.
        // Dự án đã publish: task mới chưa có task trước nên TODO ngay (cùng luật publish mở task gốc);
        // nối cha chưa xong vào sau đó thì recomputeNodeStatus tự khóa lại.
        com.pipeline.wpe.common.enums.ProjectStatus projectStatus = project.getStatus();
        boolean published = projectStatus != null
            && projectStatus != com.pipeline.wpe.common.enums.ProjectStatus.DRAFT;
        NodeStatus initialStatus = published ? NodeStatus.TODO : NodeStatus.LOCKED;
        JoinPolicy joinPolicy = request.joinPolicy() != null ? request.joinPolicy() : JoinPolicy.ALL_COMPLETED;
        Map<String, Object> metadata = request.uiMetadata() != null ? request.uiMetadata() :
            Map.of("position", Map.of("x", 200, "y", 150), "width", 220, "height", 90);

        NodeEntity node = NodeEntity.builder()
            .projectId(projectId)
            .phaseId(request.phaseId())
            .code(code)
            .title(request.title().trim())
            .description(request.description())
            .status(initialStatus)
            .joinPolicy(joinPolicy)
            .assignedUserId(request.assignedUserId())
            .dueDate(request.dueDate())
            .estimatedHours(request.estimatedHours() != null ? request.estimatedHours() : 8)
            .version(0L)
            .uiMetadata(metadata)
            .build();

        NodeEntity saved = nodeRepository.save(node);
        projectRealtimeNotifier.notifyTasksChanged(saved.getProjectId(), saved.getPhaseId(), saved.getId(), "NODE_CREATED", currentUserId);
        return mapToGraphNodeResponse(saved);
    }

    /**
     * 4.3 Nối cạnh quan hệ phụ thuộc (NODE_DEPENDENCY)
     */
    @Transactional
    public DependencyResponse createDependency(Long projectId, CreateDependencyRequest request, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        Long parentId = request.parentNodeId();
        Long childId = request.childNodeId();

        if (parentId.equals(childId)) {
            throw new IllegalArgumentException("A task can't depend on itself.");
        }

        NodeEntity parent = nodeRepository.findById(parentId)
            .orElseThrow(() -> new ResourceNotFoundException("Parent task not found with ID: " + parentId));
        NodeEntity child = nodeRepository.findById(childId)
            .orElseThrow(() -> new ResourceNotFoundException("Child task not found with ID: " + childId));

        if (!parent.getProjectId().equals(projectId) || !child.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Both tasks must belong to this project.");
        }

        // Idempotent: nếu đã nối rồi thì trả về luôn
        if (nodeDependencyRepository.existsByParentNodeIdAndChildNodeId(parentId, childId)) {
            return new DependencyResponse(String.valueOf(parentId), String.valueOf(childId));
        }

        NodeDependencyEntity entity = NodeDependencyEntity.builder()
            .projectId(projectId)
            .parentNodeId(parentId)
            .childNodeId(childId)
            .build();

        // Chặn chu trình dài bất kỳ (A->B, B->C rồi C->A), không chỉ vòng 2 node:
        // thêm parent -> child tạo vòng khi đã có đường đi từ child tới parent.
        List<NodeEntity> projectNodes = nodeRepository.findByProjectId(projectId);
        List<NodeDependencyEntity> projectEdges = nodeDependencyRepository.findByProjectId(projectId);
        if (kahnDagService.wouldCreateCycle(projectNodes, projectEdges, parentId, childId)) {
            // Chạy Kahn trên đồ thị giả định đã có cạnh mới để lấy mã các node nằm trên vòng
            List<NodeDependencyEntity> edgesWithNew = new ArrayList<>(projectEdges);
            edgesWithNew.add(entity);
            throw new CycleDetectedException(
                "Can't add this dependency: it would create a cycle between tasks.",
                kahnDagService.validateProjectDag(projectNodes, edgesWithNew).cycleNodeCodes()
            );
        }

        // Công việc đã bắt đầu làm thì không được thêm tiền đề mới
        if (child.getStatus() != NodeStatus.LOCKED && child.getStatus() != NodeStatus.TODO) {
            throw new ConflictException("NODE_IN_USE",
                "Task " + child.getCode() + " is " + child.getStatus() + ", so a new dependency can't be added.");
        }

        nodeDependencyRepository.save(entity);

        // Tính lại trạng thái node con theo danh sách cha mới
        Set<Long> parentIds = new HashSet<>();
        parentIds.add(parentId);
        for (NodeDependencyEntity edge : projectEdges) {
            if (childId.equals(edge.getChildNodeId())) {
                parentIds.add(edge.getParentNodeId());
            }
        }
        List<NodeEntity> parents = new ArrayList<>(projectNodes.stream().filter(n -> parentIds.contains(n.getId())).toList());
        if (parents.stream().noneMatch(n -> parentId.equals(n.getId()))) {
            parents.add(parent);
        }
        boolean unlocked = recomputeNodeStatus(child, parents);
        projectRealtimeNotifier.notifyTasksChanged(
            projectId,
            child.getPhaseId(),
            childId,
            unlocked ? "UNLOCKED" : "DEPENDENCY_CHANGED",
            currentUserId
        );

        return new DependencyResponse(String.valueOf(parentId), String.valueOf(childId));
    }

    /**
     * 4.3 Xóa cạnh quan hệ phụ thuộc
     */
    @Transactional
    public void deleteDependency(Long projectId, Long parentNodeId, Long childNodeId, Long currentUserId) {
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        Optional<NodeDependencyEntity> existing = nodeDependencyRepository.findByParentNodeIdAndChildNodeId(parentNodeId, childNodeId);
        if (existing.isEmpty()) {
            return; // Idempotent: cạnh không tồn tại thì coi như đã xóa
        }
        // Chặn xóa cạnh của dự án khác qua projectId của dự án mình
        if (!existing.get().getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The dependency does not belong to this project.");
        }
        nodeDependencyRepository.delete(existing.get());

        // Gỡ cạnh có thể làm node con đủ điều kiện mở khóa (ví dụ mất hết cha)
        final boolean[] childUnlocked = { false };
        nodeRepository.findById(childNodeId)
            .ifPresent(child -> {
                childUnlocked[0] = recomputeNodeStatus(child, loadParentsExcluding(childNodeId, parentNodeId));
            });
        projectRealtimeNotifier.notifyTasksChanged(
            projectId,
            null,
            childNodeId,
            childUnlocked[0] ? "UNLOCKED" : "DEPENDENCY_CHANGED",
            currentUserId
        );
    }

    /**
     * 4.3 Sửa thông tin Node (không sửa status). Bắt buộc gửi version; sai version trả 409.
     */
    @Transactional
    public GraphNodeResponse updateNode(Long nodeId, UpdateNodeRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + nodeId));
        Long projectId = node.getProjectId();
        ProjectEntity project = authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId);
        ensureNotArchived(project);

        if (!Objects.equals(node.getVersion(), request.version())) {
            throw new OptimisticLockingFailureException(
                "This task was changed by someone else (server version: " + node.getVersion() + ", your version: " + request.version() + "). Please refresh and try again.");
        }

        if (request.phaseId() != null && !request.phaseId().equals(node.getPhaseId())) {
            WorkPhaseEntity phase = workPhaseRepository.findById(request.phaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found with ID: " + request.phaseId()));
            if (!phase.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("The phase does not belong to this project.");
            }
            node.setPhaseId(request.phaseId());
        }

        if (request.shouldClearAssignee()) {
            node.setAssignedUserId(null);
        } else if (request.assignedUserId() != null && !request.assignedUserId().equals(node.getAssignedUserId())) {
            boolean isMember = request.assignedUserId().equals(project.getOwnerId())
                || projectMemberRepository.existsByProjectIdAndUserIdAndRemovedAtIsNull(projectId, request.assignedUserId());
            if (!isMember) {
                throw new IllegalArgumentException("ASSIGNEE_NOT_MEMBER: The assignee must be a member of the project.");
            }
            boolean isViewer = !request.assignedUserId().equals(project.getOwnerId())
                && projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, request.assignedUserId())
                    .map(m -> m.getRole() == com.pipeline.wpe.common.enums.ProjectRole.VIEWER)
                    .orElse(false);
            if (isViewer) {
                throw new BadRequestException("ASSIGNEE_IS_VIEWER", "Viewers can't be assigned tasks.");
            }
            node.setAssignedUserId(request.assignedUserId());
        }

        node.setTitle(request.title().trim());
        if (request.description() != null) node.setDescription(request.description());
        if (request.estimatedHours() != null) node.setEstimatedHours(request.estimatedHours());
        if (request.shouldClearDueDate()) {
            node.setDueDate(null);
            node.setIsOverdue(false);
        } else if (request.dueDate() != null) {
            DueDateRules.requireNotBeforeCreation(request.dueDate(), node.getCreatedAt());
            node.setDueDate(request.dueDate());
            // Dời hạn sang tương lai thì công việc không còn quá hạn
            if (request.dueDate().isAfter(Instant.now())) {
                node.setIsOverdue(false);
            }
        }

        boolean unlocked = false;
        if (request.joinPolicy() != null && request.joinPolicy() != node.getJoinPolicy()) {
            node.setJoinPolicy(request.joinPolicy());
            // Đổi AND/OR có thể làm đổi điều kiện hội tụ. Node chưa có cha thì không đụng trạng thái.
            List<NodeEntity> parents = loadParentsExcluding(nodeId, null);
            if (!parents.isEmpty()) {
                unlocked = recomputeNodeStatus(node, parents);
            }
        }

        // saveAndFlush để response mang version mới, client dùng cho lần sửa kế tiếp
        NodeEntity saved = nodeRepository.saveAndFlush(node);
        projectRealtimeNotifier.notifyTasksChanged(
            saved.getProjectId(),
            saved.getPhaseId(),
            saved.getId(),
            unlocked ? "UNLOCKED" : "NODE_UPDATED",
            currentUserId
        );
        return mapToGraphNodeResponse(saved);
    }

    /**
     * 4.3 Xóa Node. Chỉ xóa được khi node còn LOCKED hoặc TODO.
     */
    @Transactional
    public void deleteNode(Long nodeId, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + nodeId));
        Long projectId = node.getProjectId();
        Long phaseId = node.getPhaseId();
        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId));

        if (node.getStatus() != NodeStatus.LOCKED && node.getStatus() != NodeStatus.TODO) {
            throw new ConflictException("NODE_IN_USE",
                "Task " + node.getCode() + " is " + node.getStatus() + " and can't be deleted.");
        }

        List<NodeDependencyEntity> outgoing = nodeDependencyRepository.findByParentNodeId(nodeId);
        nodeDependencyRepository.deleteAll(outgoing);
        nodeDependencyRepository.deleteAll(nodeDependencyRepository.findByChildNodeId(nodeId));
        nodeRepository.delete(node);

        // Các node con vừa mất một cha: tính lại trạng thái
        for (NodeDependencyEntity edge : outgoing) {
            Long childId = edge.getChildNodeId();
            nodeRepository.findById(childId)
                .ifPresent(child -> recomputeNodeStatus(child, loadParentsExcluding(childId, nodeId)));
        }

        projectRealtimeNotifier.notifyTasksChanged(projectId, phaseId, nodeId, "NODE_DELETED", currentUserId);
    }

    /**
     * 4.4 Cập nhật tọa độ vẽ Canvas vào JSONB ui_metadata
     */
    @Transactional
    public GraphNodeResponse updateNodeMetadata(Long nodeId, UpdateNodeMetadataRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Task not found with ID: " + nodeId));

        ensureNotArchived(authorizationService.verifyProjectOwnerOrManager(node.getProjectId(), currentUserId));

        // UPDATE trực tiếp, không gọi save(): save() làm tăng version (@Version) và gây 409 oan trên Kanban.
        // Không setUiMetadata lên entity đang được quản lý, vì Hibernate sẽ tự phát hiện thay đổi và tăng version.
        nodeRepository.updateUiMetadata(nodeId, request.metadata());
        return mapToGraphNodeResponse(node, request.metadata());
    }

    /**
     * 4.5 Kích hoạt dự án từ DRAFT sang ACTIVE (Chạy thuật toán Kahn phát hiện chu trình)
     */
    @Transactional
    public PublishPipelineResponse publishPipeline(Long projectId, Long currentUserId) {
        ProjectEntity project = authorizationService.verifyProjectOwner(projectId, currentUserId);

        // Chỉ xuất bản được từ DRAFT. ARCHIVED -> 409 PROJECT_ARCHIVED, còn lại -> 409 INVALID_PROJECT_STATUS.
        ensureNotArchived(project);
        com.pipeline.wpe.common.enums.ProjectStatus currentStatus = project.getStatus();
        if (currentStatus != com.pipeline.wpe.common.enums.ProjectStatus.DRAFT) {
            throw new ConflictException("INVALID_PROJECT_STATUS",
                "Only projects in DRAFT status can be published. Current status: " + currentStatus + ".");
        }

        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        List<NodeDependencyEntity> dependencies = nodeDependencyRepository.findByProjectId(projectId);

        ProjectKahnResult result = kahnDagService.validateProjectDag(nodes, dependencies);

        if (!result.isValid()) {
            throw new CycleDetectedException(
                "A dependency cycle was detected in the pipeline. The project can't be published.",
                result.cycleNodeCodes()
            );
        }

        // Đồ thị hợp lệ: Chuyển dự án sang ACTIVE
        Instant publishedAt = Instant.now();
        project.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE);
        project.setUpdatedAt(publishedAt);
        projectRepository.save(project);

        // Tự động mở khóa các node gốc (in-degree == 0) từ LOCKED -> TODO
        int unlockedCount = 0;
        // Việc báo cho người phụ trách (SSE + thông báo) gom lại ở đây, chưa gửi ngay.
        List<Runnable> afterCommitActions = new ArrayList<>();
        for (NodeEntity node : nodes) {
            if (result.rootNodeIds().contains(node.getId()) && node.getStatus() == NodeStatus.LOCKED) {
                node.setStatus(NodeStatus.TODO);
                nodeRepository.save(node);
                unlockedCount++;

                Long assigneeId = node.getAssignedUserId();
                if (assigneeId != null) {
                    NotificationEvent notification = new NotificationEvent(
                        assigneeId,
                        projectId,
                        "Task ready to start",
                        "The project has been published. Task " + node.getCode() + " (" + node.getTitle() + ") is unlocked and you can start now.",
                        "TASK_READY",
                        "/project/" + projectId + "/my-tasks",
                        publishedAt
                    );
                    String nodeCode = node.getCode();
                    afterCommitActions.add(() -> {
                        // Mỗi lần gửi tự bắt lỗi riêng: dữ liệu đã commit rồi, gửi hỏng không được làm request trả 500.
                        try {
                            // Tạo nội dung ở đây (sau commit) để node mang số version đã tăng trong DB;
                            // tạo sớm hơn thì client nhận version cũ và bị 409 khi bấm bắt đầu.
                            sseEmitterService.sendToUser(assigneeId, "TASK_UNLOCKED", nodeMapper.toKanbanTaskResponse(node));
                        } catch (RuntimeException e) {
                            log.warn("Không gửi được SSE TASK_UNLOCKED của node {} tới user {}: {}", nodeCode, assigneeId, e.getMessage());
                        }
                        try {
                            eventPublisher.publishNotification(notification);
                        } catch (RuntimeException e) {
                            log.warn("Không gửi được thông báo mở khóa node {} tới user {}: {}", nodeCode, assigneeId, e.getMessage());
                        }
                    });
                }
            }
        }

        // Chỉ gửi SAU KHI transaction commit: nếu commit hỏng (rollback) thì không ai nhận tin sai.
        if (!afterCommitActions.isEmpty()) {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        afterCommitActions.forEach(Runnable::run);
                    }
                });
            } else {
                // Không có transaction nào đang mở (ví dụ unit test gọi thẳng): không có gì để chờ, gửi luôn.
                afterCommitActions.forEach(Runnable::run);
            }
        }

        log.info("Project #{} published successfully. Unlocked {} root tasks.", projectId, unlockedCount);
        projectRealtimeNotifier.notifyTasksChanged(projectId, null, null, "PUBLISHED", currentUserId);
        return new PublishPipelineResponse(true, "ACTIVE", publishedAt, unlockedCount);
    }

    /**
     * Các node cha trực tiếp của một node, bỏ qua cha có id = excludedParentId (cạnh vừa gỡ, có thể chưa flush).
     */
    private List<NodeEntity> loadParentsExcluding(Long childId, Long excludedParentId) {
        List<Long> parentIds = nodeDependencyRepository.findByChildNodeId(childId).stream()
            .map(NodeDependencyEntity::getParentNodeId)
            .filter(id -> !id.equals(excludedParentId))
            .toList();
        return parentIds.isEmpty() ? List.of() : nodeRepository.findAllById(parentIds);
    }

    /**
     * Tính lại trạng thái một node sau khi danh sách cha (hoặc joinPolicy) của nó thay đổi.
     * Cùng luật hội tụ với StateMachineService.unlockDownstreamTasks:
     * ALL_COMPLETED cần mọi cha DONE, ANY_COMPLETED cần ít nhất một cha DONE. Không còn cha thì coi như thỏa.
     * Chỉ đụng tới node LOCKED hoặc TODO; node đã bắt đầu làm thì giữ nguyên.
     */
    public boolean recomputeNodeStatus(NodeEntity child, List<NodeEntity> parents) {
        boolean satisfied = parents.isEmpty()
            || (child.getJoinPolicy() == JoinPolicy.ANY_COMPLETED
                ? parents.stream().anyMatch(p -> p.getStatus() == NodeStatus.DONE)
                : parents.stream().allMatch(p -> p.getStatus() == NodeStatus.DONE));

        // Task chủ dự án đã mở khóa sớm thì giữ TODO dù điều kiện chưa thỏa (T6)
        if (child.getStatus() == NodeStatus.TODO && !satisfied && child.getForceUnlockedAt() == null) {
            child.setStatus(NodeStatus.LOCKED);
            nodeRepository.save(child);
            log.info("Node {} chuyển TODO -> LOCKED vì điều kiện hội tụ không còn thỏa.", child.getCode());
            return false;
        } else if (child.getStatus() == NodeStatus.LOCKED && satisfied) {
            child.setStatus(NodeStatus.TODO);
            NodeEntity saved = nodeRepository.save(child);
            log.info("Node {} chuyển LOCKED -> TODO sau khi đổi cạnh phụ thuộc.", child.getCode());
            if (saved.getAssignedUserId() != null) {
                sseEmitterService.sendToUser(saved.getAssignedUserId(), "TASK_UNLOCKED", nodeMapper.toKanbanTaskResponse(saved));
            }
            return true;
        }
        return false;
    }

    /**
     * Dự án ARCHIVED là chỉ đọc (workflow-engine.md 5.1): mọi thao tác ghi trả 409 PROJECT_ARCHIVED.
     */
    private void ensureNotArchived(ProjectEntity project) {
        if (project.getStatus() == com.pipeline.wpe.common.enums.ProjectStatus.ARCHIVED) {
            throw new ConflictException("PROJECT_ARCHIVED", "This project is archived and read-only. The pipeline can't be edited.");
        }
    }

    /**
     * Gom toàn bộ Phase cha của từng Phase: bảng phase_dependency (V6) + cột cũ parent_phase_id.
     */
    private Map<Long, Set<Long>> loadPhaseParents(Long projectId, List<WorkPhaseEntity> phases) {
        Map<Long, Set<Long>> parents = new HashMap<>();
        for (WorkPhaseEntity p : phases) {
            if (p.getParentPhaseId() != null) {
                parents.computeIfAbsent(p.getId(), k -> new LinkedHashSet<>()).add(p.getParentPhaseId());
            }
        }
        for (PhaseDependencyEntity d : phaseDependencyRepository.findByProjectId(projectId)) {
            parents.computeIfAbsent(d.getChildPhaseId(), k -> new LinkedHashSet<>()).add(d.getParentPhaseId());
        }
        return parents;
    }

    /**
     * Thêm cạnh Phase parent -> child. Idempotent nếu đã có; ném 422 nếu child đã đi tới được parent (tạo chu trình).
     */
    private void addPhaseEdge(Long projectId, WorkPhaseEntity parent, WorkPhaseEntity child) {
        List<WorkPhaseEntity> phases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        Map<Long, Set<Long>> parentsByPhase = loadPhaseParents(projectId, phases);

        if (parentsByPhase.getOrDefault(child.getId(), Set.of()).contains(parent.getId())) {
            return;
        }

        // Đảo chiều thành danh sách con, BFS từ child xem có quay về parent không
        Map<Long, List<Long>> childrenByPhase = new HashMap<>();
        parentsByPhase.forEach((c, ps) -> ps.forEach(p -> childrenByPhase.computeIfAbsent(p, k -> new ArrayList<>()).add(c)));

        Deque<Long> queue = new ArrayDeque<>(List.of(child.getId()));
        Set<Long> visited = new HashSet<>();
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            if (current.equals(parent.getId())) {
                throw new CycleDetectedException(
                    "Can't add this dependency: it would create a cycle between phases.",
                    List.of(parent.getName(), child.getName())
                );
            }
            if (visited.add(current)) {
                queue.addAll(childrenByPhase.getOrDefault(current, List.of()));
            }
        }

        phaseDependencyRepository.save(PhaseDependencyEntity.builder()
            .projectId(projectId)
            .parentPhaseId(parent.getId())
            .childPhaseId(child.getId())
            .build());
    }

    private PhaseResponse mapToPhaseResponse(WorkPhaseEntity p, List<NodeEntity> phaseTasks, Set<Long> parentPhaseIds) {
        PhaseProgress progress = PhaseProgressCalculator.compute(phaseTasks);
        return new PhaseResponse(
            String.valueOf(p.getId()),
            p.getName(),
            p.getSubTitle(),
            p.getAccentColor() != null ? p.getAccentColor() : "slate",
            p.getOrderIndex(),
            parentPhaseIds.stream().map(String::valueOf).toList(),
            progress.status(),
            progress.progressPct(),
            progress.totalTasks(),
            progress.doneTasks(),
            p.getUiMetadata() != null ? p.getUiMetadata() : Map.of()
        );
    }

    private GraphNodeResponse mapToGraphNodeResponse(NodeEntity n) {
        return mapToGraphNodeResponse(n, n.getUiMetadata());
    }

    private GraphNodeResponse mapToGraphNodeResponse(NodeEntity n, Map<String, Object> uiMetadata) {
        return GraphNodeResponse.from(n, uiMetadata);
    }
}
