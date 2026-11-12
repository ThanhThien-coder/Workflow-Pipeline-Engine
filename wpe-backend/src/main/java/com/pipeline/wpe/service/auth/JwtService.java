package com.pipeline.wpe.service.auth;

import com.pipeline.wpe.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Tạo và đọc access token (JWT, HS256).
 * Claims: sub = userId, username, role = system_role, tv = token_version, iat, exp.
 */
@Service
public class JwtService {

    public static final String CLAIM_USERNAME = "username";
    public static final String CLAIM_ROLE = "role";
    public static final String CLAIM_TOKEN_VERSION = "tv";

    private final SecretKey key;
    private final long accessTokenExpirationMs;

    public JwtService(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-token-expiration-ms:900000}") long accessTokenExpirationMs
    ) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("jwt.secret phải dài ít nhất 32 byte (256 bit) cho HS256");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
    }

    public String generateAccessToken(UserEntity user) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
            .subject(String.valueOf(user.getId()))
            .claim(CLAIM_USERNAME, user.getUsername())
            .claim(CLAIM_ROLE, user.getSystemRole().name())
            .claim(CLAIM_TOKEN_VERSION, user.getTokenVersion())
            .issuedAt(new Date(now))
            .expiration(new Date(now + accessTokenExpirationMs))
            .signWith(key, Jwts.SIG.HS256)
            .compact();
    }

    /**
     * Kiểm chữ ký và hạn dùng, trả về claims đã đọc.
     *
     * @throws JwtException nếu token sai chữ ký, sai định dạng hoặc hết hạn
     *                      (ExpiredJwtException là lớp con của JwtException)
     */
    public AccessTokenClaims parseAccessToken(String token) {
        if (token == null || token.isBlank()) {
            throw new JwtException("Token rỗng");
        }
        Claims claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();

        Long userId;
        try {
            userId = Long.parseLong(claims.getSubject());
        } catch (NumberFormatException e) {
            throw new JwtException("sub không phải userId hợp lệ");
        }
        Integer tokenVersion = claims.get(CLAIM_TOKEN_VERSION, Integer.class);
        if (tokenVersion == null) {
            throw new JwtException("Thiếu claim tv");
        }
        return new AccessTokenClaims(
            userId,
            claims.get(CLAIM_USERNAME, String.class),
            claims.get(CLAIM_ROLE, String.class),
            tokenVersion
        );
    }

    public long getAccessTokenExpirationMs() {
        return accessTokenExpirationMs;
    }

    public record AccessTokenClaims(Long userId, String username, String role, Integer tokenVersion) {
    }
}
