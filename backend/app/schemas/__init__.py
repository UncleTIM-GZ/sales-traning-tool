"""Schemas模块"""

from app.schemas.user import (
    ProfileResponse,
    ProfileUpdate,
    Token,
    TokenWithUser,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    SendCodeRequest,
    VerifyCodeRequest,
    ResetPasswordRequest,
)
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioPackListResponse,
    ScenarioResponse,
    ScenarioUpdate,
)
from app.schemas.session import (
    MessageRequest,
    SessionCreate,
    SessionHistoryResponse,
    SessionListResponse,
    SessionResponse,
)
from app.schemas.report import (
    CompareReportResponse,
    ReportListResponse,
    ReportResponse,
)
from app.schemas.training import (
    ProgressResponse,
    TrainingPlanCreate,
    TrainingPlanListResponse,
    TrainingPlanResponse,
    TrainingPlanUpdate,
)

__all__ = [
    # User
    "Token",
    "TokenWithUser",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "UserUpdate",
    "ProfileResponse",
    "ProfileUpdate",
    "SendCodeRequest",
    "VerifyCodeRequest",
    "ResetPasswordRequest",
    # Scenario
    "ScenarioCreate",
    "ScenarioUpdate",
    "ScenarioResponse",
    "ScenarioListResponse",
    "ScenarioPackListResponse",
    # Session
    "SessionCreate",
    "SessionResponse",
    "SessionListResponse",
    "SessionHistoryResponse",
    "MessageRequest",
    # Report
    "ReportResponse",
    "ReportListResponse",
    "CompareReportResponse",
    # Training
    "TrainingPlanCreate",
    "TrainingPlanUpdate",
    "TrainingPlanResponse",
    "TrainingPlanListResponse",
    "ProgressResponse",
]
