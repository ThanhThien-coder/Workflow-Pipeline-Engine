package com.pipeline.wpe.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "work_phase")
public class WorkPhaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "parent_phase_id")
    private Long parentPhaseId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "sub_title", length = 255)
    private String subTitle;

    @Column(name = "accent_color", length = 50)
    private String accentColor;

    @Column(name = "order_index", nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;

    // Vị trí và kích thước thẻ Phase trên canvas: { "x": 280, "y": 140, "w": 250, "h": 220 } (V9)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ui_metadata", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> uiMetadata = new HashMap<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
