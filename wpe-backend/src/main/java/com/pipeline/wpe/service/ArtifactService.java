package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.ArtifactType;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.artifact.ArtifactResponse;
import com.pipeline.wpe.dto.artifact.CreateArtifactRequest;
import com.pipeline.wpe.entity.ArtifactEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ArtifactRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArtifactService {

    private final ArtifactRepository artifactRepository;
    private final ProjectAuthorizationService projectAuthorizationService;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;

    /**
     * Lấy danh sách tài nguyên của dự án theo các điều kiện lọc.
     */
    @Transactional(readOnly = true)
    public List<ArtifactResponse> getProjectArtifacts(Long projectId, Long nodeId, Boolean inRepoOnly, Long currentUserId) {
        if (currentUserId != null) {
            projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
        }

        List<ArtifactEntity> entities;
        if (nodeId != null) {
            entities = artifactRepository.findByProjectIdAndNodeIdOrderByCreatedAtDesc(projectId, nodeId);
        } else if (Boolean.TRUE.equals(inRepoOnly)) {
            entities = artifactRepository.findByProjectIdAndIsInRepositoryTrueOrderByCreatedAtDesc(projectId);
        } else {
            entities = artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        }

        return entities.stream().map(ArtifactResponse::from).toList();
    }

    /**
     * Thêm mới liên kết tài nguyên ngoài (cấp Task hoặc cấp Dự án/Kho chung).
     */
    @Transactional
    public ArtifactResponse createArtifact(Long projectId, CreateArtifactRequest req, Long currentUserId) {
        if (currentUserId != null) {
            projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
        }

        ArtifactType resolvedType = (req.type() != null) ? req.type() : detectArtifactType(req.url());
        boolean isInRepo = (req.isInRepository() != null) ? req.isInRepository() : (req.nodeId() == null);

        ArtifactEntity entity = ArtifactEntity.builder()
                .projectId(projectId)
                .nodeId(req.nodeId())
                .uploadedBy(currentUserId != null ? currentUserId : 1L)
                .name(req.name().trim())
                .type(resolvedType)
                .url(req.url().trim())
                .isInRepository(isInRepo)
                .isPublicForGuest(true)
                .build();

        ArtifactEntity saved = artifactRepository.save(entity);
        log.info("[ArtifactService] Đã tạo artifact ID: {} cho Project: {}", saved.getId(), projectId);
        return ArtifactResponse.from(saved);
    }

    /**
     * Xóa liên kết tài nguyên.
     * Quyền: Người upload, Owner của dự án, hoặc System Admin.
     */
    @Transactional
    public void deleteArtifact(Long projectId, Long artifactId, Long currentUserId) {
        ArtifactEntity artifact = artifactRepository.findById(artifactId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài nguyên với ID: " + artifactId));

        if (!artifact.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Tài nguyên không thuộc về dự án này");
        }

        if (currentUserId != null) {
            boolean isUploader = artifact.getUploadedBy().equals(currentUserId);
            ProjectEntity project = projectAuthorizationService.getProjectOrThrow(projectId);
            boolean isOwner = project.getOwnerId().equals(currentUserId);

            boolean isProjectOwnerMember = projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentUserId)
                    .map(m -> m.getRole() == ProjectRole.OWNER)
                    .orElse(false);

            boolean isAdmin = userRepository.findById(currentUserId)
                    .map(u -> u.getSystemRole() == SystemRole.ADMIN)
                    .orElse(false);

            if (!isUploader && !isOwner && !isProjectOwnerMember && !isAdmin) {
                throw new ForbiddenException("ACCESS_DENIED", "Bạn không có quyền xóa tài nguyên này.");
            }
        }

        artifactRepository.delete(artifact);
        log.info("[ArtifactService] Đã xóa artifact ID: {} khỏi Project: {}", artifactId, projectId);
    }

    /**
     * Chuyển đổi cờ hiển thị trong Kho tài nguyên chung (is_in_repository).
     */
    @Transactional
    public ArtifactResponse toggleRepositoryVisibility(Long projectId, Long artifactId, boolean isInRepo, Long currentUserId) {
        if (currentUserId != null) {
            projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
        }

        ArtifactEntity artifact = artifactRepository.findById(artifactId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài nguyên với ID: " + artifactId));

        if (!artifact.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("Tài nguyên không thuộc về dự án này");
        }

        artifact.setIsInRepository(isInRepo);
        ArtifactEntity updated = artifactRepository.save(artifact);
        log.info("[ArtifactService] Đã cập nhật isInRepository = {} cho artifact ID: {}", isInRepo, artifactId);
        return ArtifactResponse.from(updated);
    }

    /**
     * Tự động nhận diện loại tài nguyên từ đường dẫn URL.
     */
    private ArtifactType detectArtifactType(String url) {
        if (url == null) return ArtifactType.OTHER_LINK;
        String lower = url.trim().toLowerCase();

        if (lower.contains("figma.com")) {
            return ArtifactType.FIGMA;
        }
        if (lower.contains("github.com") || lower.contains("gitlab.com")) {
            return ArtifactType.PR;
        }
        if (lower.contains("swagger") || lower.contains("openapi") || lower.contains("/api-docs")) {
            return ArtifactType.SWAGGER;
        }
        if (lower.contains("docs.google.com") || lower.contains("drive.google.com") || lower.contains("notion.so") || lower.contains("wiki")) {
            return ArtifactType.DOCS;
        }

        return ArtifactType.OTHER_LINK;
    }
}
