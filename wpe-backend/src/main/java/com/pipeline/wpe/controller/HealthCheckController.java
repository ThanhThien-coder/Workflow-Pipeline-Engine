package com.pipeline.wpe.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
@Tag(name = "10. System Health", description = "Kiểm tra tình trạng hoạt động của hệ thống và Database")
public class HealthCheckController {

    private final JdbcTemplate jdbcTemplate;

    @GetMapping
    @Operation(summary = "Kiểm tra sức khỏe hệ thống", description = "Trả về trạng thái server, thời gian hệ thống và kết nối PostgreSQL.")
    public ResponseEntity<Map<String, Object>> checkHealth() {
        String dbStatus = "CONNECTED";
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        } catch (Exception e) {
            dbStatus = "DISCONNECTED: " + e.getMessage();
        }

        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Workflow-Pipeline-Engine",
                "version", "0.0.1-SNAPSHOT",
                "database", dbStatus,
                "timestamp", Instant.now().toString()
        ));
    }
}
