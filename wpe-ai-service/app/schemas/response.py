from typing import List, Literal, Optional
from pydantic import BaseModel, Field

SeverityLiteral = Literal["HIGH", "MEDIUM", "LOW"]
TrapTypeLiteral = Literal["POTENTIAL_STALL", "SCOPE_CREEP", "UNREALISTIC_DEADLINE"]
ActionTypeLiteral = Literal["SPLIT_NODE", "RESOLVE_FEEDBACK", "PARALLELIZE", "CONTINUE_PIPELINE"]
DiagnosisSourceLiteral = Literal["AI_SERVICE", "HEURISTIC_FALLBACK"]
MetricsStatusLiteral = Literal[
    "STABLE_GREEN",
    "YELLOW_WARNING",
    "RED_ALERT",
    "INSUFFICIENT_DATA",
    "OVERDUE",
]

ALLOWED_SEVERITIES = frozenset({"HIGH", "MEDIUM", "LOW"})
ALLOWED_TRAP_TYPES = frozenset({"POTENTIAL_STALL", "SCOPE_CREEP", "UNREALISTIC_DEADLINE"})
ALLOWED_ACTIONS = frozenset({"SPLIT_NODE", "RESOLVE_FEEDBACK", "PARALLELIZE", "CONTINUE_PIPELINE"})


class BottleneckItem(BaseModel):
    nodeCode: str
    title: str
    reason: str
    severity: SeverityLiteral = "HIGH"


class TaskTrapItem(BaseModel):
    nodeCode: str
    title: str
    trapType: TrapTypeLiteral = "POTENTIAL_STALL"
    suggestion: str


class ActionableAdviceItem(BaseModel):
    action: ActionTypeLiteral
    targetNodeCode: str = "GENERAL"
    instruction: str
    priority: SeverityLiteral = "HIGH"


class MetricsDto(BaseModel):
    status: MetricsStatusLiteral = "STABLE_GREEN"
    targetVelocity: float = 0.0
    actualVelocity: float = 0.0
    completedLast7Days: int = 0
    driftScore: Optional[float] = None
    overdueDays: Optional[int] = None
    remainingTasks: int = 0


class TokenUsageDto(BaseModel):
    promptTokens: int = 0
    candidateTokens: int = 0
    thoughtsTokens: int = 0
    totalTokens: int = 0
    estimatedCostUsd: float = 0.0
    source: Literal["GEMINI_API", "HEURISTIC_FALLBACK"] = "GEMINI_API"
    # Model Gemini đã trả lời (model chính hoặc model dự phòng); null khi dùng luật dự phòng
    model: Optional[str] = None


class GeminiTaskTrapSchema(BaseModel):
    """Schema TaskTrap gửi Gemini: mọi trường bắt buộc, không có default (Q3)."""
    nodeCode: str
    title: str
    trapType: TrapTypeLiteral
    suggestion: str


class GeminiActionableAdviceSchema(BaseModel):
    """Schema ActionableAdvice gửi Gemini: mọi trường bắt buộc, không có default (Q3)."""
    action: ActionTypeLiteral
    targetNodeCode: str
    instruction: str
    priority: SeverityLiteral


class GeminiDiagnosisSchema(BaseModel):
    """Schema Structured Output ép kiểu trả về cho Google Gemini API (mọi trường bắt buộc, không default)."""
    taskTraps: List[GeminiTaskTrapSchema]
    actionableAdvice: List[GeminiActionableAdviceSchema]
    rootCauseNotes: str


class AiDiagnosisResponse(BaseModel):
    analyzedAt: str
    source: DiagnosisSourceLiteral = "AI_SERVICE"
    criticalPath: List[str] = Field(default_factory=list)
    bottlenecks: List[BottleneckItem] = Field(default_factory=list)
    taskTraps: List[TaskTrapItem] = Field(default_factory=list)
    actionableAdvice: List[ActionableAdviceItem] = Field(default_factory=list)
    metrics: MetricsDto
    warning: Optional[str] = None
    rootCauseNotes: Optional[str] = None
    tokenUsage: Optional[TokenUsageDto] = None
