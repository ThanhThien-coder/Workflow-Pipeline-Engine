package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    /**
     * A6 — Danh sách user cho Admin. {@code pattern} đã viết thường và có dạng {@code %abc%} (rỗng thì {@code %}),
     * {@code lockedValues} là [false] (ACTIVE), [true] (SUSPENDED) hoặc cả hai. Không tìm theo email để
     * Admin không dò ra email thật qua ô tìm kiếm (email chỉ hiện dạng đã che).
     */
    @Query("""
        SELECT u FROM UserEntity u
        WHERE u.isLocked IN :lockedValues
          AND (LOWER(u.username) LIKE :pattern OR LOWER(COALESCE(u.fullName, '')) LIKE :pattern)
        ORDER BY u.id
    """)
    List<UserEntity> searchForAdmin(@Param("pattern") String pattern,
                                    @Param("lockedValues") Collection<Boolean> lockedValues);
}
