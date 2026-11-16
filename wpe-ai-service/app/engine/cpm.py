from typing import List, Dict, Any, Tuple
from app.schemas.request import NodeDto, DependencyDto
from app.config import settings
from app.engine.graph_validator import topological_sort

class CpmResult:
    def __init__(self, critical_path: List[str], total_duration_hours: float, node_timings: Dict[int, Dict[str, Any]]):
        self.critical_path = critical_path
        self.total_duration_hours = total_duration_hours
        self.node_timings = node_timings

def calculate_cpm(nodes: List[NodeDto], dependencies: List[DependencyDto]) -> CpmResult:
    """
    Tính toán đường găng Critical Path Method (CPM):
    - Forward pass: ES (Early Start), EF (Early Finish)
    - Backward pass: LF (Late Finish), LS (Late Start)
    - Slack: LS - ES (độ trôi dự phòng)
    - Critical Path: Các node có Slack == 0
    """
    if not nodes:
        return CpmResult(critical_path=[], total_duration_hours=0.0, node_timings={})

    # 1. Xác thực DAG và lấy thứ tự Topo
    is_acyclic, sorted_ids, cycle_nodes = topological_sort(nodes, dependencies)
    if not is_acyclic:
        # Nếu đồ thị có chu trình, fallback lấy toàn bộ code theo thứ tự hiện tại
        return CpmResult(
            critical_path=[node.code for node in nodes],
            total_duration_hours=0.0,
            node_timings={}
        )

    # 2. Xây dựng cấu trúc tra cứu
    node_map: Dict[int, NodeDto] = {node.id: node for node in nodes}
    parents_map: Dict[int, List[int]] = {node.id: [] for node in nodes}
    children_map: Dict[int, List[int]] = {node.id: [] for node in nodes}

    for dep in dependencies:
        p, c = dep.parentNodeId, dep.childNodeId
        if p in node_map and c in node_map:
            children_map[p].append(c)
            parents_map[c].append(p)

    # 3. Forward Pass: tính ES và EF
    es: Dict[int, float] = {}
    ef: Dict[int, float] = {}

    for node_id in sorted_ids:
        node = node_map[node_id]
        duration = float(node.estimatedHours) if (node.estimatedHours and node.estimatedHours > 0) else float(settings.DEFAULT_NODE_HOURS)

        parents = parents_map[node_id]
        if not parents:
            node_es = 0.0
        else:
            parent_efs = [ef[p] for p in parents if p in ef]
            if not parent_efs:
                node_es = 0.0
            elif node.joinPolicy == "ANY_COMPLETED":
                # OR join: chỉ cần 1 node cha xong là mở khóa
                node_es = min(parent_efs)
            else:
                # ALL_COMPLETED (AND join mặc định): phải chờ tất cả cha xong
                node_es = max(parent_efs)

        es[node_id] = node_es
        ef[node_id] = node_es + duration

    # Tổng thời gian thực hiện dự án theo CPM
    total_project_duration = max(ef.values()) if ef else 0.0

    # 4. Backward Pass: tính LF và LS (duyệt ngược thứ tự Topo)
    lf: Dict[int, float] = {}
    ls: Dict[int, float] = {}

    for node_id in reversed(sorted_ids):
        node = node_map[node_id]
        duration = float(node.estimatedHours) if (node.estimatedHours and node.estimatedHours > 0) else float(settings.DEFAULT_NODE_HOURS)

        children = children_map[node_id]
        if not children:
            node_lf = total_project_duration
        else:
            child_lss = [ls[c] for c in children if c in ls]
            node_lf = min(child_lss) if child_lss else total_project_duration

        lf[node_id] = node_lf
        ls[node_id] = node_lf - duration

    # 5. Tính Slack (Độ trôi) và tìm Critical Path (Slack == 0)
    critical_path_codes: List[str] = []
    node_timings: Dict[int, Dict[str, Any]] = {}

    for node_id in sorted_ids:
        node = node_map[node_id]
        duration = float(node.estimatedHours) if (node.estimatedHours and node.estimatedHours > 0) else float(settings.DEFAULT_NODE_HOURS)
        slack = round(ls[node_id] - es[node_id], 2)

        node_timings[node_id] = {
            "code": node.code,
            "title": node.title,
            "duration": duration,
            "ES": es[node_id],
            "EF": ef[node_id],
            "LS": ls[node_id],
            "LF": lf[node_id],
            "slack": slack
        }

        # Node có slack xấp xỉ 0 nằm trên đường găng
        if abs(slack) < 0.01:
            critical_path_codes.append(node.code)

    return CpmResult(
        critical_path=critical_path_codes,
        total_duration_hours=total_project_duration,
        node_timings=node_timings
    )
