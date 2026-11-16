/**
 * Phân hệ chẩn đoán AI (AI Diagnostics Subsystem).
 * Backend gọi microservice AI Python qua HTTP (HttpAiServiceClient, app.ai.mode=http là mặc định);
 * model do microservice chọn (hiện là gemini-2.5-flash). Kết quả hợp lệ được lưu vào
 * PROJECT.latest_ai_analysis (JSONB). Không gọi được dịch vụ AI hoặc response sai khuôn thì trả 503
 * AI_SERVICE_UNAVAILABLE, không tạo dữ liệu giả. app.ai.mode=mock (AiServiceClientImpl) chỉ dùng để demo.
 * Hợp đồng: docs/specs/ai-service-contract.md.
 */
package com.pipeline.wpe.service.ai;
