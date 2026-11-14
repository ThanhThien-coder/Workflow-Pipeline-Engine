from typing import List, Dict, Any, Tuple
from datetime import datetime, timezone
from app.schemas.request import NodeDto, FeedbackDto
from app.schemas.response import BottleneckItem, MetricsDto
from app.config import settings

def parse_iso_datetime(dt_str: str | None) -> datetime | None:
    if not dt_str:
        return None
    try:
        # Hỗ trợ cả Z và +00:00
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def detect_bottlenecks_and_metrics(
    nodes: List[NodeDto],
    open_feedbacks: List[FeedbackDto],
    now: datetime | None = None
) -> Tuple[List[BottleneckItem], MetricsDto, List[NodeDto]]:
    """
    TẦNG 1: Phân tích định lượng chạy cục bộ (< 10ms, tốn 0 token).
    - Phát hiện Stalled Nodes (ngâm quá 2.5x thời gian ước lượng).
    - Phát hiện Overdue Nodes (quá hạn chót).
    - Tính Target Velocity, Actual Velocity, và Drift Score.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    bottlenecks: List[BottleneckItem] = []
    stalled_or_risky_nodes: List[NodeDto] = []

    uncompleted_count = 0
    completed_count = 0
    max_due_date: datetime | None = None

    for node in nodes:
        duration_hours = float(node.estimatedHours) if (node.estimatedHours and node.estimatedHours > 0) else float(settings.DEFAULT_NODE_HOURS)
        is_done = (node.status == "DONE")
        
        if is_done:
            completed_count += 1
        else:
            uncompleted_count += 1

        due_dt = parse_iso_datetime(node.dueDate)
        if due_dt and (max_due_date is None or due_dt > max_due_date):
            max_due_date = due_dt

        # 1. Kiểm tra Overdue (Quá hạn)
        is_node_overdue = False
        if not is_done:
            if node.isOverdue:
                is_node_overdue = True
            elif due_dt and due_dt < now:
                is_node_overdue = True

        # 2. Kiểm tra Stalled Node (Ngâm ở IN_PROGRESS > 2.5x estimatedHours)
        is_node_stalled = False
        started_dt = parse_iso_datetime(node.startedAt)
        if node.status == "IN_PROGRESS" and started_dt:
            elapsed_hours = (now - started_dt).total_seconds() / 3600.0
            if elapsed_hours > (settings.STALL_MULTIPLIER * duration_hours):
                is_node_stalled = True

        # Ghi nhận bottleneck định lượng
        if is_node_overdue or is_node_stalled:
            stalled_or_risky_nodes.append(node)
            severity = "HIGH" if (is_node_overdue and is_node_stalled) else "HIGH" if is_node_overdue else "MEDIUM"
            
            reasons = []
            if is_node_overdue:
                reasons.append("Tác vụ đã vượt quá hạn chót (due_date) và đang giữ chân downstream nodes.")
            if is_node_stalled:
                reasons.append(f"Tác vụ đang ngâm ở IN_PROGRESS quá {settings.STALL_MULTIPLIER}x thời lượng ước lượng.")

            bottlenecks.append(BottleneckItem(
                nodeCode=node.code,
                title=node.title,
                reason="; ".join(reasons),
                severity=severity
            ))

    # 3. Tính toán Vận tốc và Điểm lệch quỹ đạo (Drift Score)
    # Xác định số ngày còn lại đến hạn chót dự án
    if max_due_date and max_due_date > now:
        days_remaining = max(1.0, (max_due_date - now).total_seconds() / 86400.0)
    else:
        days_remaining = 14.0  # Mặc định 2 tuần nếu không có ngày deadline

    # V_target = Số task chưa xong / Số ngày còn lại
    target_velocity = round(uncompleted_count / days_remaining, 2)
    # V_actual = Ước lượng số task xong / 7 ngày
    actual_velocity = round(max(0.1, completed_count / 7.0), 2)

    if uncompleted_count == 0:
        drift_score = 0.0
        status = "STABLE_GREEN"
    else:
        # DriftScore = (1 - V_actual / V_target) * 100
        safe_v_target = max(0.01, target_velocity)
        raw_drift = (1.0 - (actual_velocity / safe_v_target)) * 100.0
        drift_score = round(max(0.0, min(100.0, raw_drift)), 1)

        if drift_score < 20.0:
            status = "STABLE_GREEN"
        elif drift_score < 40.0:
            status = "YELLOW_WARNING"
        else:
            status = "RED_ALERT"

    metrics = MetricsDto(
        targetVelocity=target_velocity,
        actualVelocity=actual_velocity,
        driftScore=drift_score,
        status=status
    )

    return bottlenecks, metrics, stalled_or_risky_nodes
