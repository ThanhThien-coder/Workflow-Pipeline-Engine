package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cài đặt kết nối HTTP sang microservice AI (Python).
 * Được kích hoạt khi app.ai.mode=http.
 * Tự động chuyển về fallback (AiServiceClientImpl) khi microservice gặp sự cố hoặc quá giờ.
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "app.ai", name = "mode", havingValue = "http")
public class HttpAiServiceClient implements AiServiceClient {

    private final RestClient restClient;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final String diagnosePath;
    private final AiServiceClient fallback;

    public HttpAiServiceClient(RestClient.Builder restClientBuilder,
                               NodeDependencyRepository nodeDependencyRepository,
                               @Value("${app.ai.service-url}") String serviceUrl,
                               @Value("${app.ai.diagnose-path:/api/ai/diagnose}") String diagnosePath,
                               @Value("${app.ai.connect-timeout-seconds:3}") int connectTimeoutSeconds,
                               @Value("${app.ai.read-timeout-seconds:30}") int readTimeoutSeconds) {
        this.nodeDependencyRepository = nodeDependencyRepository;
        this.diagnosePath = diagnosePath;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutSeconds * 1000);
        factory.setReadTimeout(readTimeoutSeconds * 1000);
        this.restClient = restClientBuilder
                .baseUrl(serviceUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(factory))
                .build();
        this.fallback = new AiServiceClientImpl();
    }

    @Override
    public Map<String, Object> requestDiagnosis(ProjectEntity project, List<NodeEntity> nodes, List<ProjectFeedbackEntity> openFeedbacks) {
        try {
            Long projectId = project != null ? project.getId() : null;
            List<NodeDependencyEntity> deps = (projectId != null)
                    ? nodeDependencyRepository.findByProjectId(projectId)
                    : List.of();
            AiDiagnosisRequest payload = AiDiagnosisRequest.from(project, nodes, deps, openFeedbacks, Instant.now());

            Map<String, Object> responseBody = restClient.post()
                    .uri(diagnosePath)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (responseBody == null) {
                log.warn("Dịch vụ AI trả về body null cho dự án ID: {}", projectId);
                return createFallbackResult(project, nodes, openFeedbacks, "body null");
            }

            Map<String, Object> result = new LinkedHashMap<>(responseBody);
            if (!result.containsKey("analyzedAt") || result.get("analyzedAt") == null) {
                result.put("analyzedAt", Instant.now().toString());
            }
            if (!result.containsKey("source") || result.get("source") == null) {
                result.put("source", "AI_SERVICE");
            }

            return result;
        } catch (Exception ex) {
            String shortReason = extractShortReason(ex);
            log.warn("Không gọi được dịch vụ AI (dự án ID: {}): {}",
                    project != null ? project.getId() : "null", shortReason, ex);
            return createFallbackResult(project, nodes, openFeedbacks, shortReason);
        }
    }

    private Map<String, Object> createFallbackResult(ProjectEntity project, List<NodeEntity> nodes,
                                                     List<ProjectFeedbackEntity> openFeedbacks, String shortReason) {
        Map<String, Object> fallbackResult = new LinkedHashMap<>(fallback.requestDiagnosis(project, nodes, openFeedbacks));
        fallbackResult.put("source", "MOCK_FALLBACK");
        fallbackResult.put("warning", "Không gọi được dịch vụ AI (" + shortReason + "), đang hiển thị dữ liệu giả.");
        return fallbackResult;
    }

    private String extractShortReason(Exception ex) {
        if (ex instanceof ResourceAccessException rae) {
            Throwable cause = rae.getCause();
            if (cause != null && cause.getMessage() != null && !cause.getMessage().isBlank()) {
                return cause.getMessage();
            }
            if (rae.getMessage() != null && !rae.getMessage().isBlank()) {
                return rae.getMessage();
            }
            return "kết nối thất bại hoặc quá giờ";
        }
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            return ex.getMessage();
        }
        return ex.getClass().getSimpleName();
    }
}
