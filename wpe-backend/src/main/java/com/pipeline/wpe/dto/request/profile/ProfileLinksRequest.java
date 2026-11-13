package com.pipeline.wpe.dto.request.profile;

import jakarta.validation.constraints.Size;

/** Liên kết ngoài; chuỗi rỗng hoặc null = chưa đặt. */
public record ProfileLinksRequest(
    @Size(max = 500, message = "Link must be at most 500 characters") String github,
    @Size(max = 500, message = "Link must be at most 500 characters") String linkedin,
    @Size(max = 500, message = "Link must be at most 500 characters") String website
) {}
