package com.pipeline.wpe.controller;

import com.pipeline.wpe.service.ai.AiDiagnosticService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "09. AI Diagnostics & Trajectory", description = "Phân hệ chẩn đoán AI bấm nút chủ động (On-Demand AI Diagnosis) & Báo cáo độ lệch quỹ đạo")
public class AiDiagnosticController {

    private final AiDiagnosticService aiDiagnosticService;

    @GetMapping({"/api/v1/projects/{id}/ai-analysis", "/api/projects/{id}/ai-analysis"})
    @Operation(summary = "9.1 Lấy bản ghi phân tích đã lưu từ JSONB PROJECT.latest_ai_analysis",
               description = "Đọc dữ liệu phân tích AI đã được cache sẵn trong CSDL với độ trễ 1ms khi mở Overview.")
    public ResponseEntity<Map<String, Object>> getLatestAiAnalysis(@PathVariable("id") Long id) {
        Map<String, Object> response = aiDiagnosticService.getLatestAnalysis(id);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/api/v1/projects/{id}/ai-diagnostics", "/api/projects/{id}/ai-diagnostics"})
    @Operation(summary = "9.2 Bấm nút 'AI Diagnosis' kích hoạt phân tích mới (có Cooldown 3-5 phút)",
               description = "Kích hoạt phân tích AI đồ thị quy trình và tính toán đường găng CPM. Trả về HTTP 429 nếu vi phạm thời gian giãn cách Cooldown.")
    public ResponseEntity<Map<String, Object>> triggerAiDiagnostics(@PathVariable("id") Long id) {
        Map<String, Object> response = aiDiagnosticService.triggerAiDiagnostics(id);
        return ResponseEntity.ok(response);
    }
}
