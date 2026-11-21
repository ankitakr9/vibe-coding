package com.stowbase.inventory.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;
    private final JwtService jwtService;

    public FirebaseAuthFilter(JdbcTemplate jdbcTemplate, JwtService jwtService) {
        this.jdbcTemplate = jdbcTemplate;
        this.jwtService = jwtService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/")
                || "/api/health".equals(path)
                || "/api/auth/register".equals(path)
                || "/api/auth/login".equals(path);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            unauthorized(response, "Authentication required.");
            return;
        }

        String token = authHeader.substring("Bearer ".length()).trim();

        // 1. Verify native HS256 JWT
        Optional<Claims> jwtClaims = jwtService.verifyToken(token);
        if (jwtClaims.isPresent()) {
            Claims claims = jwtClaims.get();
            request.setAttribute("dbUserId", Integer.valueOf(claims.getSubject()));
            request.setAttribute("firebaseUid", claims.get("uid", String.class));
            request.setAttribute("jwtId", claims.getId());
            request.setAttribute("jwtExpMillis", claims.getExpiration().getTime());
            filterChain.doFilter(request, response);
            return;
        }

        // 2. Fallback to Firebase Auth ID token
        try {
            FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(token);
            String uid = decoded.getUid();
            String email = decoded.getEmail() != null ? decoded.getEmail().toLowerCase() : uid + "@user.local";
            String name = decoded.getName() != null ? decoded.getName() : "";

            Integer dbUserId = jdbcTemplate.queryForObject(
                    "INSERT INTO users (uid, email, display_name) VALUES (?, ?, ?) " +
                    "ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email " +
                    "RETURNING id",
                    Integer.class,
                    uid,
                    email,
                    name
            );

            request.setAttribute("firebaseUid", uid);
            request.setAttribute("dbUserId", dbUserId);
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            unauthorized(response, "Invalid or expired session.");
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
