package com.pipeline.wpe.security;

import com.pipeline.wpe.config.WebCorsConfig;
import com.pipeline.wpe.controller.HealthCheckController;
import com.pipeline.wpe.repository.UserRepository;
import com.pipeline.wpe.service.auth.JwtService;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Import;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.Method;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = HealthCheckController.class)
@Import({SecurityConfig.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class, WebCorsConfig.class})
@TestPropertySource(properties = {
    "app.security.debug-user-id-enabled=false"
})
class SecurityRulesTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private JdbcTemplate jdbcTemplate;

    record Endpoint(HttpMethod method, String path) {}
    record EndpointMapping(HttpMethod httpMethod, String[] paths) {}

    static List<Endpoint> scanSecuredEndpoints() {
        ClassPathScanningCandidateComponentProvider scanner =
            new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));

        Set<BeanDefinition> candidates = scanner.findCandidateComponents("com.pipeline.wpe.controller");
        Set<Endpoint> securedEndpoints = new LinkedHashSet<>();

        for (BeanDefinition beanDef : candidates) {
            try {
                Class<?> clazz = Class.forName(beanDef.getBeanClassName());
                String[] basePaths = extractClassPaths(clazz);

                for (Method method : clazz.getDeclaredMethods()) {
                    List<EndpointMapping> mappings = extractMethodMappings(method);
                    for (EndpointMapping mapping : mappings) {
                        for (String basePath : basePaths) {
                            for (String subPath : mapping.paths) {
                                String combined = combine(basePath, subPath);
                                String resolved = combined.replaceAll("\\{[^}]+\\}", "1");
                                if (!isPublic(resolved)) {
                                    securedEndpoints.add(new Endpoint(mapping.httpMethod, resolved));
                                }
                            }
                        }
                    }
                }
            } catch (ClassNotFoundException e) {
                throw new RuntimeException("Không thể nạp class: " + beanDef.getBeanClassName(), e);
            }
        }
        return new ArrayList<>(securedEndpoints);
    }

    private static String[] extractClassPaths(Class<?> clazz) {
        RequestMapping mapping = clazz.getAnnotation(RequestMapping.class);
        if (mapping == null) {
            return new String[]{""};
        }
        if (mapping.value().length > 0) {
            return mapping.value();
        }
        if (mapping.path().length > 0) {
            return mapping.path();
        }
        return new String[]{""};
    }

    private static List<EndpointMapping> extractMethodMappings(Method method) {
        List<EndpointMapping> list = new ArrayList<>();

        GetMapping get = method.getAnnotation(GetMapping.class);
        if (get != null) {
            list.add(new EndpointMapping(HttpMethod.GET, getPaths(get.value(), get.path())));
        }
        PostMapping post = method.getAnnotation(PostMapping.class);
        if (post != null) {
            list.add(new EndpointMapping(HttpMethod.POST, getPaths(post.value(), post.path())));
        }
        PutMapping put = method.getAnnotation(PutMapping.class);
        if (put != null) {
            list.add(new EndpointMapping(HttpMethod.PUT, getPaths(put.value(), put.path())));
        }
        PatchMapping patch = method.getAnnotation(PatchMapping.class);
        if (patch != null) {
            list.add(new EndpointMapping(HttpMethod.PATCH, getPaths(patch.value(), patch.path())));
        }
        DeleteMapping delete = method.getAnnotation(DeleteMapping.class);
        if (delete != null) {
            list.add(new EndpointMapping(HttpMethod.DELETE, getPaths(delete.value(), delete.path())));
        }
        RequestMapping req = method.getAnnotation(RequestMapping.class);
        if (req != null) {
            String[] paths = getPaths(req.value(), req.path());
            RequestMethod[] methods = req.method().length > 0 ? req.method() : new RequestMethod[]{RequestMethod.GET};
            for (RequestMethod rm : methods) {
                list.add(new EndpointMapping(HttpMethod.valueOf(rm.name()), paths));
            }
        }
        return list;
    }

    private static String[] getPaths(String[] value, String[] path) {
        if (value != null && value.length > 0) return value;
        if (path != null && path.length > 0) return path;
        return new String[]{""};
    }

    private static String combine(String base, String sub) {
        if (base == null) base = "";
        if (sub == null) sub = "";
        base = base.trim();
        sub = sub.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (!sub.isEmpty() && !sub.startsWith("/")) {
            sub = "/" + sub;
        }
        String combined = base + sub;
        if (!combined.startsWith("/")) {
            combined = "/" + combined;
        }
        if (combined.length() > 1 && combined.endsWith("/")) {
            combined = combined.substring(0, combined.length() - 1);
        }
        return combined;
    }

    private static boolean isPublic(String path) {
        return path.startsWith("/api/v1/auth/") || path.equals("/api/v1/auth")
            || path.startsWith("/api/auth/") || path.equals("/api/auth")
            || path.startsWith("/api/v1/guest/") || path.equals("/api/v1/guest")
            || path.startsWith("/api/guest/") || path.equals("/api/guest")
            || path.startsWith("/api/v1/health")
            || path.startsWith("/api/health")
            || path.startsWith("/swagger-ui")
            || path.startsWith("/v3/api-docs")
            || path.equals("/error");
    }

    static Stream<Arguments> securedEndpoints() {
        List<Endpoint> endpoints = scanSecuredEndpoints();
        return endpoints.stream().map(ep -> Arguments.of(ep.method(), ep.path()));
    }

    @ParameterizedTest(name = "[{index}] {0} {1}")
    @MethodSource("securedEndpoints")
    @DisplayName("Endpoint bảo mật: không gửi token -> 401 UNAUTHORIZED")
    void securedEndpoint_withoutToken_returns401Unauthorized(HttpMethod method, String path) throws Exception {
        MockHttpServletRequestBuilder requestBuilder = switch (method.name()) {
            case "GET" -> MockMvcRequestBuilders.get(path);
            case "POST" -> MockMvcRequestBuilders.post(path);
            case "PUT" -> MockMvcRequestBuilders.put(path);
            case "PATCH" -> MockMvcRequestBuilders.patch(path);
            case "DELETE" -> MockMvcRequestBuilders.delete(path);
            case "OPTIONS" -> MockMvcRequestBuilders.options(path);
            case "HEAD" -> MockMvcRequestBuilders.head(path);
            default -> MockMvcRequestBuilders.request(method, path);
        };

        mockMvc.perform(requestBuilder)
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.message").value("Please sign in to do this."));
    }

    @Test
    @DisplayName("Số lượng endpoint tự quét phải > 50 để chắc chắn không quét rỗng")
    void scannedEndpointsCount_isGreaterThan50() {
        List<Endpoint> endpoints = scanSecuredEndpoints();
        System.out.println("Đã quét được " + endpoints.size() + " secured endpoints.");
        assertThat(endpoints.size()).isGreaterThan(50);
    }

    @Test
    @DisplayName("Đường công khai không token -> status KHÁC 401")
    void publicEndpoints_withoutToken_statusNot401() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
            .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));

        mockMvc.perform(get("/api/v1/guest/x/overview"))
            .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));

        mockMvc.perform(get("/v3/api-docs"))
            .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));
    }

    @Test
    @DisplayName("Header Authorization với token không hợp lệ -> 401 TOKEN_EXPIRED")
    void invalidBearerToken_returns401TokenExpired() throws Exception {
        when(jwtService.parseAccessToken("example-bad-token")).thenThrow(new JwtException("Invalid token"));

        mockMvc.perform(get("/api/v1/projects/1/graph")
                .header(HttpHeaders.AUTHORIZATION, "Bearer example-bad-token"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"))
            .andExpect(jsonPath("$.message").value("Your access token is invalid or has expired. Please refresh it or sign in again."));
    }

    @Test
    @DisplayName("SSE với access_token query không hợp lệ và Accept text/event-stream -> 401 TOKEN_EXPIRED (không phải 500)")
    void sseQueryTokenInvalid_returns401TokenExpired() throws Exception {
        when(jwtService.parseAccessToken("example-bad-token")).thenThrow(new JwtException("Invalid token"));

        mockMvc.perform(get("/api/v1/realtime/subscribe")
                .param("access_token", "example-bad-token")
                .header(HttpHeaders.ACCEPT, MediaType.TEXT_EVENT_STREAM_VALUE))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("TOKEN_EXPIRED"))
            .andExpect(jsonPath("$.message").value("Your access token is invalid or has expired. Please refresh it or sign in again."));
    }

    @Test
    @DisplayName("Header X-Debug-User-Id: 2 khi debug TẮT -> vẫn 401 UNAUTHORIZED")
    void debugHeaderWhenDisabled_returns401Unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/projects/1/graph")
                .header("X-Debug-User-Id", "2"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("UNAUTHORIZED"))
            .andExpect(jsonPath("$.message").value("Please sign in to do this."));
    }
}
