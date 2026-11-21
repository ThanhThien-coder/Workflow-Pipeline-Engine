package com.pipeline.wpe.service.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.exception.CooldownActiveException;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.repository.ProjectFeedbackRepository;
import com.pipeline.wpe.repository.ProjectRepository;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.ProjectAuthorizationService;
import com.pipeline.wpe.service.event.ProjectRealtimeNotifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiDiagnosticService {

    private final ProjectRepository projectRepository;
    private final NodeRepository nodeRepository;
    private final ProjectFeedbackRepository feedbackRepository;
    private final ProjectAuthorizationService authorizationService;
    private final CurrentUserProvider currentUserProvider;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;
    private final ProjectRealtimeNotifier projectRealtimeNotifier;

    @Value("${app.ai.cooldown-seconds:60}")
    private long cooldownSeconds;

    /**
     * 9.1 Lấy bản ghi phân tích đã lưu từ JSONB PROJECT.latest_ai_analysis.
     * Độ trễ < 2ms, chi phí 0 token, không gọi external API.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getLatestAnalysis(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectEntity project = authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        Map<String, Object> analysis = project.getLatestAiAnalysis();
        if (analysis == null || analysis.isEmpty()) {
            return Map.of(
                "message", "No AI diagnosis is available for this project yet. Select 'AI diagnosis' to run an analysis.",
                "hasAnalysis", false
            );
        }
        return analysis;
    }

    /**
     * 9.2 Bấm nút "AI Diagnosis" kích hoạt phân tích mới (có cooldown, mặc định 60 giây, đổi bằng AI_COOLDOWN_SECONDS).
     * Giữ chỗ nguyên tử trên project.ai_requested_at (chống bấm trùng, cooldown app.ai.cooldown-seconds).
     * Gọi AI ngoài transaction. AI lỗi thì trả lại chỗ và ném tiếp (503), không lưu.
     * Thành công thì chỉ ghi cột latest_ai_analysis.
     */
    public Map<String, Object> triggerAiDiagnostics(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectEntity project = authorizationService.verifyProjectOwnerOrManager(projectId, currentUserId); // chỉ owner/manager được chạy AI (tốn token)
        Instant previousRequestedAt = project.getAiRequestedAt();

        // 1. Giữ chỗ nguyên tử (B3). Postgres lưu tới micro giây: PHẢI cắt now về MICROS,
        //    nếu không câu trả lại chỗ (so sánh bằng) sẽ không bao giờ khớp.
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        int claimed = projectRepository.claimAiDiagnosis(projectId, now, now.minusSeconds(cooldownSeconds));
        if (claimed == 0) {
            Instant last = projectRepository.findAiRequestedAt(projectId).orElse(now);
            long elapsed = Duration.between(last, now).getSeconds();
            long remainingSeconds = Math.min(cooldownSeconds, Math.max(1L, cooldownSeconds - elapsed));
            log.warn("Project ID: {} triggered AI diagnostics too soon. Remaining cooldown: {}s", projectId, remainingSeconds);
            throw new CooldownActiveException(remainingSeconds);
        }

        try {
            // 2. Thu thập dữ liệu (mỗi repository tự chạy transaction ngắn)
            List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
            List<ProjectFeedbackEntity> openFeedbacks = feedbackRepository.findByProjectIdAndStatus(projectId, FeedbackStatus.OPEN);

            // 3. Gọi dịch vụ AI NGOÀI transaction (B2)
            Map<String, Object> newAnalysis = aiServiceClient.requestDiagnosis(project, nodes, openFeedbacks);

            // 4. Chỉ ghi cột latest_ai_analysis (không ghi đè cột khác, không đổi updated_at)
            projectRepository.updateLatestAiAnalysis(projectId, toJson(newAnalysis));
            log.info("Successfully updated AI diagnosis in PROJECT.latest_ai_analysis for project ID: {}", projectId);
            projectRealtimeNotifier.notifyProjectChanged(projectId, "AI", "AI_ANALYZED", currentUserId, null, null);
            return newAnalysis;
        } catch (RuntimeException ex) {
            // AI lỗi (gồm AiServiceUnavailableException) hoặc lưu lỗi: trả lại chỗ, không tính cooldown
            projectRepository.releaseAiDiagnosisClaim(projectId, previousRequestedAt, now);
            throw ex;
        }
    }

    private String toJson(Map<String, Object> analysis) {
        try {
            return objectMapper.writeValueAsString(analysis);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize the AI result to JSON", e);
        }
    }
}
