package com.pipeline.wpe.exception;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    List<ValidationErrorItem> validationErrors,
    List<String> cycleNodes
) {
    public record ValidationErrorItem(
        String field,
        Object rejectedValue,
        String reason
    ) {}

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(Instant.now(), status, error, message, path, null, null);
    }

    public static ErrorResponse withCycle(int status, String error, String message, String path, List<String> cycleNodes) {
        return new ErrorResponse(Instant.now(), status, error, message, path, null, cycleNodes);
    }
}
