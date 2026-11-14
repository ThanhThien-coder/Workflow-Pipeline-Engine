from typing import List, Optional
from pydantic import BaseModel, Field

class NodeDto(BaseModel):
    id: int
    code: str
    title: str
    status: str = "TODO"  # LOCKED, TODO, IN_PROGRESS, REVIEW, DONE
    phaseId: Optional[int] = None
    estimatedHours: Optional[int] = None
    startedAt: Optional[str] = None
    dueDate: Optional[str] = None
    isOverdue: Optional[bool] = False
    assignedUserId: Optional[int] = None
    joinPolicy: Optional[str] = "ALL_COMPLETED"  # ALL_COMPLETED (AND), ANY_COMPLETED (OR)

class DependencyDto(BaseModel):
    parentNodeId: int
    childNodeId: int

class FeedbackDto(BaseModel):
    id: int
    nodeId: Optional[int] = None
    reviewerRole: Optional[str] = "GUEST"  # TEACHER, GUEST
    content: str
    createdAt: Optional[str] = None

class AiDiagnosisRequest(BaseModel):
    projectId: int
    projectName: Optional[str] = "Chưa đặt tên"
    projectStatus: Optional[str] = "ACTIVE"
    requestedAt: Optional[str] = None
    nodes: List[NodeDto] = Field(default_factory=list)
    dependencies: List[DependencyDto] = Field(default_factory=list)
    openFeedbacks: List[FeedbackDto] = Field(default_factory=list)
