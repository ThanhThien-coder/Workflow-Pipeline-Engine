package com.pipeline.wpe.service.profile;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.dto.response.profile.PublicProfileResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.*;
import com.pipeline.wpe.service.auth.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserProfileService.getPublicProfile - quyen xem ho so nguoi khac")
class PublicProfileServiceTest {

    private static final long VIEWER = 1L;
    private static final long TARGET = 2L;

    @Mock private UserRepository userRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ProjectMemberRepository projectMemberRepository;
    @Mock private WorkPhaseRepository workPhaseRepository;
    @Mock private NodeRepository nodeRepository;
    @Mock private ArtifactRepository artifactRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private AuthService authService;
    @Mock private AvatarStorageService avatarStorageService;

    private UserProfileService service;
    private UserEntity viewer;
    private UserEntity target;

    private ProjectEntity project(long id, String name) {
        return ProjectEntity.builder().id(id).name(name).ownerId(TARGET).status(ProjectStatus.ACTIVE).build();
    }

    private Map<String, Object> privacy(String visibility, boolean showEmail, boolean showStats) {
        return new HashMap<>(Map.of("visibility", visibility, "showEmail", showEmail, "showStats", showStats));
    }

    private UserEntity user(long id, String name, SystemRole role, String visibility, boolean showEmail, boolean showStats) {
        return UserEntity.builder()
            .id(id).username("user" + id).email("user" + id + "@example.com").fullName(name)
            .passwordHash("x").systemRole(role).isLocked(false).tokenVersion(1)
            .title("Engineer").bio("Bio " + id)
            .skills(new ArrayList<>(List.of("Java")))
            .links(new HashMap<>(Map.of("github", "https://github.com/user" + id)))
            .profilePrivacy(privacy(visibility, showEmail, showStats))
            .publicProjectIds(new ArrayList<>())
            .build();
    }

