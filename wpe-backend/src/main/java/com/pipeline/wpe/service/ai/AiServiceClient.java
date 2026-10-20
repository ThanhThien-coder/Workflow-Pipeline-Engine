package com.pipeline.wpe.service.ai;

import com.pipeline.wpe.entity.NodeEntity;
import com.pipeline.wpe.entity.ProjectEntity;
import com.pipeline.wpe.entity.ProjectFeedbackEntity;

import java.util.List;
import java.util.Map;

/**
 * Interface cho việc kết nối sang dịch vụ AI (AI Microservice của nhóm AI / Gemini API).
 * Khi nhóm AI gửi contract/endpoint chính thức, ta sẽ cấu hình HTTP client trong class triển khai của interface này.
 */
public interface AiServiceClient {

    /**
     * Gửi dữ liệu đồ thị và sự cố để AI phân tích chẩn đoán.
     *
     * @param project Dự án cần chẩn đoán
     * @param nodes Danh sách các nút công việc
     * @param openFeedbacks Danh sách các góp ý chưa giải quyết
     * @return Dữ liệu JSON chẩn đoán sự cố theo cấu trúc chuẩn
     */
    Map<String, Object> requestDiagnosis(ProjectEntity project, List<NodeEntity> nodes, List<ProjectFeedbackEntity> openFeedbacks);
}
