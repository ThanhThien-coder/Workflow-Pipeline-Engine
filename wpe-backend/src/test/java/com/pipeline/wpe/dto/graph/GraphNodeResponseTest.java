package com.pipeline.wpe.dto.graph;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.dto.response.graph.GraphNodeResponse;
import com.pipeline.wpe.entity.NodeEntity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GraphNodeResponseTest {

    private NodeEntity node(Boolean overdue) {
        return NodeEntity.builder().id(1L).projectId(1L).code("A").title("t")
            .status(NodeStatus.TODO).joinPolicy(JoinPolicy.ALL_COMPLETED).isOverdue(overdue).build();
    }

    @Test
    @DisplayName("from: mang isOverdue của node, null coi như false")
    void fromCarriesIsOverdue() {
        assertThat(GraphNodeResponse.from(node(true), Map.of()).isOverdue()).isTrue();
        assertThat(GraphNodeResponse.from(node(false), Map.of()).isOverdue()).isFalse();
        assertThat(GraphNodeResponse.from(node(null), Map.of()).isOverdue()).isFalse();
    }

    @Test
    @DisplayName("JSON có khóa isOverdue và vẫn đủ các field cũ")
    void jsonHasIsOverdueAndOldFields() throws Exception {
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        var json = mapper.readTree(mapper.writeValueAsString(GraphNodeResponse.from(node(true), Map.of())));
        assertThat(json.get("isOverdue").asBoolean()).isTrue();
        for (String f : new String[]{"id", "phaseId", "code", "title", "description", "status", "joinPolicy",
            "assignedUserId", "dueDate", "estimatedHours", "version", "uiMetadata", "forceUnlockedBy",
            "forceUnlockedAt", "createdAt", "completedAt"}) {
            assertThat(json.has(f)).as(f).isTrue();
        }
    }
}
