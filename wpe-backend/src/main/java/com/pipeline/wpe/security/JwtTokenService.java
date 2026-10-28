package com.pipeline.wpe.security;

import com.pipeline.wpe.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtTokenService {

    private final SecretKey signingKey;
    private final long accessTokenLifetimeMillis;

    public JwtTokenService(
        @Value("${jwt.secret}") String base64Secret,
        @Value("${jwt.access-token-expiration-ms:900000}") long accessTokenLifetimeMillis
    ) {
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(base64Secret));
        this.accessTokenLifetimeMillis = accessTokenLifetimeMillis;
    }

    public String createAccessToken(UserEntity user) {
        Instant issuedAt = Instant.now();
        return Jwts.builder()
            .subject(String.valueOf(user.getId()))
            .claim("username", user.getUsername())
            .claim("role", user.getSystemRole().name())
            .claim("tokenVersion", user.getTokenVersion())
            .issuedAt(Date.from(issuedAt))
            .expiration(Date.from(issuedAt.plusMillis(accessTokenLifetimeMillis)))
            .signWith(signingKey)
            .compact();
    }

    public Claims parseAccessToken(String token) {
        return Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
