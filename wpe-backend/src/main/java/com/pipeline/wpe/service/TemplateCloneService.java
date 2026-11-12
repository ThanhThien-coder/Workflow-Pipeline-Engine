package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.TemplateVisibility;
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
    private final PhaseDependencyRepository phaseDependencyRepository;
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
        // Bước 1: Xác thực Nguồn mẫu (Source Template)
        // =====================================================================
        Long numericId = req.getNumericTemplateId();
        String identifier = req.getTemplateIdentifier();

        Optional<PipelineTemplateEntity> pipelineTemplateOpt = Optional.empty();

        if (numericId != null) {
            pipelineTemplateOpt = pipelineTemplateRepository.findById(numericId);
        }

        if (pipelineTemplateOpt.isEmpty() && identifier != null) {
            pipelineTemplateOpt = pipelineTemplateRepository.findBySlug(identifier);
        }

        if (pipelineTemplateOpt.isEmpty()) {
            throw new ResourceNotFoundException("Không tìm thấy mẫu quy trình với ID: " + identifier);
        }

        PipelineTemplateEntity tpl = pipelineTemplateOpt.get();
        if (tpl.getVisibility() == TemplateVisibility.PRIVATE && (currentUserId == null || !currentUserId.equals(tpl.getCreatedBy()))) {
            throw new ResourceNotFoundException("Không tìm thấy mẫu quy trình với ID: " + identifier);
        }
        log.info("Tìm thấy PipelineTemplate mẫu: '{}' (ID: {}, Slug: {})", tpl.getName(), tpl.getId(), tpl.getSlug());

        // Tăng số lượt clone nếu nguồn là PipelineTemplateEntity
        tpl.setCloneCount((tpl.getCloneCount() != null ? tpl.getCloneCount() : 0) + 1);
        pipelineTemplateRepository.save(tpl);
        log.info("Đã cập nhật clone_count cho template ID {}: {}", tpl.getId(), tpl.getCloneCount());

        // =====================================================================
        // Bước 2: Khởi tạo Dự án Mới & Gán Chủ sở hữu (OWNER)
        // =====================================================================
        ProjectEntity newProject = ProjectEntity.builder()
            .name(req.projectName().trim())
            .description(req.description())
            .ownerId(currentUserId)
            .status(ProjectStatus.DRAFT)
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

        // =====================================================================
        // Bước 4: Sao chép sâu đồ thị DAG từ Template graphData
        // =====================================================================
        cloneFromTemplateGraphData(tpl, newProjectId, phaseIdMap, nodeIdMap);

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

        Map<String, Long> phaseKeyMap = new HashMap<>();
        Map<String, Long> nodeKeyMap = new HashMap<>();

        // 1. Nhân bản các WorkPhase từ Template graphData
        List<Map<String, Object>> phasesData = (List<Map<String, Object>>) graphData.get("phases");
        if (phasesData != null) {
            int order = 0;
            for (Map<String, Object> p : phasesData) {
                String phaseKey = p.get("id") != null ? p.get("id").toString() : String.valueOf(order);
                String phaseName = (String) p.getOrDefault("name", "Phase " + (order + 1));
                String subTitle = p.get("subTitle") != null ? p.get("subTitle").toString() :
                    (p.get("sub") != null ? p.get("sub").toString() : null);
                String accentColor = p.get("accentColor") != null ? p.get("accentColor").toString() :
                    (p.get("accent") != null ? p.get("accent").toString() : "blue");

                int phaseOrder = order;
                if (p.get("orderIndex") != null) {
                    try { phaseOrder = Integer.parseInt(p.get("orderIndex").toString()); } catch (Exception ignored) {}
                } else if (p.get("order") != null) {
                    try { phaseOrder = Integer.parseInt(p.get("order").toString()); } catch (Exception ignored) {}
                }
                order++;

                WorkPhaseEntity newPhase = WorkPhaseEntity.builder()
                    .projectId(newProjectId)
                    .name(phaseName)
                    .subTitle(subTitle)
                    .accentColor(accentColor)
                    .orderIndex(phaseOrder)
                    .build();
                WorkPhaseEntity savedPhase = workPhaseRepository.save(newPhase);
                phaseKeyMap.put(phaseKey, savedPhase.getId());
                try {
                    phaseIdMap.put(Long.parseLong(phaseKey), savedPhase.getId());
                } catch (NumberFormatException ignored) {}
            }
        }

        // 2. Tái lập liên kết thứ tự Phase (Phase DAG edges & runsAfter)
        Set<String> seenPhaseEdges = new HashSet<>();
        List<Map.Entry<Long, Long>> phaseEdgesToApply = new ArrayList<>();

        List<Map<String, Object>> phaseEdgesData = (List<Map<String, Object>>) graphData.get("phaseEdges");
        if (phaseEdgesData != null) {
            for (Map<String, Object> pe : phaseEdgesData) {
                Object parentKeyObj = pe.get("parentPhaseId") != null ? pe.get("parentPhaseId") : pe.get("source");
                Object childKeyObj = pe.get("childPhaseId") != null ? pe.get("childPhaseId") : pe.get("target");
                if (parentKeyObj != null && childKeyObj != null) {
                    Long parentPhaseId = phaseKeyMap.get(parentKeyObj.toString());
                    Long childPhaseId = phaseKeyMap.get(childKeyObj.toString());
                    if (parentPhaseId != null && childPhaseId != null && !parentPhaseId.equals(childPhaseId)) {
                        String edgeKey = parentPhaseId + "->" + childPhaseId;
                        if (seenPhaseEdges.add(edgeKey)) {
                            phaseEdgesToApply.add(Map.entry(parentPhaseId, childPhaseId));
                        }
                    }
                }
            }
        }
        if (phasesData != null) {
            for (Map<String, Object> p : phasesData) {
                String childKey = p.get("id") != null ? p.get("id").toString() : null;
                Long childPhaseId = childKey != null ? phaseKeyMap.get(childKey) : null;
                if (childPhaseId != null && p.get("runsAfter") instanceof List<?> runsAfterList) {
                    for (Object parentObj : runsAfterList) {
                        if (parentObj != null) {
                            Long parentPhaseId = phaseKeyMap.get(parentObj.toString());
                            if (parentPhaseId != null && !parentPhaseId.equals(childPhaseId)) {
                                String edgeKey = parentPhaseId + "->" + childPhaseId;
                                if (seenPhaseEdges.add(edgeKey)) {
                                    phaseEdgesToApply.add(Map.entry(parentPhaseId, childPhaseId));
                                }
                            }
                        }
                    }
                }
            }
        }

        List<PhaseDependencyEntity> extraPhaseDeps = new ArrayList<>();
        for (Map.Entry<Long, Long> edge : phaseEdgesToApply) {
            Long parentPhaseId = edge.getKey();
            Long childPhaseId = edge.getValue();
            WorkPhaseEntity childPhase = workPhaseRepository.findById(childPhaseId).orElse(null);
            if (childPhase != null) {
                if (childPhase.getParentPhaseId() == null) {
                    childPhase.setParentPhaseId(parentPhaseId);
                    workPhaseRepository.save(childPhase);
                } else if (!parentPhaseId.equals(childPhase.getParentPhaseId())) {
                    extraPhaseDeps.add(PhaseDependencyEntity.builder()
                        .projectId(newProjectId)
                        .parentPhaseId(parentPhaseId)
                        .childPhaseId(childPhaseId)
                        .build());
                }
            }
        }

        if (!extraPhaseDeps.isEmpty()) {
            phaseDependencyRepository.saveAll(extraPhaseDeps);
            log.info("Đã lưu {} quan hệ phase_dependency cho dự án ID {}", extraPhaseDeps.size(), newProjectId);
        }

        // 3. Nhân bản các Node và bảo toàn tọa độ uiMetadata
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
            for (Map<String, Object> n : nodesData) {
                Object parentId = n.get("parentId");
                if (parentId != null && !parentId.toString().isBlank()) {
                    nodeIdsWithIncoming.add(n.get("id") != null ? n.get("id").toString() : "");
                }
            }
        }

        if (nodesData != null) {
            int nodeSeq = 1;
            for (Map<String, Object> n : nodesData) {
                String rawId = n.get("id") != null ? n.get("id").toString() : String.valueOf(nodeSeq);
                String oldPhaseKey = n.get("phaseId") != null ? n.get("phaseId").toString() : null;
                Long newPhaseId = oldPhaseKey != null ? phaseKeyMap.get(oldPhaseKey) : null;
                boolean hasIncoming = nodeIdsWithIncoming.contains(rawId);

                NodeStatus initialStatus = hasIncoming ? NodeStatus.LOCKED : NodeStatus.TODO;
                String code = n.get("code") != null ? n.get("code").toString() : "WPE-" + String.format("%03d", nodeSeq++);
                String title = n.get("title") != null ? n.get("title").toString() : "Untitled Task";
                String description = n.get("description") != null ? n.get("description").toString() : null;

                JoinPolicy joinPolicy = JoinPolicy.ALL_COMPLETED;
                if (n.get("joinPolicy") != null) {
                    try {
                        joinPolicy = JoinPolicy.valueOf(n.get("joinPolicy").toString().toUpperCase());
                    } catch (Exception ignored) {}
                }

                // Bảo toàn nguyên vẹn tọa độ canvas uiMetadata (position {x, y})
                Map<String, Object> nodeUiMetadata = new HashMap<>();
                if (n.get("uiMetadata") instanceof Map<?, ?> m) {
                    nodeUiMetadata.putAll((Map<String, Object>) m);
                } else if (n.get("ui_metadata") instanceof Map<?, ?> m) {
                    nodeUiMetadata.putAll((Map<String, Object>) m);
                } else {
                    nodeUiMetadata.put("position", Map.of("x", 200, "y", 150));
                }

                NodeEntity newNode = NodeEntity.builder()
                    .projectId(newProjectId)
                    .phaseId(newPhaseId)
                    .code(code)
                    .title(title)
                    .description(description)
                    .status(initialStatus)
                    .joinPolicy(joinPolicy)
                    .estimatedHours(8)
                    .version(0L)
                    .uiMetadata(nodeUiMetadata)
                    .build();

                NodeEntity savedNode = nodeRepository.save(newNode);
                nodeKeyMap.put(rawId, savedNode.getId());
                try {
                    nodeIdMap.put(Long.parseLong(rawId), savedNode.getId());
                } catch (NumberFormatException ignored) {}
            }
        }

        // 4. Tái lập quan hệ phụ thuộc DAG (Cả Explicit Edges và Implicit Tree Edges)
        Set<String> seenEdges = new HashSet<>();
        List<NodeDependencyEntity> newDependencies = new ArrayList<>();

        // 4a. Cạnh tường minh từ mảng edges
        if (edgesData != null) {
            for (Map<String, Object> edge : edgesData) {
                Object sourceObj = edge.get("source") != null ? edge.get("source") : edge.get("parentId");
                Object targetObj = edge.get("target") != null ? edge.get("target") : edge.get("childId");

                if (sourceObj != null && targetObj != null) {
                    Long newParentId = nodeKeyMap.get(sourceObj.toString());
                    Long newChildId = nodeKeyMap.get(targetObj.toString());

                    if (newParentId != null && newChildId != null && !newParentId.equals(newChildId)) {
                        String edgeKey = newParentId + "->" + newChildId;
                        if (seenEdges.add(edgeKey)) {
                            newDependencies.add(NodeDependencyEntity.builder()
                                .projectId(newProjectId)
                                .parentNodeId(newParentId)
                                .childNodeId(newChildId)
                                .build());
                        }
                    }
                }
            }
        }

        // 4b. Cạnh ngầm định từ quan hệ cây parentId -> id
        if (nodesData != null) {
            for (Map<String, Object> n : nodesData) {
                Object childIdObj = n.get("id");
                Object parentIdObj = n.get("parentId");
                if (childIdObj != null && parentIdObj != null && !parentIdObj.toString().isBlank()) {
                    Long newParentId = nodeKeyMap.get(parentIdObj.toString());
                    Long newChildId = nodeKeyMap.get(childIdObj.toString());
                    if (newParentId != null && newChildId != null && !newParentId.equals(newChildId)) {
                        String edgeKey = newParentId + "->" + newChildId;
                        if (seenEdges.add(edgeKey)) {
                            newDependencies.add(NodeDependencyEntity.builder()
                                .projectId(newProjectId)
                                .parentNodeId(newParentId)
                                .childNodeId(newChildId)
                                .build());
                        }
                    }
                }
            }
        }

        if (!newDependencies.isEmpty()) {
            nodeDependencyRepository.saveAll(newDependencies);
            log.info("Đã tạo {} cạnh phụ thuộc DAG mới từ Template cho dự án ID {}",
                newDependencies.size(), newProjectId);
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
