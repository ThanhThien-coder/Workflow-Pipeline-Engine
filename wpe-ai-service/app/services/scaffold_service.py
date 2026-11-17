import logging
from typing import Any, Dict, List, Optional, Tuple

from app.engine.graph_validator import topological_sort
from app.schemas.request import DependencyDto, NodeDto
from app.schemas.scaffold import (
    ScaffoldDependency,
    ScaffoldNode,
    ScaffoldPhase,
    ScaffoldRequest,
    ScaffoldResponse,
)
from app.services.gemini_client import gemini_client

logger = logging.getLogger("wpe_ai.scaffold")


def _validate_scaffold_data(
    llm_data: Any, max_nodes: int
) -> Optional[Tuple[List[ScaffoldPhase], List[ScaffoldNode], List[ScaffoldDependency]]]:
    """
    Xác thực nghiêm ngặt đồ thị Prompt-to-DAG do AI sinh ra (P4):
    - Kiểm phases, nodes, dependencies là list hợp lệ và không rỗng (phases, nodes).
    - Không vượt quá max_nodes; tempId không trùng lặp.
    - Mọi node.phaseTempId phải tồn tại trong phases; estimatedHours >= 1.
    - Mọi parentTempId / childTempId phải tồn tại trong nodes và không tự trỏ chính mình.
    - Chạy topological_sort đảm bảo đồ thị phi chu trình (DAG hợp lệ).
    """
    if not isinstance(llm_data, dict):
        logger.warning("Scaffold AI không phải object.")
        return None

    raw_phases = llm_data.get("phases")
    raw_nodes = llm_data.get("nodes")
    raw_deps = llm_data.get("dependencies", [])

    if not isinstance(raw_phases, list) or not raw_phases:
        logger.warning("Scaffold AI thiếu hoặc sai kiểu danh sách phases.")
        return None
    if not isinstance(raw_nodes, list) or not raw_nodes:
        logger.warning("Scaffold AI thiếu hoặc sai kiểu danh sách nodes.")
        return None
    if len(raw_nodes) > max_nodes:
        logger.warning("Scaffold AI sinh %d nodes vượt giới hạn maxNodes=%d.", len(raw_nodes), max_nodes)
        return None
    if not isinstance(raw_deps, list):
        logger.warning("Scaffold AI sai kiểu danh sách dependencies.")
        return None

    try:
        phases = [ScaffoldPhase(**p) for p in raw_phases if isinstance(p, dict)]
        nodes = [ScaffoldNode(**n) for n in raw_nodes if isinstance(n, dict)]
        dependencies = [ScaffoldDependency(**d) for d in raw_deps if isinstance(d, dict)]
    except Exception as ex:
        logger.warning("Scaffold AI không khớp schema Pydantic (vd: estimatedHours < 1): %s", ex)
        return None

    if len(phases) != len(raw_phases) or len(nodes) != len(raw_nodes) or len(dependencies) != len(raw_deps):
        logger.warning("Scaffold AI chứa phần tử không phải dict trong phases/nodes/dependencies.")
        return None

    phase_ids = {p.tempId for p in phases}
    if len(phase_ids) != len(phases):
        logger.warning("Scaffold AI có phase tempId trùng lặp.")
        return None

    node_id_map: Dict[str, int] = {}
    for idx, n in enumerate(nodes, start=1):
        if n.tempId in node_id_map:
            logger.warning("Scaffold AI có node tempId trùng lặp: %s", n.tempId)
            return None
        if n.phaseTempId not in phase_ids:
            logger.warning("Scaffold AI có node %s trỏ tới phaseTempId không tồn tại: %s", n.tempId, n.phaseTempId)
            return None
        if n.estimatedHours < 1:
            logger.warning("Scaffold AI có node %s với estimatedHours < 1: %s", n.tempId, n.estimatedHours)
            return None
        node_id_map[n.tempId] = idx

    dep_dtos: List[DependencyDto] = []
    for d in dependencies:
        if d.parentTempId not in node_id_map or d.childTempId not in node_id_map:
            logger.warning(
                "Scaffold AI có cạnh trỏ tới node không tồn tại: %s -> %s", d.parentTempId, d.childTempId
            )
            return None
        if d.parentTempId == d.childTempId:
            logger.warning("Scaffold AI có cạnh tự lặp: %s -> %s", d.parentTempId, d.childTempId)
            return None
        dep_dtos.append(
            DependencyDto(
                parentNodeId=node_id_map[d.parentTempId],
                childNodeId=node_id_map[d.childTempId],
            )
        )

    node_dtos = [
        NodeDto(id=node_id_map[n.tempId], code=n.tempId, title=n.title, estimatedHours=n.estimatedHours)
        for n in nodes
    ]
    is_acyclic, _, cycle_ids = topological_sort(node_dtos, dep_dtos)
    if not is_acyclic:
        logger.warning("Scaffold AI chứa chu trình phụ thuộc (cycle_ids=%s). Chuyển sang mẫu dự phòng.", cycle_ids)
        return None

    return phases, nodes, dependencies


