import unittest
import sys
from pathlib import Path

# Thêm thư mục gốc wpe-ai-service vào PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.request import NodeDto, DependencyDto
from app.engine.cpm import calculate_cpm
from app.engine.graph_validator import topological_sort

class TestCpmCalculator(unittest.TestCase):
    def test_topological_sort_acyclic(self):
        nodes = [
            NodeDto(id=1, code="A", title="Node A", estimatedHours=8),
            NodeDto(id=2, code="B", title="Node B", estimatedHours=4),
            NodeDto(id=3, code="C", title="Node C", estimatedHours=10),
            NodeDto(id=4, code="D", title="Node D", estimatedHours=3),
        ]
        deps = [
            DependencyDto(parentNodeId=1, childNodeId=2),  # A -> B
            DependencyDto(parentNodeId=1, childNodeId=3),  # A -> C
            DependencyDto(parentNodeId=2, childNodeId=4),  # B -> D
            DependencyDto(parentNodeId=3, childNodeId=4),  # C -> D
        ]
        is_acyclic, sorted_ids, cycle_nodes = topological_sort(nodes, deps)
        self.assertTrue(is_acyclic)
        self.assertEqual(len(sorted_ids), 4)
        self.assertEqual(sorted_ids[0], 1)  # A phải ở đầu
        self.assertEqual(sorted_ids[-1], 4) # D phải ở cuối

    def test_cpm_critical_path(self):
        """
        Kiểm thử bài toán CPM mẫu:
        A(8h) -> B(4h) -> D(3h)
        A(8h) -> C(10h) -> D(3h)
        - Đường nhánh 1: A(8) + B(4) + D(3) = 15h
        - Đường nhánh 2: A(8) + C(10) + D(3) = 21h (Dài nhất = Đường găng)
        Critical Path phải là: ['A', 'C', 'D']
        """
        nodes = [
            NodeDto(id=1, code="A", title="Node A", estimatedHours=8),
            NodeDto(id=2, code="B", title="Node B", estimatedHours=4),
            NodeDto(id=3, code="C", title="Node C", estimatedHours=10),
            NodeDto(id=4, code="D", title="Node D", estimatedHours=3),
        ]
        deps = [
            DependencyDto(parentNodeId=1, childNodeId=2),
            DependencyDto(parentNodeId=1, childNodeId=3),
            DependencyDto(parentNodeId=2, childNodeId=4),
            DependencyDto(parentNodeId=3, childNodeId=4),
        ]

        result = calculate_cpm(nodes, deps)
        self.assertEqual(result.total_duration_hours, 21.0)
        self.assertEqual(result.critical_path, ["A", "C", "D"])
        
        # Node B phải có slack > 0 (không nằm trên đường găng)
        b_timing = result.node_timings[2]
        self.assertEqual(b_timing["slack"], 6.0)
        
        # Node C phải có slack == 0
        c_timing = result.node_timings[3]
        self.assertEqual(c_timing["slack"], 0.0)

    def test_cpm_cycle_detection(self):
        """Nếu có chu trình A -> B -> A, phải phát hiện và xử lý an toàn"""
        nodes = [
            NodeDto(id=1, code="A", title="Node A", estimatedHours=4),
            NodeDto(id=2, code="B", title="Node B", estimatedHours=4),
        ]
        deps = [
            DependencyDto(parentNodeId=1, childNodeId=2),
            DependencyDto(parentNodeId=2, childNodeId=1),
        ]
        is_acyclic, _, cycle_nodes = topological_sort(nodes, deps)
        self.assertFalse(is_acyclic)
        self.assertEqual(cycle_nodes, {1, 2})

if __name__ == "__main__":
    unittest.main()
