import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.engine.metrics import (
    VN_TZ,
    compute_active_hours_vn,
    detect_bottlenecks_and_metrics,
    parse_iso_datetime,
)
from app.schemas.request import NodeDto


class TestMetricsEngine(unittest.TestCase):
    def test_p9a_new_project_no_done_tasks_is_insufficient_data(self):
        """P9(a): Dự án mới có 3 task TODO (chưa DONE nào) -> INSUFFICIENT_DATA, không báo RED_ALERT"""
        now = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)
        future_due = (now + timedelta(days=10)).isoformat()
        nodes = [
            NodeDto(id=1, code="WPE-001", title="Task 1", status="TODO", dueDate=future_due),
            NodeDto(id=2, code="WPE-002", title="Task 2", status="TODO", dueDate=future_due),
            NodeDto(id=3, code="WPE-003", title="Task 3", status="TODO", dueDate=future_due),
        ]

        _, metrics, _ = detect_bottlenecks_and_metrics(nodes, [], now=now)
        self.assertEqual(metrics.status, "INSUFFICIENT_DATA")
        self.assertIsNone(metrics.driftScore)
        self.assertIsNone(metrics.overdueDays)
        self.assertEqual(metrics.remainingTasks, 3)
        self.assertEqual(metrics.completedLast7Days, 0)

    def test_p9b_velocity_only_counts_completed_last_7_days(self):
        """P9(b): actualVelocity và completedLast7Days chỉ đếm node DONE có completedAt trong 7 ngày gần nhất"""
        now = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)
        future_due = (now + timedelta(days=7)).isoformat()
        nodes = [
            # Xong cách đây 20 ngày -> KHÔNG đếm vào 7 ngày gần nhất
            NodeDto(
                id=1,
                code="WPE-001",
                title="Old done",
                status="DONE",
                completedAt=(now - timedelta(days=20)).isoformat(),
                dueDate=future_due,
            ),
            # Xong cách đây 2 ngày -> Đếm vào 7 ngày gần nhất
            NodeDto(
                id=2,
                code="WPE-002",
                title="Recent done 1",
                status="DONE",
                completedAt=(now - timedelta(days=2)).isoformat(),
                dueDate=future_due,
            ),
            # Xong cách đây 1 ngày -> Đếm vào 7 ngày gần nhất
            NodeDto(
                id=3,
                code="WPE-003",
                title="Recent done 2",
                status="DONE",
                completedAt=(now - timedelta(days=1)).isoformat(),
                dueDate=future_due,
            ),
            NodeDto(id=4, code="WPE-004", title="Remaining 1", status="IN_PROGRESS", dueDate=future_due),
            NodeDto(id=5, code="WPE-005", title="Remaining 2", status="TODO", dueDate=future_due),
        ]

        _, metrics, _ = detect_bottlenecks_and_metrics(nodes, [], now=now)
        self.assertEqual(metrics.completedLast7Days, 2)
        self.assertEqual(metrics.actualVelocity, round(2 / 7.0, 2))
        self.assertEqual(metrics.remainingTasks, 2)
        self.assertEqual(metrics.targetVelocity, round(2 / 7.0, 2))
        self.assertEqual(metrics.driftScore, 0.0)
        self.assertEqual(metrics.status, "STABLE_GREEN")

    def test_p9c_overdue_project_status_and_overdue_days(self):
        """P9(c): Dự án quá hạn (max dueDate < now và còn node chưa DONE) -> OVERDUE, driftScore=None, overdueDays=ceil"""
        now = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
        past_due = (now - timedelta(days=2, hours=3)).isoformat()  # quá hạn 2 ngày 3 giờ -> làm tròn lên = 3 ngày
        nodes = [
            NodeDto(
                id=1,
                code="WPE-001",
                title="Done task",
                status="DONE",
                completedAt=(now - timedelta(days=3)).isoformat(),
                dueDate=(now - timedelta(days=4)).isoformat(),
            ),
            NodeDto(
                id=2,
                code="WPE-002",
                title="Late task",
                status="IN_PROGRESS",
                dueDate=past_due,
                isOverdue=True,
            ),
        ]

        _, metrics, _ = detect_bottlenecks_and_metrics(nodes, [], now=now)
        self.assertEqual(metrics.status, "OVERDUE")
        self.assertIsNone(metrics.driftScore)
        self.assertEqual(metrics.overdueDays, 3)
        self.assertEqual(metrics.remainingTasks, 1)

    def test_p10_stalled_node_excludes_0h_to_7h_vietnam_time(self):
        """
        P10 / Contract 3.3 (ví dụ của Minh):
        - Task ước tính 8h -> ngưỡng 2.5 * 8 = 20h.
        - Bắt đầu 17:00 thứ Hai (giờ VN = 10:00 UTC).
        - Thứ Hai: 17h–24h = 7h.
        - Thứ Ba 0h–7h: không tính.
        - Lúc 20:00 thứ Ba (VN): 7h + 13h = đúng 20h -> CHƯA coi là ngâm.
        - Lúc 20:01 thứ Ba (VN): > 20h -> COI LÀ NGÂM (stalled).
        """
        start_vn = datetime(2026, 11, 16, 17, 0, 0, tzinfo=VN_TZ)
        at_threshold_vn = datetime(2026, 11, 17, 20, 0, 0, tzinfo=VN_TZ)
        past_threshold_vn = datetime(2026, 11, 17, 20, 1, 0, tzinfo=VN_TZ)

        self.assertAlmostEqual(compute_active_hours_vn(start_vn, at_threshold_vn), 20.0, places=4)
        self.assertGreater(compute_active_hours_vn(start_vn, past_threshold_vn), 20.0)

        node = NodeDto(
            id=1,
            code="WPE-010",
            title="Implement payment",
            status="IN_PROGRESS",
            estimatedHours=8,
            startedAt=start_vn.astimezone(timezone.utc).isoformat(),
            dueDate=datetime(2026, 11, 25, 10, 0, tzinfo=timezone.utc).isoformat(),
        )

        # Tại đúng mốc 20h (27h đồng hồ nhưng trừ 7h đêm còn 20h): chưa bị đánh stalled
        bottlenecks_ok, _, stalled_ok = detect_bottlenecks_and_metrics([node], [], now=at_threshold_vn)
        self.assertEqual(stalled_ok, [])
        self.assertEqual(bottlenecks_ok, [])

        # Vượt mốc 1 phút (20h01p hoạt động): bị đánh stalled
        bottlenecks_stalled, _, stalled_hit = detect_bottlenecks_and_metrics([node], [], now=past_threshold_vn)
        self.assertEqual(len(stalled_hit), 1)
        self.assertEqual(bottlenecks_stalled[0].nodeCode, "WPE-010")

    def test_p16_naive_datetime_treated_as_utc_no_500(self):
        """P16: Ngày giờ không có múi giờ (naive ISO) phải được coi là UTC, không gây TypeError"""
        parsed = parse_iso_datetime("2026-11-10T08:30:00")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.tzinfo, timezone.utc)

        now = datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc)
        nodes = [
            NodeDto(
                id=1,
                code="WPE-001",
                title="Naive dates task",
                status="IN_PROGRESS",
                estimatedHours=8,
                startedAt="2026-11-10T08:00:00",  # Không có Z / +00:00
                dueDate="2026-11-20T17:00:00",  # Không có Z / +00:00
            ),
            NodeDto(
                id=2,
                code="WPE-002",
                title="Done naive task",
                status="DONE",
                completedAt="2026-11-14T12:00:00",  # Không có Z / +00:00
                dueDate="2026-11-20T17:00:00",
            ),
        ]
        bottlenecks, metrics, _ = detect_bottlenecks_and_metrics(nodes, [], now=now)
        self.assertEqual(len(bottlenecks), 1)
        self.assertEqual(metrics.completedLast7Days, 1)


if __name__ == "__main__":
    unittest.main()
