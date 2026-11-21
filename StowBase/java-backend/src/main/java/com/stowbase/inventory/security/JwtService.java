package com.stowbase.inventory.security;

import com.stowbase.inventory.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class JwtService {

    private static final String ISSUER = "stowbase";
    private static final long TTL_SECONDS = 60L * 60L * 12L;

    private final SecretKey signingKey;
    private final Map<String, Long> revokedTokens = new ConcurrentHashMap<>();

    public JwtService(@Value("${JWT_SECRET:}") String configuredSecret) {
        if (configuredSecret != null && configuredSecret.length() >= 32) {
            this.signingKey = Keys.hmacShaKeyFor(configuredSecret.getBytes(StandardCharsets.UTF_8));
        } else {
            byte[] randomBytes = new byte[32];
            new SecureRandom().nextBytes(randomBytes);
            this.signingKey = Keys.hmacShaKeyFor(randomBytes);
        }
    }

    public record IssuedToken(String token, long expiresAtMillis) {}

    public IssuedToken issueToken(User user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(TTL_SECONDS);
        String token = Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(ISSUER)
                .subject(String.valueOf(user.getId()))
                .claim("uid", user.getUid())
                .claim("email", user.getEmail())
                .claim("displayName", user.getDisplayName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
        return new IssuedToken(token, exp.toEpochMilli());
    }

    public Optional<Claims> verifyToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(ISSUER)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            String jti = claims.getId();
            if (jti == null || revokedTokens.containsKey(jti)) {
                return Optional.empty();
            }
            return Optional.of(claims);
        } catch (Exception ex) {
            return Optional.empty();
        }
    }

    public void revokeToken(String jti, long expMillis) {
        long now = System.currentTimeMillis();
        revokedTokens.entrySet().removeIf(entry -> entry.getValue() <= now);
        revokedTokens.put(jti, expMillis);
    }
}
