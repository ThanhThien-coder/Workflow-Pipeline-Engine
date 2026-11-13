package com.pipeline.wpe.service;

import com.pipeline.wpe.common.enums.InvitationStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.dto.response.activity.ProjectActivityItemResponse;
import com.pipeline.wpe.entity.*;
import com.pipeline.wpe.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * FC5 — Dịch vụ tổng hợp nhật ký hoạt động của dự án từ dữ liệu hiện có (chỉ đọc, không tạo bảng mới).
 * Lưu ý quan trọng: Với các công việc (node/task), cơ sở dữ liệu không lưu lịch sử từng lần chuyển trạng thái,
 * do đó nhật ký chỉ phản ánh trạng thái hiện tại và thời điểm cập nhật gần nhất (node.updated_at).
 */
@Service
@RequiredArgsConstructor
public class ProjectActivityService {

    private final ProjectAuthorizationService projectAuthorizationService;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectInvitationRepository projectInvitationRepository;
    private final NodeRepository nodeRepository;
    private final ArtifactRepository artifactRepository;
    private final GuestLinkRepository guestLinkRepository;
    private final ProjectFeedbackRepository projectFeedbackRepository;

    @Transactional(readOnly = true)
    public List<ProjectActivityItemResponse> getProjectActivity(Long projectId, Long currentUserId, int limit) {
        ProjectEntity project = projectAuthorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        List<ProjectMemberEntity> members = projectMemberRepository.findByProjectIdOrderByJoinedAtAsc(projectId);
        List<ProjectInvitationEntity> invitations = projectInvitationRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        List<ArtifactEntity> artifacts = artifactRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        List<GuestLinkEntity> guestLinks = guestLinkRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        List<ProjectFeedbackEntity> feedbacks = projectFeedbackRepository.findByProjectIdOrderByCreatedAtDesc(projectId);

        Set<Long> userIds = new HashSet<>();
        if (project.getOwnerId() != null) {
            userIds.add(project.getOwnerId());
        }
        for (ProjectMemberEntity m : members) {
            if (m.getUserId() != null) userIds.add(m.getUserId());
        }
        for (ProjectInvitationEntity inv : invitations) {
            if (inv.getInviterId() != null) userIds.add(inv.getInviterId());
            if (inv.getInviteeId() != null) userIds.add(inv.getInviteeId());
        }
        for (NodeEntity n : nodes) {
            if (n.getAssignedUserId() != null) userIds.add(n.getAssignedUserId());
        }
        for (ArtifactEntity a : artifacts) {
            if (a.getUploadedBy() != null) userIds.add(a.getUploadedBy());
        }

        Map<Long, UserEntity> userMap = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(UserEntity::getId, Function.identity(), (a, b) -> a));

        Map<Long, NodeEntity> nodeMap = nodes.stream()
                .filter(n -> n.getId() != null)
                .collect(Collectors.toMap(NodeEntity::getId, Function.identity(), (a, b) -> a));

        String ownerName = resolveUserDisplayName(userMap.get(project.getOwnerId()), project.getOwnerId(), "Chủ dự án");
        Instant projectCreatedAt = project.getCreatedAt() != null ? project.getCreatedAt() : Instant.EPOCH;

        List<ProjectActivityItemResponse> events = new ArrayList<>();

        // 1. Tạo dự án
        events.add(new ProjectActivityItemResponse(
                "project-" + project.getId() + "-created",
                "PROJECT_CREATED",
                ownerName,
                "Đã tạo dự án \"" + project.getName() + "\"",
                null,
                projectCreatedAt
        ));

        // 2. Đổi trạng thái dự án (trạng thái hiện tại)
        boolean statusChangedFromDraft = project.getStatus() != null && project.getStatus() != ProjectStatus.DRAFT;
        boolean updatedAfterCreated = project.getUpdatedAt() != null
                && project.getCreatedAt() != null
                && project.getUpdatedAt().isAfter(project.getCreatedAt());
        if (statusChangedFromDraft || updatedAfterCreated) {
            Instant statusTime = project.getUpdatedAt() != null ? project.getUpdatedAt() : projectCreatedAt;
            events.add(new ProjectActivityItemResponse(
                    "project-" + project.getId() + "-status",
                    "PROJECT_STATUS_CHANGED",
                    ownerName,
                    "Đổi trạng thái dự án sang " + project.getStatus(),
                    null,
                    statusTime
            ));
        }

