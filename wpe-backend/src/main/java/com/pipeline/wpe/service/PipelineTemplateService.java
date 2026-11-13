package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.common.enums.TemplateVisibility;
import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.request.template.SaveProjectAsTemplateRequest;
import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.TemplateDetailResponse;
import com.pipeline.wpe.dto.response.template.TemplateSummaryResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.exception.ConflictException;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import com.pipeline.wpe.service.engine.KahnDagService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PipelineTemplateService {

    private final PipelineTemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final KahnDagService kahnDagService;
    private final ProjectAuthorizationService projectAuthorizationService;
    private final WorkPhaseRepository workPhaseRepository;
    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final PhaseDependencyRepository phaseDependencyRepository;
    private final AdminAuditService adminAuditService;

    /**
     * 10.3.1 Lấy danh mục quy trình mẫu
     */
    @Transactional(readOnly = true)
    public List<TemplateSummaryResponse> getTemplates(String category, String search, Boolean isSystemStandard) {
        return getTemplates(category, search, isSystemStandard, null, null);
    }

    @Transactional(readOnly = true)
    public List<TemplateSummaryResponse> getTemplates(String category, String search, Boolean isSystemStandard, Long currentUserId) {
        return getTemplates(category, search, isSystemStandard, currentUserId, null);
    }

    @Transactional(readOnly = true)
    public List<TemplateSummaryResponse> getTemplates(String category, String search, Boolean isSystemStandard, Long currentUserId, String visibility) {
        final TemplateVisibility targetVisibility;
        if (visibility != null && !visibility.trim().isEmpty()) {
            String v = visibility.trim();
            if ("PUBLIC".equalsIgnoreCase(v)) {
                targetVisibility = TemplateVisibility.PUBLIC;
            } else if ("PRIVATE".equalsIgnoreCase(v)) {
                targetVisibility = TemplateVisibility.PRIVATE;
            } else {
                throw new IllegalArgumentException("visibility chỉ nhận PUBLIC hoặc PRIVATE");
            }
        } else {
            targetVisibility = null;
        }

        List<PipelineTemplateEntity> all = templateRepository.findAll();

        return all.stream()
            .filter(t -> canView(t, currentUserId))
            .filter(t -> {
                if (targetVisibility != null) {
                    TemplateVisibility v = t.getVisibility() != null ? t.getVisibility() : TemplateVisibility.PUBLIC;
                    if (v != targetVisibility) return false;
                }
                if (category != null && !category.isBlank() && !"All".equalsIgnoreCase(category)) {
                    if (!category.equalsIgnoreCase(t.getCategory())) return false;
                }
                if (isSystemStandard != null) {
                    if (!isSystemStandard.equals(t.getIsSystemStandard())) return false;
                }
                if (search != null && !search.isBlank()) {
                    String q = search.trim().toLowerCase();
                    boolean matchName = t.getName() != null && t.getName().toLowerCase().contains(q);
                    boolean matchDesc = t.getDescription() != null && t.getDescription().toLowerCase().contains(q);
                    if (!matchName && !matchDesc) return false;
                }
                return true;
            })
            .map(this::mapToSummaryResponse)
            .toList();
    }

    /**
     * 10.3.2 Lấy chi tiết Template kèm cấu trúc graphData JSONB
     */
    @Transactional(readOnly = true)
    public TemplateDetailResponse getTemplateById(Long id) {
        return getTemplateById(id, null);
    }

    @Transactional(readOnly = true)
    public TemplateDetailResponse getTemplateById(Long id, Long currentUserId) {
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

        if (!canView(template, currentUserId)) {
            throw new ResourceNotFoundException("Không tìm thấy Template với ID: " + id);
        }

        return mapToDetailResponse(template);
    }

    @Transactional(readOnly = true)
    public TemplateDetailResponse getTemplateByIdOrSlug(String idOrSlug) {
        return getTemplateByIdOrSlug(idOrSlug, null);
    }

    @Transactional(readOnly = true)
    public TemplateDetailResponse getTemplateByIdOrSlug(String idOrSlug, Long currentUserId) {
        PipelineTemplateEntity template = findTemplateEntity(idOrSlug);
        if (!canView(template, currentUserId)) {
            try {
                Long.parseLong(idOrSlug.trim());
                throw new ResourceNotFoundException("Không tìm thấy Template với ID: " + idOrSlug);
            } catch (NumberFormatException e) {
                throw new ResourceNotFoundException("Không tìm thấy Template với slug: " + idOrSlug);
            }
        }
        return mapToDetailResponse(template);
    }

    @Transactional
    public TemplateDetailResponse updateTemplateBySlugOrId(String idOrSlug, CreateTemplateRequest request, Long currentUserId) {
        PipelineTemplateEntity template = findTemplateEntity(idOrSlug);
        return updateTemplate(template.getId(), request, currentUserId);
    }

    @Transactional
    public void deleteTemplateBySlugOrId(String idOrSlug, Long currentUserId) {
        PipelineTemplateEntity template = findTemplateEntity(idOrSlug);
        deleteTemplate(template.getId(), currentUserId);
    }

    public PipelineTemplateEntity findTemplateEntity(String idOrSlug) {
        if (idOrSlug == null || idOrSlug.isBlank()) {
            throw new ResourceNotFoundException("ID hoặc slug của Template không được để trống.");
        }
        try {
            Long id = Long.parseLong(idOrSlug.trim());
            return templateRepository.findById(id)
                .or(() -> templateRepository.findBySlug(idOrSlug.trim()))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + idOrSlug));
        } catch (NumberFormatException e) {
            return templateRepository.findBySlug(idOrSlug.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với slug: " + idOrSlug));
        }
    }

    /**
     * 10.3.3 Thêm mới Template (Thẩm định Kahn trước khi lưu)
     */
    @Transactional
    public TemplateDetailResponse createTemplate(CreateTemplateRequest request, Long currentUserId) {
        requireAdmin(currentUserId);

        // Thẩm định Kahn 2 tầng
        DagValidationResponse validation = kahnDagService.validateTemplateGraph(request.graphData());
        if (!validation.valid()) {
            List<String> cycleNodes = validation.violations().stream()
                .flatMap(v -> v.nodeIds().stream())
                .toList();
            throw new CycleDetectedException("Phát hiện chu trình lặp trong đồ thị Template mẫu.", cycleNodes);
        }

        PipelineTemplateEntity entity = PipelineTemplateEntity.builder()
            .name(request.name().trim())
            .description(request.description())
            .category(request.category().trim())
            .createdBy(currentUserId)
            .isSystemStandard(request.isSystemStandard() != null ? request.isSystemStandard() : false)
            .visibility(TemplateVisibility.PUBLIC)
            .graphData(request.graphData())
            .cloneCount(0)
            .build();

        PipelineTemplateEntity saved = templateRepository.save(entity);
        log.info("Template #{} ('{}') created by user #{}", saved.getId(), saved.getName(), currentUserId);
        adminAuditService.record(currentUserId, null, AdminAuditAction.TEMPLATE_CREATED, "TEMPLATE", String.valueOf(saved.getId()), saved.getName());
        return mapToDetailResponse(saved);
    }

    /**
     * 10.3.3 Cập nhật Template
     */
    @Transactional
    public TemplateDetailResponse updateTemplate(Long id, CreateTemplateRequest request, Long currentUserId) {
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

        requireCanManage(template, currentUserId);

        DagValidationResponse validation = kahnDagService.validateTemplateGraph(request.graphData());
        if (!validation.valid()) {
            List<String> cycleNodes = validation.violations().stream()
                .flatMap(v -> v.nodeIds().stream())
                .toList();
            throw new CycleDetectedException("Phát hiện chu trình lặp trong đồ thị Template mẫu.", cycleNodes);
        }

        template.setName(request.name().trim());
        template.setDescription(request.description());
        template.setCategory(request.category().trim());
        if (template.getVisibility() == TemplateVisibility.PRIVATE) {
            template.setIsSystemStandard(false);
        } else if (request.isSystemStandard() != null) {
            template.setIsSystemStandard(request.isSystemStandard());
        }
        template.setGraphData(request.graphData());
        template.setUpdatedAt(Instant.now());

        PipelineTemplateEntity saved = templateRepository.save(template);
        adminAuditService.record(currentUserId, null, AdminAuditAction.TEMPLATE_UPDATED, "TEMPLATE", String.valueOf(saved.getId()), saved.getName());
        return mapToDetailResponse(saved);
    }

    /**
     * 10.3.3 Xóa Template
     */
    @Transactional
    public void deleteTemplate(Long id, Long currentUserId) {
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

        requireCanManage(template, currentUserId);

        if (Boolean.TRUE.equals(template.getIsSystemStandard())) {
            throw new ConflictException("SYSTEM_TEMPLATE_LOCKED", "Không thể xóa template chuẩn của hệ thống.");
        }

        templateRepository.delete(template);
        log.info("Template #{} deleted by user #{}", id, currentUserId);
        adminAuditService.record(currentUserId, null, AdminAuditAction.TEMPLATE_DELETED, "TEMPLATE", String.valueOf(id), template.getName());
    }

    /**
     * Lưu đồ thị dự án thành Template cá nhân (PRIVATE)
     */
    @Transactional
    public TemplateDetailResponse saveProjectAsTemplate(Long projectId, SaveProjectAsTemplateRequest req, Long currentUserId) {
        projectAuthorizationService.verifyProjectOwner(projectId, currentUserId);

        List<WorkPhaseEntity> phases = workPhaseRepository.findByProjectIdOrderByOrderIndexAsc(projectId);
        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        List<NodeDependencyEntity> nodeDeps = nodeDependencyRepository.findByProjectId(projectId);
        List<PhaseDependencyEntity> phaseDeps = phaseDependencyRepository.findByProjectId(projectId);

        // Map childPhaseId -> Set of parent phase IDs ("ph-<parentId>")
        Map<Long, Set<String>> runsAfterMap = new LinkedHashMap<>();
        for (WorkPhaseEntity p : phases) {
            runsAfterMap.put(p.getId(), new LinkedHashSet<>());
            if (p.getParentPhaseId() != null) {
                runsAfterMap.get(p.getId()).add("ph-" + p.getParentPhaseId());
            }
        }
        for (PhaseDependencyEntity pd : phaseDeps) {
            if (runsAfterMap.containsKey(pd.getChildPhaseId())) {
                runsAfterMap.get(pd.getChildPhaseId()).add("ph-" + pd.getParentPhaseId());
            }
        }

        // Build phases list
        List<Map<String, Object>> phasesList = new ArrayList<>();
        for (WorkPhaseEntity p : phases) {
            Map<String, Object> pMap = new LinkedHashMap<>();
            pMap.put("id", "ph-" + p.getId());
            pMap.put("name", p.getName());
            pMap.put("subTitle", p.getSubTitle());
            pMap.put("accentColor", p.getAccentColor());
            pMap.put("order", p.getOrderIndex() != null ? p.getOrderIndex() : 0);
            pMap.put("runsAfter", new ArrayList<>(runsAfterMap.getOrDefault(p.getId(), Collections.emptySet())));
            pMap.put("uiMetadata", p.getUiMetadata() != null ? p.getUiMetadata() : Collections.emptyMap());
            phasesList.add(pMap);
        }

        // Build phaseEdges list (bỏ trùng)
        Set<String> seenPhaseEdges = new LinkedHashSet<>();
        List<Map<String, Object>> phaseEdgesList = new ArrayList<>();
        for (WorkPhaseEntity p : phases) {
            if (p.getParentPhaseId() != null) {
                String parentKey = "ph-" + p.getParentPhaseId();
                String childKey = "ph-" + p.getId();
                if (seenPhaseEdges.add(parentKey + "->" + childKey)) {
                    Map<String, Object> pe = new LinkedHashMap<>();
                    pe.put("parentPhaseId", parentKey);
                    pe.put("childPhaseId", childKey);
                    phaseEdgesList.add(pe);
                }
            }
        }
        for (PhaseDependencyEntity pd : phaseDeps) {
            String parentKey = "ph-" + pd.getParentPhaseId();
            String childKey = "ph-" + pd.getChildPhaseId();
            if (seenPhaseEdges.add(parentKey + "->" + childKey)) {
                Map<String, Object> pe = new LinkedHashMap<>();
                pe.put("parentPhaseId", parentKey);
                pe.put("childPhaseId", childKey);
                phaseEdgesList.add(pe);
            }
        }

        // Build nodes list (KHÔNG chép trạng thái, người làm, hạn chót, thời gian bắt đầu)
        List<Map<String, Object>> nodesList = new ArrayList<>();
        for (NodeEntity n : nodes) {
            Map<String, Object> nMap = new LinkedHashMap<>();
            nMap.put("id", "nd-" + n.getId());
            nMap.put("code", n.getCode());
            nMap.put("phaseId", n.getPhaseId() != null ? "ph-" + n.getPhaseId() : null);
            nMap.put("parentId", null);
            nMap.put("title", n.getTitle());
            nMap.put("description", n.getDescription());
            nMap.put("joinPolicy", n.getJoinPolicy() != null ? n.getJoinPolicy().name() : JoinPolicy.ALL_COMPLETED.name());
            nMap.put("estimatedHours", n.getEstimatedHours() != null ? n.getEstimatedHours() : 8);
            nMap.put("level", 0);
            nMap.put("uiMetadata", n.getUiMetadata() != null ? n.getUiMetadata() : Collections.emptyMap());
            nodesList.add(nMap);
        }

        // Build edges list
        List<Map<String, Object>> edgesList = new ArrayList<>();
        for (NodeDependencyEntity d : nodeDeps) {
            Map<String, Object> eMap = new LinkedHashMap<>();
            eMap.put("id", "e-" + d.getParentNodeId() + "-" + d.getChildNodeId());
            eMap.put("parentId", "nd-" + d.getParentNodeId());
            eMap.put("childId", "nd-" + d.getChildNodeId());
            eMap.put("kind", "DEPENDENCY");
            edgesList.add(eMap);
        }

        Map<String, Object> graphData = new LinkedHashMap<>();
        graphData.put("schemaVersion", 2);
        graphData.put("phases", phasesList);
        graphData.put("phaseEdges", phaseEdgesList);
        graphData.put("nodes", nodesList);
        graphData.put("edges", edgesList);
        graphData.put("metadata", Map.of("version", "1"));

        DagValidationResponse validation = kahnDagService.validateTemplateGraph(graphData);
        if (!validation.valid()) {
            List<String> cycleNodes = validation.violations().stream()
                .flatMap(v -> v.nodeIds().stream())
                .toList();
            throw new CycleDetectedException("Phát hiện chu trình lặp trong đồ thị Template mẫu.", cycleNodes);
        }

        String category = (req.category() != null && !req.category().isBlank()) ? req.category().trim() : "General";

        PipelineTemplateEntity entity = PipelineTemplateEntity.builder()
            .name(req.name().trim())
            .description(req.description())
            .category(category)
            .createdBy(currentUserId)
            .isSystemStandard(false)
            .visibility(TemplateVisibility.PRIVATE)
            .sourceProjectId(projectId)
            .cloneCount(0)
            .slug(null)
            .graphData(graphData)
            .build();

        PipelineTemplateEntity saved = templateRepository.save(entity);
        log.info("Project #{} saved as private template #{} by user #{}", projectId, saved.getId(), currentUserId);
        return mapToDetailResponse(saved);
    }

    private boolean canView(PipelineTemplateEntity t, Long userId) {
        if (t.getVisibility() == null || t.getVisibility() == TemplateVisibility.PUBLIC) {
            return true;
        }
        return userId != null && userId.equals(t.getCreatedBy());
    }

    private boolean isAdmin(Long userId) {
        if (userId == null) return false;
        return userRepository.findById(userId)
            .map(u -> u.getSystemRole() == SystemRole.ADMIN)
            .orElse(false);
    }

    private void requireAdmin(Long currentUserId) {
        if (currentUserId == null) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ quản trị viên hệ thống mới được quản lý template.");
        }
        UserEntity user = userRepository.findById(currentUserId)
            .orElseThrow(() -> new ForbiddenException("ACCESS_DENIED", "Chỉ quản trị viên hệ thống mới được quản lý template."));
        if (user.getSystemRole() != SystemRole.ADMIN) {
            throw new ForbiddenException("ACCESS_DENIED", "Chỉ quản trị viên hệ thống mới được quản lý template.");
        }
    }

    private void requireCanManage(PipelineTemplateEntity template, Long currentUserId) {
        if (isAdmin(currentUserId)) {
            return;
        }

        boolean isPrivate = template.getVisibility() == TemplateVisibility.PRIVATE;
        boolean isOwner = currentUserId != null && currentUserId.equals(template.getCreatedBy());

        if (isPrivate) {
            if (isOwner) {
                return;
            }
            throw new ResourceNotFoundException("Không tìm thấy Template với ID: " + template.getId());
        }

        throw new ForbiddenException("ACCESS_DENIED", "Chỉ quản trị viên hệ thống mới được quản lý template.");
    }

    /**
     * 10.3.4 Thẩm định đồ thị mẫu bằng giải thuật Kahn
     */
    public DagValidationResponse validateGraph(Map<String, Object> graphData) {
        return kahnDagService.validateTemplateGraph(graphData);
    }

    @SuppressWarnings("unchecked")
    private TemplateSummaryResponse mapToSummaryResponse(PipelineTemplateEntity t) {
        int phaseCount = 0;
        int nodeCount = 0;

        if (t.getGraphData() != null) {
            Object phasesObj = t.getGraphData().get("phases");
            if (phasesObj instanceof List<?> list) phaseCount = list.size();

            Object nodesObj = t.getGraphData().get("nodes");
            if (nodesObj instanceof List<?> list) nodeCount = list.size();
        }

        String creatorName = "Administrator";
        if (t.getCreatedBy() != null) {
            Optional<UserEntity> userOpt = userRepository.findById(t.getCreatedBy());
            if (userOpt.isPresent() && userOpt.get().getFullName() != null) {
                creatorName = userOpt.get().getFullName();
            }
        }

        String templateIdStr = (t.getSlug() != null && !t.getSlug().isBlank()) ? t.getSlug() : String.valueOf(t.getId());
        String visibilityStr = t.getVisibility() != null ? t.getVisibility().name() : TemplateVisibility.PUBLIC.name();
        return new TemplateSummaryResponse(
            templateIdStr,
            t.getName(),
            t.getDescription(),
            t.getCategory(),
            t.getIsSystemStandard(),
            phaseCount,
            nodeCount,
            t.getCloneCount() != null ? t.getCloneCount() : 0,
            creatorName,
            t.getCreatedAt(),
            t.getUpdatedAt(),
            visibilityStr,
            t.getSourceProjectId()
        );
    }

    private TemplateDetailResponse mapToDetailResponse(PipelineTemplateEntity t) {
        TemplateSummaryResponse summary = mapToSummaryResponse(t);
        return new TemplateDetailResponse(
            summary.id(),
            summary.name(),
            summary.description(),
            summary.category(),
            summary.isSystemStandard(),
            summary.phaseCount(),
            summary.nodeCount(),
            summary.cloneCount(),
            summary.createdBy(),
            summary.createdAt(),
            summary.updatedAt(),
            t.getGraphData() != null ? t.getGraphData() : Collections.emptyMap(),
            summary.visibility(),
            summary.sourceProjectId()
        );
    }
}
