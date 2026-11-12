package com.pipeline.wpe.security;

import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
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
            // Đọc JWT và đặt SecurityContext. Token sai chưa bị chặn ở đây (xem JwtAuthFilter), chặn thật ở X1.
            .addFilterBefore(new JwtAuthFilter(jwtService, userRepository), UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                // Công khai Swagger UI & OpenAPI docs
                .requestMatchers(
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**",
                    "/v3/api-docs.yaml"
                ).permitAll()
                // Công khai Auth API
                .requestMatchers("/api/v1/auth/**", "/api/auth/**").permitAll()
                // Công khai Guest Link & Health check
                .requestMatchers("/api/v1/guest/**", "/api/guest/**", "/actuator/**", "/error").permitAll()
                // Mọi API khác tạm thời yêu cầu xác thực hoặc mở theo cấu hình
                .anyRequest().permitAll() // Tạm permitAll trong giai đoạn dev skeleton cho tới X1
            );

        return http.build();
    }
}
