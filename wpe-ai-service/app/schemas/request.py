from typing import List, Optional
from pydantic import BaseModel, Field


class NodeDto(BaseModel):
    id: int
    code: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., max_length=300)
    status: str = Field(default="TODO", max_length=32)  # LOCKED, TODO, IN_PROGRESS, REVIEW, DONE
    phaseId: Optional[int] = None
    estimatedHours: Optional[int] = None
    startedAt: Optional[str] = None
    dueDate: Optional[str] = None
    isOverdue: Optional[bool] = False
    assignedUserId: Optional[int] = None
    joinPolicy: Optional[str] = "ALL_COMPLETED"  # ALL_COMPLETED (AND), ANY_COMPLETED (OR)
    completedAt: Optional[str] = None  # ISO-8601 UTC, null nếu chưa DONE


class DependencyDto(BaseModel):
    parentNodeId: int
    childNodeId: int


class FeedbackDto(BaseModel):
    id: int
    nodeId: Optional[int] = None
    reviewerRole: Optional[str] = "GUEST"  # TEACHER, GUEST
    content: str = Field(..., max_length=2000)
    createdAt: Optional[str] = None


class AiDiagnosisRequest(BaseModel):
    projectId: int
    projectName: Optional[str] = Field(default="Untitled Project", max_length=255)
    projectStatus: Optional[str] = Field(default="ACTIVE", max_length=32)
    requestedAt: Optional[str] = None
    nodes: List[NodeDto] = Field(default_factory=list, max_length=500)
    dependencies: List[DependencyDto] = Field(default_factory=list, max_length=2000)
    openFeedbacks: List[FeedbackDto] = Field(default_factory=list, max_length=200)
