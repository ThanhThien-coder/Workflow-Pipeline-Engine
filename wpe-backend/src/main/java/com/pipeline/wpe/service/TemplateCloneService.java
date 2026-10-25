package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.project.CloneTemplateRequest;
import com.pipeline.wpe.dto.project.CloneTemplateResponse;
import com.pipeline.wpe.dto.project.ProjectDetailResponse;
import com.pipeline.wpe.dto.project.WorkPhaseSummaryResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.security.CurrentUserProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dịch vụ nhân bản quy trình mẫu và sao chép sâu đồ thị DAG (Deep-Copy DAG Engine).
 * Bảo toàn 100% cấu trúc thứ bậc WorkPhase, quan hệ phụ thuộc Topological của Node,
 * và reset an toàn trạng thái thực thi máy trạng thái FSM (LOCKED / TODO).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(rollbackFor = Exception.class)
public class TemplateCloneService {

    private final ProjectRepository projectRepository;
    private final WorkPhaseRepository workPhaseRepository;
    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final PipelineTemplateRepository pipelineTemplateRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final CurrentUserProvider currentUserProvider;
    private final UserRepository userRepository;

    /**
     * Sao chép sâu (deep-copy) toàn bộ cấu trúc DAG từ một mẫu quy trình hoặc dự án mẫu.
     *
     * @param req           Dữ liệu yêu cầu nhân bản gồm templateId, projectName, description, visibility
     * @param currentUserId ID của người dùng thực hiện (sẽ trở thành OWNER của dự án mới)
     * @return ProjectDetailResponse của dự án mới sau khi nhân bản hoàn tất
     */
    public ProjectDetailResponse cloneTemplate(CloneTemplateRequest req, Long currentUserId) {
        log.info("Bắt đầu quy trình nhân bản DAG từ templateId: {} cho user: {}", req.templateId(), currentUserId);

        // =====================================================================
        // Bước 1: Xác thực Nguồn mẫu (Source Template / Project)
        // =====================================================================
        Long sourceProjectId = null;
        Optional<ProjectEntity> sourceProjectOpt = projectRepository.findById(req.templateId());
        Optional<PipelineTemplateEntity> pipelineTemplateOpt = pipelineTemplateRepository.findById(req.templateId());

        if (sourceProjectOpt.isPresent()) {
            sourceProjectId = sourceProjectOpt.get().getId();
            log.info("Tìm thấy dự án mẫu nguồn: '{}' (ID: {})", sourceProjectOpt.get().getName(), sourceProjectId);
        } else if (pipelineTemplateOpt.isPresent()) {
            // Trường hợp templateId nằm trong bảng pipeline_template
            PipelineTemplateEntity tpl = pipelineTemplateOpt.get();
            log.info("Tìm thấy PipelineTemplate mẫu: '{}' (ID: {})", tpl.getName(), tpl.getId());
            // Nếu có project cùng ID hoặc ánh xạ, fallback về ID đó
            if (projectRepository.existsById(tpl.getId())) {
                sourceProjectId = tpl.getId();
            }
        }

        if (sourceProjectId == null && pipelineTemplateOpt.isEmpty()) {
            throw new ResourceNotFoundException("Không tìm thấy mẫu quy trình hoặc dự án nguồn với ID: " + req.templateId());
        }

        // Tăng số lượt clone nếu nguồn là PipelineTemplateEntity
        pipelineTemplateOpt.ifPresent(tpl -> {
            tpl.setCloneCount((tpl.getCloneCount() != null ? tpl.getCloneCount() : 0) + 1);
            pipelineTemplateRepository.save(tpl);
            log.info("Đã cập nhật clone_count cho template ID {}: {}", tpl.getId(), tpl.getCloneCount());
        });

        // =====================================================================
        // Bước 2: Khởi tạo Dự án Mới & Gán Chủ sở hữu (OWNER)
        // =====================================================================
        ProjectEntity newProject = ProjectEntity.builder()
            .name(req.projectName().trim())
            .description(req.description())
            .ownerId(currentUserId)
            .status(ProjectStatus.PLANNING)
            .build();

        ProjectEntity savedProject = projectRepository.save(newProject);
        Long newProjectId = savedProject.getId();
        log.info("Khởi tạo dự án mới thành công với ID: {}", newProjectId);

        ProjectMemberEntity ownerMember = ProjectMemberEntity.builder()
            .projectId(newProjectId)
            .userId(currentUserId)
            .role(ProjectRole.OWNER)
            .joinedAt(Instant.now())
            .removedAt(null)
            .build();
        projectMemberRepository.save(ownerMember);

        // =====================================================================
        // Bước 3: Khởi tạo Bảng Ánh xạ ID Trong Bộ Nhớ (In-Memory ID Mapping)
        // =====================================================================
        Map<Long, Long> phaseIdMap = new HashMap<>(); // oldPhaseId -> newPhaseId
        Map<Long, Long> nodeIdMap = new HashMap<>();   // oldNodeId -> newNodeId

        // Nếu sourceProjectId hợp lệ trong bảng project, tiến hành nhân bản relational DAG
        if (sourceProjectId != null) {
            // =====================================================================
            // Bước 4: Nhân bản các WorkPhase
            // =====================================================================
            List<WorkPhaseEntity> oldPhases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(sourceProjectId);
            log.info("Nhân bản {} giai đoạn (phases) từ sourceProjectId: {}", oldPhases.size(), sourceProjectId);

            for (WorkPhaseEntity oldPhase : oldPhases) {
                WorkPhaseEntity newPhase = WorkPhaseEntity.builder()
                    .projectId(newProjectId)
                    .parentPhaseId(null) // Cập nhật quan hệ cha-con ở pass 2 nếu có
                    .name(oldPhase.getName())
                    .subTitle(oldPhase.getSubTitle())
                    .accentColor(oldPhase.getAccentColor())
                    .orderIndex(oldPhase.getOrderIndex() != null ? oldPhase.getOrderIndex() : 0)
                    .build();
                WorkPhaseEntity savedPhase = workPhaseRepository.save(newPhase);
                phaseIdMap.put(oldPhase.getId(), savedPhase.getId());
            }

            // Tái liên kết quan hệ phân tầng phase cha - con (sub-phases)
            for (WorkPhaseEntity oldPhase : oldPhases) {
                if (oldPhase.getParentPhaseId() != null && phaseIdMap.containsKey(oldPhase.getParentPhaseId())) {
                    Long newPhaseId = phaseIdMap.get(oldPhase.getId());
                    WorkPhaseEntity newPhase = workPhaseRepository.findById(newPhaseId).orElse(null);
                    if (newPhase != null) {
                        newPhase.setParentPhaseId(phaseIdMap.get(oldPhase.getParentPhaseId()));
                        workPhaseRepository.save(newPhase);
                    }
                }
            }

            // =====================================================================
            // Bước 5: Nhân bản các Node & Đặt Lại Trạng Thái Máy (FSM Reset)
            // =====================================================================
            List<NodeEntity> oldNodes = nodeRepository.findByProjectId(sourceProjectId);
            List<NodeDependencyEntity> oldDependencies = nodeDependencyRepository.findByProjectId(sourceProjectId);

            // Tập hợp ID của các node có cạnh tiền nhiệm (incoming dependencies: là child_node_id)
            Set<Long> nodeIdsWithIncomingDeps = oldDependencies.stream()
                .map(NodeDependencyEntity::getChildNodeId)
                .collect(Collectors.toSet());

            log.info("Nhân bản {} nodes từ sourceProjectId: {} (Số node có incoming deps: {})",
                oldNodes.size(), sourceProjectId, nodeIdsWithIncomingDeps.size());

            for (NodeEntity oldNode : oldNodes) {
                Long newPhaseId = oldNode.getPhaseId() != null ? phaseIdMap.get(oldNode.getPhaseId()) : null;
                boolean hasIncoming = nodeIdsWithIncomingDeps.contains(oldNode.getId());

                // Reset FSM: Node gốc không có tiền nhiệm -> TODO, Node có tiền nhiệm -> LOCKED
                NodeStatus initialStatus = hasIncoming ? NodeStatus.LOCKED : NodeStatus.TODO;

                NodeEntity newNode = NodeEntity.builder()
                    .projectId(newProjectId)
                    .phaseId(newPhaseId)
                    .code(oldNode.getCode())
                    .title(oldNode.getTitle())
                    .description(oldNode.getDescription())
                    .status(initialStatus)
                    .assignedUserId(null)
                    .joinPolicy(oldNode.getJoinPolicy() != null ? oldNode.getJoinPolicy() : JoinPolicy.ALL_COMPLETED)
                    .rejectReason(null)
                    .dueDate(null)
                    .isOverdue(false)
                    .estimatedHours(oldNode.getEstimatedHours() != null ? oldNode.getEstimatedHours() : 8)
                    .startedAt(null)
                    .version(0L)
                    .uiMetadata(oldNode.getUiMetadata() != null ? new HashMap<>(oldNode.getUiMetadata()) : new HashMap<>())
                    .build();

                NodeEntity savedNode = nodeRepository.save(newNode);
                nodeIdMap.put(oldNode.getId(), savedNode.getId());
            }

            // =====================================================================
            // Bước 6: Tái lập Cạnh Phụ Thuộc DAG (Node Dependencies)
            // =====================================================================
            List<NodeDependencyEntity> newDependencies = new ArrayList<>();
            for (NodeDependencyEntity oldDep : oldDependencies) {
                Long newParentId = nodeIdMap.get(oldDep.getParentNodeId());
                Long newChildId = nodeIdMap.get(oldDep.getChildNodeId());

                if (newParentId != null && newChildId != null) {
                    NodeDependencyEntity newDep = NodeDependencyEntity.builder()
                        .projectId(newProjectId)
                        .parentNodeId(newParentId)
                        .childNodeId(newChildId)
                        .build();
                    newDependencies.add(newDep);
                }
            }

            if (!newDependencies.isEmpty()) {
                nodeDependencyRepository.saveAll(newDependencies);
                log.info("Tái lập thành công {} cạnh phụ thuộc DAG mới cho dự án ID: {}",
                    newDependencies.size(), newProjectId);
            }
        } else if (pipelineTemplateOpt.isPresent()) {
            // Trường hợp mẫu nằm hoàn toàn trong graph_data JSONB của PipelineTemplateEntity
            PipelineTemplateEntity tpl = pipelineTemplateOpt.get();
            cloneFromTemplateGraphData(tpl, newProjectId, phaseIdMap, nodeIdMap);
        }

        // =====================================================================
        // Bước 7: Trả về kết quả ProjectDetailResponse
        // =====================================================================
        String ownerName = getOwnerDisplayName(currentUserId);
        List<WorkPhaseEntity> createdPhases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(newProjectId);
        List<NodeEntity> createdNodes = nodeRepository.findByProjectId(newProjectId);

        Map<Long, Long> nodesPerPhase = createdNodes.stream()
            .filter(n -> n.getPhaseId() != null)
            .collect(Collectors.groupingBy(NodeEntity::getPhaseId, Collectors.counting()));

        List<WorkPhaseSummaryResponse> phaseResponses = createdPhases.stream()
            .map(p -> WorkPhaseSummaryResponse.fromEntity(
                p,
                nodesPerPhase.getOrDefault(p.getId(), 0L).intValue()
            ))
            .toList();

        int totalNodes = createdNodes.size();
        int completedNodes = 0;
        int inProgressNodes = 0;

        log.info("Hoàn thành sao chép sâu DAG cho dự án ID {}. Đã tạo: {} phases, {} nodes.",
            newProjectId, createdPhases.size(), totalNodes);

        return ProjectDetailResponse.fromEntity(
            savedProject,
            ownerName,
            totalNodes,
            completedNodes,
            inProgressNodes,
            phaseResponses
        );
    }

