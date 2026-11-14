from typing import List, Optional, Dict, Any
from app.schemas.scaffold import (
    ScaffoldRequest,
    ScaffoldResponse,
    ScaffoldPhase,
    ScaffoldNode,
    ScaffoldDependency
)
from app.services.gemini_client import gemini_client

class ScaffoldService:
    @staticmethod
    def generate_scaffold(request: ScaffoldRequest) -> ScaffoldResponse:
        """
        Khởi tạo đồ thị quy trình 2 tầng từ mô tả yêu cầu bằng LLM Gemini.
        Có sẵn Fallback mẫu chuẩn công nghiệp nếu chưa có API Key.
        """
        # Thử gọi Gemini sinh cấu trúc đồ thị
        llm_data = gemini_client.scaffold_dag(
            prompt=request.prompt,
            tech_stack=request.techStack,
            max_nodes=request.maxNodes
        )

        if llm_data and "phases" in llm_data and "nodes" in llm_data:
            try:
                phases = [ScaffoldPhase(**p) for p in llm_data.get("phases", [])]
                nodes = [ScaffoldNode(**n) for n in llm_data.get("nodes", [])]
                dependencies = [ScaffoldDependency(**d) for d in llm_data.get("dependencies", [])]
                return ScaffoldResponse(
                    domain=llm_data.get("domain", "Hệ thống phần mềm"),
                    targetAudience=llm_data.get("targetAudience", "Người dùng cuối & Quản trị viên"),
                    techStack=llm_data.get("techStack", request.techStack or ["Spring Boot 3", "React", "PostgreSQL"]),
                    phases=phases,
                    nodes=nodes,
                    dependencies=dependencies
                )
            except Exception:
                pass

        # Heuristic Scaffolding Fallback nếu không có Key
        tech = request.techStack or ["Spring Boot 3", "React", "PostgreSQL"]
        return ScaffoldResponse(
            domain="Hệ thống phần mềm tự động hóa",
            targetAudience="Người dùng cuối & Quản trị viên dự án",
            techStack=tech,
            phases=[
                ScaffoldPhase(tempId="p1", name="1. Khảo sát & Thiết kế Kiến trúc", orderIndex=1),
                ScaffoldPhase(tempId="p2", name="2. Phát triển Dịch vụ Cốt lõi", orderIndex=2),
                ScaffoldPhase(tempId="p3", name="3. Tích hợp Giao diện & API", orderIndex=3),
                ScaffoldPhase(tempId="p4", name="4. Kiểm thử & Triển khai", orderIndex=4),
            ],
            nodes=[
                ScaffoldNode(tempId="n1", phaseTempId="p1", title="Đặc tả CSDL 3NF & API Contract", estimatedHours=16),
                ScaffoldNode(tempId="n2", phaseTempId="p1", title="Thiết kế Wireframe & UI Flow", estimatedHours=12),
                ScaffoldNode(tempId="n3", phaseTempId="p2", title="Xây dựng Auth & Quản lý người dùng", estimatedHours=24),
                ScaffoldNode(tempId="n4", phaseTempId="p2", title="Xây dựng API Nghiệp vụ chính", estimatedHours=32),
                ScaffoldNode(tempId="n5", phaseTempId="p3", title="Phát triển Giao diện React Frontend", estimatedHours=40),
                ScaffoldNode(tempId="n6", phaseTempId="p4", title="Kiểm thử tích hợp & Viết tài liệu", estimatedHours=16),
            ],
            dependencies=[
                ScaffoldDependency(parentTempId="n1", childTempId="n3"),
                ScaffoldDependency(parentTempId="n1", childTempId="n4"),
                ScaffoldDependency(parentTempId="n2", childTempId="n5"),
                ScaffoldDependency(parentTempId="n3", childTempId="n5"),
                ScaffoldDependency(parentTempId="n4", childTempId="n5"),
                ScaffoldDependency(parentTempId="n5", childTempId="n6"),
            ]
        )

scaffold_service = ScaffoldService()
