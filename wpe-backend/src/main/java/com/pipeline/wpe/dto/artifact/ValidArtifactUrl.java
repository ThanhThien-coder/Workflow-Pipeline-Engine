package com.pipeline.wpe.dto.artifact;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Link tài nguyên phải là http/https hợp lệ, có host, tối đa 500 ký tự (C4). Xem {@link ArtifactUrlValidator}.
 */
@Documented
@Constraint(validatedBy = ArtifactUrlValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidArtifactUrl {

    String message() default "Đường dẫn URL phải là link http:// hoặc https:// hợp lệ (có tên miền), tối đa 500 ký tự";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
