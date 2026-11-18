import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.engine.cpm import calculate_cpm
from app.engine.metrics import detect_bottlenecks_and_metrics, parse_iso_datetime
from app.schemas.request import AiDiagnosisRequest, NodeDto
from app.schemas.response import (
    ALLOWED_ACTIONS,
    ALLOWED_SEVERITIES,
    ALLOWED_TRAP_TYPES,
    ActionableAdviceItem,
    AiDiagnosisResponse,
    BottleneckItem,
    TaskTrapItem,
    TokenUsageDto,
)
from app.services.gemini_client import gemini_client

logger = logging.getLogger("wpe_ai.diagnosis")

MAX_ROOT_CAUSE_CHARS = 1000
DEFAULT_FALLBACK_WARNING = "AI is unavailable, showing rule-based analysis."


def _fallback_token_usage() -> TokenUsageDto:
    return TokenUsageDto(
        promptTokens=0,
        candidateTokens=0,
        thoughtsTokens=0,
        totalTokens=0,
        estimatedCostUsd=0.0,
        source="HEURISTIC_FALLBACK",
    )


def _default_continue_advice() -> ActionableAdviceItem:
    return ActionableAdviceItem(
        action="CONTINUE_PIPELINE",
        targetNodeCode="GENERAL",
        instruction="Maintain current execution pace along the CPM critical path.",
        priority="LOW",
    )


def _parse_and_validate_ai_result(
    gemini_result: Dict[str, Any],
    valid_node_codes: Set[str],
) -> Tuple[bool, List[TaskTrapItem], List[ActionableAdviceItem], Optional[str], Optional[TokenUsageDto]]:
    """
    Kiểm tra và lọc đầu ra của AI theo đúng Contract mục 4.1 (P3 & P6):
    - Nếu taskTraps hoặc actionableAdvice không phải list (vd: null, str, int) -> coi là sai kiểu, báo hỏng để fallback.
    - Lọc bỏ từng item AI bịa nodeCode / action / trapType / priority ngoài danh sách cho phép và ghi log.
    - Trích xuất rootCauseNotes thành trường riêng (P11).
    """
    raw_traps = gemini_result.get("taskTraps", [])
    raw_advice = gemini_result.get("actionableAdvice", [])

    if not isinstance(raw_traps, list):
        logger.warning("AI trả về taskTraps sai kiểu (%s). Chuyển sang Heuristic Fallback.", type(raw_traps).__name__)
        return False, [], [], None, None

    if not isinstance(raw_advice, list):
        logger.warning(
            "AI trả về actionableAdvice sai kiểu (%s). Chuyển sang Heuristic Fallback.", type(raw_advice).__name__
        )
        return False, [], [], None, None

    task_traps: List[TaskTrapItem] = []
    for trap in raw_traps:
        if not isinstance(trap, dict):
            logger.warning("Bỏ qua TaskTrap không phải object từ AI: %r", trap)
            continue
        node_code = trap.get("nodeCode")
        title = trap.get("title")
        trap_type = trap.get("trapType")
        suggestion = trap.get("suggestion")

        if (
            not isinstance(node_code, str)
            or node_code not in valid_node_codes
            or not isinstance(trap_type, str)
            or trap_type not in ALLOWED_TRAP_TYPES
            or not isinstance(title, str)
            or not isinstance(suggestion, str)
            or not suggestion.strip()
        ):
            logger.warning("Bỏ qua TaskTrap không hợp lệ từ AI (P3): %r", trap)
            continue

        task_traps.append(
            TaskTrapItem(
                nodeCode=node_code,
                title=title.strip() or node_code,
                trapType=trap_type,
                suggestion=suggestion.strip(),
            )
        )

    actionable_advice: List[ActionableAdviceItem] = []
    for advice in raw_advice:
        if not isinstance(advice, dict):
            logger.warning("Bỏ qua ActionableAdvice không phải object từ AI: %r", advice)
            continue
        action = advice.get("action")
        target_code = advice.get("targetNodeCode")
        instruction = advice.get("instruction")
        priority = advice.get("priority")

        if (
            not isinstance(action, str)
            or action not in ALLOWED_ACTIONS
            or not isinstance(target_code, str)
            or target_code not in valid_node_codes
            or not isinstance(priority, str)
            or priority not in ALLOWED_SEVERITIES
            or not isinstance(instruction, str)
            or not instruction.strip()
        ):
            logger.warning("Bỏ qua ActionableAdvice không hợp lệ từ AI (P3): %r", advice)
            continue

        actionable_advice.append(
            ActionableAdviceItem(
                action=action,
                targetNodeCode=target_code,
                instruction=instruction.strip(),
                priority=priority,
            )
        )

    raw_root_cause = gemini_result.get("rootCauseNotes")
    root_cause_notes: Optional[str] = None
    if isinstance(raw_root_cause, str) and raw_root_cause.strip():
        root_cause_notes = raw_root_cause.strip()[:MAX_ROOT_CAUSE_CHARS]

    token_usage: Optional[TokenUsageDto] = None
    raw_usage = gemini_result.get("_token_usage")
    if isinstance(raw_usage, dict):
        try:
            token_usage = TokenUsageDto(**raw_usage)
        except Exception as ex:
            logger.warning("Không đọc được _token_usage từ AI: %s", ex)

    return True, task_traps, actionable_advice, root_cause_notes, token_usage


