import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

from app.config import settings
from app.schemas.request import FeedbackDto, NodeDto
from app.schemas.response import BottleneckItem, MetricsDto

# Múi giờ chuẩn cho mọi quy tắc ngày/giờ theo contract mục 3.3 (Asia/Ho_Chi_Minh = UTC+7)
try:
    VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
except Exception:
    VN_TZ = timezone(timedelta(hours=7))

NIGHT_EXCLUDE_START_HOUR = 0
NIGHT_EXCLUDE_END_HOUR = 7


def parse_iso_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """
    Parse chuỗi ISO-8601 sang datetime có múi giờ (timezone-aware UTC).
    Nếu chuỗi đầu vào không có múi giờ (naive) thì mặc định coi là UTC (P16).
    """
    if not dt_str or not isinstance(dt_str, str):
        return None
    try:
        clean_str = dt_str.strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(clean_str)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return None


def compute_active_hours_vn(start_utc: datetime, end_utc: datetime) -> float:
    """
    Tính số giờ đồng hồ từ start_utc đến end_utc theo giờ Việt Nam (Asia/Ho_Chi_Minh),
    KHÔNG tính khung 0h–7h mỗi đêm (contract mục 3.3 / P10).
    Độ phức tạp O(1).
    """
    if start_utc.tzinfo is None:
        start_utc = start_utc.replace(tzinfo=timezone.utc)
    if end_utc.tzinfo is None:
        end_utc = end_utc.replace(tzinfo=timezone.utc)

    if end_utc <= start_utc:
        return 0.0

    start_vn = start_utc.astimezone(VN_TZ)
    end_vn = end_utc.astimezone(VN_TZ)

    total_seconds = (end_vn - start_vn).total_seconds()
    start_day = start_vn.date()
    end_day = end_vn.date()

    def _night_overlap_seconds(day_date) -> float:
        w_start = datetime(
            day_date.year, day_date.month, day_date.day, NIGHT_EXCLUDE_START_HOUR, 0, 0, tzinfo=VN_TZ
        )
        w_end = datetime(
            day_date.year, day_date.month, day_date.day, NIGHT_EXCLUDE_END_HOUR, 0, 0, tzinfo=VN_TZ
        )
        overlap_start = max(start_vn, w_start)
        overlap_end = min(end_vn, w_end)
        return max(0.0, (overlap_end - overlap_start).total_seconds())

    days_diff = (end_day - start_day).days
    if days_diff == 0:
        excluded_seconds = _night_overlap_seconds(start_day)
    else:
        excluded_seconds = _night_overlap_seconds(start_day) + _night_overlap_seconds(end_day)
        full_middle_days = days_diff - 1
        if full_middle_days > 0:
            excluded_seconds += full_middle_days * (NIGHT_EXCLUDE_END_HOUR - NIGHT_EXCLUDE_START_HOUR) * 3600.0

    active_seconds = max(0.0, total_seconds - excluded_seconds)
    return active_seconds / 3600.0


