package com.pipeline.wpe.service.maintenance;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Chạy 1 lần khi backend khởi động (sau Flyway). Tắt bằng CLEANUP_ORPHAN_NODES=false.
 * Lỗi chỉ ghi log ERROR, không làm backend dừng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrphanNodeCleanupRunner implements ApplicationRunner {

    private final OrphanNodeCleanupService cleanupService;

    @Value("${app.maintenance.cleanup-orphan-nodes:true}")
    private boolean enabled;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            log.info("Bỏ qua dọn task mồ côi (app.maintenance.cleanup-orphan-nodes=false).");
            return;
        }
        try {
            int removed = cleanupService.cleanup();
            log.info("Dọn task mồ côi xong: {} node đã xóa.", removed);
        } catch (Exception ex) {
            log.error("Dọn task mồ côi thất bại, backend vẫn khởi động bình thường.", ex);
        }
    }
}
