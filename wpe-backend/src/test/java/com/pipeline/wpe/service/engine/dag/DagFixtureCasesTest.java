package com.pipeline.wpe.service.engine.dag;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.service.engine.KahnDagService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * B6 — Bộ case DAG dùng chung với frontend (wpe-frontend/src/lib/graph/__tests__/dagFixtureCases.test.ts).
 * Cả hai bên đọc cùng file shared/test-fixtures/dag-cases.json, nên Kahn ở FE và BE không thể âm thầm lệch nhau.
 * Backend là chuẩn: case nào FE ra khác thì sửa FE.
 *
 * Maven (và CI) chạy test với thư mục làm việc là wpe-backend/, nên đường dẫn tương đối là ../shared/...
 */
@DisplayName("B6 - Bộ case DAG dùng chung FE/BE (shared/test-fixtures/dag-cases.json)")
class DagFixtureCasesTest {

    static final Path FIXTURE = Path.of("..", "shared", "test-fixtures", "dag-cases.json");

    /** Một case trong file JSON. nodes là mã node; edges là cặp [mã cha, mã con]. */
    record DagCase(String name, List<String> nodes, List<List<String>> edges,
                   boolean expectedValid, List<String> expectedCycleNodes) {
        @Override
        public String toString() {
            return name;
        }
    }

    static List<DagCase> cases() throws IOException {
        return new ObjectMapper().readValue(Files.readString(FIXTURE), new TypeReference<List<DagCase>>() {});
    }

    private final KahnDagService kahnDagService = new KahnDagService();

    @Test
    @DisplayName("Đọc được file fixture và có đủ case (ít nhất 15)")
    void fixtureIsReadable() throws IOException {
        assertTrue(Files.exists(FIXTURE), "Không thấy " + FIXTURE.toAbsolutePath());
        assertTrue(cases().size() >= 15);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void validateProjectDagMatchesFixture(DagCase dagCase) {
        // Id node = vị trí trong mảng + 1, nên thứ tự id tăng dần trùng thứ tự trong fixture.
        // Mã không có trong nodes (cạnh trỏ tới node lạ) nhận id riêng từ 10_000.
        Map<String, Long> idOf = new HashMap<>();
        List<NodeEntity> nodes = new ArrayList<>();
        for (int i = 0; i < dagCase.nodes().size(); i++) {
            String code = dagCase.nodes().get(i);
            idOf.put(code, (long) (i + 1));
            nodes.add(NodeEntity.builder().id((long) (i + 1)).code(code).build());
        }
        List<NodeDependencyEntity> edges = new ArrayList<>();
        for (List<String> edge : dagCase.edges()) {
            long parent = idOf.computeIfAbsent(edge.get(0), c -> 10_000L + idOf.size());
            long child = idOf.computeIfAbsent(edge.get(1), c -> 10_000L + idOf.size());
            edges.add(NodeDependencyEntity.builder().parentNodeId(parent).childNodeId(child).build());
        }

        var result = kahnDagService.validateProjectDag(nodes, edges);

        assertEquals(dagCase.expectedValid(), result.isValid(), "isValid");
        assertEquals(dagCase.expectedCycleNodes(), result.cycleNodeCodes(), "cycleNodeCodes");
    }
}
