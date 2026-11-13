package com.pipeline.wpe.service.admin;

import com.pipeline.wpe.dto.response.admin.AdminAuditLogPageResponse;
import com.pipeline.wpe.dto.response.admin.AdminAuditLogResponse;
import com.pipeline.wpe.entity.AdminAuditLogEntity;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.AdminAuditLogRepository;
import com.pipeline.wpe.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class AdminAuditService {

    private final AdminAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final TransactionTemplate transactionTemplate;

    public AdminAuditService(
        AdminAuditLogRepository auditLogRepository,
        UserRepository userRepository,
        PlatformTransactionManager transactionManager
    ) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void record(Long actorUserId, String actorUsername, String action, String targetType, String targetId, String detail) {
        try {
            String resolvedUsername = actorUsername;
            if (resolvedUsername == null && actorUserId != null) {
                try {
                    resolvedUsername = userRepository.findById(actorUserId)
                        .map(UserEntity::getUsername)
                        .orElse(null);
                } catch (Exception e) {
                    log.warn("Không thể tra cứu username cho actorUserId {}: {}", actorUserId, e.getMessage());
                }
            }

            String ip = extractClientIp();

            String truncatedDetail = detail;
            if (truncatedDetail != null && truncatedDetail.length() > 1000) {
                truncatedDetail = truncatedDetail.substring(0, 1000);
            }

            AdminAuditLogEntity entity = AdminAuditLogEntity.builder()
                .actorUserId(actorUserId)
                .actorUsername(resolvedUsername)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .detail(truncatedDetail)
                .ipAddress(ip)
                .build();

            transactionTemplate.executeWithoutResult(status -> auditLogRepository.save(entity));
        } catch (RuntimeException e) {
            log.warn("Không thể ghi audit log [action={}, targetType={}, targetId={}]: {}", action, targetType, targetId, e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public AdminAuditLogPageResponse search(String group, String action, Instant from, Instant to, int page, int size) {
        Specification<AdminAuditLogEntity> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();

            if (group != null && !group.isBlank() && !"ALL".equalsIgnoreCase(group.trim())) {
                List<String> actions = AdminAuditAction.actionsOfGroup(group.trim());
                predicates.add(root.get("action").in(actions));
            }

            if (action != null && !action.isBlank()) {
                predicates.add(cb.equal(root.get("action"), action.trim()));
            }

            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }

            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        int pageIndex = Math.max(page, 0);
        int pageSize = Math.min(Math.max(size, 1), 200);
        PageRequest pageRequest = PageRequest.of(pageIndex, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<AdminAuditLogEntity> pageResult = auditLogRepository.findAll(spec, pageRequest);

        List<AdminAuditLogResponse> items = pageResult.getContent().stream()
            .map(this::toResponse)
            .toList();

        return new AdminAuditLogPageResponse(items, pageResult.getNumber(), pageResult.getSize(), pageResult.getTotalElements());
    }

    private AdminAuditLogResponse toResponse(AdminAuditLogEntity entity) {
        return new AdminAuditLogResponse(
            String.valueOf(entity.getId()),
            entity.getCreatedAt(),
            entity.getActorUsername(),
            entity.getAction(),
            entity.getTargetType(),
            entity.getTargetId(),
            entity.getDetail(),
            maskIp(entity.getIpAddress())
        );
    }

    public static String maskIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return "—";
        }
        String trimmed = ip.trim();
        if (trimmed.contains(":")) {
            String[] parts = trimmed.split(":");
            if (parts.length >= 4) {
                return parts[0] + ":" + parts[1] + ":" + parts[2] + ":" + parts[3] + ":***";
            }
            return trimmed + ":***";
        }
        if (trimmed.contains(".")) {
            String[] parts = trimmed.split("\\.");
            if (parts.length == 4) {
                return parts[0] + "." + parts[1] + "." + parts[2] + ".***";
            }
        }
        return trimmed;
    }

    private String extractClientIp() {
        try {
            RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
            if (attributes instanceof ServletRequestAttributes servletRequestAttributes) {
                HttpServletRequest request = servletRequestAttributes.getRequest();
                String xForwardedFor = request.getHeader("X-Forwarded-For");
                if (xForwardedFor != null && !xForwardedFor.isBlank()) {
                    String firstIp = xForwardedFor.split(",")[0].trim();
                    if (!firstIp.isEmpty()) {
                        return firstIp;
                    }
                }
                return request.getRemoteAddr();
            }
        } catch (Exception e) {
            log.warn("Không thể lấy địa chỉ IP của client: {}", e.getMessage());
        }
        return null;
    }
}
