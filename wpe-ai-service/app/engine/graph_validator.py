from typing import List, Dict, Set, Tuple
from app.schemas.request import NodeDto, DependencyDto

def topological_sort(nodes: List[NodeDto], dependencies: List[DependencyDto]) -> Tuple[bool, List[int], Set[int]]:
    """
    Thuật toán Kahn xác thực đồ thị DAG (phi chu trình) và sắp xếp thứ tự Topo.
    Trả về: (is_acyclic, sorted_node_ids, remaining_cycle_nodes)
    """
    node_ids = {node.id for node in nodes}
    in_degree: Dict[int, int] = {node_id: 0 for node_id in node_ids}
    adj_list: Dict[int, List[int]] = {node_id: [] for node_id in node_ids}

    for dep in dependencies:
        p, c = dep.parentNodeId, dep.childNodeId
        if p in node_ids and c in node_ids:
            adj_list[p].append(c)
            in_degree[c] = in_degree.get(c, 0) + 1

    # Hàng đợi chứa các node có in_degree == 0 (không có node cha nào cản trở)
    queue = [node_id for node_id in node_ids if in_degree[node_id] == 0]
    sorted_order: List[int] = []

    while queue:
        # Lấy một node không có tiền điều kiện
        curr = queue.pop(0)
        sorted_order.append(curr)

        for child in adj_list[curr]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    is_acyclic = len(sorted_order) == len(node_ids)
    cycle_nodes = node_ids - set(sorted_order)

    return is_acyclic, sorted_order, cycle_nodes
