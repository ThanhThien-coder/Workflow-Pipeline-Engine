package com.pipeline.wpe.exception;

import lombok.Getter;

import java.util.List;

@Getter
public class CycleDetectedException extends RuntimeException {
    private final List<String> cycleNodes;

    public CycleDetectedException(String message, List<String> cycleNodes) {
        super(message);
        this.cycleNodes = cycleNodes != null ? cycleNodes : List.of();
    }
}
