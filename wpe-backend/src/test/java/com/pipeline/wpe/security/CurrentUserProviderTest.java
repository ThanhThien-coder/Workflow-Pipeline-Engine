package com.pipeline.wpe.security;

import com.pipeline.wpe.exception.UnauthorizedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CurrentUserProviderTest {

    private CurrentUserProvider provider;
    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() {
        provider = new CurrentUserProvider();
        ReflectionTestUtils.setField(provider, "debugUserIdEnabled", true);
        ReflectionTestUtils.setField(provider, "defaultDebugUserId", 2L);
        request = new MockHttpServletRequest();
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Có principal Long trong SecurityContext -> trả đúng userId đó")
    void authenticatedPrincipal_returnsUserId() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            3L, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        request.addHeader("Authorization", "Bearer valid");

        assertThat(provider.getCurrentUserId()).contains(3L);
        assertThat(provider.requireCurrentUserId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("Có header Authorization nhưng token sai -> KHÔNG rơi về user debug, require ném 401 TOKEN_EXPIRED")
    void invalidBearer_doesNotFallBackToDebugUser() {
        request.addHeader("Authorization", "Bearer token-bi-sua");

        assertThat(provider.getCurrentUserId()).isEqualTo(Optional.empty());
        assertThatThrownBy(() -> provider.requireCurrentUserId())
            .isInstanceOf(UnauthorizedException.class)
            .extracting("errorCode").isEqualTo("TOKEN_EXPIRED");
    }

    @Test
    @DisplayName("Có header Authorization sai và cả X-Debug-User-Id -> vẫn không dùng header debug")
    void invalidBearerWithDebugHeader_ignoresDebugHeader() {
        request.addHeader("Authorization", "Bearer token-bi-sua");
        request.addHeader("X-Debug-User-Id", "3");

        assertThat(provider.getCurrentUserId()).isEmpty();
    }

    @Test
    @DisplayName("Không có Authorization, có X-Debug-User-Id -> giữ cơ chế debug như cũ")
    void noAuthorization_usesDebugHeader() {
        request.addHeader("X-Debug-User-Id", "3");

        assertThat(provider.getCurrentUserId()).contains(3L);
    }

    @Test
    @DisplayName("Không có Authorization, không có header debug -> user mặc định")
    void noAuthorization_usesDefaultDebugUser() {
        assertThat(provider.getCurrentUserId()).contains(2L);
    }

    @Test
    @DisplayName("Tắt chế độ debug, không có gì -> require ném 401 UNAUTHORIZED")
    void debugDisabled_requireThrowsUnauthorized() {
        ReflectionTestUtils.setField(provider, "debugUserIdEnabled", false);

        assertThatThrownBy(() -> provider.requireCurrentUserId())
            .isInstanceOf(UnauthorizedException.class)
            .extracting("errorCode").isEqualTo("UNAUTHORIZED");
    }
}
