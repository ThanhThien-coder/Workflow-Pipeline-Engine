from typing import List, Optional
from pydantic import BaseModel, Field

class BottleneckItem(BaseModel):
    nodeCode: str
    title: str
    reason: str
    severity: str = "HIGH"  # HIGH, MEDIUM, LOW

class TaskTrapItem(BaseModel):
    nodeCode: str
    title: str
    trapType: str = "POTENTIAL_STALL"  # POTENTIAL_STALL, SCOPE_CREEP, UNREALISTIC_DEADLINE
    suggestion: str

class ActionableAdviceItem(BaseModel):
    action: str  # SPLIT_NODE, RESOLVE_FEEDBACK, PARALLELIZE, CONTINUE_PIPELINE
    targetNodeCode: str = "GENERAL"
    instruction: str
    priority: str = "HIGH"  # HIGH, MEDIUM, LOW

class MetricsDto(BaseModel):
    targetVelocity: float = 1.0
    actualVelocity: float = 1.0
    driftScore: float = 0.0
    status: str = "STABLE_GREEN"  # STABLE_GREEN, YELLOW_WARNING, RED_ALERT

class TokenUsageDto(BaseModel):
    promptTokens: int = 0
    candidateTokens: int = 0
    totalTokens: int = 0
    estimatedCostUsd: float = 0.0
    source: str = "GEMINI_API"  # GEMINI_API hoặc HEURISTIC_FALLBACK

class AiDiagnosisResponse(BaseModel):
    analyzedAt: str
    source: str = "AI_SERVICE"
    criticalPath: List[str] = Field(default_factory=list)
    bottlenecks: List[BottleneckItem] = Field(default_factory=list)
    taskTraps: List[TaskTrapItem] = Field(default_factory=list)
    actionableAdvice: List[ActionableAdviceItem] = Field(default_factory=list)
    metrics: MetricsDto
    tokenUsage: Optional[TokenUsageDto] = None
    rateLimitWarning: Optional[str] = None
