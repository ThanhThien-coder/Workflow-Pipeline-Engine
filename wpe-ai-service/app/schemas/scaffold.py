from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ScaffoldRequest(BaseModel):
    prompt: str = Field(..., description="Mô tả yêu cầu dự án bằng ngôn ngữ tự nhiên")
    techStack: Optional[List[str]] = Field(default=None, description="Ngăn xếp công nghệ tùy chọn")
    maxNodes: int = Field(default=20, ge=5, le=30, description="Giới hạn số node tối đa (chống tràn token)")

class ScaffoldPhase(BaseModel):
    tempId: str
    name: str
    orderIndex: int

class ScaffoldNode(BaseModel):
    tempId: str
    phaseTempId: str
    title: str
    estimatedHours: int = 16

class ScaffoldDependency(BaseModel):
    parentTempId: str
    childTempId: str

class ScaffoldResponse(BaseModel):
    source: str = "GEMINI_API"  # GEMINI_API hoặc HEURISTIC_FALLBACK
    domain: str
    targetAudience: str
    techStack: List[str]
    phases: List[ScaffoldPhase]
    nodes: List[ScaffoldNode]
    dependencies: List[ScaffoldDependency]
    tokenUsage: Optional[Dict[str, Any]] = None
