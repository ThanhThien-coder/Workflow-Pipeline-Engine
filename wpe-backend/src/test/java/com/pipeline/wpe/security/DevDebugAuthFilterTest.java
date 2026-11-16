package com.pipeline.wpe.security;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class DevDebugAuthFilterTest {

    @Mock
    private UserRepository userRepository;

    private DevDebugAuthFilter filter;

    private UserEntity defaultUser;
    private UserEntity sarahUser;

    @BeforeEach
    void setUp() {
        filter = new DevDebugAuthFilter(userRepository, 2L);
        defaultUser = UserEntity.builder()
            .id(2L)
            .username("alex.kim")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .build();
        sarahUser = UserEntity.builder()
            .id(3L)
            .username("sarah.chen")
            .systemRole(SystemRole.USER)
            .isLocked(false)
            .build();
        lenient().when(userRepository.findById(2L)).thenReturn(Optional.of(defaultUser));
        lenient().when(userRepository.findById(3L)).thenReturn(Optional.of(sarahUser));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Không token, không header -> đặt principal = default user (2L), authority ROLE_USER đúng")
    void noTokenNoHeader_setsDefaultUser() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo(2L);
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority)
            .containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("Header X-Debug-User-Id: 3 -> đặt principal = 3L")
    void headerDebugUserId_setsSpecifiedUser() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader("X-Debug-User-Id", "3");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo(3L);
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority)
            .containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("Có header Authorization (token sai, chưa ai đặt authentication) -> KHÔNG đặt principal")
    void withAuthorizationHeader_doesNotSetPrincipal() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader(HttpHeaders.AUTHORIZATION, "Bearer example-bad-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("SSE GET /api/v1/realtime/subscribe?access_token=example-bad-token -> KHÔNG đặt principal")
    void sseWithQueryToken_doesNotSetPrincipal() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/realtime/subscribe");
        request.setParameter("access_token", "example-bad-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("User không tồn tại trong DB -> KHÔNG đặt principal")
    void userNotFound_doesNotSetPrincipal() throws Exception {
        lenient().when(userRepository.findById(99L)).thenReturn(Optional.empty());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader("X-Debug-User-Id", "99");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("User bị khóa (isLocked = true) -> KHÔNG đặt principal")
    void lockedUser_doesNotSetPrincipal() throws Exception {
        UserEntity locked = UserEntity.builder()
            .id(4L)
            .username("locked.user")
            .systemRole(SystemRole.USER)
            .isLocked(true)
            .build();
        lenient().when(userRepository.findById(4L)).thenReturn(Optional.of(locked));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader("X-Debug-User-Id", "4");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("Header X-Debug-User-Id không phải số -> KHÔNG đặt principal")
    void invalidNumberHeader_doesNotSetPrincipal() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader("X-Debug-User-Id", "invalid-id");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("defaultDebugUserId là null và không có header -> KHÔNG đặt principal")
    void nullDefaultUserId_doesNotSetPrincipal() throws Exception {
        DevDebugAuthFilter nullDefaultFilter = new DevDebugAuthFilter(userRepository, null);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        nullDefaultFilter.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
