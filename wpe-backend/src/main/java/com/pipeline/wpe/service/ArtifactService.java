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
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
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
    private final ProjectRealtimeNotifier projectRealtimeNotifier;

    /**
     * Lấy danh sách tài nguyên của dự án theo các điều kiện lọc.
     */
    @Transactional(readOnly = true)
    public List<ArtifactResponse> getProjectArtifacts(Long projectId, Long nodeId, Boolean inRepoOnly, Long currentUserId) {
        // C4: luôn kiểm thành viên; không có người gọi thì chặn (không còn "null thì bỏ qua kiểm").
        if (currentUserId == null) {
            throw new ForbiddenException("ACCESS_DENIED", "Please sign in to view the artifact repository.");
        }
        projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

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
        requireWriter(projectId, currentUserId);

        ArtifactType resolvedType = resolveType(req.type(), req.url());
        boolean isInRepo = (req.isInRepository() != null) ? req.isInRepository() : (req.nodeId() == null);
        String name = req.name().trim();
        String url = req.url().trim();

        // G17: trùng hoàn toàn (cùng dự án, tên, link) ở cùng chỗ (cùng trong kho, hoặc cùng task) thì trả bản có sẵn.
        // Cùng link mà khác tên vẫn thêm bình thường.
        java.util.Optional<ArtifactEntity> identical = artifactRepository.findByProjectIdAndNameAndUrl(projectId, name, url).stream()
                .filter(a -> isInRepo
                        ? Boolean.TRUE.equals(a.getIsInRepository())
                        : java.util.Objects.equals(a.getNodeId(), req.nodeId()))
                .findFirst();
        if (identical.isPresent()) {
            log.info("[ArtifactService] Bỏ qua artifact trùng (ID có sẵn: {}) cho Project: {}", identical.get().getId(), projectId);
            return ArtifactResponse.from(identical.get());
        }

        ArtifactEntity entity = ArtifactEntity.builder()
                .projectId(projectId)
                .nodeId(req.nodeId())
                .uploadedBy(currentUserId)
                .name(name)
                .type(resolvedType)
                .url(url)
                .isInRepository(isInRepo)
                .isPublicForGuest(true)
                .build();

        ArtifactEntity saved = artifactRepository.save(entity);
        log.info("[ArtifactService] Đã tạo artifact ID: {} cho Project: {}", saved.getId(), projectId);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "ARTIFACTS", "ARTIFACT_ADDED", currentUserId, null, saved.getNodeId());
        return ArtifactResponse.from(saved);
    }

    /**
     * Xóa liên kết tài nguyên.
     * Quyền: Người upload, Owner của dự án, hoặc System Admin.
     */
    @Transactional
    public void deleteArtifact(Long projectId, Long artifactId, Long currentUserId) {
        ArtifactEntity artifact = findArtifactInProject(projectId, artifactId);

        // C4: không còn "currentUserId == null thì bỏ qua kiểm quyền".
        if (currentUserId == null) {
            throw new ForbiddenException("ACCESS_DENIED", "You don't have permission to delete this artifact.");
        }
        boolean isUploader = currentUserId.equals(artifact.getUploadedBy());
        ProjectEntity project = projectAuthorizationService.getProjectOrThrow(projectId);
        boolean isOwner = project.getOwnerId().equals(currentUserId);

        boolean isProjectOwnerMember = projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentUserId)
                .map(m -> m.getRole() == ProjectRole.OWNER)
                .orElse(false);

        boolean isAdmin = userRepository.findById(currentUserId)
                .map(u -> u.getSystemRole() == SystemRole.ADMIN)
                .orElse(false);

        if (!isUploader && !isOwner && !isProjectOwnerMember && !isAdmin) {
            throw new ForbiddenException("ACCESS_DENIED", "You don't have permission to delete this artifact.");
        }

        artifactRepository.delete(artifact);
        log.info("[ArtifactService] Đã xóa artifact ID: {} khỏi Project: {}", artifactId, projectId);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "ARTIFACTS", "ARTIFACT_REMOVED", currentUserId, null, artifact.getNodeId());
    }

    /**
     * Chuyển đổi cờ hiển thị trong Kho tài nguyên chung (is_in_repository).
     */
    @Transactional
    public ArtifactResponse toggleRepositoryVisibility(Long projectId, Long artifactId, boolean isInRepo, Long currentUserId) {
        requireWriter(projectId, currentUserId);

        ArtifactEntity artifact = findArtifactInProject(projectId, artifactId);

        artifact.setIsInRepository(isInRepo);
        ArtifactEntity updated = artifactRepository.save(artifact);
        log.info("[ArtifactService] Đã cập nhật isInRepository = {} cho artifact ID: {}", isInRepo, artifactId);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "ARTIFACTS", "ARTIFACT_UPDATED", currentUserId, null, updated.getNodeId());
        return ArtifactResponse.from(updated);
    }

    /**
     * Chuyển đổi cờ hiển thị tài nguyên trên trang dành cho khách (is_public_for_guest).
     */
    @Transactional
    public ArtifactResponse toggleGuestVisibility(Long projectId, Long artifactId, boolean visible, Long currentUserId) {
        // Chỉ owner hoặc manager được ẩn hiện minh chứng với khách (collaborator thì không).
        projectAuthorizationService.verifyProjectOwnerOrManager(projectId, currentUserId);

        ArtifactEntity artifact = findArtifactInProject(projectId, artifactId);

        artifact.setIsPublicForGuest(visible);
        ArtifactEntity updated = artifactRepository.save(artifact);
        log.info("[ArtifactService] Đã cập nhật isPublicForGuest = {} cho artifact ID: {}", visible, artifactId);
        projectRealtimeNotifier.notifyProjectChanged(projectId, "ARTIFACTS", "ARTIFACT_UPDATED", currentUserId, null, updated.getNodeId());
        return ArtifactResponse.from(updated);
    }

    private ArtifactEntity findArtifactInProject(Long projectId, Long artifactId) {
        ArtifactEntity artifact = artifactRepository.findById(artifactId)
                .orElseThrow(() -> new ResourceNotFoundException("Artifact not found with ID: " + artifactId));

        if (!artifact.getProjectId().equals(projectId)) {
            throw new IllegalArgumentException("The artifact does not belong to this project.");
        }
        return artifact;
    }

    /**
     * C4: người được ghi vào kho tài nguyên (thêm link, bật/tắt kho chung).
     * Phải là thành viên (verifyProjectMemberOrOwner: 404 dự án không có, 403 không phải thành viên),
     * và là Chủ dự án hoặc có vai trò OWNER / MANAGER / COLLABORATOR trong {@code project_member}. VIEWER chỉ xem → 403.
     * Vai trò lấy từ DB, không tin thông tin vai trò client gửi lên.
     */
    private void requireWriter(Long projectId, Long currentUserId) {
        if (currentUserId == null) {
            throw new ForbiddenException("ACCESS_DENIED", "Please sign in to change the artifact repository.");
        }
        ProjectEntity project = projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
        if (project != null && currentUserId.equals(project.getOwnerId())) {
            return;
        }
        boolean canWrite = projectMemberRepository.findByProjectIdAndUserIdAndRemovedAtIsNull(projectId, currentUserId)
                .map(m -> m.getRole() == ProjectRole.OWNER
                        || m.getRole() == ProjectRole.MANAGER
                        || m.getRole() == ProjectRole.COLLABORATOR)
                .orElse(false);
        if (!canWrite) {
            throw new ForbiddenException("ACCESS_DENIED", "Viewers can view artifacts but cannot add or edit them.");
        }
    }

    /**
     * C4: type gửi lên là chuỗi. Rỗng/không gửi → nhận diện theo URL; đúng tên loại (không phân biệt hoa thường) → loại đó;
     * giá trị lạ → OTHER_LINK.
     */
    /** Loại artifact: dùng loại gửi lên nếu có (sai tên → OTHER_LINK), không có thì nhận theo link. Dùng chung cho nộp minh chứng ở task. */
    public static ArtifactType resolveType(String type, String url) {
        if (type == null || type.isBlank()) {
            return detectArtifactType(url);
        }
        try {
            return ArtifactType.valueOf(type.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ArtifactType.OTHER_LINK;
        }
    }

    /**
     * Tự động nhận diện loại tài nguyên từ đường dẫn URL.
     */
    static ArtifactType detectArtifactType(String url) {
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
