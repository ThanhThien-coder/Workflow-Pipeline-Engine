package com.pipeline.wpe.dto.response.node;

import java.util.List;

/** S04: ảnh hưởng của việc mở lại một task Done lên các task con trực tiếp. */
public record ReopenImpactResponse(
    String taskCode,
    List<Child> children
) {
    /** willRelock = true: task con đang TODO sẽ bị khóa lại (LOCKED) khi cha được mở lại. */
    public record Child(String id, String code, String title, String status, boolean willRelock) {}
}
