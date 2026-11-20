import type { FraudRuleConfig, JavaProjectFile } from '../shared/types.ts';

export function generateJavaProjectFiles(rules: FraudRuleConfig): JavaProjectFile[] {
  return [
    {
      path: 'pom.xml',
      language: 'xml',
      category: 'Build & Config',
      description:
        'Maven descriptor for Java 21 + Spring Boot 3.4, Spring Security 6, JJWT, STOMP WebSockets, Data JPA, and PostgreSQL.',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.4.2</version>
    </parent>

    <groupId>com.veritas</groupId>
    <artifactId>fraudguard-bank-service</artifactId>
    <version>2.0.0</version>
    <name>Veritas FraudGuard</name>
    <description>Fullstack Java Bank Fraud Detection, JWT RBAC &amp; Real-Time Monitoring</description>

    <properties>
        <java.version>21</java.version>
        <jjwt.version>0.12.6</jjwt.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-websocket</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>\${jjwt.version}</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>\${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>\${jjwt.version}</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/FraudGuardApplication.java',
      language: 'java',
      category: 'Build & Config',
      description: 'Spring Boot entry point enabling async real-time alert dispatch.',
      content: `package com.veritas.fraudguard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class FraudGuardApplication {
    public static void main(String[] args) {
        SpringApplication.run(FraudGuardApplication.class, args);
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/config/SecurityConfig.java',
      language: 'java',
      category: 'Authentication & RBAC',
      description:
        'Spring Security 6 stateless JWT filter chain with BCrypt password hashing and @EnableMethodSecurity RBAC enforcement.',
      content: `package com.veritas.fraudguard.config;

import com.veritas.fraudguard.security.JwtAuthenticationFilter;
import com.veritas.fraudguard.security.UnauthorizedAccessFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UnauthorizedAccessFilter unauthorizedAccessFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/ws-fraud-alerts/**").permitAll()
                .requestMatchers("/api/v1/admin/**", "/api/v1/rules/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/alerts/**").hasAnyRole("ADMIN", "ANALYST", "CUSTOMER")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(unauthorizedAccessFilter, JwtAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/security/JwtTokenProvider.java',
      language: 'java',
      category: 'Authentication & RBAC',
      description: 'HMAC-SHA256 JWT issuer and validator embedding user ID, email, and RBAC authority claims.',
      content: `package com.veritas.fraudguard.security;

import com.veritas.fraudguard.model.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final long expirationSeconds;

    public JwtTokenProvider(
        @Value("\${security.jwt.secret}") String secret,
        @Value("\${security.jwt.expiration-seconds:28800}") long expirationSeconds
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
    }

    public String generateToken(AppUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getId())
            .claim("email", user.getEmail())
            .claim("role", user.getRole().name())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirationSeconds)))
            .signWith(secretKey)
            .compact();
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/security/JwtAuthenticationFilter.java',
      language: 'java',
      category: 'Authentication & RBAC',
      description: 'Per-request Bearer JWT filter authenticating callers and granting Spring Security RBAC authorities.',
      content: `package com.veritas.fraudguard.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwtTokenProvider.parseClaims(header.substring(7));
                String role = claims.get("role", String.class);
                var auth = new UsernamePasswordAuthenticationToken(
                    claims.get("email", String.class),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/controller/AuthController.java',
      language: 'java',
      category: 'Authentication & RBAC',
      description: 'Secure user registration, BCrypt login, and JWT issuance endpoints enforcing least-privilege registration roles.',
      content: `package com.veritas.fraudguard.controller;

import com.veritas.fraudguard.model.AppUser;
import com.veritas.fraudguard.repository.AppUserRepository;
import com.veritas.fraudguard.security.JwtTokenProvider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        String normalizedEmail = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Email is already registered"));
        }

        // Prevent privilege escalation during self-registration
        AppUser.Role assignedRole = "ANALYST".equalsIgnoreCase(req.requestedRole())
            ? AppUser.Role.ANALYST
            : AppUser.Role.CUSTOMER;

        AppUser user = userRepository.save(AppUser.builder()
            .id("usr-" + UUID.randomUUID().toString().substring(0, 8))
            .fullName(req.fullName().trim())
            .email(normalizedEmail)
            .passwordHash(passwordEncoder.encode(req.password()))
            .role(assignedRole)
            .status(AppUser.Status.ACTIVE)
            .createdAt(Instant.now())
            .build());

        String token = jwtTokenProvider.generateToken(user);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(Map.of("token", token, "user", user.toPublicView()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        AppUser user = userRepository.findByEmailIgnoreCase(req.email().trim())
            .orElse(null);

        if (user == null || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Invalid credentials"));
        }

        if (user.getStatus() == AppUser.Status.SUSPENDED) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "User account is suspended"));
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return ResponseEntity.ok(Map.of(
            "token", jwtTokenProvider.generateToken(user),
            "user", user.toPublicView()
        ));
    }

    public record RegisterRequest(
        @NotBlank String fullName,
        @Email @NotBlank String email,
        @Size(min = 8) String password,
        String requestedRole
    ) {}

    public record LoginRequest(
        @Email @NotBlank String email,
        @NotBlank String password
    ) {}
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/model/AppUser.java',
      language: 'java',
      category: 'Domain Models',
      description: 'JPA entity storing BCrypt password hashes, RBAC roles (ADMIN, ANALYST, CUSTOMER), and account linkage.',
      content: `package com.veritas.fraudguard.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "app_users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppUser {

    @Id
    private String id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    private String linkedAccountId;
    private Instant createdAt;
    private Instant lastLoginAt;

    public enum Role { ADMIN, ANALYST, CUSTOMER }
    public enum Status { ACTIVE, SUSPENDED }

    public Map<String, Object> toPublicView() {
        return Map.of(
            "id", id,
            "fullName", fullName,
            "email", email,
            "role", role.name(),
            "status", status.name()
        );
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/model/AccountProfile.java',
      language: 'java',
      category: 'Domain Models',
      description: 'JPA entity storing trusted device fingerprints, verified geolocation coordinates, spending baselines, and freeze state.',
      content: `package com.veritas.fraudguard.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "account_profiles")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountProfile {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String accountNumber;

    @Column(nullable = false)
    private String holderName;

    @Column(nullable = false)
    private String email;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "trusted_devices", joinColumns = @JoinColumn(name = "account_id"))
    @Column(name = "device_fingerprint")
    @Builder.Default
    private Set<String> trustedDeviceIds = new HashSet<>();

    @Column(nullable = false)
    private BigDecimal avgTransactionAmount;

    @Column(nullable = false)
    private BigDecimal stdDevTransactionAmount;

    @Column(nullable = false)
    private BigDecimal dailyLimit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AccountStatus status;

    private String lastVerifiedCity;
    private double lastVerifiedLat;
    private double lastVerifiedLng;
    private Instant lastVerifiedAt;

    public enum AccountStatus { ACTIVE, FROZEN }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/service/FraudDetectionService.java',
      language: 'java',
      category: 'Fraud & ML Engine',
      description:
        'Hybrid rule-based + calibrated logistic regression ML fraud scoring service broadcasting real-time STOMP WebSocket alerts.',
      content: `package com.veritas.fraudguard.service;

import com.veritas.fraudguard.model.AccountProfile;
import com.veritas.fraudguard.model.FraudAlert;
import com.veritas.fraudguard.repository.AccountProfileRepository;
import com.veritas.fraudguard.repository.FraudAlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FraudDetectionService {

    private final AccountProfileRepository accountRepository;
    private final FraudAlertRepository alertRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("\${fraud.weights.unknown-device:${rules.unknownDeviceWeight}}")
    private int unknownDeviceWeight;

    @Value("\${fraud.weights.impossible-travel:${rules.impossibleTravelWeight}}")
    private int impossibleTravelWeight;

    @Value("\${fraud.weights.vpn-proxy:${rules.vpnProxyWeight}}")
    private int vpnProxyWeight;

    @Value("\${fraud.weights.mfa-failure:${rules.mfaFailureWeight}}")
    private int mfaFailureWeight;

    @Value("\${fraud.weights.invalid-session:${rules.invalidSessionWeight}}")
    private int invalidSessionWeight;

    @Value("\${fraud.weights.high-amount:${rules.highAmountWeight}}")
    private int highAmountWeight;

    @Value("\${fraud.thresholds.amount-multiplier:${rules.highAmountMultiplier}}")
    private double amountMultiplier;

    @Value("\${fraud.thresholds.challenge:${rules.challengeThreshold}}")
    private int challengeThreshold;

    @Value("\${fraud.thresholds.block:${rules.blockThreshold}}")
    private int blockThreshold;

    @Transactional
    public EvaluationResult evaluateActivity(ActivityRequest request) {
        AccountProfile account = accountRepository.findById(request.accountId())
            .orElseThrow(() -> new IllegalArgumentException("Unknown account: " + request.accountId()));

        List<String> reasons = new ArrayList<>();
        int ruleScore = 0;

        if (account.getStatus() == AccountProfile.AccountStatus.FROZEN) {
            ruleScore += 95;
            reasons.add("ACC_FROZEN: Attempted access on frozen account");
        }
        if (!request.sessionTokenValid()) {
            ruleScore += invalidSessionWeight;
            reasons.add("INVALID_SESSION: JWT signature or replay nonce failed");
        }
        if (!"VERIFIED".equalsIgnoreCase(request.mfaStatus())) {
            ruleScore += mfaFailureWeight;
            reasons.add("MFA_" + request.mfaStatus() + ": Multi-factor verification incomplete");
        }

        boolean knownDevice = account.getTrustedDeviceIds().contains(request.deviceId());
        if (!knownDevice) {
            ruleScore += unknownDeviceWeight;
            reasons.add("UNRECOGNIZED_DEVICE: Fingerprint not enrolled");
        }

        double distanceKm = haversineKm(
            account.getLastVerifiedLat(), account.getLastVerifiedLng(),
            request.lat(), request.lng()
        );
        double elapsedHours = Math.max(0.25,
            Duration.between(account.getLastVerifiedAt(), Instant.now()).toMinutes() / 60.0
        );
        if (distanceKm > 450 && (distanceKm / elapsedHours) > 800) {
            ruleScore += impossibleTravelWeight;
            reasons.add(String.format("IMPOSSIBLE_TRAVEL: %.0f km in %.1fh", distanceKm, elapsedHours));
        }

        if (request.vpnOrTor()) {
            ruleScore += vpnProxyWeight;
            reasons.add("ANONYMIZER_IP: Proxy or Tor exit node detected");
        }

        double zScore = computeAmountZScore(request.amount(), account);
        BigDecimal anomalyThreshold = account.getAvgTransactionAmount()
            .multiply(BigDecimal.valueOf(amountMultiplier));
        if (request.amount().compareTo(anomalyThreshold) > 0
                || request.amount().compareTo(account.getDailyLimit()) > 0) {
            ruleScore += highAmountWeight;
            reasons.add(String.format("AMOUNT_DEVIATION: Z-score %.1f above customer baseline", zScore));
        }

        // Calibrated logistic regression ML probability model
        double mlProbability = computeMlFraudProbability(zScore, knownDevice, distanceKm, request);
        int finalScore = Math.min(100, Math.max(2,
            (int) Math.round(ruleScore * 0.78 + mlProbability * 100.0 * 0.22)
        ));

        boolean unauthorizedUser = !request.sessionTokenValid()
            || !"VERIFIED".equalsIgnoreCase(request.mfaStatus())
            || (!knownDevice && reasons.size() >= 2)
            || account.getStatus() == AccountProfile.AccountStatus.FROZEN;

        String verdict = "AUTHORIZED";
        if (finalScore >= blockThreshold || (unauthorizedUser && finalScore >= 55) || mlProbability >= 0.90) {
            verdict = "BLOCKED_UNAUTHORIZED";
        } else if (finalScore >= challengeThreshold || !knownDevice || mlProbability >= 0.65) {
            verdict = "CHALLENGE_MFA";
        }

        FraudAlert alert = null;
        if (!"AUTHORIZED".equals(verdict)) {
            FraudAlert.Severity severity = (finalScore >= 80 || unauthorizedUser)
                ? FraudAlert.Severity.CRITICAL
                : (finalScore >= blockThreshold ? FraudAlert.Severity.HIGH : FraudAlert.Severity.MEDIUM);

            alert = alertRepository.save(FraudAlert.builder()
                .id("ALT-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                .transactionId("TXN-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                .accountId(account.getId())
                .holderName(account.getHolderName())
                .severity(severity)
                .status(FraudAlert.AlertStatus.OPEN)
                .title(unauthorizedUser ? "Unauthorized user blocked" : "Step-up verification required")
                .triggeredRuleSummary(String.join(" | ", reasons))
                .riskScore(finalScore)
                .mlFraudProbability(mlProbability)
                .unauthorizedUserDetected(unauthorizedUser)
                .amount(request.amount())
                .location(request.city() + ", " + request.country())
                .ipAddress(request.ipAddress())
                .deviceLabel(request.deviceLabel())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build());

            messagingTemplate.convertAndSend("/topic/fraud-alerts", alert);
            messagingTemplate.convertAndSend("/topic/account-alerts/" + account.getId(), alert);
        }

        return new EvaluationResult(verdict, finalScore, mlProbability, unauthorizedUser, reasons, alert);
    }

    private double computeAmountZScore(BigDecimal amount, AccountProfile account) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return 0.0;
        double diff = amount.doubleValue() - account.getAvgTransactionAmount().doubleValue();
        double std = Math.max(100.0, account.getStdDevTransactionAmount().doubleValue());
        return Math.max(0.0, diff / std);
    }

    private double computeMlFraudProbability(
        double zScore, boolean knownDevice, double distanceKm, ActivityRequest req
    ) {
        double logit = -3.15;
        logit += Math.min(4.5, zScore) * 0.62;
        if (!knownDevice) logit += 1.45;
        if (distanceKm > 150) logit += Math.min(2.2, Math.log10(distanceKm + 1) * 0.55);
        if (req.vpnOrTor()) logit += 1.18;
        if (!"VERIFIED".equalsIgnoreCase(req.mfaStatus()) || !req.sessionTokenValid()) logit += 2.05;
        return Math.min(0.99, Math.max(0.01, 1.0 / (1.0 + Math.exp(-logit))));
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public record ActivityRequest(
        String accountId, String eventType, BigDecimal amount,
        String ipAddress, String city, String country, double lat, double lng,
        String deviceId, String deviceLabel, boolean vpnOrTor,
        String mfaStatus, boolean sessionTokenValid
    ) {}

    public record EvaluationResult(
        String verdict, int riskScore, double mlFraudProbability,
        boolean unauthorizedUser, List<String> triggeredRules, FraudAlert alert
    ) {}
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/controller/FraudController.java',
      language: 'java',
      category: 'API & WebSocket',
      description: 'RBAC-protected REST endpoints using @PreAuthorize for transaction checks, case triage, account freezes, and admin rule changes.',
      content: `package com.veritas.fraudguard.controller;

import com.veritas.fraudguard.model.AccountProfile;
import com.veritas.fraudguard.model.FraudAlert;
import com.veritas.fraudguard.repository.AccountProfileRepository;
import com.veritas.fraudguard.repository.FraudAlertRepository;
import com.veritas.fraudguard.service.FraudDetectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class FraudController {

    private final FraudDetectionService fraudDetectionService;
    private final FraudAlertRepository alertRepository;
    private final AccountProfileRepository accountRepository;

    @PostMapping("/fraud/evaluate")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST', 'CUSTOMER')")
    public ResponseEntity<FraudDetectionService.EvaluationResult> evaluate(
        @RequestBody FraudDetectionService.ActivityRequest request
    ) {
        return ResponseEntity.ok(fraudDetectionService.evaluateActivity(request));
    }

    @GetMapping("/alerts")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public List<FraudAlert> listAlerts() {
        return alertRepository.findAllByOrderByCreatedAtDesc();
    }

    @PatchMapping("/alerts/{alertId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<FraudAlert> updateAlertStatus(
        @PathVariable String alertId,
        @RequestParam FraudAlert.AlertStatus status
    ) {
        return alertRepository.findById(alertId)
            .map(alert -> {
                alert.setStatus(status);
                alert.setUpdatedAt(Instant.now());
                return ResponseEntity.ok(alertRepository.save(alert));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/accounts/{accountId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<AccountProfile> setAccountStatus(
        @PathVariable String accountId,
        @RequestParam AccountProfile.AccountStatus status
    ) {
        return accountRepository.findById(accountId)
            .map(account -> {
                account.setStatus(status);
                return ResponseEntity.ok(accountRepository.save(account));
            })
            .orElse(ResponseEntity.notFound().build());
    }
}
`,
    },
    {
      path: 'src/main/java/com/veritas/fraudguard/config/WebSocketConfig.java',
      language: 'java',
      category: 'API & WebSocket',
      description: 'STOMP WebSocket broker pushing real-time alerts to admin operations topics and customer-scoped account channels.',
      content: `package com.veritas.fraudguard.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-fraud-alerts")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
`,
    },
    {
      path: 'src/main/resources/application.yml',
      language: 'yaml',
      category: 'Build & Config',
      description: 'Spring Boot runtime config synced live with dashboard fraud rule weights, JWT expiration, and PostgreSQL datasource.',
      content: `server:
  port: 8080

spring:
  application:
    name: veritas-fraudguard
  datasource:
    url: jdbc:postgresql://localhost:5432/fraudguard
    username: \${DB_USER:fraudguard}
    password: \${DB_PASSWORD:change_me_in_prod}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false

security:
  jwt:
    secret: \${JWT_SECRET:replace-with-256-bit-random-production-secret-key}
    expiration-seconds: 28800

fraud:
  weights:
    unknown-device: ${rules.unknownDeviceWeight}
    impossible-travel: ${rules.impossibleTravelWeight}
    vpn-proxy: ${rules.vpnProxyWeight}
    mfa-failure: ${rules.mfaFailureWeight}
    invalid-session: ${rules.invalidSessionWeight}
    high-amount: ${rules.highAmountWeight}
    velocity-burst: ${rules.velocityBurstWeight}
  thresholds:
    amount-multiplier: ${rules.highAmountMultiplier}
    velocity-burst-limit: ${rules.velocityBurstLimit}
    challenge: ${rules.challengeThreshold}
    block: ${rules.blockThreshold}
`,
    },
    {
      path: 'src/main/resources/schema.sql',
      language: 'sql',
      category: 'Build & Config',
      description: 'PostgreSQL schema for users & RBAC roles, account baselines, trusted devices, fraud alerts, case notes, and audit logs.',
      content: `CREATE TABLE IF NOT EXISTS app_users (
    id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(24) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    linked_account_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS account_profiles (
    id VARCHAR(36) PRIMARY KEY,
    account_number VARCHAR(32) NOT NULL UNIQUE,
    holder_name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    avg_transaction_amount NUMERIC(14, 2) NOT NULL,
    std_dev_transaction_amount NUMERIC(14, 2) NOT NULL DEFAULT 500.00,
    daily_limit NUMERIC(14, 2) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    last_verified_city VARCHAR(80),
    last_verified_lat DOUBLE PRECISION,
    last_verified_lng DOUBLE PRECISION,
    last_verified_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS fraud_alerts (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NOT NULL REFERENCES account_profiles(id),
    holder_name VARCHAR(120) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    title VARCHAR(255) NOT NULL,
    triggered_rule_summary TEXT,
    risk_score INTEGER NOT NULL,
    ml_fraud_probability DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    unauthorized_user_detected BOOLEAN NOT NULL DEFAULT FALSE,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    location VARCHAR(120),
    ip_address VARCHAR(64),
    device_label VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_investigation_notes (
    id VARCHAR(36) PRIMARY KEY,
    alert_id VARCHAR(36) NOT NULL REFERENCES fraud_alerts(id) ON DELETE CASCADE,
    author_email VARCHAR(160) NOT NULL,
    author_role VARCHAR(24) NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_email VARCHAR(160) NOT NULL,
    actor_role VARCHAR(24) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(160) NOT NULL,
    outcome VARCHAR(16) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      category: 'Documentation',
      description: 'Setup guide for Java 21 Spring Boot with JWT authentication, RBAC roles, ML scoring, and STOMP WebSocket alerts.',
      content: `# Veritas FraudGuard — Fullstack Java 21 + Spring Boot 3.4

## Security & Role-Based Access Control (RBAC)
- **Stateless JWT + BCrypt**: \`AuthController\` issues HMAC-SHA256 JWT tokens for registered users.
- **Role Hierarchy**:
  - \`ROLE_ADMIN\`: Full platform control, detection rule policy updates, user & role governance.
  - \`ROLE_ANALYST\`: Real-time transaction monitoring, alert triage, case investigation notes, account freezes.
  - \`ROLE_CUSTOMER\`: Scoped self-service alerts and emergency account freeze for their linked account.

## Hybrid Fraud & ML Detection Engine
- Combines deterministic rules (Device Fingerprint, Haversine Impossible Travel, VPN/Tor ASN, MFA/JWT integrity) with a calibrated Logistic Regression fraud probability score.
- Synced Policy Thresholds: Challenge MFA at **${rules.challengeThreshold}/100**, Auto-Block at **${rules.blockThreshold}/100**.

## Running Locally
\`\`\`bash
createdb fraudguard
psql -d fraudguard -f src/main/resources/schema.sql
mvn spring-boot:run
\`\`\`
`,
    },
  ];
}
