package com.pipeline.wpe.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "node_dependency", uniqueConstraints = {
    @UniqueConstraint(name = "uq_node_dependency", columnNames = {"parent_node_id", "child_node_id"})
})
public class NodeDependencyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "parent_node_id", nullable = false)
    private Long parentNodeId;

    @Column(name = "child_node_id", nullable = false)
    private Long childNodeId;
}
