package com.pipeline.wpe.dto.request.template;

import com.fasterxml.jackson.annotation.JsonCreator;
import java.util.Collections;
import java.util.Map;

public record ValidateTemplateGraphRequest(
    Map<String, Object> graphData
) {
    @JsonCreator
    public static ValidateTemplateGraphRequest fromJson(Map<String, Object> map) {
        if (map != null && map.get("graphData") instanceof Map<?, ?> inner) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = (Map<String, Object>) inner;
            return new ValidateTemplateGraphRequest(casted);
        }
        return new ValidateTemplateGraphRequest(map != null ? map : Collections.emptyMap());
    }
}

