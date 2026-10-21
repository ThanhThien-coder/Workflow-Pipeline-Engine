package com.pipeline.wpe.service.ai;

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
import java.time.format.DateTimeParseException;
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
     * Kiểm tra cooldown trước khi gọi microservice AI để chống spam và lãng phí token.
     * Ghi đè kết quả phân tích vào PROJECT.latest_ai_analysis.
     */
    @Transactional
    public Map<String, Object> triggerAiDiagnostics(Long projectId) {
        Long currentUserId = currentUserProvider.requireCurrentUserId();
        ProjectEntity project = authorizationService.verifyProjectMemberOrOwner(projectId, currentUserId);

        // 1. Kiểm tra Cooldown
        Map<String, Object> latestAnalysis = project.getLatestAiAnalysis();
        if (latestAnalysis != null && latestAnalysis.containsKey("analyzedAt")) {
            Object rawAnalyzedAt = latestAnalysis.get("analyzedAt");
            Instant lastAnalyzed = parseInstant(rawAnalyzedAt);
            if (lastAnalyzed != null) {
                long elapsedSeconds = Duration.between(lastAnalyzed, Instant.now()).getSeconds();
                if (elapsedSeconds < cooldownSeconds) {
                    long remainingSeconds = cooldownSeconds - elapsedSeconds;
                    log.warn("Project ID: {} triggered AI diagnostics too soon. Remaining cooldown: {}s", projectId, remainingSeconds);
                    throw new CooldownActiveException(remainingSeconds);
                }
            }
        }

        // 2. Thu thập dữ liệu ngữ cảnh
        List<NodeEntity> nodes = nodeRepository.findByProjectId(projectId);
        List<ProjectFeedbackEntity> openFeedbacks = feedbackRepository.findByProjectIdAndStatus(projectId, FeedbackStatus.OPEN);

        // 3. Gọi dịch vụ AI
        Map<String, Object> newAnalysis = aiServiceClient.requestDiagnosis(project, nodes, openFeedbacks);

        // 4. Ghi đè vào JSONB latest_ai_analysis và lưu Database
        project.setLatestAiAnalysis(newAnalysis);
        projectRepository.save(project);
        log.info("Successfully updated AI diagnosis in PROJECT.latest_ai_analysis for project ID: {}", projectId);

        return newAnalysis;
    }

    private Instant parseInstant(Object raw) {
        if (raw instanceof Instant inst) {
            return inst;
        }
        if (raw instanceof String str) {
            try {
                return Instant.parse(str);
            } catch (DateTimeParseException ignored) {
            }
        }
        return null;
    }
}

