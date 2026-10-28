package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUsername(String username);
    Optional<UserEntity> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);

    @Query("""
            SELECT u FROM UserEntity u
            WHERE (:query IS NULL OR LOWER(u.username) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%')))
              AND (:status IS NULL
                OR (:status = 'ACTIVE' AND u.isLocked = false)
                OR (:status = 'SUSPENDED' AND u.isLocked = true))
            ORDER BY u.id
            """)
    java.util.List<UserEntity> searchUsers(@Param("query") String query, @Param("status") String status);
}
