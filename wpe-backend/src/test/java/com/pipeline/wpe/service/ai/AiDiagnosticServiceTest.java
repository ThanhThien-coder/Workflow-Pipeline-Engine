package com.pipeline.wpe.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.exception.AiServiceUnavailableException;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
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

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

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
    @DisplayName("9.2 Trigger AI Diagnostics - 1. Thành công: giữ chỗ, gọi AI ngoài tx, lưu JSONB")
    void testTriggerAiDiagnostics_Success() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .name("Core Banking")
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockAiResult = Map.of(
            "analyzedAt", Instant.now().toString(),
            "bottlenecks", List.of()
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockAiResult);

        Map<String, Object> result = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result).isEqualTo(mockAiResult);
        verify(projectRepository).updateLatestAiAnalysis(eq(projectId), argThat(json -> json.contains("analyzedAt")));
        verify(projectRepository, never()).save(any());
        verify(projectRepository, never()).releaseAiDiagnosisClaim(any(), any(), any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 2. Ngưỡng cooldown đúng 180s và now cắt về micro giây")
    void testTriggerAiDiagnostics_CooldownThresholdAndMicrosPrecision() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockAiResult = Map.of("analyzedAt", Instant.now().toString());
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockAiResult);

        aiDiagnosticService.triggerAiDiagnostics(projectId);

        ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> thresholdCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(projectRepository).claimAiDiagnosis(eq(projectId), nowCaptor.capture(), thresholdCaptor.capture());

        Instant capturedNow = nowCaptor.getValue();
        Instant capturedThreshold = thresholdCaptor.getValue();

        assertThat(Duration.between(capturedThreshold, capturedNow).getSeconds()).isEqualTo(180L);
        assertThat(capturedNow.getNano() % 1000).isZero();
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 3. Đang cooldown ném CooldownActiveException (429)")
    void testTriggerAiDiagnostics_CooldownActive_ThrowsCooldownActiveException() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(0);
        when(projectRepository.findAiRequestedAt(projectId)).thenReturn(Optional.of(Instant.now().minusSeconds(30)));

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(CooldownActiveException.class)
            .satisfies(ex -> {
                CooldownActiveException ce = (CooldownActiveException) ex;
                assertThat(ce.getRemainingSeconds()).isBetween(140L, 160L);
            });

        verify(aiServiceClient, never()).requestDiagnosis(any(), any(), any());
        verify(projectRepository, never()).updateLatestAiAnalysis(any(), any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 4. Đang cooldown nhưng không đọc được giờ thì remainingSeconds bằng 180")
    void testTriggerAiDiagnostics_CooldownActive_NoTimestamp_DefaultsToFullCooldown() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(0);
        when(projectRepository.findAiRequestedAt(projectId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(CooldownActiveException.class)
            .satisfies(ex -> {
                CooldownActiveException ce = (CooldownActiveException) ex;
                assertThat(ce.getRemainingSeconds()).isEqualTo(180L);
            });

        verify(aiServiceClient, never()).requestDiagnosis(any(), any(), any());
        verify(projectRepository, never()).updateLatestAiAnalysis(any(), any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 5. AI lỗi trả lại chỗ và ném tiếp, không ghi DB")
    void testTriggerAiDiagnostics_AiServiceError_ReleasesClaimAndThrows() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        Instant t0 = Instant.parse("2026-11-16T01:00:00Z");
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .aiRequestedAt(t0)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        AiServiceUnavailableException serviceException = new AiServiceUnavailableException("example-reason", null);
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenThrow(serviceException);

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isSameAs(serviceException);

        ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(projectRepository).claimAiDiagnosis(eq(projectId), nowCaptor.capture(), any(Instant.class));

        ArgumentCaptor<Instant> claimedAtCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(projectRepository).releaseAiDiagnosisClaim(eq(projectId), eq(t0), claimedAtCaptor.capture());

        assertThat(claimedAtCaptor.getValue()).isEqualTo(nowCaptor.getValue());
        verify(projectRepository, never()).updateLatestAiAnalysis(any(), any());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 6. AI lỗi 2 lần liên tiếp đều ném AiServiceUnavailableException và trả lại chỗ cả 2 lần")
    void testTriggerAiDiagnostics_ConsecutiveAiErrors_BothThrowUnavailableAndReleaseClaim() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        when(aiServiceClient.requestDiagnosis(any(), any(), any()))
            .thenThrow(new AiServiceUnavailableException("example-reason", null));

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(AiServiceUnavailableException.class);
        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(AiServiceUnavailableException.class);

        verify(projectRepository, times(2)).releaseAiDiagnosisClaim(eq(projectId), any(), any());
        verify(projectRepository, never()).updateLatestAiAnalysis(any(), any());
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 7. Lưu kết quả lỗi cũng trả lại chỗ và ném tiếp")
    void testTriggerAiDiagnostics_SaveError_ReleasesClaimAndThrows() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        Instant t0 = Instant.parse("2026-11-16T01:00:00Z");
        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .aiRequestedAt(t0)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockAiResult = Map.of("analyzedAt", Instant.now().toString());
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockAiResult);
        when(projectRepository.updateLatestAiAnalysis(eq(projectId), anyString()))
            .thenThrow(new RuntimeException("example-db-error"));

        assertThatThrownBy(() -> aiDiagnosticService.triggerAiDiagnostics(projectId))
            .isInstanceOf(RuntimeException.class)
            .hasMessage("example-db-error");

        verify(projectRepository, times(1)).releaseAiDiagnosisClaim(eq(projectId), eq(t0), any(Instant.class));
        verify(projectRepository, never()).save(any());
    }

    @Test
    @DisplayName("9.2 Trigger AI Diagnostics - 8. source MOCK vẫn được lưu vào latest_ai_analysis")
    void testTriggerAiDiagnostics_MockSource_SavedSuccessfully() {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(userId);

        ProjectEntity project = ProjectEntity.builder()
            .id(projectId)
            .build();
        when(authorizationService.verifyProjectMemberOrOwner(projectId, userId)).thenReturn(project);
        when(projectRepository.claimAiDiagnosis(eq(projectId), any(Instant.class), any(Instant.class))).thenReturn(1);
        when(nodeRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(feedbackRepository.findByProjectIdAndStatus(any(), any())).thenReturn(List.of());

        Map<String, Object> mockResult = Map.of(
            "source", "MOCK",
            "analyzedAt", Instant.now().toString()
        );
        when(aiServiceClient.requestDiagnosis(any(), any(), any())).thenReturn(mockResult);

        Map<String, Object> result = aiDiagnosticService.triggerAiDiagnostics(projectId);

        assertThat(result.get("source")).isEqualTo("MOCK");
        verify(projectRepository).updateLatestAiAnalysis(eq(projectId), argThat(json -> json.contains("\"source\":\"MOCK\"")));
        verify(projectRepository, never()).save(any());
        verify(projectRepository, never()).releaseAiDiagnosisClaim(any(), any(), any());
    }
}
