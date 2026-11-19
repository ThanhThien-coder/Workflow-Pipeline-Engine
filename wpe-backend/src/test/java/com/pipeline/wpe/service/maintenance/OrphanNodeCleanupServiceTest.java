package com.pipeline.wpe.service.maintenance;

import com.pipeline.wpe.common.enums.JoinPolicy;
import com.pipeline.wpe.common.enums.NodeStatus;
import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.service.WorkflowGraphService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("S05: dọn task mồ côi")
class OrphanNodeCleanupServiceTest {

    @Mock private NodeRepository nodeRepository;
    @Mock private NodeDependencyRepository nodeDependencyRepository;
    @Mock private WorkflowGraphService workflowGraphService;
    @Mock private EntityManager entityManager;
    @Mock private TypedQuery<NodeEntity> query;

    @InjectMocks private OrphanNodeCleanupService service;

    @BeforeEach
    void injectEntityManager() {
        // InjectMocks dùng constructor nên field @PersistenceContext phải gán tay
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    private NodeEntity node(long id, NodeStatus status, Long phaseId) {
        return NodeEntity.builder().id(id).projectId(1L).phaseId(phaseId).code("N" + id)
            .status(status).joinPolicy(JoinPolicy.ALL_COMPLETED).build();
    }

    private void givenOrphans(List<NodeEntity> orphans) {
        when(entityManager.createQuery(anyString(), eq(NodeEntity.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(orphans);
    }

    @Test
    @DisplayName("2 node TODO và 1 node DONE mồ côi: cả 3 bị xóa cùng dây nối")
    void deletesAllOrphansIncludingDone() {
        givenOrphans(List.of(node(1, NodeStatus.TODO, null), node(2, NodeStatus.TODO, null), node(3, NodeStatus.DONE, null)));
        NodeDependencyEntity edge = NodeDependencyEntity.builder().projectId(1L).parentNodeId(1L).childNodeId(2L).build();
        when(nodeDependencyRepository.findByParentNodeId(1L)).thenReturn(List.of(edge));
        when(nodeDependencyRepository.findByChildNodeId(2L)).thenReturn(List.of(edge));
        when(nodeDependencyRepository.findByParentNodeId(2L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByChildNodeId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByParentNodeId(3L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByChildNodeId(3L)).thenReturn(List.of());

        assertEquals(3, service.cleanup());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<NodeEntity>> deleted = ArgumentCaptor.forClass(List.class);
        verify(nodeRepository).deleteAll(deleted.capture());
        assertEquals(3, deleted.getValue().size());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<NodeDependencyEntity>> edges = ArgumentCaptor.forClass(Collection.class);
        verify(nodeDependencyRepository).deleteAll(edges.capture());
        assertEquals(1, edges.getValue().size());
        verify(workflowGraphService, never()).recomputeNodeStatus(any(), anyList());
    }

    @Test
    @DisplayName("Task con ở phase khác mất cha duy nhất: được tính lại với danh sách cha rỗng")
    void recomputesExternalChild() {
        NodeEntity child = node(5, NodeStatus.LOCKED, 10L);
        givenOrphans(List.of(node(1, NodeStatus.TODO, null)));
        NodeDependencyEntity edge = NodeDependencyEntity.builder().projectId(1L).parentNodeId(1L).childNodeId(5L).build();
        when(nodeDependencyRepository.findByParentNodeId(1L)).thenReturn(List.of(edge));
        when(nodeDependencyRepository.findByChildNodeId(1L)).thenReturn(List.of());
        when(nodeDependencyRepository.findByChildNodeId(5L)).thenReturn(List.of(edge));
        when(nodeRepository.findById(5L)).thenReturn(Optional.of(child));

        assertEquals(1, service.cleanup());

        verify(workflowGraphService).recomputeNodeStatus(child, List.of());
    }

    @Test
    @DisplayName("Chạy lần 2 (không còn node mồ côi): không làm gì")
    void secondRunDoesNothing() {
        givenOrphans(List.of());

        assertEquals(0, service.cleanup());

        verify(nodeRepository, never()).deleteAll(any());
        verifyNoInteractions(nodeDependencyRepository, workflowGraphService);
    }

    @Test
    @DisplayName("Runner: cờ tắt thì không gọi cleanup")
    void runnerSkippedWhenDisabled() {
        OrphanNodeCleanupService mockService = mock(OrphanNodeCleanupService.class);
        OrphanNodeCleanupRunner runner = new OrphanNodeCleanupRunner(mockService);
        ReflectionTestUtils.setField(runner, "enabled", false);

        runner.run(new DefaultApplicationArguments());

        verifyNoInteractions(mockService);
    }

    @Test
    @DisplayName("Runner: cờ bật thì gọi cleanup; lỗi chỉ ghi log, không ném ra ngoài")
    void runnerSwallowsErrors() {
        OrphanNodeCleanupService mockService = mock(OrphanNodeCleanupService.class);
        when(mockService.cleanup()).thenThrow(new IllegalStateException("boom"));
        OrphanNodeCleanupRunner runner = new OrphanNodeCleanupRunner(mockService);
        ReflectionTestUtils.setField(runner, "enabled", true);

        runner.run(new DefaultApplicationArguments());

        verify(mockService).cleanup();
    }
}
