"""会话模型"""

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.report import Report


class Session(Base):
    """对话会话表"""

    __tablename__ = "sessions"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(
        Enum("train", "exam", "replay", name="mode_enum", create_type=False),
        nullable=False,
    )
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("pending", "active", "completed", "aborted", name="session_status_enum"),
        default="pending",
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, default=dict, nullable=False
    )

    # 关系
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    turns: Mapped[list["SessionTurn"]] = relationship(
        "SessionTurn", back_populates="session", order_by="SessionTurn.turn_number"
    )
    report: Mapped["Report | None"] = relationship("Report", back_populates="session", uselist=False)


class SessionTurn(Base):
    """对话轮次表"""

    __tablename__ = "session_turns"

    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_number: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("user", "npc", "coach", name="turn_role_enum"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    partial_score: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # 关系
    session: Mapped["Session"] = relationship("Session", back_populates="turns")
