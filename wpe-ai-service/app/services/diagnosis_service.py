from datetime import datetime, timezone
from typing import List, Dict, Any

from app.schemas.request import AiDiagnosisRequest, NodeDto
from app.schemas.response import (
    AiDiagnosisResponse,
    BottleneckItem,
    TaskTrapItem,
    ActionableAdviceItem,
    MetricsDto
)
from app.engine.cpm import calculate_cpm
from app.engine.metrics import detect_bottlenecks_and_metrics
from app.services.gemini_client import gemini_client

class DiagnosisService:
    @staticmethod
    def process_diagnosis(request: AiDiagnosisRequest) -> AiDiagnosisResponse:
        now = datetime.now(timezone.utc)
        nodes = request.nodes or []
        dependencies = request.dependencies or []
        feedbacks = request.openFeedbacks or []

        # =====================================================================
        # TẦNG 1: Thuật toán nội bộ (CPM + Metrics) - 0 Token, < 10ms
        # =====================================================================
        cpm_result = calculate_cpm(nodes, dependencies)
        bottlenecks, metrics, stalled_nodes = detect_bottlenecks_and_metrics(nodes, feedbacks, now)

        # =====================================================================
        # TẦNG 2: Google Gemini AI (NLP & Semantic Reasoning)
        # =====================================================================
        # Thu thập các candidate nodes cho LLM: gồm các node trên critical path và các node ngâm/quá hạn
        critical_set = set(cpm_result.critical_path)
        candidate_nodes: List[NodeDto] = []
        for n in nodes:
            if n.code in critical_set or n in stalled_nodes or n.status in ("TODO", "IN_PROGRESS"):
                if n not in candidate_nodes:
                    candidate_nodes.append(n)

        # Gọi Gemini phân tích ngữ nghĩa
        gemini_result = gemini_client.analyze_semantic_insights(
            project_name=request.projectName or "Dự án phần mềm",
            critical_path_codes=cpm_result.critical_path,
            candidate_nodes=candidate_nodes,
            dependencies=dependencies,
            feedbacks=feedbacks
        )

        task_traps: List[TaskTrapItem] = []
        actionable_advice: List[ActionableAdviceItem] = []

        if gemini_result:
            # 1. Trích xuất Task Traps từ Gemini
            for trap in gemini_result.get("taskTraps", []):
                try:
                    task_traps.append(TaskTrapItem(
                        nodeCode=trap.get("nodeCode", "GENERAL"),
                        title=trap.get("title", ""),
                        trapType=trap.get("trapType", "POTENTIAL_STALL"),
                        suggestion=trap.get("suggestion", "")
                    ))
                except Exception:
                    pass

            # 2. Trích xuất Actionable Advice từ Gemini
            for advice in gemini_result.get("actionableAdvice", []):
                try:
                    actionable_advice.append(ActionableAdviceItem(
                        action=advice.get("action", "CONTINUE_PIPELINE"),
                        targetNodeCode=advice.get("targetNodeCode", "GENERAL"),
                        instruction=advice.get("instruction", ""),
                        priority=advice.get("priority", "HIGH")
                    ))
                except Exception:
                    pass

            # 3. Làm giàu lý do Bottlenecks nếu Gemini có ghi chú Root Cause
            root_cause_notes = gemini_result.get("rootCauseNotes")
            if root_cause_notes and bottlenecks:
                bottlenecks[0].reason += f" [Cố vấn AI]: {root_cause_notes}"

        # =====================================================================
        # DỰ PHÒNG THÔNG MINH (Heuristic Fallback khi không có Key hoặc LLM lỗi)
        # =====================================================================
        if not task_traps:
            for s_node in stalled_nodes:
                task_traps.append(TaskTrapItem(
                    nodeCode=s_node.code,
                    title=s_node.title,
                    trapType="POTENTIAL_STALL",
                    suggestion="Nên phân rã nhỏ phạm vi công việc hoặc bổ sung người phối hợp pair-programming."
                ))

        if not actionable_advice:
            for s_node in stalled_nodes:
                actionable_advice.append(ActionableAdviceItem(
                    action="SPLIT_NODE",
                    targetNodeCode=s_node.code,
                    instruction=f"Tách tác vụ {s_node.code} thành 2 phần để giải phóng nhánh phụ thuộc.",
                    priority="HIGH"
                ))

            if feedbacks:
                actionable_advice.append(ActionableAdviceItem(
                    action="RESOLVE_FEEDBACK",
                    targetNodeCode="GENERAL",
                    instruction=f"Dự án hiện có {len(feedbacks)} ý kiến đóng góp chưa giải quyết tại Feedback Queue.",
                    priority="HIGH"
                ))

            if not actionable_advice:
                actionable_advice.append(ActionableAdviceItem(
                    action="CONTINUE_PIPELINE",
                    targetNodeCode="GENERAL",
                    instruction="Duy trì nhịp độ thực hiện tác vụ theo đúng đường găng CPM.",
                    priority="LOW"
                ))

        # Nếu không có điểm nghẽn nào, thêm điểm an toàn
        if not bottlenecks:
            first_code = cpm_result.critical_path[0] if cpm_result.critical_path else (nodes[0].code if nodes else "N/A")
            first_title = nodes[0].title if nodes else "Tác vụ khởi đầu"
            bottlenecks.append(BottleneckItem(
                nodeCode=first_code,
                title=first_title,
                reason="Tiến độ đang trong tầm kiểm soát ổn định (DriftScore < 20%).",
                severity="LOW"
            ))

        return AiDiagnosisResponse(
            analyzedAt=now.isoformat(),
            source="AI_SERVICE",
            criticalPath=cpm_result.critical_path,
            bottlenecks=bottlenecks,
            taskTraps=task_traps,
            actionableAdvice=actionable_advice,
            metrics=metrics
        )

diagnosis_service = DiagnosisService()
