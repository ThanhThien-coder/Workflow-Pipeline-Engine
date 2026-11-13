package com.pipeline.wpe.admin;

import com.pipeline.wpe.entity.AdminAuditLogEntity;
import com.pipeline.wpe.repository.AdminAuditLogRepository;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.admin.AdminAuditAction;
import com.pipeline.wpe.service.admin.AdminAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAuditServiceTest {

    @Mock
    private AdminAuditLogRepository auditLogRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PlatformTransactionManager transactionManager;

    private AdminAuditService auditService;

    @BeforeEach
    void setUp() {
        auditService = new AdminAuditService(auditLogRepository, userRepository, transactionManager);
    }

    @Test
    @DisplayName("record: repository.save ném RuntimeException -> record nuốt lỗi, KHÔNG ném ra ngoài")
    void record_repositoryThrowsRuntimeException_doesNotThrow() {
        TransactionStatus status = mock(TransactionStatus.class);
        when(transactionManager.getTransaction(any())).thenReturn(status);
        when(auditLogRepository.save(any())).thenThrow(new RuntimeException("Database connection failure"));

        assertDoesNotThrow(() ->
            auditService.record(1L, "admin", AdminAuditAction.LOGIN_SUCCESS, "USER", "1", "Chi tiết đăng nhập")
        );
    }

    @Test
    @DisplayName("actionsOfGroup: nhóm LOGIN trả về đúng 5 action bảo mật đăng nhập")
    void actionsOfGroup_loginGroup_returns5Actions() {
        List<String> actions = AdminAuditAction.actionsOfGroup("LOGIN");

        assertThat(actions).hasSize(5);
        assertThat(actions).containsExactly(
            AdminAuditAction.LOGIN_SUCCESS,
            AdminAuditAction.LOGIN_FAILED,
            AdminAuditAction.LOGOUT,
            AdminAuditAction.REGISTER,
            AdminAuditAction.ACCOUNT_LOCKED_LOGIN
        );
    }

    @Test
    @DisplayName("actionsOfGroup: nhóm ADMIN trả về đúng 7 action quản trị hệ thống")
    void actionsOfGroup_adminGroup_returns7Actions() {
        List<String> actions = AdminAuditAction.actionsOfGroup("ADMIN");

        assertThat(actions).hasSize(7);
        assertThat(actions).containsExactly(
            AdminAuditAction.USER_SUSPENDED,
            AdminAuditAction.USER_UNBANNED,
            AdminAuditAction.ADMIN_ACCESS_DENIED,
            AdminAuditAction.USER_ROLE_CHANGED,
            AdminAuditAction.USER_DELETED,
            AdminAuditAction.PROJECT_OWNER_TRANSFERRED,
            AdminAuditAction.WORKSPACE_ARCHIVED
        );
    }

    @Test
    @DisplayName("record: targetId dài 80 ký tự -> entity được save có targetId dài đúng 50")
    void record_targetIdLongerThan50_truncatedTo50() {
        TransactionStatus status = mock(TransactionStatus.class);
        when(transactionManager.getTransaction(any())).thenReturn(status);
        ArgumentCaptor<AdminAuditLogEntity> captor = ArgumentCaptor.forClass(AdminAuditLogEntity.class);

        String longTargetId = "A".repeat(80);
        auditService.record(1L, "admin", AdminAuditAction.PROJECT_OWNER_TRANSFERRED, "PROJECT", longTargetId, null);

        verify(auditLogRepository).save(captor.capture());
        AdminAuditLogEntity saved = captor.getValue();
        assertThat(saved.getTargetId()).hasSize(50);
        assertThat(saved.getTargetId()).isEqualTo("A".repeat(50));
    }

    @Test
    @DisplayName("actionsOfGroup: group không hợp lệ -> ném IllegalArgumentException")
    void actionsOfGroup_invalidGroup_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> AdminAuditAction.actionsOfGroup("UNKNOWN_GROUP"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Nhóm audit không hợp lệ");

        assertThatThrownBy(() -> AdminAuditAction.actionsOfGroup(null))
            .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> AdminAuditAction.actionsOfGroup("   "))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("maskIp: che đúng định dạng cho IPv4, IPv6 và null/rỗng")
    void maskIp_formatsCorrectly() {
        // IPv4
        assertThat(AdminAuditService.maskIp("192.168.1.1")).isEqualTo("192.168.1.***");
        assertThat(AdminAuditService.maskIp("10.0.4.15")).isEqualTo("10.0.4.***");

        // IPv6 (giữ 4 nhóm đầu + :***)
        assertThat(AdminAuditService.maskIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334"))
            .isEqualTo("2001:0db8:85a3:0000:***");
        assertThat(AdminAuditService.maskIp("fe80:0000:0000:0000:0204:61ff:fe9d:f156"))
            .isEqualTo("fe80:0000:0000:0000:***");

        // null / empty / blank -> "—"
        assertThat(AdminAuditService.maskIp(null)).isEqualTo("—");
        assertThat(AdminAuditService.maskIp("")).isEqualTo("—");
        assertThat(AdminAuditService.maskIp("   ")).isEqualTo("—");
    }
}
