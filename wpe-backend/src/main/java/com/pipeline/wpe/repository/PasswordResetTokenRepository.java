package com.pipeline.wpe.repository;

import com.pipeline.wpe.entity.PasswordResetTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetTokenEntity, Long> {

    Optional<PasswordResetTokenEntity> findByTokenHash(String tokenHash);

    boolean existsByUserIdAndCreatedAtAfter(Long userId, Instant after);

    /** Đánh dấu đã dùng đúng 1 token nếu nó chưa dùng; trả 0 khi request khác đã dùng trước (chống dùng 2 lần đồng thời). */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE PasswordResetTokenEntity t SET t.usedAt = :now WHERE t.id = :id AND t.usedAt IS NULL")
    int markUsedIfUnused(@Param("id") Long id, @Param("now") Instant now);

    /** Đánh dấu đã dùng mọi token chưa dùng của user (link cũ hết hiệu lực). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PasswordResetTokenEntity t SET t.usedAt = :now WHERE t.userId = :userId AND t.usedAt IS NULL")
    int markAllUnusedAsUsed(@Param("userId") Long userId, @Param("now") Instant now);

    /** Xóa token có hạn hoặc ngày dùng cũ hơn mốc cắt. */
    @Modifying
    @Query("DELETE FROM PasswordResetTokenEntity t WHERE t.expiresAt < :cutoff OR t.usedAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
