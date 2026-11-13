package com.pipeline.wpe.service.admin;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.request.admin.SuspendUserRequest;
import com.pipeline.wpe.dto.response.admin.AdminUserResponse;
import com.pipeline.wpe.dto.response.admin.WorkspaceOverviewResponse;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ForbiddenException;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.RefreshTokenRepository;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.RecordComponent;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private AdminService service;

    private static final Long ADMIN_ACTOR_ID = 1L;

    @BeforeEach
    void setUp() {
        service = new AdminService(userRepository, projectRepository, refreshTokenRepository);
    }

    private static UserEntity user(Long id, String username, String email, SystemRole role, boolean locked, int tv) {
        return UserEntity.builder()
            .id(id).username(username).email(email).fullName("Full " + username)
            .passwordHash("x").systemRole(role).isLocked(locked).tokenVersion(tv)
            .build();
    }

    private static List<Object[]> rows(long... pairs) {
        List<Object[]> list = new ArrayList<>();
        for (int i = 0; i < pairs.length; i += 2) {
            list.add(new Object[]{pairs[i], pairs[i + 1]});
        }
        return list;
    }

    // ---------------- suspend ----------------

    @Test
    @DisplayName("Khóa user thường: is_locked bật, token_version tăng 1, thu hồi mọi refresh token")
    void suspend_regularUser_locksBumpsVersionAndRevokes() {
        UserEntity sarah = user(3L, "sarah.chen", "sarah.chen@pipeline.engine", SystemRole.USER, false, 4);
        when(userRepository.findById(3L)).thenReturn(Optional.of(sarah));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUserResponse res = service.suspendUser(3L, new SuspendUserRequest("Vi phạm chính sách", 7), ADMIN_ACTOR_ID);

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getIsLocked()).isTrue();
        assertThat(saved.getValue().getTokenVersion()).isEqualTo(5);
        verify(refreshTokenRepository).revokeAllByUserId(3L);

        assertThat(res.status()).isEqualTo("SUSPENDED");
        assertThat(res.maskedEmail()).isEqualTo("s***@pipeline.engine");
        assertThat(res.id()).isEqualTo("3");
    }

    @Test
    @DisplayName("Khóa user có system_role = ADMIN -> 403 CANNOT_SUSPEND_ADMIN, không đổi gì trong DB")
    void suspend_admin_forbidden() {
        UserEntity admin = user(1L, "admin", "admin@pipeline.engine", SystemRole.ADMIN, false, 0);
        when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.suspendUser(1L, new SuspendUserRequest("x", null), ADMIN_ACTOR_ID))
            .isInstanceOf(ForbiddenException.class)
            .satisfies(ex -> assertThat(((ForbiddenException) ex).getErrorCode()).isEqualTo("CANNOT_SUSPEND_ADMIN"));

        verify(userRepository, never()).save(any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        assertThat(admin.getIsLocked()).isFalse();
        assertThat(admin.getTokenVersion()).isZero();
    }

    @Test
    @DisplayName("Khóa user không tồn tại -> 404")
    void suspend_unknownUser_404() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.suspendUser(99L, new SuspendUserRequest("x", 1), ADMIN_ACTOR_ID))
            .isInstanceOf(ResourceNotFoundException.class);
        verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
    }

    // ---------------- unban ----------------

    @Test
    @DisplayName("Mở khóa: is_locked = false, trả status ACTIVE")
    void unban_unlocks() {
        UserEntity marcus = user(4L, "marcus", "marcus@acme.io", SystemRole.USER, true, 2);
        when(userRepository.findById(4L)).thenReturn(Optional.of(marcus));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminUserResponse res = service.unbanUser(4L, ADMIN_ACTOR_ID);

        assertThat(marcus.getIsLocked()).isFalse();
        assertThat(res.status()).isEqualTo("ACTIVE");
        verify(userRepository).save(marcus);
    }

    // ---------------- list users ----------------

    @Test
    @DisplayName("Danh sách user: email đã che, status/role đúng, workspaceCount = làm chủ + tham gia")
    @SuppressWarnings("unchecked")
    void getUsers_masksEmailAndCounts() {
        UserEntity alex = user(2L, "alex.kim", "alex.kim@pipeline.engine", SystemRole.USER, false, 0);
        UserEntity marcus = user(4L, "marcus", "marcus@acme.io", SystemRole.USER, true, 0);
        when(userRepository.searchForAdmin(eq("%"), anyCollection())).thenReturn(List.of(alex, marcus));
        when(projectRepository.countProjectsGroupByOwner()).thenReturn(rows(2L, 2L));
        when(projectRepository.countJoinedProjectsGroupByMember()).thenReturn(rows(2L, 1L, 4L, 3L));

        List<AdminUserResponse> res = service.getUsers(null, null);

        assertThat(res).hasSize(2);
        assertThat(res.get(0).maskedEmail()).isEqualTo("a***@pipeline.engine");
        assertThat(res.get(0).role()).isEqualTo("USER");
        assertThat(res.get(0).status()).isEqualTo("ACTIVE");
        assertThat(res.get(0).workspaceCount()).isEqualTo(3);
        assertThat(res.get(1).status()).isEqualTo("SUSPENDED");
        assertThat(res.get(1).workspaceCount()).isEqualTo(3);
        // Không chuỗi nào chứa email thật
        assertThat(res.toString()).doesNotContain("alex.kim@pipeline.engine").doesNotContain("marcus@acme.io");

        ArgumentCaptor<Collection<Boolean>> locked = ArgumentCaptor.forClass(Collection.class);
        verify(userRepository).searchForAdmin(eq("%"), locked.capture());
        assertThat(locked.getValue()).containsExactlyInAnyOrder(true, false);
    }

    @Test
    @DisplayName("Lọc user: query viết thường thành %q%, status SUSPENDED -> chỉ is_locked = true")
    @SuppressWarnings("unchecked")
    void getUsers_filters() {
        when(userRepository.searchForAdmin(eq("%sarah%"), anyCollection())).thenReturn(List.of());

        service.getUsers("  SaRaH ", "SUSPENDED");

        ArgumentCaptor<Collection<Boolean>> locked = ArgumentCaptor.forClass(Collection.class);
        verify(userRepository).searchForAdmin(eq("%sarah%"), locked.capture());
        assertThat(locked.getValue()).containsExactly(true);
    }

    @Test
    @DisplayName("status không hợp lệ -> IllegalArgumentException (400)")
    void getUsers_badStatus() {
        assertThatThrownBy(() -> service.getUsers(null, "BANNED")).isInstanceOf(IllegalArgumentException.class);
    }

    // ---------------- workspaces ----------------

    @Test
    @DisplayName("GET workspaces: chỉ metadata (tên, owner, trạng thái, số thành viên, số node, updatedAt), không có tên task")
    void getWorkspaces_metadataOnly() throws Exception {
        Instant updated = Instant.parse("2026-11-01T10:00:00Z");
        ProjectEntity p = ProjectEntity.builder()
            .id(10L).ownerId(2L).name("Core Banking Pipeline")
            .description("Mô tả nội bộ không được lộ cho admin")
            .status(ProjectStatus.ACTIVE).updatedAt(updated)
            .build();
        when(projectRepository.findAllByOrderByUpdatedAtDesc()).thenReturn(List.of(p));
        when(projectRepository.countActiveMembersGroupByProject()).thenReturn(rows(10L, 4L));
        when(projectRepository.countNodesGroupByProject()).thenReturn(rows(10L, 6L));
        when(userRepository.findAllById(any())).thenReturn(
            List.of(user(2L, "alex.kim", "alex.kim@pipeline.engine", SystemRole.USER, false, 0)));

        List<WorkspaceOverviewResponse> res = service.getWorkspaces();

        assertThat(res).hasSize(1);
        WorkspaceOverviewResponse w = res.get(0);
        assertThat(w.id()).isEqualTo("10");
        assertThat(w.name()).isEqualTo("Core Banking Pipeline");
        assertThat(w.ownerName()).isEqualTo("Full alex.kim");
        assertThat(w.status()).isEqualTo("ACTIVE");
        assertThat(w.memberCount()).isEqualTo(4);
        assertThat(w.nodeCount()).isEqualTo(6);
        assertThat(w.updatedAt()).isEqualTo(updated);

        // JSON trả ra chỉ gồm đúng các field metadata, không có title/description/tasks
        ObjectMapper om = new ObjectMapper().registerModule(new JavaTimeModule());
        JsonNode json = om.valueToTree(w);
        Set<String> keys = new java.util.HashSet<>();
        Iterator<String> it = json.fieldNames();
        it.forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder(
            "id", "name", "ownerId", "ownerName", "status", "memberCount", "nodeCount", "updatedAt");
        assertThat(json.toString()).doesNotContain("Mô tả nội bộ");
    }

    @Test
    @DisplayName("Service không phụ thuộc NodeRepository/ArtifactRepository: không có đường nào đọc nội dung task")
    void adminService_hasNoTaskContentDependency() {
        Set<String> deps = Arrays.stream(AdminService.class.getDeclaredFields())
            .map(f -> f.getType().getSimpleName())
            .collect(Collectors.toSet());
        assertThat(deps).doesNotContain("NodeRepository", "ArtifactRepository", "WorkPhaseRepository");
        Set<String> components = Arrays.stream(WorkspaceOverviewResponse.class.getRecordComponents())
            .map(RecordComponent::getName).collect(Collectors.toSet());
        assertThat(components).noneMatch(n -> n.toLowerCase().contains("task") || n.toLowerCase().contains("title")
            || n.toLowerCase().contains("description"));
    }

    // ---------------- archive ----------------

    @Test
    @DisplayName("Archive: status = ARCHIVED, trả metadata")
    void archive_setsArchived() {
        ProjectEntity p = ProjectEntity.builder().id(10L).ownerId(2L).name("Core Banking Pipeline")
            .status(ProjectStatus.ACTIVE).build();
        when(projectRepository.findById(10L)).thenReturn(Optional.of(p));
        when(projectRepository.save(any(ProjectEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(projectRepository.countActiveMembersGroupByProject()).thenReturn(rows());
        when(projectRepository.countNodesGroupByProject()).thenReturn(rows());
        when(userRepository.findById(2L)).thenReturn(
            Optional.of(user(2L, "alex.kim", "alex.kim@pipeline.engine", SystemRole.USER, false, 0)));

        WorkspaceOverviewResponse res = service.archiveWorkspace(10L, ADMIN_ACTOR_ID);

        assertThat(p.getStatus()).isEqualTo(ProjectStatus.ARCHIVED);
        assertThat(res.status()).isEqualTo("ARCHIVED");
        verify(projectRepository).save(p);
    }

    @Test
    @DisplayName("Archive dự án không tồn tại -> 404")
    void archive_unknown_404() {
        when(projectRepository.findById(77L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.archiveWorkspace(77L, ADMIN_ACTOR_ID))
            .isInstanceOf(ResourceNotFoundException.class);
    }
}
