package com.pipeline.wpe.admin;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectRole;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.common.enums.TemplateVisibility;
import com.pipeline.wpe.dto.response.admin.AdminStatsResponse;
import com.pipeline.wpe.dto.response.admin.AdminTrendPointResponse;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.PipelineTemplateEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectMemberEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.PipelineTemplateRepository;
import com.pipeline.wpe.repository.ProjectMemberRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.admin.AdminStatsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminStatsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private PipelineTemplateRepository pipelineTemplateRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private AdminStatsService adminStatsService;

    @Test
    @DisplayName("getStats: 3 user (1 khóa) -> total 3, suspended 1; byStatus đủ khóa")
    void testGetStats_countsAndStatuses() {
        Instant now = Instant.now();
        Instant past = now.minus(2, ChronoUnit.DAYS);

        // 3 user (1 khóa, 2 hoạt động)
        UserEntity u1 = UserEntity.builder().id(1L).systemRole(SystemRole.ADMIN).isLocked(false).createdAt(past).build();
        UserEntity u2 = UserEntity.builder().id(2L).systemRole(SystemRole.USER).isLocked(false).createdAt(past).build();
        UserEntity u3 = UserEntity.builder().id(3L).systemRole(SystemRole.USER).isLocked(true).createdAt(past).build();
        when(userRepository.findAll()).thenReturn(List.of(u1, u2, u3));

        // Projects
        ProjectEntity p1 = ProjectEntity.builder().id(10L).status(ProjectStatus.ACTIVE).createdAt(past).build();
        ProjectEntity p2 = ProjectEntity.builder().id(11L).status(ProjectStatus.DRAFT).createdAt(past).build();
        when(projectRepository.findAll()).thenReturn(List.of(p1, p2));

        // Tasks (nodes)
        NodeEntity n1 = NodeEntity.builder().id(101L).status(NodeStatus.DONE).dueDate(past).build();
        NodeEntity n2 = NodeEntity.builder().id(102L).status(NodeStatus.TODO).dueDate(past).build(); // Overdue
        NodeEntity n3 = NodeEntity.builder().id(103L).status(NodeStatus.IN_PROGRESS).dueDate(now.plus(2, ChronoUnit.DAYS)).build();
        when(nodeRepository.findAll()).thenReturn(List.of(n1, n2, n3));

        // Templates
        PipelineTemplateEntity t1 = PipelineTemplateEntity.builder().id(1L).visibility(TemplateVisibility.PUBLIC).cloneCount(5).build();
        PipelineTemplateEntity t2 = PipelineTemplateEntity.builder().id(2L).visibility(TemplateVisibility.PRIVATE).cloneCount(3).build();
        when(pipelineTemplateRepository.findAll()).thenReturn(List.of(t1, t2));

        // Members
        ProjectMemberEntity m1 = ProjectMemberEntity.builder().id(1L).projectId(10L).userId(1L).role(ProjectRole.OWNER).build();
        ProjectMemberEntity m2 = ProjectMemberEntity.builder().id(2L).projectId(10L).userId(2L).role(ProjectRole.COLLABORATOR).build();
        when(projectMemberRepository.findAll()).thenReturn(List.of(m1, m2));

        AdminStatsResponse response = adminStatsService.getStats();

        // 1. Users
        assertThat(response.users().total()).isEqualTo(3);
        assertThat(response.users().active()).isEqualTo(2);
        assertThat(response.users().suspended()).isEqualTo(1);
        assertThat(response.users().newLast7Days()).isEqualTo(3);

        // 2. Projects: byStatus đủ mọi ProjectStatus
        assertThat(response.projects().total()).isEqualTo(2);
        assertThat(response.projects().byStatus()).containsOnlyKeys(
            "DRAFT", "PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "INACTIVE", "ARCHIVED"
        );
        assertThat(response.projects().byStatus().get("ACTIVE")).isEqualTo(1);
        assertThat(response.projects().byStatus().get("DRAFT")).isEqualTo(1);
        assertThat(response.projects().byStatus().get("ARCHIVED")).isEqualTo(0);

        // 3. Tasks: byStatus đủ 5 NodeStatus
        assertThat(response.tasks().total()).isEqualTo(3);
        assertThat(response.tasks().byStatus()).containsOnlyKeys(
            "LOCKED", "TODO", "IN_PROGRESS", "REVIEW", "DONE"
        );
        assertThat(response.tasks().byStatus().get("DONE")).isEqualTo(1);
        assertThat(response.tasks().byStatus().get("TODO")).isEqualTo(1);
        assertThat(response.tasks().byStatus().get("IN_PROGRESS")).isEqualTo(1);
        assertThat(response.tasks().overdue()).isEqualTo(1);

        // 4. Templates
        assertThat(response.templates().publicCount()).isEqualTo(1);
        assertThat(response.templates().privateCount()).isEqualTo(1);
        assertThat(response.templates().totalClones()).isEqualTo(8);

        // 5. Roles
        assertThat(response.roles().systemRoles()).containsOnlyKeys("ADMIN", "USER");
        assertThat(response.roles().systemRoles().get("ADMIN")).isEqualTo(1);
        assertThat(response.roles().systemRoles().get("USER")).isEqualTo(2);

        assertThat(response.roles().projectRoles()).containsOnlyKeys("OWNER", "MANAGER", "COLLABORATOR", "VIEWER");
        assertThat(response.roles().projectRoles().get("OWNER")).isEqualTo(1);
        assertThat(response.roles().projectRoles().get("COLLABORATOR")).isEqualTo(1);
        assertThat(response.roles().projectRoles().get("MANAGER")).isEqualTo(0);
        assertThat(response.roles().projectRoles().get("VIEWER")).isEqualTo(0);
    }

    @Test
    @DisplayName("getTrends: range 7D trả đúng 7 phần tử, phần tử cuối là hôm nay và đếm đúng 1 user tạo hôm nay")
    void testGetTrends_7D_returns7ElementsWithTodayAsLast() {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);
        Instant todayInstant = today.atStartOfDay(zone).plusHours(10).toInstant();

        UserEntity userToday = UserEntity.builder().id(1L).createdAt(todayInstant).build();
        when(userRepository.findAll()).thenReturn(List.of(userToday));
        when(projectRepository.findAll()).thenReturn(List.of());
        when(nodeRepository.findAll()).thenReturn(List.of());

        List<AdminTrendPointResponse> trends = adminStatsService.getTrends("7D");

        assertThat(trends).hasSize(7);

        // Phần tử cuối cùng là hôm nay
        AdminTrendPointResponse lastPoint = trends.get(6);
        assertThat(lastPoint.date()).isEqualTo(today.format(DateTimeFormatter.ISO_LOCAL_DATE));
        assertThat(lastPoint.newUsers()).isEqualTo(1);
        assertThat(lastPoint.newProjects()).isEqualTo(0);
        assertThat(lastPoint.tasksDone()).isEqualTo(0);

        // Phần tử đầu tiên là 6 ngày trước
        LocalDate sixDaysAgo = today.minusDays(6);
        AdminTrendPointResponse firstPoint = trends.get(0);
        assertThat(firstPoint.date()).isEqualTo(sixDaysAgo.format(DateTimeFormatter.ISO_LOCAL_DATE));
        assertThat(firstPoint.newUsers()).isEqualTo(0);
    }

    @Test
    @DisplayName("getTrends: range = '1Y' không hợp lệ -> ném IllegalArgumentException")
    void testGetTrends_invalidRange_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> adminStatsService.getTrends("1Y"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Khoảng thời gian không hợp lệ");
    }
}
