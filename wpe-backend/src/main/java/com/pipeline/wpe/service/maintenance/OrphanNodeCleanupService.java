package com.pipeline.wpe.service.maintenance;

import com.pipeline.wpe.entity.NodeDependencyEntity;
import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.repository.NodeDependencyRepository;
import com.pipeline.wpe.repository.NodeRepository;
import com.pipeline.wpe.service.WorkflowGraphService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * S05: dọn task "mồ côi" (phase_id IS NULL). Trước TASK_68, xóa phase chỉ đặt phase_id = NULL nên các task này
 * không hiện trên đồ thị nhưng vẫn bị đếm ở Overview, trang khách, AI và vẫn giữ dây phụ thuộc.
 * Idempotent: chạy lần 2 không còn node mồ côi nên không làm gì.
 * Theo quyết định của Thiện (19/11): xóa hết, kể cả task IN_PROGRESS/REVIEW/DONE (dữ liệu hiện chỉ là dữ liệu test).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrphanNodeCleanupService {

    private final NodeRepository nodeRepository;
    private final NodeDependencyRepository nodeDependencyRepository;
    private final WorkflowGraphService workflowGraphService;

    @PersistenceContext
    private EntityManager entityManager;

    /** @return tổng số node đã xóa. */
    @Transactional
    public int cleanup() {
        List<NodeEntity> orphans = entityManager
            .createQuery("SELECT n FROM NodeEntity n WHERE n.phaseId IS NULL", NodeEntity.class)
            .getResultList();
        if (orphans.isEmpty()) {
            return 0;
        }

        Map<Long, List<NodeEntity>> byProject = orphans.stream()
            .collect(Collectors.groupingBy(NodeEntity::getProjectId, LinkedHashMap::new, Collectors.toList()));

        int total = 0;
        for (Map.Entry<Long, List<NodeEntity>> entry : byProject.entrySet()) {
            int removed = deleteOrphansOfProject(entry.getValue());
            log.info("Dọn task mồ côi: dự án {} đã xóa {} node (phase_id NULL).", entry.getKey(), removed);
            total += removed;
        }
        return total;
    }

    private int deleteOrphansOfProject(List<NodeEntity> orphans) {
        Set<Long> deletedIds = orphans.stream().map(NodeEntity::getId).collect(Collectors.toSet());
        Map<String, NodeDependencyEntity> edgesToDelete = new LinkedHashMap<>();
        Set<Long> externalChildIds = new LinkedHashSet<>();

        for (NodeEntity node : orphans) {
            for (NodeDependencyEntity e : nodeDependencyRepository.findByParentNodeId(node.getId())) {
                edgesToDelete.put(e.getParentNodeId() + ":" + e.getChildNodeId(), e);
                if (!deletedIds.contains(e.getChildNodeId())) {
                    externalChildIds.add(e.getChildNodeId());
                }
            }
            for (NodeDependencyEntity e : nodeDependencyRepository.findByChildNodeId(node.getId())) {
                edgesToDelete.put(e.getParentNodeId() + ":" + e.getChildNodeId(), e);
            }
        }
        nodeDependencyRepository.deleteAll(edgesToDelete.values());
        nodeRepository.deleteAll(orphans);
        nodeRepository.flush();

        // Task con ở phase khác vừa mất cha: tính lại trạng thái theo các cha còn lại
        for (Long childId : externalChildIds) {
            nodeRepository.findById(childId).ifPresent(child -> {
                List<Long> remainingParentIds = nodeDependencyRepository.findByChildNodeId(childId).stream()
                    .map(NodeDependencyEntity::getParentNodeId)
                    .filter(id -> !deletedIds.contains(id))
                    .toList();
                List<NodeEntity> remaining = remainingParentIds.isEmpty()
                    ? List.of() : nodeRepository.findAllById(remainingParentIds);
                workflowGraphService.recomputeNodeStatus(child, remaining);
            });
        }
        return orphans.size();
    }
}
