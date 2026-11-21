package com.stowbase.inventory.controller;

import com.stowbase.inventory.model.User;
import com.stowbase.inventory.repository.UserRepository;
import com.stowbase.inventory.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    public AuthController(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 80) String displayName,
            @NotBlank @Email @Size(max = 160) String email,
            @NotBlank @Size(min = 8, max = 128) String password
    ) {}

    public record LoginRequest(
            @NotBlank @Email @Size(max = 160) String email,
            @NotBlank @Size(max = 128) String password
    ) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest body) {
        String normalizedEmail = body.email().trim().toLowerCase();
        if (userRepository.findByEmailIgnoreCase(normalizedEmail).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "An account with this email address already exists."));
        }

        User user = new User();
        user.setUid("local:" + UUID.randomUUID());
        user.setEmail(normalizedEmail);
        user.setDisplayName(body.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(body.password()));
        User saved = userRepository.save(user);

        JwtService.IssuedToken issued = jwtService.issueToken(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "token", issued.token(),
                "expiresAt", issued.expiresAtMillis(),
                "user", saved
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest body) {
        String normalizedEmail = body.email().trim().toLowerCase();
        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(u -> u.getPasswordHash() != null
                        && passwordEncoder.matches(body.password(), u.getPasswordHash()))
                .map(user -> {
                    JwtService.IssuedToken issued = jwtService.issueToken(user);
                    return ResponseEntity.ok((Object) Map.of(
                            "token", issued.token(),
                            "expiresAt", issued.expiresAtMillis(),
                            "user", user
                    ));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid email or password.")));
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout(HttpServletRequest request) {
        String jti = (String) request.getAttribute("jwtId");
        Long exp = (Long) request.getAttribute("jwtExpMillis");
        if (jti != null && exp != null) {
            jwtService.revokeToken(jti, exp);
        }
        return Map.of("loggedOut", true);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        Integer userId = (Integer) request.getAttribute("dbUserId");
        return userRepository.findById(userId)
                .<ResponseEntity<?>>map(user -> ResponseEntity.ok(Map.of("user", user)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid session.")));
    }
}
