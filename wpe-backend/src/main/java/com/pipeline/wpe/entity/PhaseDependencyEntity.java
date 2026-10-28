package com.pipeline.wpe.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Cạnh phụ thuộc giữa 2 Macro Phase (parent -> child). Một Phase có thể có nhiều Phase tiền nhiệm.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "phase_dependency", uniqueConstraints = {
    @UniqueConstraint(name = "uq_phase_dependency", columnNames = {"parent_phase_id", "child_phase_id"})
})
public class PhaseDependencyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "parent_phase_id", nullable = false)
    private Long parentPhaseId;

    @Column(name = "child_phase_id", nullable = false)
    private Long childPhaseId;
}
