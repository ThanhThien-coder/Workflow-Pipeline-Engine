package com.pipeline.wpe.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;

@Configuration
public class UploadResourceConfig implements WebMvcConfigurer {

    private final String uploadDir;

    public UploadResourceConfig(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadDir = uploadDir;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path avatarsPath = Paths.get(uploadDir, "avatars").toAbsolutePath().normalize();
        String location = avatarsPath.toUri().toString();
        if (!location.endsWith("/")) {
            location += "/";
        }
        registry.addResourceHandler("/uploads/avatars/**")
            .addResourceLocations(location)
            .setCacheControl(CacheControl.maxAge(Duration.ofDays(7)));
    }
}
