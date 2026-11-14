import unittest
import sys
from pathlib import Path

# Thêm thư mục gốc wpe-ai-service vào PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import health_check, trigger_ai_diagnostics, scaffold_dag
from app.schemas.request import AiDiagnosisRequest, NodeDto, DependencyDto, FeedbackDto
from app.schemas.scaffold import ScaffoldRequest

class TestApiEndpoints(unittest.TestCase):
    def test_health_check(self):
        data = health_check()
        self.assertEqual(data["status"], "UP")
        self.assertIn("geminiConfigured", data)
        self.assertIn("model", data)

    def test_diagnose_contract(self):
        """
        Kiểm thử khớp 100% với JSON mẫu tại docs/specs/ai-service-contract.md
        """
        req = AiDiagnosisRequest(
            projectId=10,
            projectName="Xây dựng cổng thanh toán trực tuyến",
            projectStatus="ACTIVE",
            requestedAt="2026-11-12T09:44:11.123Z",
            nodes=[
                NodeDto(
                    id=101,
                    code="WPE-001",
                    title="Thiết kế CSDL 3NF & API Contract",
                    status="DONE",
                    phaseId=1,
                    estimatedHours=16,
                    startedAt="2026-11-01T08:00:00Z",
                    dueDate="2026-11-03T17:00:00Z",
                    isOverdue=False,
                    assignedUserId=2,
                    joinPolicy="ALL_COMPLETED"
                ),
                NodeDto(
                    id=102,
                    code="WPE-002",
                    title="Tích hợp cổng thanh toán VNPay",
                    status="IN_PROGRESS",
                    phaseId=2,
                    estimatedHours=24,
                    startedAt="2026-11-04T08:00:00Z",
                    dueDate="2026-11-08T17:00:00Z",
                    isOverdue=True,
                    assignedUserId=3,
                    joinPolicy="ALL_COMPLETED"
                )
            ],
            dependencies=[
                DependencyDto(
                    parentNodeId=101,
                    childNodeId=102
                )
            ],
            openFeedbacks=[
                FeedbackDto(
                    id=501,
                    nodeId=102,
                    reviewerRole="TEACHER",
                    content="Cần kiểm tra kỹ luồng IPN và checksum HMAC-SHA512 khi nhận webhook từ cổng.",
                    createdAt="2026-11-09T10:15:00Z"
                )
            ]
        )

        response = trigger_ai_diagnostics(req)

        # Kiểm tra các trường bắt buộc của Contract
        self.assertIsNotNone(response.analyzedAt)
        self.assertEqual(response.source, "AI_SERVICE")
        self.assertTrue(len(response.criticalPath) > 0)
        self.assertTrue(len(response.bottlenecks) > 0)
        self.assertTrue(len(response.actionableAdvice) > 0)
        self.assertIsNotNone(response.metrics)

        # Kiểm tra tính toán CPM
        self.assertEqual(response.criticalPath, ["WPE-001", "WPE-002"])

        # Kiểm tra phát hiện bottleneck WPE-002 quá hạn
        node_codes_bottleneck = [b.nodeCode for b in response.bottlenecks]
        self.assertIn("WPE-002", node_codes_bottleneck)

        # Kiểm tra actionable advice có hành động xử lý feedback và tách node
        actions = [a.action for a in response.actionableAdvice]
        self.assertIn("SPLIT_NODE", actions)
        self.assertIn("RESOLVE_FEEDBACK", actions)

    def test_scaffold_dag(self):
        """Kiểm thử tính năng Prompt-to-DAG"""
        req = ScaffoldRequest(
            prompt="Xây dựng ứng dụng quản lý kho hàng",
            techStack=["Spring Boot 3", "React", "PostgreSQL"],
            maxNodes=15
        )
        response = scaffold_dag(req)
        self.assertTrue(len(response.phases) > 0)
        self.assertTrue(len(response.nodes) > 0)
        self.assertTrue(len(response.dependencies) > 0)

if __name__ == "__main__":
    unittest.main()
