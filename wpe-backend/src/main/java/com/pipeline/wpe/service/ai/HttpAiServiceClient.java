package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.exception.AiServiceUnavailableException;
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
 * Không gọi được dịch vụ AI thì ném AiServiceUnavailableException (HTTP 503), không tạo dữ liệu giả.
 * Backend luôn tự đặt analyzedAt (cooldown dựa vào đó); response sai khuôn contract cũng ném AiServiceUnavailableException.
 */
@Slf4j
@Service
@ConditionalOnProperty(prefix = "app.ai", name = "mode", havingValue = "http", matchIfMissing = true)
public class HttpAiServiceClient implements AiServiceClient {

    static final String INTERNAL_KEY_HEADER = "X-Internal-Key";

    /** Các khóa bắt buộc phải là mảng trong response của dịch vụ AI (contract mục 4.1). */
    static final List<String> REQUIRED_ARRAY_KEYS = List.of("criticalPath", "bottlenecks", "taskTraps", "actionableAdvice");

    /** Trả mô tả lỗi đầu tiên nếu response sai khuôn contract, hoặc null nếu hợp lệ. Chỉ kiểm kiểu, không kiểm nội dung. */
    static String findContractViolation(Map<String, Object> body) {
        for (String key : REQUIRED_ARRAY_KEYS) {
            if (!(body.get(key) instanceof List<?>)) {
                return key + " is missing or is not an array";
            }
        }
        if (!(body.get("metrics") instanceof Map<?, ?>)) {
            return "metrics is missing or is not an object";
        }
        return null;
    }

    private final RestClient restClient;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final String diagnosePath;
    private final String internalKey;

    public HttpAiServiceClient(RestClient.Builder restClientBuilder,
                               NodeDependencyRepository nodeDependencyRepository,
                               @Value("${app.ai.service-url}") String serviceUrl,
                               @Value("${app.ai.diagnose-path:/api/ai/diagnose}") String diagnosePath,
                               @Value("${app.ai.connect-timeout-seconds:3}") int connectTimeoutSeconds,
                               @Value("${app.ai.read-timeout-seconds:30}") int readTimeoutSeconds,
                               @Value("${app.ai.internal-key:}") String internalKey) {
        this.nodeDependencyRepository = nodeDependencyRepository;
        this.diagnosePath = diagnosePath;
        this.internalKey = internalKey != null ? internalKey.trim() : "";
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutSeconds * 1000);
        factory.setReadTimeout(readTimeoutSeconds * 1000);
        this.restClient = restClientBuilder
                .baseUrl(serviceUrl)
                .requestFactory(new BufferingClientHttpRequestFactory(factory))
                .build();
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
                    .headers(h -> {
                        if (!internalKey.isEmpty()) {
                            h.set(INTERNAL_KEY_HEADER, internalKey);
                        }
                    })
                    .body(payload)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (responseBody == null) {
                log.warn("Dịch vụ AI trả về body null cho dự án ID: {}", projectId);
                throw new AiServiceUnavailableException("body null", null);
            }

            String violation = findContractViolation(responseBody);
            if (violation != null) {
                log.warn("Dịch vụ AI trả dữ liệu sai hợp đồng (dự án ID: {}): {}", projectId, violation);
                throw new AiServiceUnavailableException("contract violation: " + violation, null);
            }

            Map<String, Object> result = new LinkedHashMap<>(responseBody);
            Object serviceAnalyzedAt = result.remove("analyzedAt");
            if (serviceAnalyzedAt != null) {
                result.put("serviceAnalyzedAt", serviceAnalyzedAt);
            }
            result.put("analyzedAt", Instant.now().toString());
            if (!result.containsKey("source") || result.get("source") == null) {
                result.put("source", "AI_SERVICE");
            }

            return result;
        } catch (AiServiceUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            String shortReason = extractShortReason(ex);
            log.warn("Không gọi được dịch vụ AI (dự án ID: {}): {}",
                    project != null ? project.getId() : "null", shortReason, ex);
            throw new AiServiceUnavailableException(shortReason, ex);
        }
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
            return "connection failed or timed out";
        }
        if (ex.getMessage() != null && !ex.getMessage().isBlank()) {
            return ex.getMessage();
        }
        return ex.getClass().getSimpleName();
    }
}
