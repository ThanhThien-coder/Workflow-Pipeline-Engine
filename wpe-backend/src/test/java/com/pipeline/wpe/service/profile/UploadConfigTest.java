package com.pipeline.wpe.service.profile;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Giữ cấu hình upload đúng đặc tả A5. resolve-lazily = true để MaxUploadSizeExceededException được ném lúc
 * controller đọc tham số 'file' (đã biết handler) nên @ExceptionHandler trong UserProfileController bắt được
 * và trả 400 FILE_TOO_LARGE, không rơi vào handler Exception chung (500).
 */
class UploadConfigTest {

    private Properties applicationYml() {
        YamlPropertiesFactoryBean factory = new YamlPropertiesFactoryBean();
        factory.setResources(new ClassPathResource("application.yml"));
        return factory.getObject();
    }

    @Test
    @DisplayName("application.yml: multipart tối đa 2MB, phân tích lười, thư mục upload mặc định 'uploads'")
    void multipartSettings() {
        Properties props = applicationYml();
        assertThat(props.getProperty("spring.servlet.multipart.max-file-size")).isEqualTo("2MB");
        assertThat(props.getProperty("spring.servlet.multipart.resolve-lazily")).isEqualTo("true");
        assertThat(props.getProperty("app.upload.dir")).isEqualTo("${APP_UPLOAD_DIR:uploads}");
    }
}