    /**
     * Nhân bản quy trình kèm theo các số liệu thống kê chi tiết.
     */
    public CloneTemplateResponse cloneTemplateWithStats(CloneTemplateRequest req, Long currentUserId) {
        ProjectDetailResponse detail = cloneTemplate(req, currentUserId);
        int clonedPhasesCount = detail.phases() != null ? detail.phases().size() : 0;
        int clonedNodesCount = detail.totalNodes();
        int clonedDependenciesCount = nodeDependencyRepository.findByProjectId(detail.id()).size();

        return CloneTemplateResponse.fromProjectDetail(
            detail,
            clonedPhasesCount,
            clonedNodesCount,
            clonedDependenciesCount
        );
    }

    /**
     * Hỗ trợ giải mã và nhân bản từ JSONB graph_data của PipelineTemplateEntity (nếu có).
     */
    @SuppressWarnings("unchecked")
    private void cloneFromTemplateGraphData(
        PipelineTemplateEntity tpl,
        Long newProjectId,
        Map<Long, Long> phaseIdMap,
        Map<Long, Long> nodeIdMap
    ) {
        Map<String, Object> graphData = tpl.getGraphData();
        if (graphData == null || graphData.isEmpty()) {
            return;
        }

        List<Map<String, Object>> phasesData = (List<Map<String, Object>>) graphData.get("phases");
        if (phasesData != null) {
            int order = 0;
            for (Map<String, Object> p : phasesData) {
                Long oldId = p.get("id") != null ? Long.valueOf(p.get("id").toString()) : (long) order;
                WorkPhaseEntity newPhase = WorkPhaseEntity.builder()
                    .projectId(newProjectId)
                    .name((String) p.getOrDefault("name", "Phase " + (order + 1)))
                    .subTitle((String) p.get("subTitle"))
                    .accentColor((String) p.getOrDefault("accentColor", "blue"))
                    .orderIndex(order++)
                    .build();
                WorkPhaseEntity savedPhase = workPhaseRepository.save(newPhase);
                phaseIdMap.put(oldId, savedPhase.getId());
            }
        }

        List<Map<String, Object>> nodesData = (List<Map<String, Object>>) graphData.get("nodes");
        List<Map<String, Object>> edgesData = (List<Map<String, Object>>) graphData.get("edges");

        Set<String> nodeIdsWithIncoming = new HashSet<>();
        if (edgesData != null) {
            for (Map<String, Object> edge : edgesData) {
                Object target = edge.get("target") != null ? edge.get("target") : edge.get("childId");
                if (target != null) {
                    nodeIdsWithIncoming.add(target.toString());
                }
            }
        }

        if (nodesData != null) {
            int nodeSeq = 1;
            for (Map<String, Object> n : nodesData) {
                String rawId = n.get("id") != null ? n.get("id").toString() : String.valueOf(nodeSeq);
                Long oldId = null;
                try {
                    oldId = Long.parseLong(rawId);
                } catch (NumberFormatException ignored) {
                    oldId = (long) nodeSeq;
                }

                Long oldPhaseId = n.get("phaseId") != null ? Long.valueOf(n.get("phaseId").toString()) : null;
                Long newPhaseId = oldPhaseId != null ? phaseIdMap.get(oldPhaseId) : null;
                boolean hasIncoming = nodeIdsWithIncoming.contains(rawId);

                NodeStatus initialStatus = hasIncoming ? NodeStatus.LOCKED : NodeStatus.TODO;

                NodeEntity newNode = NodeEntity.builder()
                    .projectId(newProjectId)
                    .phaseId(newPhaseId)
                    .code((String) n.getOrDefault("code", "TASK-" + String.format("%03d", nodeSeq++)))
                    .title((String) n.getOrDefault("title", "Untitled Task"))
                    .description((String) n.get("description"))
                    .status(initialStatus)
                    .joinPolicy(JoinPolicy.ALL_COMPLETED)
                    .estimatedHours(8)
                    .version(0L)
                    .uiMetadata(new HashMap<>())
                    .build();

                NodeEntity savedNode = nodeRepository.save(newNode);
                nodeIdMap.put(oldId, savedNode.getId());
            }
        }

        if (edgesData != null) {
            List<NodeDependencyEntity> newDependencies = new ArrayList<>();
            for (Map<String, Object> edge : edgesData) {
                Object sourceObj = edge.get("source") != null ? edge.get("source") : edge.get("parentId");
                Object targetObj = edge.get("target") != null ? edge.get("target") : edge.get("childId");

                if (sourceObj != null && targetObj != null) {
                    try {
                        Long oldParentId = Long.parseLong(sourceObj.toString());
                        Long oldChildId = Long.parseLong(targetObj.toString());

                        Long newParentId = nodeIdMap.get(oldParentId);
                        Long newChildId = nodeIdMap.get(oldChildId);

                        if (newParentId != null && newChildId != null) {
                            newDependencies.add(NodeDependencyEntity.builder()
                                .projectId(newProjectId)
                                .parentNodeId(newParentId)
                                .childNodeId(newChildId)
                                .build());
                        }
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
            if (!newDependencies.isEmpty()) {
                nodeDependencyRepository.saveAll(newDependencies);
            }
        }
    }

    private String getOwnerDisplayName(Long ownerId) {
        if (ownerId == null) {
            return "Unknown";
        }
        return userRepository.findById(ownerId)
            .map(u -> (u.getFullName() != null && !u.getFullName().isBlank()) ? u.getFullName() : u.getUsername())
            .orElse("User #" + ownerId);
    }
}
