package com.pipeline.wpe.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * A5: phục vụ file tải lên (ảnh đại diện) tại /uploads/** từ thư mục ${app.upload.dir:uploads}.
 * VD: /uploads/avatars/2-abc.png -> <app.upload.dir>/avatars/2-abc.png.
 */
@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    private final String uploadLocation;

    public StaticResourceConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        String uri = Paths.get(uploadDir).toAbsolutePath().normalize().toUri().toString();
        this.uploadLocation = uri.endsWith("/") ? uri : uri + "/";
    }

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
            .addResourceLocations(uploadLocation);
    }
}
