package com.pipeline.wpe.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI openAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Workflow Pipeline Engine (WPE) — REST API")
                        .description("Hệ thống quản lý quy trình công việc theo mô hình đồ thị có hướng không chu trình (DAG) và FSM State Machine kết hợp trợ lý AI Gemini.")
                        .version("v1.0.0")
                        .contact(new Contact().name("WPE Engineering Team").email("dev@pipeline.engine"))
                        .license(new License().name("Apache 2.0").url("https://spring.io/")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Nhập Access Token JWT (không cần gõ chữ Bearer)")));
    }
}
