package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.common.enums.SystemRole;
import com.pipeline.wpe.entity.UserEntity;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-secret-for-unit-tests-only-0123456789abcdef";
    private static final String OTHER_SECRET = "another-secret-for-unit-tests-only-9876543210";

    private final JwtService jwtService = new JwtService(SECRET, 900_000);

    private UserEntity alex() {
        return UserEntity.builder()
            .id(2L).username("alex.kim").email("alex.kim@pipeline.engine")
            .systemRole(SystemRole.USER).tokenVersion(3).isLocked(false)
            .build();
    }

    @Test
    @DisplayName("Tạo token rồi đọc lại đúng sub, username, role, tv")
    void generateAndParse_roundTrip() {
        String token = jwtService.generateAccessToken(alex());

        JwtService.AccessTokenClaims claims = jwtService.parseAccessToken(token);
        assertThat(claims.userId()).isEqualTo(2L);
        assertThat(claims.username()).isEqualTo("alex.kim");
        assertThat(claims.role()).isEqualTo("USER");
        assertThat(claims.tokenVersion()).isEqualTo(3);
    }

    @Test
    @DisplayName("Header là HS256, exp - iat = 15 phút")
    @SuppressWarnings("unchecked")
    void headerIsHs256_andExpiresIn15Minutes() throws Exception {
        String token = jwtService.generateAccessToken(alex());
        String[] parts = token.split("\\.");
        assertThat(parts).hasSize(3);

        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String, Object> header = mapper.readValue(Decoders.BASE64URL.decode(parts[0]), Map.class);
        Map<String, Object> payload = mapper.readValue(Decoders.BASE64URL.decode(parts[1]), Map.class);

        assertThat(header.get("alg")).isEqualTo("HS256");
        assertThat(payload.get("sub")).isEqualTo("2");
        long iat = ((Number) payload.get("iat")).longValue();
        long exp = ((Number) payload.get("exp")).longValue();
        assertThat(exp - iat).isEqualTo(900);
    }

    @Test
    @DisplayName("Token hết hạn -> ExpiredJwtException")
    void expiredToken_throws() {
        JwtService expiredIssuer = new JwtService(SECRET, -60_000);
        String token = expiredIssuer.generateAccessToken(alex());

        assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @DisplayName("Token ký bằng secret khác -> JwtException (sai chữ ký)")
    void wrongSignature_throws() {
        String token = new JwtService(OTHER_SECRET, 900_000).generateAccessToken(alex());

        assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("Sửa 1 ký tự trong payload -> JwtException")
    void tamperedPayload_throws() {
        String token = jwtService.generateAccessToken(alex());
        String[] parts = token.split("\\.");
        char c = parts[1].charAt(5);
        parts[1] = parts[1].substring(0, 5) + (c == 'A' ? 'B' : 'A') + parts[1].substring(6);
        String tampered = String.join(".", parts);

        assertThatThrownBy(() -> jwtService.parseAccessToken(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("Chuỗi rác, rỗng -> JwtException")
    void garbage_throws() {
        assertThatThrownBy(() -> jwtService.parseAccessToken("abc.def")).isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> jwtService.parseAccessToken("")).isInstanceOf(JwtException.class);
        assertThatThrownBy(() -> jwtService.parseAccessToken(null)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("Token không có claim tv -> JwtException")
    void missingTv_throws() {
        String token = Jwts.builder()
            .subject("2")
            .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
            .compact();

        assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(JwtException.class);
    }

    @Test
    @DisplayName("Secret ngắn hơn 32 byte -> từ chối khởi tạo")
    void shortSecret_rejected() {
        assertThatThrownBy(() -> new JwtService("too-short", 900_000)).isInstanceOf(IllegalStateException.class);
    }
}
