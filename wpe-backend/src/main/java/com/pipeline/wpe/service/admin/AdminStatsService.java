package com.pipeline.wpe.service.admin;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final NodeRepository nodeRepository;
    private final PipelineTemplateRepository pipelineTemplateRepository;
    private final ProjectMemberRepository projectMemberRepository;

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Transactional(readOnly = true)
    public AdminStatsResponse getStats() {
        Instant now = Instant.now();
        Instant sevenDaysAgo = now.minus(Duration.ofDays(7));

        // 1. Users
        List<UserEntity> users = userRepository.findAll();
        int totalUsers = users.size();
        int activeUsers = 0;
        int suspendedUsers = 0;
        int newUsersLast7Days = 0;
        Map<String, Integer> systemRoles = new LinkedHashMap<>();
        for (SystemRole role : SystemRole.values()) {
            systemRoles.put(role.name(), 0);
        }
        for (UserEntity u : users) {
            if (Boolean.TRUE.equals(u.getIsLocked())) {
                suspendedUsers++;
            } else {
                activeUsers++;
            }
            if (u.getCreatedAt() != null && !u.getCreatedAt().isBefore(sevenDaysAgo)) {
                newUsersLast7Days++;
            }
            if (u.getSystemRole() != null) {
                systemRoles.merge(u.getSystemRole().name(), 1, Integer::sum);
            }
        }
        AdminStatsResponse.UserStats userStats = new AdminStatsResponse.UserStats(
            totalUsers,
            activeUsers,
            suspendedUsers,
            newUsersLast7Days
        );

        // 2. Projects
        List<ProjectEntity> projects = projectRepository.findAll();
        int totalProjects = projects.size();
        int newProjectsLast7Days = 0;
        Map<String, Integer> projectsByStatus = new LinkedHashMap<>();
        for (ProjectStatus s : ProjectStatus.values()) {
            projectsByStatus.put(s.name(), 0);
        }
        for (ProjectEntity p : projects) {
            if (p.getStatus() != null) {
                projectsByStatus.merge(p.getStatus().name(), 1, Integer::sum);
            }
            if (p.getCreatedAt() != null && !p.getCreatedAt().isBefore(sevenDaysAgo)) {
                newProjectsLast7Days++;
            }
        }
        AdminStatsResponse.ProjectStats projectStats = new AdminStatsResponse.ProjectStats(
            totalProjects,
            projectsByStatus,
            newProjectsLast7Days
        );

        // 3. Tasks (nodes)
        List<NodeEntity> nodes = nodeRepository.findAll();
        int totalNodes = nodes.size();
        int overdueNodes = 0;
        Map<String, Integer> tasksByStatus = new LinkedHashMap<>();
        for (NodeStatus s : NodeStatus.values()) {
            tasksByStatus.put(s.name(), 0);
        }
        for (NodeEntity n : nodes) {
            if (n.getStatus() != null) {
                tasksByStatus.merge(n.getStatus().name(), 1, Integer::sum);
            }
            if (n.getDueDate() != null && n.getDueDate().isBefore(now) && n.getStatus() != NodeStatus.DONE) {
                overdueNodes++;
            }
        }
        AdminStatsResponse.TaskStats taskStats = new AdminStatsResponse.TaskStats(
            totalNodes,
            tasksByStatus,
            overdueNodes
        );

        // 4. Templates
        List<PipelineTemplateEntity> templates = pipelineTemplateRepository.findAll();
        int publicCount = 0;
        int privateCount = 0;
        int totalClones = 0;
        for (PipelineTemplateEntity t : templates) {
            if (t.getVisibility() == TemplateVisibility.PUBLIC) {
                publicCount++;
            } else if (t.getVisibility() == TemplateVisibility.PRIVATE) {
                privateCount++;
            }
            if (t.getCloneCount() != null) {
                totalClones += t.getCloneCount();
            }
        }
        AdminStatsResponse.TemplateStats templateStats = new AdminStatsResponse.TemplateStats(
            publicCount,
            privateCount,
            totalClones
        );

        // 5. Roles
        List<ProjectMemberEntity> members = projectMemberRepository.findAll();
        Map<String, Integer> projectRoles = new LinkedHashMap<>();
        for (ProjectRole role : ProjectRole.values()) {
            projectRoles.put(role.name(), 0);
        }
        for (ProjectMemberEntity m : members) {
            if (m.getRemovedAt() == null && m.getRole() != null) {
                projectRoles.merge(m.getRole().name(), 1, Integer::sum);
            }
        }
        AdminStatsResponse.RoleStats roleStats = new AdminStatsResponse.RoleStats(
            systemRoles,
            projectRoles
        );

        return new AdminStatsResponse(
            userStats,
            projectStats,
            taskStats,
            templateStats,
            roleStats
        );
    }

    /**
     * Lấy xu hướng người dùng mới, dự án mới và tác vụ hoàn thành theo ngày.
     * Ghi chú: task DONE theo ngày cập nhật cuối, vì DB không có cột thời điểm hoàn thành.
     */
    @Transactional(readOnly = true)
    public List<AdminTrendPointResponse> getTrends(String range) {
        String effectiveRange = (range == null || range.isBlank()) ? "7D" : range.trim().toUpperCase();
        if (!"7D".equals(effectiveRange) && !"30D".equals(effectiveRange)) {
            throw new IllegalArgumentException("Khoảng thời gian không hợp lệ: " + range);
        }

        int days = "30D".equals(effectiveRange) ? 30 : 7;
        LocalDate today = LocalDate.now(VIETNAM_ZONE);

        List<UserEntity> users = userRepository.findAll();
        List<ProjectEntity> projects = projectRepository.findAll();
        List<NodeEntity> nodes = nodeRepository.findAll();

        Map<LocalDate, Integer> userCounts = new HashMap<>();
        for (UserEntity u : users) {
            if (u.getCreatedAt() != null) {
                LocalDate d = u.getCreatedAt().atZone(VIETNAM_ZONE).toLocalDate();
                userCounts.merge(d, 1, Integer::sum);
            }
        }

        Map<LocalDate, Integer> projectCounts = new HashMap<>();
        for (ProjectEntity p : projects) {
            if (p.getCreatedAt() != null) {
                LocalDate d = p.getCreatedAt().atZone(VIETNAM_ZONE).toLocalDate();
                projectCounts.merge(d, 1, Integer::sum);
            }
        }

        Map<LocalDate, Integer> doneTaskCounts = new HashMap<>();
        for (NodeEntity n : nodes) {
            if (n.getStatus() == NodeStatus.DONE && n.getUpdatedAt() != null) {
                LocalDate d = n.getUpdatedAt().atZone(VIETNAM_ZONE).toLocalDate();
                doneTaskCounts.merge(d, 1, Integer::sum);
            }
        }

        List<AdminTrendPointResponse> points = new ArrayList<>(days);
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            String dateStr = day.format(DateTimeFormatter.ISO_LOCAL_DATE);
            int newUsers = userCounts.getOrDefault(day, 0);
            int newProjects = projectCounts.getOrDefault(day, 0);
            int tasksDone = doneTaskCounts.getOrDefault(day, 0);
            points.add(new AdminTrendPointResponse(dateStr, newUsers, newProjects, tasksDone));
        }

        return points;
    }
}
