import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types

from app.config import settings
from app.schemas.request import NodeDto, DependencyDto, FeedbackDto
from app.schemas.response import TaskTrapItem, ActionableAdviceItem, BottleneckItem

logger = logging.getLogger("wpe_ai.gemini")

class GeminiClient:
    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._init_client()

    def _init_client(self):
        if settings.has_gemini_key:
            try:
                self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("Khởi tạo Google Gemini Client thành công với model: %s", settings.GEMINI_MODEL)
            except Exception as ex:
                logger.warning("Không thể khởi tạo Gemini Client: %s", ex)
                self._client = None
        else:
            logger.info("Chưa cấu hình GEMINI_API_KEY hoặc dùng key mặc định. Hệ thống sẽ dùng Heuristic Fallback.")

    def analyze_semantic_insights(
        self,
        project_name: str,
        critical_path_codes: List[str],
        candidate_nodes: List[NodeDto],
        dependencies: List[DependencyDto],
        feedbacks: List[FeedbackDto]
    ) -> Optional[Dict[str, Any]]:
        """
        Gọi Google Gemini API phân tích ngữ nghĩa 3 bài toán cốt lõi:
        1. Semantic Task Trap & Smart Decomposition
        2. Root-Cause Synthesizer (từ Feedback và nút nghẽn)
        3. Semantic Dependency & Parallelization Recommender
        """
        if not self._client:
            return None

        # Rút trích thông tin súc tích để tiết kiệm token
        nodes_summary = [
            {
                "code": n.code,
                "title": n.title,
                "status": n.status,
                "estimatedHours": n.estimatedHours,
                "isOverdue": n.isOverdue,
                "joinPolicy": n.joinPolicy
            }
            for n in candidate_nodes[:15]  # Giới hạn 15 node quan trọng nhất
        ]

        feedbacks_summary = [
            {
                "nodeId": fb.nodeId,
                "role": fb.reviewerRole,
                "content": fb.content
            }
            for fb in feedbacks[:10]
        ]

        deps_summary = [
            {"parent": d.parentNodeId, "child": d.childNodeId}
            for d in dependencies[:20]
        ]

        prompt = f"""
Bạn là Trợ lý Cố vấn Kỹ thuật Cao cấp (Technical Project Advisor) cho dự án phần mềm "{project_name}".
Hãy phân tích dữ liệu đồ thị quy trình và đưa ra chẩn đoán chính xác bằng tiếng Việt.

[DỮ LIỆU ĐỒ THỊ VÀ TIẾN ĐỘ]:
- Đường găng CPM (Critical Path): {json.dumps(critical_path_codes)}
- Các task cần chú ý: {json.dumps(nodes_summary, ensure_ascii=False)}
- Quan hệ phụ thuộc: {json.dumps(deps_summary)}
- Ý kiến đóng góp chưa giải quyết (Feedback Queue): {json.dumps(feedbacks_summary, ensure_ascii=False)}

[NHIỆM VỤ PHÂN TÍCH]:
1. TASK BẪY & PHÂN RÃ (Task Trap & Decomposition):
   - Đọc tên và ước tính giờ. Nếu có task có phạm vi quá ôm đồm (Scope Creep) hoặc quá nặng mà không khả thi, hãy chỉ định trapType ("SCOPE_CREEP" hoặc "POTENTIAL_STALL") và gợi ý phân rã.
   - Tạo action "SPLIT_NODE" với instruction cụ thể (ví dụ: "Tách thành 2-3 sub-task nhỏ: ...").

2. NGUYÊN NHÂN GỐC RỄ (Root-Cause Synthesizer):
   - Nếu có Feedback của Giáo viên/Khách hoặc task trên Critical Path bị quá hạn, hãy đúc kết nguyên nhân thực sự khiến dự án chậm.
   - Tạo action "RESOLVE_FEEDBACK" hoặc cập nhật lý do cụ thể.

3. ĐỀ XUẤT SONG SONG HÓA (Parallelization Recommender):
   - Nếu phát hiện 2 task đang phụ thuộc tuần tự nhưng về mặt kỹ thuật có thể làm độc lập (ví dụ: Viết Docs và Vẽ UI, hoặc Code API độc lập), hãy đề xuất action "PARALLELIZE".

[QUY TẮC BẮT BUỘC]:
- CẤM đưa ra lời khuyên chung chung như "cố gắng giao tiếp", "họp thêm".
- BẮT BUỘC trả về đúng định dạng JSON theo schema dưới đây.

JSON SCHEMA:
{{
  "taskTraps": [
    {{
      "nodeCode": "Mã node",
      "title": "Tên node",
      "trapType": "SCOPE_CREEP | POTENTIAL_STALL | UNREALISTIC_DEADLINE",
      "suggestion": "Gợi ý phân rã ngắn gọn"
    }}
  ],
  "actionableAdvice": [
    {{
      "action": "SPLIT_NODE | RESOLVE_FEEDBACK | PARALLELIZE | CONTINUE_PIPELINE",
      "targetNodeCode": "Mã node hoặc GENERAL",
      "instruction": "Hướng dẫn hành động cụ thể",
      "priority": "HIGH | MEDIUM | LOW"
    }}
  ],
  "rootCauseNotes": "Tổng kết ngắn gọn nguyên nhân nghẽn (1-2 câu)"
}}
"""

        try:
            response = self._client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json"
                )
            )

            if response and response.text:
                result_json = json.loads(response.text)
                return result_json
            return None

        except Exception as ex:
            logger.warning("Lỗi khi gọi Google Gemini API: %s. Kích hoạt Heuristic Fallback.", ex)
            return None

    def scaffold_dag(self, prompt: str, tech_stack: Optional[List[str]], max_nodes: int = 20) -> Optional[Dict[str, Any]]:
        """
        Tính năng 1: Prompt-to-DAG (Sinh đồ thị 2 tầng từ mô tả yêu cầu).
        """
        if not self._client:
            return None

        tech_text = ", ".join(tech_stack) if tech_stack else "Phù hợp với dự án phần mềm tiêu chuẩn"
        system_prompt = f"""
Bạn là Kiến trúc sư Hệ thống (Software Workflow Architect).
Người dùng muốn tạo quy trình phát triển cho bài toán sau:
"{prompt}"
Ngăn xếp công nghệ dự kiến: {tech_text}.

Hãy sinh cấu trúc đồ thị DAG gồm 3-4 giai đoạn (Phases), tối đa {max_nodes} Nodes cốt lõi, và các cung phụ thuộc (Dependencies) hợp lý toán học.
Đảm bảo đồ thị phi chu trình (Acyclic).

JSON SCHEMA BẮT BUỘC:
{{
  "domain": "Lĩnh vực bài toán",
  "targetAudience": "Đối tượng người dùng",
  "techStack": ["Công nghệ 1", "Công nghệ 2"],
  "phases": [
    {{"tempId": "p1", "name": "1. Khảo sát & Thiết kế", "orderIndex": 1}},
    {{"tempId": "p2", "name": "2. Phát triển Dịch vụ Cốt lõi", "orderIndex": 2}}
  ],
  "nodes": [
    {{"tempId": "n1", "phaseTempId": "p1", "title": "Thiết kế CSDL 3NF", "estimatedHours": 16}},
    {{"tempId": "n2", "phaseTempId": "p2", "title": "Xây dựng RESTful API", "estimatedHours": 24}}
  ],
  "dependencies": [
    {{"parentTempId": "n1", "childTempId": "n2"}}
  ]
}}
"""
        try:
            response = self._client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=system_prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json"
                )
            )
            if response and response.text:
                return json.loads(response.text)
            return None
        except Exception as ex:
            logger.warning("Lỗi Prompt-to-DAG qua Gemini: %s", ex)
            return None

gemini_client = GeminiClient()
