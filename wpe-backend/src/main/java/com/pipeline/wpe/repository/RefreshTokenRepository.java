package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.RefreshTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshTokenEntity, Long> {
    Optional<RefreshTokenEntity> findByTokenHash(String tokenHash);

    @Modifying
    @Query("UPDATE RefreshTokenEntity r SET r.revoked = true WHERE r.userId = :userId")
    void revokeAllByUserId(Long userId);

    /**
     * Thu hồi một token chỉ khi nó còn hoạt động (cập nhật có điều kiện, nguyên tử ở mức DB).
     * Trả về 0 nếu token đã bị thu hồi trước đó (VD: hai request refresh cùng lúc bằng một token).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE RefreshTokenEntity r SET r.revoked = true WHERE r.id = :id AND r.revoked = false")
    int revokeIfActive(@Param("id") Long id);
}
