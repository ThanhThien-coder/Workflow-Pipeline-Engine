package com.pipeline.wpe.dto.response.profile;

/** 200 { "success": true, "message": "Password updated successfully" } (integration map 2.2). */
public record PasswordChangedResponse(boolean success, String message) {}