class ScaffoldService:
    @staticmethod
    def generate_scaffold(request: ScaffoldRequest) -> ScaffoldResponse:
        """
        Khởi tạo đồ thị quy trình 2 tầng từ mô tả yêu cầu bằng LLM Gemini.
        Xác thực đồ thị chặt chẽ (DAG, phaseTempId, edges, estimatedHours >= 1).
        Fallback sang mẫu chuẩn tiếng Anh nếu chưa có API Key hoặc AI trả đồ thị lỗi.
        """
        llm_data = gemini_client.scaffold_dag(
            prompt=request.prompt,
            tech_stack=request.techStack,
            max_nodes=request.maxNodes,
        )

        validated = _validate_scaffold_data(llm_data, request.maxNodes) if llm_data else None
        if validated is not None:
            phases, nodes, dependencies = validated
            raw_domain = llm_data.get("domain")
            raw_audience = llm_data.get("targetAudience")
            raw_tech = llm_data.get("techStack")
            tech_stack = (
                [str(t) for t in raw_tech if isinstance(t, str) and t.strip()]
                if isinstance(raw_tech, list)
                else (request.techStack or ["Spring Boot 3", "React", "PostgreSQL"])
            )
            return ScaffoldResponse(
                source="GEMINI_API",
                domain=raw_domain if isinstance(raw_domain, str) and raw_domain.strip() else "Software System",
                targetAudience=(
                    raw_audience
                    if isinstance(raw_audience, str) and raw_audience.strip()
                    else "End Users & Administrators"
                ),
                techStack=tech_stack or ["Spring Boot 3", "React", "PostgreSQL"],
                phases=phases,
                nodes=nodes,
                dependencies=dependencies,
                tokenUsage=llm_data.get("tokenUsage") if isinstance(llm_data.get("tokenUsage"), dict) else None,
            )

        # Heuristic Scaffolding Fallback (100% English per Q1)
        tech = request.techStack or ["Spring Boot 3", "React", "PostgreSQL"]
        return ScaffoldResponse(
            source="HEURISTIC_FALLBACK",
            domain="Automated Software System",
            targetAudience="End Users & Project Administrators",
            techStack=tech,
            phases=[
                ScaffoldPhase(tempId="p1", name="1. Discovery & Architecture Design", orderIndex=1),
                ScaffoldPhase(tempId="p2", name="2. Core Backend Services", orderIndex=2),
                ScaffoldPhase(tempId="p3", name="3. Frontend & API Integration", orderIndex=3),
                ScaffoldPhase(tempId="p4", name="4. Testing & Deployment", orderIndex=4),
            ],
            nodes=[
                ScaffoldNode(tempId="n1", phaseTempId="p1", title="3NF Database Schema & API Contract", estimatedHours=16),
                ScaffoldNode(tempId="n2", phaseTempId="p1", title="Wireframes & UI Flow Design", estimatedHours=12),
                ScaffoldNode(tempId="n3", phaseTempId="p2", title="Authentication & User Management", estimatedHours=24),
                ScaffoldNode(tempId="n4", phaseTempId="p2", title="Core Business Logic APIs", estimatedHours=32),
                ScaffoldNode(tempId="n5", phaseTempId="p3", title="React Frontend Implementation", estimatedHours=40),
                ScaffoldNode(tempId="n6", phaseTempId="p4", title="Integration Testing & Documentation", estimatedHours=16),
            ],
            dependencies=[
                ScaffoldDependency(parentTempId="n1", childTempId="n3"),
                ScaffoldDependency(parentTempId="n1", childTempId="n4"),
                ScaffoldDependency(parentTempId="n2", childTempId="n5"),
                ScaffoldDependency(parentTempId="n3", childTempId="n5"),
                ScaffoldDependency(parentTempId="n4", childTempId="n5"),
                ScaffoldDependency(parentTempId="n5", childTempId="n6"),
            ],
            tokenUsage={
                "source": "HEURISTIC_FALLBACK",
                "totalTokens": 0,
                "note": "Fallback template used because Gemini API was unavailable or returned an invalid graph.",
            },
        )


scaffold_service = ScaffoldService()
