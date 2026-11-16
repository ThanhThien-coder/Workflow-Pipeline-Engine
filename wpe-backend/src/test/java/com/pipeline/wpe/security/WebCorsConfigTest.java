package com.pipeline.wpe.security;

import com.pipeline.wpe.config.WebCorsConfig;
import com.pipeline.wpe.controller.HealthCheckController;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = HealthCheckController.class)
@Import({SecurityConfig.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class, WebCorsConfig.class})
@TestPropertySource(properties = {
    "app.cors.allowed-origins=http://example.test",
    "app.security.debug-user-id-enabled=false"
})
class WebCorsConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("Preflight OPTIONS từ origin được phép (http://example.test) -> 200 OK có Access-Control-Allow-Origin")
    void corsAllowedOrigin_returnsAllowOriginHeader() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                .header(HttpHeaders.ORIGIN, "http://example.test")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://example.test"))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    @DisplayName("Preflight OPTIONS từ origin khác không được phép -> không có header Access-Control-Allow-Origin")
    void corsDisallowedOrigin_doesNotReturnAllowOriginHeader() throws Exception {
        mockMvc.perform(options("/api/v1/health")
                .header(HttpHeaders.ORIGIN, "http://forbidden.test")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
