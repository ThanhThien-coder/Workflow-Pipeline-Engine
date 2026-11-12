package com.pipeline.wpe.entity;

import com.pipeline.wpe.common.enums.TemplateVisibility;
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

    @Column(length = 100, unique = true)
    private String slug;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "visibility", nullable = false, length = 20)
    @Builder.Default
    private TemplateVisibility visibility = TemplateVisibility.PUBLIC;

    @Column(name = "source_project_id")
    private Long sourceProjectId;

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
