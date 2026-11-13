package com.pipeline.wpe.service;

import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.entity.NotificationEntity;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public List<NotificationResponse> getNotifications(Long userId, boolean unreadOnly, int limit) {
        int safeLimit = limit <= 0 ? 30 : Math.min(limit, 200);
        List<NotificationEntity> entities = unreadOnly
                ? notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId)
                : notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return entities.stream()
                .limit(safeLimit)
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public NotificationResponse markAsRead(Long notificationId, Long userId) {
        NotificationEntity entity = notificationRepository.findByIdAndUserId(notificationId, userId)
                .or(() -> notificationRepository.findById(notificationId)
                        .filter(n -> Objects.equals(n.getUserId(), userId)))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy thông báo với ID: " + notificationId));

        if (!Boolean.TRUE.equals(entity.getIsRead())) {
            entity.setIsRead(true);
            entity = notificationRepository.save(entity);
        }
        return NotificationResponse.from(entity);
    }

    @Transactional
    public int markAllAsRead(Long userId) {
        List<NotificationEntity> unread = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        if (!unread.isEmpty()) {
            unread.forEach(n -> n.setIsRead(true));
            notificationRepository.saveAll(unread);
        }
        return unread.size();
    }
}
