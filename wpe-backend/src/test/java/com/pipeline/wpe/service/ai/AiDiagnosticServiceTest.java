package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.CooldownActiveException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiDiagnosticServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private NodeRepository nodeRepository;

    @Mock
    private ProjectFeedbackRepository feedbackRepository;

    @Mock
    private ProjectAuthorizationService authorizationService;

    @Mock
    private CurrentUserProvider currentUserProvider;

    @Mock
    private AiServiceClient aiServiceClient;

    @InjectMocks
    private AiDiagnosticService aiDiagnosticService;

    private final Long projectId = 1L;
    private final Long userId = 2L;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(aiDiagnosticService, "cooldownSeconds", 180L);
    }

    @Test
    @DisplayName("9.1 Get Latest Analysis - Đọc kết quả đã cache từ JSONB")
    void testGetLatestAnalysis_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        Map<String, Object> cachedAnalysis = Map.of(
            "analyzedAt", Instant.now().toString(),
            "criticalPath", List.of("WPE-001", "WPE-002")
        );

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .latestAiAnalysis(cachedAnalysis)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);

        Map<String, Object> result = aiDiagnosticService.getLatestAnalysis(projectId);

        assertThat(result).containsKey("criticalPath");
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - Kích hoạt phân tích thành công và ghi đè JSONB")
    void testTriggerAiDiagnostics_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Banking")
            .latestAiAnalysis(null)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockAiResult = Map.of(
            "analyzedAt", Instant.now().toString(),
            "bottlenecks", List.of()
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockAiResult);

        Map<String, Object> result = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result).containsKey("analyzedAt");
        assertThat(project.getLatestAiAnalysis()).isEqualTo(mockAiResult);
        verify(projectRepository).save(project);
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - Cooldown vi phạm ném CooldownActiveException (429)")
    void testTriggerAiDiagnostics_CooldownViolation() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        // Vừa phân tích cách đây 30 giây (trong hạn mức cooldown 180s)
        Instant recentAnalysisTime = Instant.now().minus(30, ChronoUnit.SECONDS);
        Map<String, Object> existingAnalysis = Map.of(
            "analyzedAt", recentAnalysisTime.toString()
        );

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .latestAiAnalysis(existingAnalysis)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(CooldownActiveException.class)
            .satisfies(ex -> {
                CooldownActiveException ce = (CooldownActiveException) ex;
                assertThat(ce.getRemainingSeconds()).isBetween(140L, 160L);
            });

        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - MOCK_FALLBACK không ghi đè bản phân tích cũ và không lưu DB")
    void testTriggerAiDiagnostics_MockFallback_DoesNotOverwriteOldAnalysisAndDoesNotSave() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        Instant oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        Map<String, Object> oldAnalysis = Map.of(
            "analyzedAt", oneHourAgo.toString(),
            "source", "AI_SERVICE"
        );
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Banking")
            .latestAiAnalysis(oldAnalysis)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> fallbackResult = Map.of(
            "source", "MOCK_FALLBACK",
            "warning", "example-warning"
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(fallbackResult);

        Map<String, Object> result = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result.get("warning")).isEqualTo("example-warning");
        assertThat(project.getLatestAiAnalysis()).isEqualTo(oldAnalysis);
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - Gọi 2 lần liên tiếp nhận MOCK_FALLBACK không bị chặn Cooldown")
    void testTriggerAiDiagnostics_ConsecutiveMockFallback_NoCooldownException() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Banking")
            .latestAiAnalysis(null)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> fallbackResult = Map.of(
            "source", "MOCK_FALLBACK",
            "warning", "example-warning"
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(fallbackResult);

        Map<String, Object> result1 = aiDiagnosticService.triggerAiDiagnostics(projectId);
        Map<String, Object> result2 = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result1.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result2.get("source")).isEqualTo("MOCK_FALLBACK");
        verify(aiServiceClient, times(2)).requestDiagnosis(any(), any(), any());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - Client trả source MOCK vẫn được lưu DB bình thường")
    void testTriggerAiDiagnostics_MockSource_SavedSuccessfully() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Banking")
            .latestAiAnalysis(null)
            .build();

        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockResult = Map.of(
            "source", "MOCK",
            "analyzedAt", Instant.now().toString()
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockResult);

        Map<String, Object> result = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result.get("source")).isEqualTo("MOCK");
        assertThat(project.getLatestAiAnalysis()).isEqualTo(mockResult);
        verify(projectRepository).save(project);
    }
}

