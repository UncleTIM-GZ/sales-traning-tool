"""课程模型"""

from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Instructor(Base):
    """讲师表"""

    __tablename__ = "instructors"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 关系
    courses: Mapped[list["Course"]] = relationship("Course", back_populates="instructor")


class Course(Base):
    """课程表"""

    __tablename__ = "courses"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    full_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    category: Mapped[str] = mapped_column(
        Enum("sales", "social", "advanced", name="course_category_enum"),
        nullable=False,
    )
    level: Mapped[str] = mapped_column(
        Enum("beginner", "intermediate", "advanced", name="course_level_enum"),
        default="beginner",
        nullable=False,
    )
    
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # 讲师
    instructor_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("instructors.id", ondelete="SET NULL"),
        nullable=True,
    )
    
    # 课程属性
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    is_pro: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # 统计
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=5.0, nullable=False)
    enrolled_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 学习目标和要求
    objectives: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    requirements: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    
    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系
    instructor: Mapped["Instructor"] = relationship("Instructor", back_populates="courses")
    chapters: Mapped[list["Chapter"]] = relationship(
        "Chapter", back_populates="course", order_by="Chapter.order"
    )
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(
        "CourseEnrollment", back_populates="course"
    )


class Chapter(Base):
    """章节表"""

    __tablename__ = "chapters"

    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 关系
    course: Mapped["Course"] = relationship("Course", back_populates="chapters")
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson", back_populates="chapter", order_by="Lesson.order"
    )


class Lesson(Base):
    """课时表"""

    __tablename__ = "lessons"

    chapter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    
    type: Mapped[str] = mapped_column(
        Enum("video", "article", "quiz", "practice", name="lesson_type_enum"),
        default="video",
        nullable=False,
    )
    
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # 视频URL
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # 文章内容
    
    # 测验题目（仅type=quiz时使用）
    quiz_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_free: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # 是否可试看

    # 关系
    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="lessons")
    completions: Mapped[list["LessonCompletion"]] = relationship(
        "LessonCompletion", back_populates="lesson"
    )


class CourseEnrollment(Base):
    """课程报名表"""

    __tablename__ = "course_enrollments"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 学习进度
    last_lesson_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("lessons.id", ondelete="SET NULL"),
        nullable=True,
    )
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # 完成时间
    completed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User")
    course: Mapped["Course"] = relationship("Course", back_populates="enrollments")
    last_lesson: Mapped["Lesson"] = relationship("Lesson")


class LessonCompletion(Base):
    """课时完成记录表"""

    __tablename__ = "lesson_completions"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    lesson_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
    )
    
    # 测验分数（仅quiz类型）
    quiz_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quiz_answers: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # 关系
    user: Mapped["User"] = relationship("User")
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="completions")