        // 3. Thành viên vào / rời / đổi role (từ lịch sử thành viên project_member)
        for (ProjectMemberEntity m : members) {
            UserEntity user = userMap.get(m.getUserId());
            String memberName = resolveUserDisplayName(user, m.getUserId(), "Thành viên");
            String memberLabel = resolveUserLabelWithUsername(user, m.getUserId());
            Instant joinedAt = m.getJoinedAt() != null ? m.getJoinedAt() : projectCreatedAt;

            boolean isInitialOwnerRow = m.getUserId() != null
                    && m.getUserId().equals(project.getOwnerId())
                    && m.getRole() == ProjectRole.OWNER
                    && m.getRemovedAt() == null;

            if (!isInitialOwnerRow) {
                events.add(new ProjectActivityItemResponse(
                        "member-" + m.getId() + "-joined",
                        "MEMBER_JOINED",
                        memberName,
                        "Thành viên " + memberLabel + " tham gia dự án với vai trò " + m.getRole(),
                        null,
                        joinedAt
                ));
            }

            if (m.getRemovedAt() != null) {
                events.add(new ProjectActivityItemResponse(
                        "member-" + m.getId() + "-removed",
                        "MEMBER_REMOVED",
                        memberName,
                        "Thành viên " + memberLabel + " đã rời dự án",
                        null,
                        m.getRemovedAt()
                ));
            }
        }

        // 4. Lời mời gửi / chấp nhận / từ chối / thu hồi (project_invitation)
        for (ProjectInvitationEntity inv : invitations) {
            UserEntity inviter = userMap.get(inv.getInviterId());
            UserEntity invitee = userMap.get(inv.getInviteeId());
            String inviterName = resolveUserDisplayName(inviter, inv.getInviterId(), ownerName);
            String inviteeName = resolveUserDisplayName(invitee, inv.getInviteeId(), "Người được mời");
            String inviteeLabel = resolveUserLabelWithUsername(invitee, inv.getInviteeId());
            Instant invCreatedAt = inv.getCreatedAt() != null ? inv.getCreatedAt() : projectCreatedAt;

            events.add(new ProjectActivityItemResponse(
                    "invitation-" + inv.getId() + "-sent",
                    "INVITATION_SENT",
                    inviterName,
                    "Đã gửi lời mời cho " + inviteeLabel + " với vai trò " + inv.getRole(),
                    null,
                    invCreatedAt
            ));

            if (inv.getStatus() != null && inv.getStatus() != InvitationStatus.PENDING && inv.getRespondedAt() != null) {
                switch (inv.getStatus()) {
                    case ACCEPTED -> events.add(new ProjectActivityItemResponse(
                            "invitation-" + inv.getId() + "-accepted",
                            "INVITATION_ACCEPTED",
                            inviteeName,
                            inviteeLabel + " đã chấp nhận lời mời tham gia dự án (" + inv.getRole() + ")",
                            null,
                            inv.getRespondedAt()
                    ));
                    case REJECTED -> events.add(new ProjectActivityItemResponse(
                            "invitation-" + inv.getId() + "-rejected",
                            "INVITATION_REJECTED",
                            inviteeName,
                            inviteeLabel + " đã từ chối lời mời tham gia dự án",
                            null,
                            inv.getRespondedAt()
                    ));
                    case REVOKED -> events.add(new ProjectActivityItemResponse(
                            "invitation-" + inv.getId() + "-revoked",
                            "INVITATION_REVOKED",
                            inviterName,
                            "Đã thu hồi lời mời gửi cho " + inviteeLabel,
                            null,
                            inv.getRespondedAt()
                    ));
                    case EXPIRED -> events.add(new ProjectActivityItemResponse(
                            "invitation-" + inv.getId() + "-expired",
                            "INVITATION_EXPIRED",
                            "SYSTEM",
                            "Lời mời gửi cho " + inviteeLabel + " đã hết hạn",
                            null,
                            inv.getRespondedAt()
                    ));
                    default -> {
                    }
                }
            }
        }

        // 5. Task đổi trạng thái (chỉ lưu trạng thái hiện tại + lần cập nhật cuối vì DB không lưu lịch sử từng lần).
        // Bỏ qua node mới tạo/clone chưa từng được cập nhật (updatedAt <= createdAt).
        for (NodeEntity node : nodes) {
            if (node.getCreatedAt() == null || node.getUpdatedAt() == null
                    || !node.getUpdatedAt().isAfter(node.getCreatedAt())) {
                continue;
            }
            UserEntity assignee = node.getAssignedUserId() != null ? userMap.get(node.getAssignedUserId()) : null;
            String actor = assignee != null
                    ? resolveUserDisplayName(assignee, node.getAssignedUserId(), ownerName)
                    : ownerName;

            events.add(new ProjectActivityItemResponse(
                    "node-" + node.getId() + "-updated",
                    "TASK_STATUS_CHANGED",
                    actor,
                    "Task " + node.getCode() + " (" + node.getTitle() + ") ở trạng thái " + node.getStatus() + " (lần cập nhật gần nhất)",
                    node.getCode(),
                    node.getUpdatedAt()
            ));
        }

