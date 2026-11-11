package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.service.engine.KahnDagService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HeuristicAiClientTest {

    @Mock
    private NodeDependencyRepository nodeDependencyRepository;

    @Spy
    private KahnDagService kahnDagService = new KahnDagService();

    @InjectMocks
    private HeuristicAiClient heuristicAiClient;

    @Test
    @DisplayName("Dự án 4 node: B ngâm 40h -> criticalPath = [A, C, D], bottlenecks chứa B với severity MEDIUM, metrics.projectDurationHours = 21")
    @SuppressWarnings("unchecked")
    void testRequestDiagnosis_StandardFourNodes_WithStalledNodeB() {
        Long projectId = 100L;
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Order Service").build();

        // Đồ thị: A(8h)->B(4h), A->C(10h), B->D(3h), C->D(3h)
        // B đang IN_PROGRESS bắt đầu 40 giờ trước (ước lượng 4h -> ngưỡng 10h)
        NodeEntity a = NodeEntity.builder()
            .id(1L)
            .projectId(projectId)
            .code("TASK-A")
            .title("Node A")
            .estimatedHours(8)
            .status(NodeStatus.DONE)
            .build();

        NodeEntity b = NodeEntity.builder()
            .id(2L)
            .projectId(projectId)
            .code("TASK-B")
            .title("Node B")
            .estimatedHours(4)
            .status(NodeStatus.IN_PROGRESS)
            .startedAt(Instant.now().minus(40, ChronoUnit.HOURS))
            .build();

        NodeEntity c = NodeEntity.builder()
            .id(3L)
            .projectId(projectId)
            .code("TASK-C")
            .title("Node C")
            .estimatedHours(10)
            .status(NodeStatus.TODO)
            .build();

        NodeEntity d = NodeEntity.builder()
            .id(4L)
            .projectId(projectId)
            .code("TASK-D")
            .title("Node D")
            .estimatedHours(3)
            .status(NodeStatus.LOCKED)
            .build();

        List<NodeEntity> nodes = List.of(a, b, c, d);

        List<NodeDependencyEntity> deps = List.of(
            NodeDependencyEntity.builder().id(11L).projectId(projectId).parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().id(12L).projectId(projectId).parentNodeId(1L).childNodeId(3L).build(),
            NodeDependencyEntity.builder().id(13L).projectId(projectId).parentNodeId(2L).childNodeId(4L).build(),
            NodeDependencyEntity.builder().id(14L).projectId(projectId).parentNodeId(3L).childNodeId(4L).build()
        );

        when(nodeDependencyRepository.findByProjectId(projectId)).thenReturn(deps);

        Map<String, Object> result = heuristicAiClient.requestDiagnosis(project, nodes, Collections.emptyList());

        // Kiểm tra source = HEURISTIC
        assertThat(result.get("source")).isEqualTo("HEURISTIC");

        // Đường găng đúng: TASK-A, TASK-C, TASK-D (không chứa TASK-B)
        List<String> criticalPath = (List<String>) result.get("criticalPath");
        assertThat(criticalPath).containsExactly("TASK-A", "TASK-C", "TASK-D");

        // Bottlenecks chứa B với severity MEDIUM vì B không nằm trên đường găng
        List<Map<String, Object>> bottlenecks = (List<Map<String, Object>>) result.get("bottlenecks");
        assertThat(bottlenecks).anySatisfy(bn -> {
            assertThat(bn.get("nodeCode")).isEqualTo("TASK-B");
            assertThat(bn.get("severity")).isEqualTo("MEDIUM");
            assertThat((String) bn.get("reason")).contains("2.5").contains("40").contains("4h");
        });

        // taskTraps chứa B với trapType = STALLED_NODE
        List<Map<String, Object>> taskTraps = (List<Map<String, Object>>) result.get("taskTraps");
        assertThat(taskTraps).hasSize(1);
        assertThat(taskTraps.get(0).get("nodeCode")).isEqualTo("TASK-B");
        assertThat(taskTraps.get(0).get("trapType")).isEqualTo("STALLED_NODE");

        // Metrics: projectDurationHours = 21, stalledCount = 1
        Map<String, Object> metrics = (Map<String, Object>) result.get("metrics");
        assertThat(metrics.get("projectDurationHours")).isEqualTo(21);
        assertThat(metrics.get("stalledCount")).isEqualTo(1);

        // cpm danh sách các node theo thứ tự topo
        List<Map<String, Object>> cpm = (List<Map<String, Object>>) result.get("cpm");
        assertThat(cpm).hasSize(4);
    }

    @Test
    @DisplayName("Ca có chu trình -> criticalPath rỗng và có warning")
    @SuppressWarnings("unchecked")
    void testRequestDiagnosis_CycleDetected() {
        Long projectId = 200L;
        ProjectEntity project = ProjectEntity.builder().id(projectId).name("Cycle Proj").build();

        NodeEntity a = NodeEntity.builder().id(1L).projectId(projectId).code("TASK-A").title("Node A").build();
        NodeEntity b = NodeEntity.builder().id(2L).projectId(projectId).code("TASK-B").title("Node B").build();
        List<NodeEntity> nodes = List.of(a, b);

        // Cạnh chu trình: A -> B và B -> A
        List<NodeDependencyEntity> deps = List.of(
            NodeDependencyEntity.builder().id(21L).projectId(projectId).parentNodeId(1L).childNodeId(2L).build(),
            NodeDependencyEntity.builder().id(22L).projectId(projectId).parentNodeId(2L).childNodeId(1L).build()
        );

        when(nodeDependencyRepository.findByProjectId(projectId)).thenReturn(deps);

        Map<String, Object> result = heuristicAiClient.requestDiagnosis(project, nodes, Collections.emptyList());

        assertThat(result.get("source")).isEqualTo("HEURISTIC");
        assertThat(result.get("criticalPath")).isEqualTo(Collections.emptyList());
        assertThat(result).containsKey("warning");
        String warning = (String) result.get("warning");
        assertThat(warning).contains("Đồ thị có chu trình").contains("không tính được đường găng.");
    }
}
