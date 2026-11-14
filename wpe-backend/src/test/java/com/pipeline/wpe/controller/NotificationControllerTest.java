package com.pipeline.wpe.controller;

import com.pipeline.wpe.dto.response.notification.NotificationResponse;
import com.pipeline.wpe.exception.ResourceNotFoundException;
import com.pipeline.wpe.security.CurrentUserProvider;
import com.pipeline.wpe.service.NotificationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@AutoConfigureMockMvc(addFilters = false)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private CurrentUserProvider currentUserProvider;

    private final Long meomeoId = 10L;
    private final Long sarahId = 3L;

    @Test
    @DisplayName("GET /api/v1/notifications - meomeo thấy thông báo lời mời chứa invitationId, sarah không thấy")
    void getNotifications_meomeoSeesInvite_sarahDoesNot() throws Exception {
        NotificationResponse inviteNotif = new NotificationResponse(
                "501",
                "Lời mời tham gia dự án: Core Banking Pipeline",
                "Alex Kim đã mời bạn tham gia dự án \"Core Banking Pipeline\"",
                "/workspace?action=open-invite-modal&invitationId=77",
                false,
                Instant.parse("2026-11-13T10:00:00Z")
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(meomeoId);
        when(notificationService.getNotifications(meomeoId, false, 30)).thenReturn(List.of(inviteNotif));

        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("501"))
                .andExpect(jsonPath("$[0].linkUrl", containsString("invitationId=77")))
                .andExpect(jsonPath("$[0].isRead").value(false));

        // Khi sarah gọi GET /api/v1/notifications -> không thấy thông báo của meomeo
        when(currentUserProvider.requireCurrentUserId()).thenReturn(sarahId);
        when(notificationService.getNotifications(sarahId, false, 30)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/notifications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("GET /api/v1/notifications/unread-count - trả về số thông báo chưa đọc của user hiện tại")
    void getUnreadCount_returnsUnreadCount() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(meomeoId);
        when(notificationService.getUnreadCount(meomeoId)).thenReturn(1L);

        mockMvc.perform(get("/api/v1/notifications/unread-count"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unreadCount").value(1));
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read - đánh dấu đọc thông báo của người khác -> 404")
    void markAsRead_otherUsersNotification_returns404() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(sarahId);
        when(notificationService.markAsRead(501L, sarahId))
                .thenThrow(new ResourceNotFoundException("Không tìm thấy thông báo với ID: 501"));

        mockMvc.perform(patch("/api/v1/notifications/501/read"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("RESOURCE_NOT_FOUND"));
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/{id}/read - đánh dấu đọc thông báo của chính mình -> 200")
    void markAsRead_ownNotification_returns200() throws Exception {
        NotificationResponse readNotif = new NotificationResponse(
                "501",
                "Lời mời tham gia dự án: Core Banking Pipeline",
                "Alex Kim đã mời bạn tham gia dự án \"Core Banking Pipeline\"",
                "/workspace?action=open-invite-modal&invitationId=77",
                true,
                Instant.parse("2026-11-13T10:00:00Z")
        );

        when(currentUserProvider.requireCurrentUserId()).thenReturn(meomeoId);
        when(notificationService.markAsRead(501L, meomeoId)).thenReturn(readNotif);

        mockMvc.perform(patch("/api/v1/notifications/501/read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("501"))
                .andExpect(jsonPath("$.isRead").value(true));
    }

    @Test
    @DisplayName("PATCH /api/v1/notifications/read-all - đánh dấu đọc toàn bộ thông báo của chính mình -> 200")
    void markAllAsRead_returns200() throws Exception {
        when(currentUserProvider.requireCurrentUserId()).thenReturn(meomeoId);
        when(notificationService.markAllAsRead(meomeoId)).thenReturn(2);

        mockMvc.perform(patch("/api/v1/notifications/read-all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.updatedCount").value(2));

        verify(notificationService).markAllAsRead(meomeoId);
    }
}
