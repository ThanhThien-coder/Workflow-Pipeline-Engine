from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ScaffoldRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000, description="Natural language project description")
    techStack: Optional[List[str]] = Field(default=None, max_length=20, description="Optional target tech stack")
    maxNodes: int = Field(default=20, ge=5, le=30, description="Maximum node count limit")


class ScaffoldPhase(BaseModel):
    tempId: str = Field(..., min_length=1, max_length=32)
    name: str = Field(..., min_length=1, max_length=200)
    orderIndex: int = Field(..., ge=1)


class ScaffoldNode(BaseModel):
    tempId: str = Field(..., min_length=1, max_length=32)
    phaseTempId: str = Field(..., min_length=1, max_length=32)
    title: str = Field(..., min_length=1, max_length=250)
    estimatedHours: int = Field(default=16, ge=1)


class ScaffoldDependency(BaseModel):
    parentTempId: str = Field(..., min_length=1, max_length=32)
    childTempId: str = Field(..., min_length=1, max_length=32)


class GeminiScaffoldPhaseSchema(BaseModel):
    """Schema Phase gửi Gemini: mọi trường bắt buộc, không default/exclusiveMinimum (Q2 & Q3)."""
    tempId: str
    name: str
    orderIndex: int = Field(..., ge=1)


class GeminiScaffoldNodeSchema(BaseModel):
    """Schema Node gửi Gemini: mọi trường bắt buộc, ge=1 thay cho gt=0 để tương thích google-genai (Q2 & Q3)."""
    tempId: str
    phaseTempId: str
    title: str
    estimatedHours: int = Field(..., ge=1)


class GeminiScaffoldDependencySchema(BaseModel):
    """Schema Dependency gửi Gemini: mọi trường bắt buộc, không default (Q3)."""
    parentTempId: str
    childTempId: str


class GeminiScaffoldSchema(BaseModel):
    """Schema Structured Output ép kiểu trả về cho Prompt-to-DAG qua Gemini (không default/exclusiveMinimum)."""
    domain: str
    targetAudience: str
    techStack: List[str]
    phases: List[GeminiScaffoldPhaseSchema]
    nodes: List[GeminiScaffoldNodeSchema]
    dependencies: List[GeminiScaffoldDependencySchema]


class ScaffoldResponse(BaseModel):
    source: Literal["GEMINI_API", "HEURISTIC_FALLBACK"] = "GEMINI_API"
    domain: str
    targetAudience: str
    techStack: List[str]
    phases: List[ScaffoldPhase]
    nodes: List[ScaffoldNode]
    dependencies: List[ScaffoldDependency]
    tokenUsage: Optional[Dict[str, Any]] = None
