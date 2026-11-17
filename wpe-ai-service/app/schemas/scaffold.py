from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ScaffoldRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000, description="Mô tả yêu cầu dự án bằng ngôn ngữ tự nhiên")
    techStack: Optional[List[str]] = Field(default=None, max_length=20, description="Ngăn xếp công nghệ tùy chọn")
    maxNodes: int = Field(default=20, ge=5, le=30, description="Giới hạn số node tối đa (chống tràn token)")


class ScaffoldPhase(BaseModel):
    tempId: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=200)
    orderIndex: int = Field(..., ge=1)


class ScaffoldNode(BaseModel):
    tempId: str = Field(..., min_length=1, max_length=32)
    phaseTempId: str = Field(..., min_length=1, max_length=32)
    title: str = Field(..., min_length=1, max_length=250)
    estimatedHours: int = Field(default=16, gt=0)


class ScaffoldDependency(BaseModel):
    parentTempId: str = Field(..., min_length=1, max_length=32)
    childTempId: str = Field(..., min_length=1, max_length=32)


class GeminiScaffoldSchema(BaseModel):
    """Schema Structured Output ép kiểu trả về cho Prompt-to-DAG qua Gemini."""
    domain: str
    targetAudience: str
    techStack: List[str]
    phases: List[ScaffoldPhase]
    nodes: List[ScaffoldNode]
    dependencies: List[ScaffoldDependency]


class ScaffoldResponse(BaseModel):
    source: Literal["GEMINI_API", "HEURISTIC_FALLBACK"] = "GEMINI_API"
    domain: str
    targetAudience: str
    techStack: List[str]
    phases: List[ScaffoldPhase]
    nodes: List[ScaffoldNode]
    dependencies: List[ScaffoldDependency]
    tokenUsage: Optional[Dict[str, Any]] = None
