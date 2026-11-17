package com.pipeline.wpe.security;

import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
import org.springframework.http.HttpMethod;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // để A6 dùng @PreAuthorize
public class SecurityConfig {

    private final JsonAuthenticationEntryPoint authenticationEntryPoint;
    private final JsonAccessDeniedHandler accessDeniedHandler;
    private final boolean debugEnabled;
    private final Long defaultDebugUserId;

    public SecurityConfig(
        JsonAuthenticationEntryPoint authenticationEntryPoint,
        JsonAccessDeniedHandler accessDeniedHandler,
        @Value("${app.security.debug-user-id-enabled:false}") boolean debugEnabled,
        @Value("${app.security.default-debug-user-id:#{null}}") Long defaultDebugUserId
    ) {
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
        this.debugEnabled = debugEnabled;
        this.defaultDebugUserId = defaultDebugUserId;
    }

    /** BCrypt cost 12 cho mật khẩu mới. Hash cũ cost 10 (seed) vẫn so khớp được vì cost nằm trong chuỗi hash. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService, UserRepository userRepository)
        throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {}) // Uses WebCorsConfig
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e
                .authenticationEntryPoint(authenticationEntryPoint)
                .accessDeniedHandler(accessDeniedHandler)
            )
            .addFilterBefore(new JwtAuthFilter(jwtService, userRepository), UsernamePasswordAuthenticationFilter.class);

        if (debugEnabled) {
            http.addFilterAfter(new DevDebugAuthFilter(userRepository, defaultDebugUserId), JwtAuthFilter.class);
        }

        http.authorizeHttpRequests(auth -> auth
            // Công khai Swagger UI & OpenAPI docs
            .requestMatchers(
                "/swagger-ui/**",
                "/swagger-ui.html",
                "/v3/api-docs",
                "/v3/api-docs/**",
                "/v3/api-docs.yaml"
            ).permitAll()
            // Công khai Auth API
            .requestMatchers("/api/v1/auth/**", "/api/auth/**").permitAll()
            // Công khai Guest Link & Health check
            .requestMatchers(
                "/api/v1/guest/**",
                "/api/guest/**",
                "/api/v1/health",
                "/api/health",
                "/error"
            ).permitAll()
            // Công khai ảnh đại diện
            .requestMatchers(HttpMethod.GET, "/uploads/avatars/**").permitAll()
            // Mọi API khác bắt buộc phải xác thực
            .anyRequest().authenticated()
        );

        return http.build();
    }
}
