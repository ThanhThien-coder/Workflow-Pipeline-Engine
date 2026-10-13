package com.pipeline.wpe.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "pipeline_template")
public class PipelineTemplateEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String category = "General";

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "is_system_standard", nullable = false)
    @Builder.Default
    private Boolean isSystemStandard = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "graph_data", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> graphData;

    @Column(name = "clone_count", nullable = false)
    @Builder.Default
    private Integer cloneCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
