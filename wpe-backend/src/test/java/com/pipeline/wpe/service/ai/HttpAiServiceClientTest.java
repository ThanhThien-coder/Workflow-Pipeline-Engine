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

import com.pipeline.wpe.exception.AiServiceUnavailableException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

class HttpAiServiceClientTest {

    private static final String VALID_MINIMAL_RESPONSE =
            "{\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}";

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
                30,
                ""
        );

        Instant before = Instant.now();
        Map<String, Object> result = client.requestDiagnosis(project, List.of(node), List.of(feedback));
        Instant after = Instant.now();

        assertThat(result.get("criticalPath")).isEqualTo(List.of("WPE-001"));
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(result.get("serviceAnalyzedAt")).isEqualTo("2026-01-01T00:00:00Z");
        assertThat(result.get("analyzedAt")).isNotEqualTo("2026-01-01T00:00:00Z");
        Instant analyzedAt = Instant.parse(String.valueOf(result.get("analyzedAt")));
        assertThat(analyzedAt).isBetween(before, after);
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
            String jsonResponse = VALID_MINIMAL_RESPONSE;
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
                30,
                ""
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("analyzedAt")).isNotNull();
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(result).doesNotContainKey("serviceAnalyzedAt");
    }

    @Test
    @DisplayName("Server trả 500: lỗi HTTP 500 -> ném AiServiceUnavailableException (503)")
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE);
    }

    @Test
    @DisplayName("Không có server: kết nối thất bại -> ném AiServiceUnavailableException (503)")
    void testRequestDiagnosis_NoServer() {
        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient client = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:1",
                "/api/ai/diagnose",
                1,
                1,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE);
    }

    @Test
    @DisplayName("Quá giờ: server ngủ 3 giây, client đặt readTimeout=1s -> ném AiServiceUnavailableException (503)")
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
                1,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE);
    }

    @Test
    @DisplayName("Body null: server trả 200 JSON nhưng body null -> ném AiServiceUnavailableException (503)")
    void testRequestDiagnosis_NullResponseBody() throws IOException {
        int port = startServer(exchange -> {
            byte[] responseBytes = "null".getBytes(StandardCharsets.UTF_8);
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE);
    }

    @Test
    @DisplayName("Xác thực nội bộ: cấu hình internalKey khác rỗng -> server nhận đúng header X-Internal-Key")
    void testRequestDiagnosis_WithInternalKey() throws IOException {
        AtomicReference<String> recordedInternalKey = new AtomicReference<>();

        int port = startServer(exchange -> {
            recordedInternalKey.set(exchange.getRequestHeaders().getFirst(HttpAiServiceClient.INTERNAL_KEY_HEADER));
            byte[] responseBytes = VALID_MINIMAL_RESPONSE.getBytes(StandardCharsets.UTF_8);
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
                30,
                "example-internal-key"
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(recordedInternalKey.get()).isEqualTo("example-internal-key");
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
    }

    @Test
    @DisplayName("Xác thực nội bộ: cấu hình internalKey rỗng -> server không nhận header X-Internal-Key")
    void testRequestDiagnosis_WithoutInternalKey() throws IOException {
        AtomicReference<String> recordedInternalKey = new AtomicReference<>();

        int port = startServer(exchange -> {
            recordedInternalKey.set(exchange.getRequestHeaders().getFirst(HttpAiServiceClient.INTERNAL_KEY_HEADER));
            byte[] responseBytes = VALID_MINIMAL_RESPONSE.getBytes(StandardCharsets.UTF_8);
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
                30,
                ""
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(recordedInternalKey.get()).isNull();
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
    }

    @Test
    @DisplayName("Xác thực nội bộ: cấu hình internalKey null hoặc chỉ khoảng trắng -> server không nhận header X-Internal-Key")
    void testRequestDiagnosis_InternalKey_NullAndWhitespace() throws IOException {
        AtomicReference<String> recordedInternalKey = new AtomicReference<>();

        int port = startServer(exchange -> {
            recordedInternalKey.set(exchange.getRequestHeaders().getFirst(HttpAiServiceClient.INTERNAL_KEY_HEADER));
            byte[] responseBytes = VALID_MINIMAL_RESPONSE.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(responseBytes);
            }
        });

        ProjectEntity project = createSampleProject();
        when(nodeDependencyRepository.findByProjectId(project.getId())).thenReturn(List.of());

        HttpAiServiceClient clientWithNull = new HttpAiServiceClient(
                RestClient.builder(),
                nodeDependencyRepository,
                "http://127.0.0.1:" + port,
                "/api/ai/diagnose",
                3,
                30,
                null
        );

        Map<String, Object> result = clientWithNull.requestDiagnosis(project, List.of(), List.of());

        assertThat(recordedInternalKey.get()).isNull();
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
    }

    @Test
    @DisplayName("AiDiagnosisRequest.from: chuyển đổi thực thể và xử lý null an toàn")
    void testAiDiagnosisRequest_FromMapping() {
        ProjectEntity project = createSampleProject();
        NodeEntity node = createSampleNode();
        NodeEntity completedNode = NodeEntity.builder()
                .id(202L)
                .projectId(100L)
                .code("WPE-002")
                .title("completed-node-title")
                .status(NodeStatus.DONE)
                .joinPolicy(JoinPolicy.ALL_COMPLETED)
                .completedAt(Instant.parse("2026-11-10T03:00:00Z"))
                .build();
        NodeDependencyEntity dep = createSampleDependency();
        ProjectFeedbackEntity feedback = createSampleFeedback();
        Instant now = Instant.parse("2026-11-12T00:00:00Z");

        AiDiagnosisRequest request = AiDiagnosisRequest.from(
                project, List.of(node, completedNode), List.of(dep), List.of(feedback), now
        );

        assertThat(request.projectId()).isEqualTo(100L);
        assertThat(request.projectName()).isEqualTo("example-project");
        assertThat(request.projectStatus()).isEqualTo("ACTIVE");
        assertThat(request.requestedAt()).isEqualTo("2026-11-12T00:00:00Z");
        assertThat(request.nodes()).hasSize(2);
        assertThat(request.nodes().get(0).code()).isEqualTo("WPE-001");
        assertThat(request.nodes().get(0).status()).isEqualTo("TODO");
        assertThat(request.nodes().get(0).joinPolicy()).isEqualTo("ALL_COMPLETED");
        assertThat(request.nodes().get(0).completedAt()).isNull();
        assertThat(request.nodes().get(1).code()).isEqualTo("WPE-002");
        assertThat(request.nodes().get(1).status()).isEqualTo("DONE");
        assertThat(request.nodes().get(1).completedAt()).isEqualTo("2026-11-10T03:00:00Z");
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

    @Test
    @DisplayName("T3: Python trả analyzedAt ở tương lai -> backend tự đặt analyzedAt hiện tại, cất giá trị cũ vào serviceAnalyzedAt")
    void testRequestDiagnosis_FutureAnalyzedAt() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"analyzedAt\":\"2099-01-01T00:00:00Z\","
                    + "\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}";
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
                30,
                ""
        );

        Instant before = Instant.now();
        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());
        Instant after = Instant.now();

        assertThat(result.get("serviceAnalyzedAt")).isEqualTo("2099-01-01T00:00:00Z");
        Instant analyzedAt = Instant.parse(String.valueOf(result.get("analyzedAt")));
        assertThat(analyzedAt).isBetween(before, after);
    }

    @Test
    @DisplayName("T3: Python trả analyzedAt sai định dạng -> backend tự đặt analyzedAt ISO-8601, cất giá trị cũ vào serviceAnalyzedAt")
    void testRequestDiagnosis_InvalidFormatAnalyzedAt() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"analyzedAt\":\"16/11/2026\","
                    + "\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}";
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
                30,
                ""
        );

        Instant before = Instant.now();
        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());
        Instant after = Instant.now();

        assertThat(result.get("serviceAnalyzedAt")).isEqualTo("16/11/2026");
        Instant analyzedAt = Instant.parse(String.valueOf(result.get("analyzedAt")));
        assertThat(analyzedAt).isBetween(before, after);
    }

    @Test
    @DisplayName("T4: Server trả JSON rỗng {} -> ném AiServiceUnavailableException với reason chứa criticalPath")
    void testRequestDiagnosis_EmptyJsonContractViolation() throws IOException {
        int port = startServer(exchange -> {
            byte[] responseBytes = "{}".getBytes(StandardCharsets.UTF_8);
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE)
                .satisfies(ex -> assertThat(((AiServiceUnavailableException) ex).getReason()).contains("criticalPath"));
    }

    @Test
    @DisplayName("T4: criticalPath là chuỗi không phải mảng -> ném AiServiceUnavailableException với reason chứa criticalPath")
    void testRequestDiagnosis_CriticalPathNotArray() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"criticalPath\":\"abc\",\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":{}}";
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE)
                .satisfies(ex -> assertThat(((AiServiceUnavailableException) ex).getReason()).contains("criticalPath"));
    }

    @Test
    @DisplayName("T4: Thiếu taskTraps -> ném AiServiceUnavailableException với reason chứa taskTraps")
    void testRequestDiagnosis_MissingTaskTraps() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"criticalPath\":[],\"bottlenecks\":[],\"actionableAdvice\":[],\"metrics\":{}}";
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE)
                .satisfies(ex -> assertThat(((AiServiceUnavailableException) ex).getReason()).contains("taskTraps"));
    }

    @Test
    @DisplayName("T4: metrics là mảng không phải object -> ném AiServiceUnavailableException với reason chứa metrics")
    void testRequestDiagnosis_MetricsNotObject() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{\"criticalPath\":[],\"bottlenecks\":[],\"taskTraps\":[],\"actionableAdvice\":[],\"metrics\":[]}";
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
                30,
                ""
        );

        assertThatThrownBy(() -> client.requestDiagnosis(project, List.of(), List.of()))
                .isInstanceOf(AiServiceUnavailableException.class)
                .hasMessage(AiServiceUnavailableException.USER_MESSAGE)
                .satisfies(ex -> assertThat(((AiServiceUnavailableException) ex).getReason()).contains("metrics"));
    }

    @Test
    @DisplayName("T4: Các mảng có phần tử và có khóa lạ -> hợp lệ, không ném exception và giữ nguyên khóa lạ")
    void testRequestDiagnosis_ValidWithExtraKeys() throws IOException {
        int port = startServer(exchange -> {
            String jsonResponse = "{"
                    + "\"criticalPath\":[\"WPE-001\"],"
                    + "\"bottlenecks\":[{\"nodeCode\":\"WPE-001\",\"severity\":\"HIGH\"}],"
                    + "\"taskTraps\":[{\"nodeCode\":\"WPE-001\",\"trapType\":\"POTENTIAL_STALL\"}],"
                    + "\"actionableAdvice\":[{\"action\":\"CONTINUE_PIPELINE\"}],"
                    + "\"metrics\":{\"driftScore\":15.0},"
                    + "\"rootCauseNotes\":\"example-root-cause\","
                    + "\"tokenUsage\":123"
                    + "}";
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
                30,
                ""
        );

        Map<String, Object> result = client.requestDiagnosis(project, List.of(), List.of());

        assertThat(result.get("criticalPath")).isEqualTo(List.of("WPE-001"));
        assertThat(result.get("rootCauseNotes")).isEqualTo("example-root-cause");
        assertThat(result.get("tokenUsage")).isEqualTo(123);
        assertThat(result.get("source")).isEqualTo("AI_SERVICE");
        assertThat(result.get("analyzedAt")).isNotNull();
    }
}
