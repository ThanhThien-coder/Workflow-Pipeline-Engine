package com.pipeline.wpe.entity;

import com.pipeline.wpe.common.enums.SystemRole;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "full_name", length = 100)
    private String fullName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "system_role", nullable = false, length = 20)
    @Builder.Default
    private SystemRole systemRole = SystemRole.USER;

    @Column(name = "is_locked", nullable = false)
    @Builder.Default
    private Boolean isLocked = false;

    @Column(name = "token_version", nullable = false)
    @Builder.Default
    private Integer tokenVersion = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // ───── Hồ sơ cá nhân (A5, migration V7) ─────

    /** Đường dẫn tương đối dạng /uploads/avatars/&lt;file&gt;; null = chưa có ảnh. */
    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "title", length = 150)
    private String title;

    @Column(name = "bio", columnDefinition = "text")
    private String bio;

    /** Danh sách kỹ năng, lưu JSONB dạng ["React", "Spring Boot"]. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skills", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> skills = new ArrayList<>();

    /** Liên kết ngoài, lưu JSONB dạng {"github": "...", "linkedin": "...", "website": "..."}. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "links", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, String> links = new LinkedHashMap<>();
}
