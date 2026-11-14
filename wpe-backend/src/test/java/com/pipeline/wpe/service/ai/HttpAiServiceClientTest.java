package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.FeedbackStatus;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.common.enums.ProjectStatus;
import com.pipeline.wpe.common.enums.ReviewerRole;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class HttpAiServiceClientTest {

    private HttpServer server;
    private ExecutorService executor;
    private NodeDependencyRepository nodeDependencyRepository;

    @BeforeEach
    void setUp() {
        nodeDependencyRepository = Mockito.mock(NodeDependencyRepository.class);
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    private int startServer(HttpHandler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newCachedThreadPool();
        server.setExecutor(executor);
        server.createContext("/api/ai/diagnose", handler);
        server.start();
        return server.getAddress().getPort();
    }

    private ProjectEntity createSampleProject() {
        return ProjectEntity.builder()
                .id(100L)
                .name("example-project")
                .status(ProjectStatus.ACTIVE)
                .build();
    }

    private NodeEntity createSampleNode() {
        return NodeEntity.builder()
                .id(200L)
                .projectId(100L)
                .code("WPE-001")
                .title("example-node-title")
                .status(NodeStatus.TODO)
                .joinPolicy(JoinPolicy.ALL_COMPLETED)
                .estimatedHours(8)
                .isOverdue(false)
                .build();
    }

    private NodeDependencyEntity createSampleDependency() {
        return NodeDependencyEntity.builder()
                .id(300L)
                .projectId(100L)
                .parentNodeId(200L)
                .childNodeId(201L)
                .build();
    }

    private ProjectFeedbackEntity createSampleFeedback() {
        return ProjectFeedbackEntity.builder()
                .id(400L)
                .projectId(100L)
                .nodeId(200L)
                .reviewerName("example-reviewer")
                .reviewerRole(ReviewerRole.TEACHER)
                .content("example-feedback-content")
                .status(FeedbackStatus.OPEN)
                .build();
    }

    @Test
    @DisplayName("Thành công: server trả 200 JSON đầy đủ -> kết quả có criticalPath, source=AI_SERVICE và server nhận đúng request")
    void testRequestDiagnosis_Success() throws IOException {
        AtomicInteger requestCount = new AtomicInteger();
        AtomicReference<String> recordedMethod = new AtomicReference<>();
        AtomicReference<String> recordedPath = new AtomicReference<>();
        AtomicReference<String> recordedBody = new AtomicReference<>();
        AtomicReference<String> recordedContentLength = new AtomicReference<>();
        AtomicReference<String> recordedTransferEncoding = new AtomicReference<>();

        int port = startServer(exchange -> {
            requestCount.incrementAndGet();
            recordedMethod.set(exchange.getRequestMethod());
            recordedPath.set(exchange.getRequestURI().getPath());
            recordedContentLength.set(exchange.getRequestHeaders().getFirst("Content-Length"));
            recordedTransferEncoding.set(exchange.getRequestHeaders().getFirst("Transfer-Encoding"));
            byte[] bodyBytes = exchange.getRequestBody().readAllBytes();
            recordedBody.set(new String(bodyBytes, StandardCharsets.UTF_8));

            String jsonResponse = "{\"analyzedAt\":\"2026-01-01T00:00:00Z\","
                    + "\"criticalPath\":[\"WPE-001\"],"
                    + "\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}";
            byte[] responseBytes = jsonResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        });

        ProjectEntity project = createSampleProject();
        NodeEntity node = createSampleNode();
        NodeDependencyEntity dep = createSampleDependency();
        ProjectFeedbackEntity feedback = createSampleFeedback();

        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of(dep));

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:" + port,
                "/api/ai/diagnose",
                3,
                30
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(node), List.of(feedback));

        assertThat(result.get("criticalPath")).isEqualTo(List.of("WPE-001"));
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(requestCount.get()).isEqualTo(1);
        assertThat(recordedMethod.get()).isEqualTo("POST");
        assertThat(recordedPath.get()).isEqualTo("/api/ai/diagnose");
        assertThat(recordedBody.get())
                .contains("projectId")
                .contains("nodes")
                .contains("dependencies")
                .contains("openFeedbacks")
                .contains("WPE-001");
        assertThat(recordedContentLength.get()).isNotNull();
        assertThat(recordedTransferEncoding.get()).isNotEqualToIgnoringCase("chunked");
    }

    @Test
    @DisplayName("Thiếu analyzedAt: server trả 200 không có analyzedAt -> kết quả có analyzedAt khác null và source=AI_SERVICE")
    void testRequestDiagnosis_MissingAnalyzedAt() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],"
                    + "\"actionableAdvice\":[],\"metrics\":{}}";
            byte[] responseBytes = jsonResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        });

        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:" + port,
                "/api/ai/diagnose",
                3,
                30
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("analyzedAt")).isNotNull();
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
    }

    private Map<String, Object> callWithBody(String jsonResponse) throws IOException {
        int port = startServer(exchange -> {
            byte[] responseBytes = jsonResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        });
        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());
        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(), nodeDependencyRepository,
                "http://127.0.0.1:" + port, "/api/ai/diagnose", 3, 30);
        return client.requestDiagnosis(project, List.of(), List.of());
    }

    @Test
    @DisplayName("Fixture chung: response mẫu của hợp đồng được chấp nhận; request mẫu đọc được vào AiDiagnosisRequest")
    void testSharedContractFixtures() throws IOException {
        java.nio.file.Path dir = java.nio.file.Path.of("..", "shared", "test-fixtures");
        String responseJson = java.nio.file.Files.readString(dir.resolve("ai-diagnose.response.json"));
        String requestJson = java.nio.file.Files.readString(dir.resolve("ai-diagnose.request.json"));

        AiDiagnosisRequest req = new com.fasterxml.jackson.databind.ObjectMapper()
                .readValue(requestJson, AiDiagnosisRequest.class);
        assertThat(req.nodes()).hasSize(2);
        assertThat(req.dependencies()).hasSize(1);
        assertThat(req.openFeedbacks().get(0).reviewerRole()).isEqualTo("TEACHER");

        Map<String, Object> result = callWithBody(responseJson);
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(result.get("criticalPath")).isEqualTo(List.of("WPE-001", "WPE-002"));
        assertThat(result).doesNotContainKey("warning");
    }

    @Test
    @DisplayName("Sai hợp đồng: thiếu khóa bắt buộc (chỉ có criticalPath) -> MOCK_FALLBACK, warning nêu lý do")
    void testRequestDiagnosis_MissingRequiredKeys_FallsBack() throws IOException {
        Map<String, Object> result = callWithBody("{\"criticalPath\":[]}");

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result.get("warning").toString()).contains("sai hợp đồng").contains("bottlenecks");
    }

    @Test
    @DisplayName("Sai hợp đồng: sai kiểu (metrics là mảng) -> MOCK_FALLBACK")
    void testRequestDiagnosis_WrongType_FallsBack() throws IOException {
        Map<String, Object> result = callWithBody("{\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],"
                + "\"actionableAdvice\":[],\"metrics\":[]}");

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result.get("warning").toString()).contains("metrics");
    }

    @Test
    @DisplayName("analyzedAt do Java đặt: giá trị rác/quá khứ của AI không được dùng cho cooldown")
    void testRequestDiagnosis_JavaOverridesAnalyzedAt() throws IOException {
        Map<String, Object> result = callWithBody("{\"analyzedAt\":\"not-a-date\",\"criticalPath\":[],"
                + "\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}");

        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(result.get("serviceAnalyzedAt")).isEqualTo("not-a-date");
        assertThat(Instant.parse(result.get("analyzedAt").toString())).isNotNull();
    }

    @Test
    @DisplayName("Server trả 500: lỗi HTTP 500 -> source=MOCK_FALLBACK, có warning, vẫn có criticalPath")
    void testRequestDiagnosis_ServerReturns500() throws IOException {
        int port = startServer(exchange -> {
            byte[] responseBytes = "{\"error\":\"example-error\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(500, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        });

        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:" + port,
                "/api/ai/diagnose",
                3,
                30
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result).containsKey("warning");
        assertThat(result.get("warning").toString()).contains("Không gọi được dịch vụ AI");
        assertThat(result).containsKey("criticalPath");
    }

    @Test
    @DisplayName("Không có server: kết nối thất bại -> source=MOCK_FALLBACK, có warning, vẫn có criticalPath")
    void testRequestDiagnosis_NoServer() {
        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:1",
                "/api/ai/diagnose",
                1,
                1
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result).containsKey("warning");
        assertThat(result).containsKey("criticalPath");
    }

    @Test
    @DisplayName("Quá giờ: server ngủ 3 giây, client đặt readTimeout=1s -> source=MOCK_FALLBACK, có warning, vẫn có criticalPath")
    void testRequestDiagnosis_Timeout() throws IOException {
        int port = startServer(exchange -> {
            try {
                Thread.sleep(3000);
                byte[] responseBytes = "{\"criticalPath\":[]}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, responseBytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(responseBytes);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException ignored) {
                // Client đã timeout và ngắt kết nối
            }
        });

        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:" + port,
                "/api/ai/diagnose",
                3,
                1
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("source")).isEqualTo("MOCK_FALLBACK");
        assertThat(result).containsKey("warning");
        assertThat(result).containsKey("criticalPath");
    }

    @Test
    @DisplayName("AiDiagnosisRequest.from: chuyển đổi thực thể và xử lý null an toàn")
    void testAiDiagnosisRequest_FromMapping() {
        ProjectEntity project = createSampleProject();
        NodeEntity node = createSampleNode();
        NodeDependencyEntity dep = createSampleDependency();
        ProjectFeedbackEntity feedback = createSampleFeedback();
        Instant now = Instant.parse("2026-11-12T00:00:00Z");

        AiDiagnosisRequest request = AiDiagnosisRequest.from(
                project, List.of(node), List.of(dep), List.of(feedback), now
        );

        assertThat(request.projectId()).isEqualTo(100L);
        assertThat(request.projectName()).isEqualTo("example-project");
        assertThat(request.projectStatus()).isEqualTo("ACTIVE");
        assertThat(request.requestedAt()).isEqualTo("2026-11-12T00:00:00Z");
        assertThat(request.nodes()).hasSize(1);
        assertThat(request.nodes().get(0).code()).isEqualTo("WPE-001");
        assertThat(request.nodes().get(0).status()).isEqualTo("TODO");
        assertThat(request.nodes().get(0).joinPolicy()).isEqualTo("ALL_COMPLETED");
        assertThat(request.dependencies()).hasSize(1);
        assertThat(request.dependencies().get(0).parentNodeId()).isEqualTo(200L);
        assertThat(request.dependencies().get(0).childNodeId()).isEqualTo(201L);
        assertThat(request.openFeedbacks()).hasSize(1);
        assertThat(request.openFeedbacks().get(0).reviewerRole()).isEqualTo("TEACHER");

        // Kiểm tra an toàn khi truyền null
        AiDiagnosisRequest nullSafe = AiDiagnosisRequest.from(null, null, null, null, null);
        assertThat(nullSafe.projectId()).isNull();
        assertThat(nullSafe.projectName()).isNull();
        assertThat(nullSafe.projectStatus()).isNull();
        assertThat(nullSafe.requestedAt()).isNull();
        assertThat(nullSafe.nodes()).isEmpty();
        assertThat(nullSafe.dependencies()).isEmpty();
        assertThat(nullSafe.openFeedbacks()).isEmpty();
    }
}
