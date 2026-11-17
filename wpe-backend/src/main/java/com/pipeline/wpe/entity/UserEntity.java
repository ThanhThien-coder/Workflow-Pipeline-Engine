package com.pipeline.wpe.entity;

import com.pipeline.wpe.common.enums.SystemRole;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
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

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(length = 60)
    private String title;

    @Column(length = 280)
    private String bio;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "skills", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> skills = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "links", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, String> links = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "profile_privacy", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> profilePrivacy = defaultProfilePrivacy();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "public_project_ids", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Long> publicProjectIds = new ArrayList<>();

    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public static Map<String, Object> defaultProfilePrivacy() {
        Map<String, Object> privacy = new HashMap<>();
        privacy.put("visibility", "members");
        privacy.put("showEmail", false);
        privacy.put("showStats", true);
        return privacy;
    }

    public List<String> getSkills() {
        if (skills == null) {
            skills = new ArrayList<>();
        }
        return skills;
    }

    public Map<String, String> getLinks() {
        if (links == null) {
            links = new HashMap<>();
        }
        return links;
    }

    public Map<String, Object> getProfilePrivacy() {
        if (profilePrivacy == null) {
            profilePrivacy = defaultProfilePrivacy();
        }
        return profilePrivacy;
    }

    public List<Long> getPublicProjectIds() {
        if (publicProjectIds == null) {
            publicProjectIds = new ArrayList<>();
        }
        return publicProjectIds;
    }
}
