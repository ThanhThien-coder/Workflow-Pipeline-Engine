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
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.PhaseDependencyRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.WorkPhaseRepository;
import com.pipeline.wpe.service.engine.KahnDagService;
import com.pipeline.wpe.service.engine.KahnDagService.ProjectKahnResult;
import com.pipeline.wpe.service.engine.PhaseProgressCalculator;
import com.pipeline.wpe.service.engine.PhaseProgressCalculator.PhaseProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

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
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        if (request.parentPhaseId() != null) {
            WorkPhaseEntity parent = workPhaseRepository.findById(request.parentPhaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase cha với ID: " + request.parentPhaseId()));
            if (!parent.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("Phase cha không thuộc về dự án này.");
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
        return mapToPhaseResponse(saved, Collections.emptyList(), parentIds);
    }

    /**
     * 4.2 Cập nhật Macro Phase
     */
    @Transactional
    public PhaseResponse updatePhase(Long projectId, Long phaseId, UpdatePhaseRequest request, Long currentUserId) {
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        WorkPhaseEntity entity = workPhaseRepository.findById(phaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase với ID: " + phaseId));

        if (!entity.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Phase không thuộc về dự án này.");
        }

        if (request.parentPhaseId() != null) {
            if (request.parentPhaseId().equals(phaseId)) {
                throw new IllegalArgumentException("Phase không thể phụ thuộc vào chính nó.");
            }
            WorkPhaseEntity parent = workPhaseRepository.findById(request.parentPhaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase cha với ID: " + request.parentPhaseId()));
            if (!parent.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("Phase cha không thuộc về dự án này.");
            }
            // Thêm Phase tiền nhiệm (giữ các cha cũ), có kiểm tra chu trình
            addPhaseEdge(projectId, parent, entity);
        }

        entity.setName(request.name().trim());
        if (request.sub() != null) entity.setSubTitle(request.sub().trim());
        if (request.accent() != null) entity.setAccentColor(request.accent().trim());
        if (request.orderIndex() != null) entity.setOrderIndex(request.orderIndex());

        WorkPhaseEntity saved = workPhaseRepository.save(entity);
        Set<Long> parentIds = loadPhaseParents(projectId, workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId))
            .getOrDefault(phaseId, Set.of());
        return mapToPhaseResponse(saved, nodeRepository.findByPhaseId(phaseId), parentIds);
    }

    /**
     * 4.2 Xóa Phase (Bảo toàn dữ liệu: chuyển node con sang standalone)
     */
    @Transactional
    public void deletePhase(Long projectId, Long phaseId, Long currentUserId) {
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        WorkPhaseEntity entity = workPhaseRepository.findById(phaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase với ID: " + phaseId));

        if (!entity.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Phase không thuộc về dự án này.");
        }

        // Chuyển toàn bộ node thuộc phase này sang standalone (phase_id = null)
        List<NodeEntity> nodesInPhase = nodeRepository.findByPhaseId(phaseId);
        for (NodeEntity node : nodesInPhase) {
            node.setPhaseId(null);
        }
        nodeRepository.saveAll(nodesInPhase);

        // Gỡ liên kết parent_phase_id cho các phase con
        List<WorkPhaseEntity> childPhases = workPhaseRepository.findByParentPhaseIdOrderByOrderIndexAsc(phaseId);
        for (WorkPhaseEntity cp : childPhases) {
            cp.setParentPhaseId(null);
        }
        workPhaseRepository.saveAll(childPhases);

        // Các cạnh trong bảng phase_dependency tự xóa theo ON DELETE CASCADE (V6)
        workPhaseRepository.delete(entity);
    }

    /**
     * 4.2 Nối quan hệ phụ thuộc giữa 2 Phase
     */
    @Transactional
    public void connectPhases(Long projectId, Long sourcePhaseId, Long targetPhaseId, Long currentUserId) {
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        if (sourcePhaseId.equals(targetPhaseId)) {
            throw new IllegalArgumentException("Phase không thể phụ thuộc vào chính nó.");
        }

        WorkPhaseEntity target = workPhaseRepository.findById(targetPhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase đích với ID: " + targetPhaseId));
        WorkPhaseEntity source = workPhaseRepository.findById(sourcePhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase nguồn với ID: " + sourcePhaseId));

        if (!target.getProjectId().equals(projectId) || !source.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Hai Phase phải thuộc về cùng dự án này.");
        }

        // Thêm cạnh vào bảng nối (giữ nguyên các Phase cha đã có), chặn chu trình
        addPhaseEdge(projectId, source, target);
    }

    /**
     * 4.2 Gỡ bỏ quan hệ phụ thuộc giữa 2 Phase
     */
    @Transactional
    public void disconnectPhases(Long projectId, Long sourcePhaseId, Long targetPhaseId, Long currentUserId) {
        authorizationService.verifyProjectOwner(projectId, currentUserId);

        WorkPhaseEntity target = workPhaseRepository.findById(targetPhaseId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase đích với ID: " + targetPhaseId));

        if (!target.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Phase không thuộc về dự án này.");
        }

        phaseDependencyRepository.deleteByParentPhaseIdAndChildPhaseId(sourcePhaseId, targetPhaseId);

        // Cạnh cũ có thể còn nằm ở cột parent_phase_id (dữ liệu trước V6 / clone template)
        if (target.getParentPhaseId() != null && target.getParentPhaseId().equals(sourcePhaseId)) {
            target.setParentPhaseId(null);
            workPhaseRepository.save(target);
        }
    }

    /**
     * 4.3 Tạo Node công việc mới
     */
    @Transactional
    public GraphNodeResponse createNode(Long projectId, CreateNodeRequest request, Long currentUserId) {
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        if (request.phaseId() != null) {
            WorkPhaseEntity phase = workPhaseRepository.findById(request.phaseId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Phase với ID: " + request.phaseId()));
            if (!phase.getProjectId().equals(projectId)) {
                throw new IllegalArgumentException("Phase không thuộc về dự án này.");
            }
        }

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
                throw new ConflictException("DUPLICATE_NODE_CODE", "Mã công việc '" + code + "' đã tồn tại trong dự án.");
            }
        }

        // Trạng thái ban đầu: Standalone là TODO, nằm trong Phase là LOCKED
        NodeStatus initialStatus = (request.phaseId() == null) ? NodeStatus.TODO : NodeStatus.LOCKED;
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
        return mapToGraphNodeResponse(saved);
    }

    /**
     * 4.3 Nối cạnh quan hệ phụ thuộc (NODE_DEPENDENCY)
     */
    @Transactional
    public DependencyResponse createDependency(Long projectId, CreateDependencyRequest request, Long currentUserId) {
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        Long parentId = request.parentNodeId();
        Long childId = request.childNodeId();

        if (parentId.equals(childId)) {
            throw new IllegalArgumentException("Không thể nối một công việc phụ thuộc vào chính nó.");
        }

        NodeEntity parent = nodeRepository.findById(parentId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy công việc cha với ID: " + parentId));
        NodeEntity child = nodeRepository.findById(childId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy công việc con với ID: " + childId));

        if (!parent.getProjectId().equals(projectId) || !child.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Hai công việc phải thuộc về cùng dự án này.");
        }

        // Idempotent: nếu đã nối rồi thì trả về luôn
        if (nodeDependencyRepository.existsByParentNodeIdAndChildNodeId(parentId, childId)) {
            return new DependencyResponse(String.valueOf(parentId), String.valueOf(childId));
        }

        // Kiểm tra vòng lặp 2 đỉnh trực tiếp: child -> parent đã có mà lại nối parent -> child
        if (nodeDependencyRepository.existsByParentNodeIdAndChildNodeId(childId, parentId)) {
            throw new CycleDetectedException(
                "Phát hiện chu trình lặp phụ thuộc 2 chiều.",
                List.of(parent.getCode(), child.getCode())
            );
        }

        NodeDependencyEntity entity = NodeDependencyEntity.builder()
            .projectId(projectId)
            .parentNodeId(parentId)
            .childNodeId(childId)
            .build();

        nodeDependencyRepository.save(entity);
        return new DependencyResponse(String.valueOf(parentId), String.valueOf(childId));
    }

    /**
     * 4.3 Xóa cạnh quan hệ phụ thuộc
     */
    @Transactional
    public void deleteDependency(Long projectId, Long parentNodeId, Long childNodeId, Long currentUserId) {
        authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        Optional<NodeDependencyEntity> existing = nodeDependencyRepository.findByParentNodeIdAndChildNodeId(parentNodeId, childNodeId);
        if (existing.isEmpty()) {
            return; // Idempotent: cạnh không tồn tại thì coi như đã xóa
        }
        // Chặn xóa cạnh của dự án khác qua projectId của dự án mình
        if (!existing.get().getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Liên kết phụ thuộc không thuộc về dự án này.");
        }
        nodeDependencyRepository.delete(existing.get());
    }

    /**
     * 4.4 Cập nhật tọa độ vẽ Canvas vào JSONB ui_metadata
     */
    @Transactional
    public GraphNodeResponse updateNodeMetadata(Long nodeId, UpdateNodeMetadataRequest request, Long currentUserId) {
        NodeEntity node = nodeRepository.findById(nodeId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy công việc với ID: " + nodeId));

        authorizationService.verifyProjectMemberOrOwner(node.getProjectId(), currentUserId);

        node.setUiMetadata(request.metadata());
        NodeEntity saved = nodeRepository.save(node);
        return mapToGraphNodeResponse(saved);
    }

    /**
     * 4.5 Kích hoạt dự án từ DRAFT sang ACTIVE (Chạy thuật toán Kahn phát hiện chu trình)
     */
    @Transactional
    public PublishPipelineResponse publishPipeline(Long projectId, Long currentUserId) {
        ProjectEntity project = authorizationService.verifyProjectOwner(projectId, currentUserId);

        if (project.getStatus() == com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE) {
            throw new IllegalArgumentException("Dự án đã được xuất bản trước đó.");
        }

        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        List<NodeDependencyEntity> dependencies = nodeDependencyRepository.findByProjectId(projectId);

        ProjectKahnResult result = kahnDagService.validateProjectDag(nodes, dependencies);

        if (!result.isValid()) {
            throw new CycleDetectedException(
                "Phát hiện chu trình lặp phụ thuộc trong đồ thị quy trình. Không thể xuất bản.",
                result.cycleNodeCodes()
            );
        }

        // Đồ thị hợp lệ: Chuyển dự án sang ACTIVE
        project.setStatus(com.pipeline.wpe.common.enums.ProjectStatus.ACTIVE);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        // Tự động mở khóa các node gốc (in-degree == 0) từ LOCKED -> TODO
        int unlockedCount = 0;
        for (NodeEntity node : nodes) {
            if (result.rootNodeIds().contains(node.getId()) && node.getStatus() == NodeStatus.LOCKED) {
                node.setStatus(NodeStatus.TODO);
                nodeRepository.save(node);
                unlockedCount++;
            }
        }

        log.info("Project #{} published successfully. Unlocked {} root tasks.", projectId, unlockedCount);
        return new PublishPipelineResponse(true, "ACTIVE", Instant.now(), unlockedCount);
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
                    "Không thể nối Phase: tạo chu trình lặp giữa các Phase.",
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
            progress.doneTasks()
        );
    }

    private GraphNodeResponse mapToGraphNodeResponse(NodeEntity n) {
        return new GraphNodeResponse(
            String.valueOf(n.getId()),
            n.getPhaseId() != null ? String.valueOf(n.getPhaseId()) : null,
            n.getCode(),
            n.getTitle(),
            n.getDescription(),
            n.getStatus().name(),
            n.getJoinPolicy().name(),
            n.getAssignedUserId() != null ? String.valueOf(n.getAssignedUserId()) : null,
            n.getDueDate(),
            n.getEstimatedHours(),
            n.getVersion(),
            n.getUiMetadata()
        );
    }
}
