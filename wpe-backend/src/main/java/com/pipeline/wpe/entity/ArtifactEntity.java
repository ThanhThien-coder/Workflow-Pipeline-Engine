package com.pipeline.wpe.entity;

import com.pipeline.wpe.common.enums.ArtifactType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "artifacts")
public class ArtifactEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "node_id")
    private Long nodeId;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ArtifactType type;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(name = "is_in_repository", nullable = false)
    @Builder.Default
    private Boolean isInRepository = false;

    @Column(name = "is_public_for_guest", nullable = false)
    @Builder.Default
    private Boolean isPublicForGuest = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
