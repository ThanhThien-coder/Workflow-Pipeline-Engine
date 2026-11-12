package com.pipeline.wpe.security;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.entity.UserEntity;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
class JwtAuthFilterTest {

    private static final String SECRET = "test-secret-for-unit-tests-only-0123456789abcdef";

    private final JwtService jwtService = new JwtService(SECRET, 900_000);

    @Mock
    private UserRepository userRepository;

    private JwtAuthFilter filter;
    private UserEntity alex;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthFilter(jwtService, userRepository);
        alex = UserEntity.builder().id(2L).username("alex.kim").systemRole(SystemRole.USER)
            .isLocked(false).tokenVersion(0).build();
        lenient().when(userRepository.findById(2L)).thenReturn(Optional.of(alex));
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Authentication run(String authorizationHeader) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        if (authorizationHeader != null) {
            request.addHeader("Authorization", authorizationHeader);
        }
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, new MockHttpServletResponse(), chain);
        // Filter không bao giờ chặn request ở giai đoạn này
        assertThat(chain.getRequest()).isNotNull();
        return SecurityContextHolder.getContext().getAuthentication();
    }

    @Test
    @DisplayName("Token hợp lệ -> principal = userId (Long), authority ROLE_USER")
    void validToken_setsPrincipal() throws Exception {
        String token = jwtService.generateAccessToken(alex);

        Authentication auth = run("Bearer " + token);

        assertThat(auth).isNotNull();
        assertThat(auth.getPrincipal()).isEqualTo(2L);
        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("Không có header -> không đặt principal, request vẫn đi tiếp")
    void noHeader_noPrincipal() throws Exception {
        assertThat(run(null)).isNull();
    }

    @Test
    @DisplayName("Sửa 1 ký tự trong token -> không đặt principal, request vẫn đi tiếp")
    void tamperedToken_noPrincipal() throws Exception {
        String token = jwtService.generateAccessToken(alex);
        char last = token.charAt(token.length() - 2);
        String tampered = token.substring(0, token.length() - 2) + (last == 'A' ? 'B' : 'A') + token.charAt(token.length() - 1);

        assertThat(run("Bearer " + tampered)).isNull();
    }

    @Test
    @DisplayName("Token hết hạn -> không đặt principal")
    void expiredToken_noPrincipal() throws Exception {
        String token = new JwtService(SECRET, -60_000).generateAccessToken(alex);

        assertThat(run("Bearer " + token)).isNull();
    }

    @Test
    @DisplayName("tv trong token khác token_version hiện tại (đã đổi mật khẩu) -> không đặt principal")
    void tokenVersionMismatch_noPrincipal() throws Exception {
        String token = jwtService.generateAccessToken(alex);
        alex.setTokenVersion(1);

        assertThat(run("Bearer " + token)).isNull();
    }

    @Test
    @DisplayName("User bị khóa -> không đặt principal")
    void lockedUser_noPrincipal() throws Exception {
        String token = jwtService.generateAccessToken(alex);
        alex.setIsLocked(true);

        assertThat(run("Bearer " + token)).isNull();
    }

    @Test
    @DisplayName("User đã bị xóa -> không đặt principal")
    void deletedUser_noPrincipal() throws Exception {
        UserEntity ghost = UserEntity.builder().id(99L).username("ghost").systemRole(SystemRole.USER)
            .isLocked(false).tokenVersion(0).build();
        String token = jwtService.generateAccessToken(ghost);

        assertThat(run("Bearer " + token)).isNull();
    }

    @Test
    @DisplayName("Header không phải Bearer -> bỏ qua")
    void nonBearer_ignored() throws Exception {
        assertThat(run("Basic YWxleDpwYXNz")).isNull();
    }

    @Test
    @DisplayName("ADMIN -> authority ROLE_ADMIN")
    void admin_roleAdmin() throws Exception {
        alex.setSystemRole(SystemRole.ADMIN);
        String token = jwtService.generateAccessToken(alex);

        Authentication auth = run("Bearer " + token);

        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_ADMIN");
    }
}