        // 6. Nộp minh chứng (artifacts)
        for (ArtifactEntity art : artifacts) {
            UserEntity uploader = userMap.get(art.getUploadedBy());
            String uploaderName = resolveUserDisplayName(uploader, art.getUploadedBy(), ownerName);
            NodeEntity relatedNode = art.getNodeId() != null ? nodeMap.get(art.getNodeId()) : null;
            String targetCode = relatedNode != null ? relatedNode.getCode() : null;
            Instant artTime = art.getCreatedAt() != null ? art.getCreatedAt() : projectCreatedAt;
            String msg = targetCode != null
                    ? "Đã nộp minh chứng \"" + art.getName() + "\" cho task " + targetCode
                    : "Đã nộp minh chứng \"" + art.getName() + "\" vào tài nguyên dự án";

            events.add(new ProjectActivityItemResponse(
                    "artifact-" + art.getId() + "-created",
                    "ARTIFACT_SUBMITTED",
                    uploaderName,
                    msg,
                    targetCode,
                    artTime
            ));
        }

        // 7. Link khách tạo / thu hồi (guest_link)
        // Luôn sinh dòng tạo; nếu đã thu hồi thì thêm dòng thu hồi.
        // Bảng guest_link không lưu revoked_at nên dùng thời điểm tốt nhất có sẵn (createdAt) và ghi rõ trong message.
        for (GuestLinkEntity gl : guestLinks) {
            Instant glTime = gl.getCreatedAt() != null ? gl.getCreatedAt() : projectCreatedAt;
            if (Boolean.TRUE.equals(gl.getIsRevoked())) {
                events.add(new ProjectActivityItemResponse(
                        "guest-link-" + gl.getId() + "-revoked",
                        "GUEST_LINK_REVOKED",
                        ownerName,
                        "Đã thu hồi link khách (Guest Link) — không rõ thời điểm thu hồi",
                        null,
                        glTime
                ));
            }
            events.add(new ProjectActivityItemResponse(
                    "guest-link-" + gl.getId() + "-created",
                    "GUEST_LINK_CREATED",
                    ownerName,
                    "Đã tạo link khách (Guest Link)",
                    null,
                    glTime
            ));
        }

        // 8. Góp ý của khách (project_feedback)
        for (ProjectFeedbackEntity fb : feedbacks) {
            NodeEntity relatedNode = fb.getNodeId() != null ? nodeMap.get(fb.getNodeId()) : null;
            String targetCode = relatedNode != null ? relatedNode.getCode() : null;
            String reviewer = (fb.getReviewerName() != null && !fb.getReviewerName().isBlank())
                    ? fb.getReviewerName().trim()
                    : "Khách";
            String snippet = truncate(fb.getContent(), 80);
            String msg = targetCode != null
                    ? "Góp ý trên task " + targetCode + ": " + snippet
                    : "Góp ý cho dự án: " + snippet;
            Instant fbTime = fb.getCreatedAt() != null ? fb.getCreatedAt() : projectCreatedAt;

            events.add(new ProjectActivityItemResponse(
                    "feedback-" + fb.getId() + "-created",
                    "FEEDBACK_CREATED",
                    reviewer,
                    msg,
                    targetCode,
                    fbTime
            ));
        }

        events.sort(Comparator.comparing(
                ProjectActivityItemResponse::createdAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));

        int effectiveLimit = limit > 0 ? Math.min(limit, 200) : 50;
        if (events.size() > effectiveLimit) {
            return List.copyOf(events.subList(0, effectiveLimit));
        }
        return List.copyOf(events);
    }

    private String resolveUserDisplayName(UserEntity user, Long userId, String fallback) {
        if (user != null) {
            if (user.getFullName() != null && !user.getFullName().isBlank()) {
                return user.getFullName().trim();
            }
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                return user.getUsername().trim();
            }
        }
        return userId != null ? "User #" + userId : fallback;
    }

    private String resolveUserLabelWithUsername(UserEntity user, Long userId) {
        if (user != null) {
            String full = user.getFullName() != null ? user.getFullName().trim() : "";
            String uname = user.getUsername() != null ? user.getUsername().trim() : "";
            if (!full.isEmpty() && !uname.isEmpty() && !full.equalsIgnoreCase(uname)) {
                return full + " (" + uname + ")";
            }
            if (!full.isEmpty()) return full;
            if (!uname.isEmpty()) return uname;
        }
        return userId != null ? "User #" + userId : "Người dùng";
    }

    private String truncate(String text, int maxLen) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (trimmed.length() <= maxLen) return trimmed;
        return trimmed.substring(0, maxLen) + "...";
    }
}