class DiagnosisService:
    @staticmethod
    def process_diagnosis(request: AiDiagnosisRequest) -> AiDiagnosisResponse:
        eval_now = parse_iso_datetime(request.requestedAt) or datetime.now(timezone.utc)
        analyzed_at_iso = datetime.now(timezone.utc).isoformat()
        nodes = request.nodes or []
        dependencies = request.dependencies or []
        feedbacks = request.openFeedbacks or []
        valid_node_codes: Set[str] = {n.code for n in nodes if n.code} | {"GENERAL"}
        warnings: List[str] = []

        # =====================================================================
        # TẦNG 1: Thuật toán nội bộ (CPM + Metrics) - 0 Token, < 10ms
        # =====================================================================
        cpm_result = calculate_cpm(nodes, dependencies)
        bottlenecks, metrics, stalled_nodes = detect_bottlenecks_and_metrics(nodes, feedbacks, eval_now)

        # P8: Nếu đồ thị có chu trình -> criticalPath = [], thêm bottleneck HIGH & warning rõ các node trong chu trình
        if cpm_result.has_cycle:
            cycle_list_str = ", ".join(cpm_result.cycle_nodes) if cpm_result.cycle_nodes else "unknown"
            cycle_msg = (
                f"Dependency cycle detected among nodes: {cycle_list_str}. "
                "CPM critical path cannot be computed until the cycle is removed."
            )
            warnings.append(cycle_msg)
            cycle_node_code = cpm_result.cycle_nodes[0] if cpm_result.cycle_nodes else "GENERAL"
            bottlenecks.insert(
                0,
                BottleneckItem(
                    nodeCode=cycle_node_code,
                    title="Dependency Cycle Detected",
                    reason=cycle_msg,
                    severity="HIGH",
                ),
            )

        # =====================================================================
        # TẦNG 2: Google Gemini AI (NLP & Semantic Reasoning)
        # =====================================================================
        critical_set = set(cpm_result.critical_path)
        candidate_nodes: List[NodeDto] = []
        seen_ids: Set[int] = set()
        for n in nodes:
            if n.code in critical_set or n in stalled_nodes or n.status in ("TODO", "IN_PROGRESS"):
                if n.id not in seen_ids:
                    candidate_nodes.append(n)
                    seen_ids.add(n.id)

        gemini_result = gemini_client.analyze_semantic_insights(
            project_name=request.projectName or "Untitled Project",
            critical_path_codes=cpm_result.critical_path,
            candidate_nodes=candidate_nodes,
            dependencies=dependencies,
            feedbacks=feedbacks,
            all_nodes=nodes,
        )

        task_traps: List[TaskTrapItem] = []
        actionable_advice: List[ActionableAdviceItem] = []
        root_cause_notes: Optional[str] = None
        token_usage: Optional[TokenUsageDto] = None
        ai_succeeded = False
        has_fallback_warning = False

        if isinstance(gemini_result, dict):
            if gemini_result.get("_rate_limit_hit"):
                rate_warn = gemini_result.get("_warning")
                if isinstance(rate_warn, str) and rate_warn.strip():
                    warnings.append(rate_warn.strip())
                    has_fallback_warning = True
                token_usage = _fallback_token_usage()
            else:
                try:
                    ok, parsed_traps, parsed_advice, parsed_notes, parsed_usage = _parse_and_validate_ai_result(
                        gemini_result, valid_node_codes
                    )
                    if ok:
                        ai_succeeded = True
                        task_traps = parsed_traps
                        actionable_advice = parsed_advice
                        root_cause_notes = parsed_notes
                        token_usage = parsed_usage or TokenUsageDto(source="GEMINI_API")
                    else:
                        warnings.append("AI returned an invalid response format. Showing rule-based analysis.")
                        has_fallback_warning = True
                        token_usage = _fallback_token_usage()
                except Exception as ex:
                    logger.warning("Lỗi đọc kết quả AI (%s). Chuyển sang Heuristic Fallback.", ex)
                    warnings.append("Failed to parse AI response. Showing rule-based analysis.")
                    has_fallback_warning = True
                    token_usage = _fallback_token_usage()
        else:
            token_usage = _fallback_token_usage()

        # =====================================================================
        # DỰ PHÒNG THÔNG MINH (Heuristic Fallback khi không có Key hoặc LLM lỗi)
        # =====================================================================
        if not ai_succeeded:
            response_source = "HEURISTIC_FALLBACK"
            # Q5: Khi source = HEURISTIC_FALLBACK luôn có 1 câu warning tiếng Anh ngắn
            if not has_fallback_warning:
                warnings.append(DEFAULT_FALLBACK_WARNING)

            for s_node in stalled_nodes:
                task_traps.append(
                    TaskTrapItem(
                        nodeCode=s_node.code,
                        title=s_node.title,
                        trapType="POTENTIAL_STALL",
                        suggestion="Consider splitting this task into smaller sub-tasks or pairing with another teammate.",
                    )
                )

            for s_node in stalled_nodes:
                actionable_advice.append(
                    ActionableAdviceItem(
                        action="SPLIT_NODE",
                        targetNodeCode=s_node.code,
                        instruction=f"Split task {s_node.code} into smaller deliverables to unblock downstream dependencies.",
                        priority="HIGH",
                    )
                )

            if feedbacks:
                actionable_advice.append(
                    ActionableAdviceItem(
                        action="RESOLVE_FEEDBACK",
                        targetNodeCode="GENERAL",
                        instruction=f"Resolve {len(feedbacks)} open feedback item(s) in the Feedback Queue.",
                        priority="HIGH",
                    )
                )
        else:
            response_source = "AI_SERVICE"

        # Q4: Không tạo bottleneck giả khi không có điểm nghẽn (bottlenecks = []).
        # Đảm bảo actionableAdvice luôn có ít nhất 1 item (kể cả khi Gemini trả hợp lệ nhưng bị lọc hết)
        # để giao diện không hiểu nhầm cả 3 mảng rỗng là "No diagnosis yet".
        if not actionable_advice:
            actionable_advice.append(_default_continue_advice())

        combined_warning = " · ".join(warnings) if warnings else None

        return AiDiagnosisResponse(
            analyzedAt=analyzed_at_iso,
            source=response_source,
            criticalPath=cpm_result.critical_path,
            bottlenecks=bottlenecks,
            taskTraps=task_traps,
            actionableAdvice=actionable_advice,
            metrics=metrics,
            warning=combined_warning,
            rootCauseNotes=root_cause_notes,
            tokenUsage=token_usage,
        )


diagnosis_service = DiagnosisService()
