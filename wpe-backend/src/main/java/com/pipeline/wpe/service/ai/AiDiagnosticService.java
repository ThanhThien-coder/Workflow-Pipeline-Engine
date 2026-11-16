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

    @Value("${app.ai.cooldown-seconds:180}")
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
                "message", "Chưa có dữ liệu chẩn đoán AI cho dự án này. Vui lòng bấm nút 'AI Diagnosis' để kích hoạt phân tích.",
                "hasAnalysis", false
            );
        }
        return analysis;
    }

    /**
     * 9.2 Bấm nút "AI Diagnosis" kích hoạt phân tích mới (có Cooldown 3-5 phút).
     * Giữ chỗ nguyên tử trên project.ai_requested_at (chống bấm trùng, cooldown 180 giây).
     * Gọi AI ngoài transaction. AI lỗi thì trả lại chỗ và ném tiếp (503), không lưu.
     * Thành công thì chỉ ghi cột latest_ai_analysis.
     */
    public Map<String, Object> triggerAiDiagnostics(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectEntity project = authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);
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
            throw new IllegalStateException("Không chuyển được kết quả AI sang JSON", e);
        }
    }
}