    @BeforeEach
    void setUp() {
        service = new UserProfileService(userRepository, projectRepository, projectMemberRepository,
            workPhaseRepository, nodeRepository, artifactRepository, refreshTokenRepository,
            authService, avatarStorageService, new BCryptPasswordEncoder(4));
        viewer = user(VIEWER, "Viewer One", SystemRole.USER, "members", false, true);
        target = user(TARGET, "Target Two", SystemRole.USER, "members", false, true);
        lenient().when(userRepository.findById(VIEWER)).thenReturn(Optional.of(viewer));
        lenient().when(userRepository.findById(TARGET)).thenReturn(Optional.of(target));
        lenient().when(projectRepository.findAllAccessibleProjects(VIEWER)).thenReturn(List.of());
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET)).thenReturn(List.of());
        lenient().when(nodeRepository.findByProjectIdIn(anyCollection())).thenReturn(List.of());
        lenient().when(workPhaseRepository.findByProjectIdInAndParentPhaseIdIsNullOrderByOrderIndexAsc(anyCollection()))
            .thenReturn(List.of());
        lenient().when(projectMemberRepository.findByProjectIdIn(anyCollection())).thenReturn(List.of());
    }

    @Test
    @DisplayName("nguoi dich khong ton tai -> 404")
    void missingTarget_404() {
        lenient().when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getPublicProfile(VIEWER, 99L))
            .isInstanceOf(ResourceNotFoundException.class).hasMessage("Profile not found.");
    }

    @Test
    @DisplayName("nguoi dich da xoa -> 404 du ho so public")
    void deletedTarget_404() {
        target.setProfilePrivacy(privacy("public", true, true));
        target.setDeletedAt(Instant.now());
        assertThatThrownBy(() -> service.getPublicProfile(VIEWER, TARGET))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("nguoi dich bi vo hieu hoa -> 404 du ho so public")
    void deactivatedTarget_404() {
        target.setProfilePrivacy(privacy("public", true, true));
        target.setDeactivatedAt(Instant.now());
        assertThatThrownBy(() -> service.getPublicProfile(VIEWER, TARGET))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("private -> nguoi khac 404")
    void privateProfile_404() {
        target.setProfilePrivacy(privacy("private", true, true));
        assertThatThrownBy(() -> service.getPublicProfile(VIEWER, TARGET))
            .isInstanceOf(ResourceNotFoundException.class).hasMessage("Profile not found.");
    }

    @Test
    @DisplayName("private -> chinh chu van xem duoc, thay email va stats")
    void privateProfile_selfOk() {
        target.setProfilePrivacy(privacy("private", false, false));
        PublicProfileResponse res = service.getPublicProfile(TARGET, TARGET);
        assertThat(res.isSelf()).isTrue();
        assertThat(res.email()).isEqualTo("user2@example.com");
        assertThat(res.stats()).isNotNull();
    }

    @Test
    @DisplayName("private -> ADMIN he thong xem duoc")
    void privateProfile_adminOk() {
        viewer.setSystemRole(SystemRole.ADMIN);
        target.setProfilePrivacy(privacy("private", false, true));
        PublicProfileResponse res = service.getPublicProfile(VIEWER, TARGET);
        assertThat(res.userId()).isEqualTo("2");
        assertThat(res.isSelf()).isFalse();
        assertThat(res.email()).isNull();
    }

    @Test
    @DisplayName("members + co chung du an -> 200")
    void members_sharedProject_ok() {
        ProjectEntity shared = project(10L, "Shared");
        lenient().when(projectRepository.findAllAccessibleProjects(VIEWER)).thenReturn(List.of(shared));
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET)).thenReturn(List.of(shared));
        PublicProfileResponse res = service.getPublicProfile(VIEWER, TARGET);
        assertThat(res.displayName()).isEqualTo("Target Two");
        assertThat(res.projects()).extracting("projectId").containsExactly("10");
    }

    @Test
    @DisplayName("members + khong chung du an -> 404")
    void members_noSharedProject_404() {
        lenient().when(projectRepository.findAllAccessibleProjects(VIEWER)).thenReturn(List.of(project(11L, "Mine")));
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET)).thenReturn(List.of(project(10L, "Theirs")));
        assertThatThrownBy(() -> service.getPublicProfile(VIEWER, TARGET))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("public -> nguoi la xem duoc; du an khong cong khai va khong chung bi an")
    void publicProfile_hidesNonPublicNonSharedProjects() {
        target.setProfilePrivacy(privacy("public", false, true));
        target.setPublicProjectIds(new ArrayList<>(List.of(10L)));
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET))
            .thenReturn(List.of(project(10L, "Public one"), project(12L, "Secret one")));
        PublicProfileResponse res = service.getPublicProfile(VIEWER, TARGET);
        assertThat(res.projects()).extracting("projectId").containsExactly("10");
        assertThat(res.projects().get(0).isPublic()).isTrue();
    }

    @Test
    @DisplayName("public: du an cong khai hop voi du an chung")
    void publicProfile_unionOfPublicAndShared() {
        target.setProfilePrivacy(privacy("public", false, true));
        target.setPublicProjectIds(new ArrayList<>(List.of(10L)));
        ProjectEntity pub = project(10L, "Public one");
        ProjectEntity shared = project(11L, "Shared one");
        ProjectEntity secret = project(12L, "Secret one");
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET)).thenReturn(List.of(pub, shared, secret));
        lenient().when(projectRepository.findAllAccessibleProjects(VIEWER)).thenReturn(List.of(shared));
        PublicProfileResponse res = service.getPublicProfile(VIEWER, TARGET);
        assertThat(res.projects()).extracting("projectId").containsExactlyInAnyOrder("10", "11");
    }

    @Test
    @DisplayName("xem chinh minh hoac admin: thay du danh sach du an")
    void selfAndAdmin_seeAllProjects() {
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET))
            .thenReturn(List.of(project(10L, "A"), project(12L, "B")));
        assertThat(service.getPublicProfile(TARGET, TARGET).projects()).hasSize(2);
        viewer.setSystemRole(SystemRole.ADMIN);
        assertThat(service.getPublicProfile(VIEWER, TARGET).projects()).hasSize(2);
    }

    @Test
    @DisplayName("showEmail=true tra email; showEmail=false tra null")
    void email_followsFlag() {
        target.setProfilePrivacy(privacy("public", true, true));
        assertThat(service.getPublicProfile(VIEWER, TARGET).email()).isEqualTo("user2@example.com");
        target.setProfilePrivacy(privacy("public", false, true));
        assertThat(service.getPublicProfile(VIEWER, TARGET).email()).isNull();
    }

    @Test
    @DisplayName("showStats=false -> stats null; showStats=true -> cong don tren du an hien thi")
    void stats_followFlagAndAggregateVisibleProjects() {
        target.setProfilePrivacy(privacy("public", false, true));
        target.setPublicProjectIds(new ArrayList<>(List.of(10L)));
        lenient().when(projectRepository.findAllAccessibleProjects(TARGET))
            .thenReturn(List.of(project(10L, "Public one"), project(12L, "Secret one")));
        NodeEntity done = NodeEntity.builder().id(1L).projectId(10L).code("T-1").title("a")
            .status(NodeStatus.DONE).assignedUserId(TARGET)
            .dueDate(Instant.parse("2026-03-01T00:00:00Z")).completedAt(Instant.parse("2026-02-01T00:00:00Z")).build();
        NodeEntity open = NodeEntity.builder().id(2L).projectId(10L).code("T-2").title("b")
            .status(NodeStatus.IN_PROGRESS).assignedUserId(TARGET).build();
        lenient().when(nodeRepository.findByProjectIdIn(List.of(10L))).thenReturn(List.of(done, open));

        PublicProfileResponse res = service.getPublicProfile(VIEWER, TARGET);
        assertThat(res.stats()).isNotNull();
        assertThat(res.stats().tasksDone()).isEqualTo(1);
        assertThat(res.stats().tasksTotal()).isEqualTo(2);
        assertThat(res.stats().onTimePct()).isEqualTo(100);

        target.setProfilePrivacy(privacy("public", false, false));
        assertThat(service.getPublicProfile(VIEWER, TARGET).stats()).isNull();
    }
}