def detect_bottlenecks_and_metrics(
    nodes: List[NodeDto],
    open_feedbacks: List[FeedbackDto],
    now: Optional[datetime] = None,
) -> Tuple[List[BottleneckItem], MetricsDto, List[NodeDto]]:
    """
    TẦNG 1: Phân tích định lượng chạy cục bộ (< 10ms, tốn 0 token).
    - Phát hiện Stalled Nodes: IN_PROGRESS với số giờ hoạt động (trừ khung 0h-7h VN) > 2.5x estimatedHours.
    - Phát hiện Overdue Nodes (quá hạn chót).
    - Tính Velocity theo 7 ngày gần nhất (completedAt) và Drift Score theo đúng contract mục 3.3.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    else:
        now = now.astimezone(timezone.utc)

    bottlenecks: List[BottleneckItem] = []
    stalled_or_risky_nodes: List[NodeDto] = []

    uncompleted_count = 0
    completed_count = 0
    completed_last_7_days = 0
    seven_days_ago = now - timedelta(days=7)
    max_due_date: Optional[datetime] = None

    for node in nodes:
        duration_hours = (
            float(node.estimatedHours)
            if (node.estimatedHours and node.estimatedHours > 0)
            else float(settings.DEFAULT_NODE_HOURS)
        )
        is_done = node.status == "DONE"

        if is_done:
            completed_count += 1
            completed_dt = parse_iso_datetime(node.completedAt)
            if completed_dt is not None and completed_dt >= seven_days_ago:
                completed_last_7_days += 1
        else:
            uncompleted_count += 1

        due_dt = parse_iso_datetime(node.dueDate)
        if due_dt is not None and (max_due_date is None or due_dt > max_due_date):
            max_due_date = due_dt

        # 1. Kiểm tra Overdue (Quá hạn)
        is_node_overdue = False
        if not is_done:
            if node.isOverdue:
                is_node_overdue = True
            elif due_dt is not None and due_dt < now:
                is_node_overdue = True

        # 2. Kiểm tra Stalled Node (Ngâm ở IN_PROGRESS > 2.5x estimatedHours, trừ 0h-7h VN)
        is_node_stalled = False
        started_dt = parse_iso_datetime(node.startedAt)
        if node.status == "IN_PROGRESS" and started_dt is not None:
            active_hours = compute_active_hours_vn(started_dt, now)
            if active_hours > (settings.STALL_MULTIPLIER * duration_hours):
                is_node_stalled = True

        # Ghi nhận bottleneck định lượng
        if is_node_overdue or is_node_stalled:
            stalled_or_risky_nodes.append(node)
            severity = "HIGH" if is_node_overdue else "MEDIUM"

            reasons = []
            if is_node_overdue:
                reasons.append("Task is past its due date and is blocking downstream nodes.")
            if is_node_stalled:
                reasons.append(
                    f"Task has been IN_PROGRESS for more than {settings.STALL_MULTIPLIER}x its estimated hours (excluding 00:00-07:00 VN time)."
                )

            bottlenecks.append(
                BottleneckItem(
                    nodeCode=node.code,
                    title=node.title,
                    reason="; ".join(reasons),
                    severity=severity,
                )
            )

    # 3. Tính toán Vận tốc & Điểm lệch quỹ đạo (Drift Score) theo Contract 3.3 & 4.1
    actual_velocity = round(completed_last_7_days / 7.0, 2)
    remaining_tasks = uncompleted_count
    overdue_days: Optional[int] = None
    drift_score: Optional[float] = None

    if len(nodes) == 0:
        target_velocity = 0.0
        status = "INSUFFICIENT_DATA"
    elif remaining_tasks == 0:
        target_velocity = 0.0
        drift_score = 0.0
        status = "STABLE_GREEN"
    elif max_due_date is not None and max_due_date < now:
        # Dự án đã quá hạn và còn node chưa DONE -> OVERDUE, không tính Drift
        overdue_days = max(1, math.ceil((now - max_due_date).total_seconds() / 86400.0))
        target_velocity = round(remaining_tasks / 1.0, 2)
        drift_score = None
        status = "OVERDUE"
    elif completed_count == 0:
        # Dự án chưa có node nào DONE -> INSUFFICIENT_DATA, không tính Drift
        days_remaining = (
            max(1.0, (max_due_date - now).total_seconds() / 86400.0)
            if (max_due_date is not None and max_due_date > now)
            else 14.0
        )
        target_velocity = round(remaining_tasks / days_remaining, 2)
        drift_score = None
        status = "INSUFFICIENT_DATA"
    else:
        days_remaining = (
            max(1.0, (max_due_date - now).total_seconds() / 86400.0)
            if (max_due_date is not None and max_due_date > now)
            else 14.0
        )
        target_velocity = round(remaining_tasks / days_remaining, 2)
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
        status=status,
        targetVelocity=target_velocity,
        actualVelocity=actual_velocity,
        completedLast7Days=completed_last_7_days,
        driftScore=drift_score,
        overdueDays=overdue_days,
        remainingTasks=remaining_tasks,
    )

    return bottlenecks, metrics, stalled_or_risky_nodes
