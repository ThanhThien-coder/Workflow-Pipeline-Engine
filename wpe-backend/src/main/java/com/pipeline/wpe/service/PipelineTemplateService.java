package com.pipeline.wpe.service;

import com.pipeline.wpe.dto.request.template.CreateTemplateRequest;
import com.pipeline.wpe.dto.response.template.DagValidationResponse;
import com.pipeline.wpe.dto.response.template.TemplateDetailResponse;
import com.pipeline.wpe.dto.response.template.TemplateSummaryResponse;
import com.pipeline.wpe.entity.PipelineTemplateEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.CycleDetectedException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.PipelineTemplateRepository;
import com.pipeline.wpe.repository.UserRepository;
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

    /**
     * 10.3.1 Lấy danh mục quy trình mẫu
     */
    @Transactional(readOnly = true)
    public List<TemplateSummaryResponse> getTemplates(String category, String search, Boolean isSystemStandard) {
        List<PipelineTemplateEntity> all = templateRepository.findAll();

        return all.stream()
            .filter(t -> {
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
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

        return mapToDetailResponse(template);
    }

    @Transactional(readOnly = true)
    public TemplateDetailResponse getTemplateByIdOrSlug(String idOrSlug) {
        PipelineTemplateEntity template = findTemplateEntity(idOrSlug);
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
        // Thẩm định Kahn 2 tầng
        DagValidationResponse validation = kahnDagService.validateTemplateGraph(request.graphData());
        if (!validation.valid()) {
            List<String> cycleNodes = validation.violations().stream()
                .flatMap(v -> v.nodeIds().stream())
                .toList();
            throw new CycleDetectedException("Phát hiện chu trình lặp trong đồ thị Template mẫu.", cycleNodes);
        }

        Long creatorId = currentUserId != null ? currentUserId : 1L;

        PipelineTemplateEntity entity = PipelineTemplateEntity.builder()
            .name(request.name().trim())
            .description(request.description())
            .category(request.category().trim())
            .createdBy(creatorId)
            .isSystemStandard(request.isSystemStandard() != null ? request.isSystemStandard() : false)
            .graphData(request.graphData())
            .cloneCount(0)
            .build();

        PipelineTemplateEntity saved = templateRepository.save(entity);
        log.info("Template #{} ('{}') created by user #{}", saved.getId(), saved.getName(), creatorId);
        return mapToDetailResponse(saved);
    }

    /**
     * 10.3.3 Cập nhật Template
     */
    @Transactional
    public TemplateDetailResponse updateTemplate(Long id, CreateTemplateRequest request, Long currentUserId) {
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

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
        if (request.isSystemStandard() != null) {
            template.setIsSystemStandard(request.isSystemStandard());
        }
        template.setGraphData(request.graphData());
        template.setUpdatedAt(Instant.now());

        PipelineTemplateEntity saved = templateRepository.save(template);
        return mapToDetailResponse(saved);
    }

    /**
     * 10.3.3 Xóa Template
     */
    @Transactional
    public void deleteTemplate(Long id, Long currentUserId) {
        PipelineTemplateEntity template = templateRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Template với ID: " + id));

        templateRepository.delete(template);
        log.info("Template #{} deleted by user #{}", id, currentUserId);
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
            t.getUpdatedAt()
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
            t.getGraphData() != null ? t.getGraphData() : Collections.emptyMap()
        );
    }
}
