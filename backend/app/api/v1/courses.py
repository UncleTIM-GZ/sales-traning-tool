"""课程 API"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db, get_optional_user
from app.models import (
    Course,
    Chapter,
    Lesson,
    CourseEnrollment,
    LessonCompletion,
    Instructor,
    User,
)

router = APIRouter()


# ===== Schemas =====

class InstructorResponse(BaseModel):
    id: str
    name: str
    title: Optional[str]
    avatar: Optional[str]

    class Config:
        from_attributes = True


class LessonResponse(BaseModel):
    id: str
    title: str
    type: str
    duration_minutes: int
    order: int
    is_free: bool
    is_completed: bool = False

    class Config:
        from_attributes = True


class ChapterResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    order: int
    lessons: list[LessonResponse]

    class Config:
        from_attributes = True


class CourseListItem(BaseModel):
    id: str
    title: str
    description: str
    category: str
    level: str
    duration_minutes: int
    cover_image: Optional[str]
    is_pro: bool
    is_new: bool
    rating: float
    enrolled_count: int
    instructor: Optional[InstructorResponse]
    progress: int = 0  # 用户学习进度

    class Config:
        from_attributes = True


class CourseDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    full_description: Optional[str]
    category: str
    level: str
    duration_minutes: int
    cover_image: Optional[str]
    is_pro: bool
    is_new: bool
    rating: float
    enrolled_count: int
    objectives: list[str]
    requirements: list[str]
    instructor: Optional[InstructorResponse]
    chapters: list[ChapterResponse]
    is_enrolled: bool = False
    progress: int = 0

    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    items: list[CourseListItem]
    total: int
    page: int
    size: int


class LessonContentResponse(BaseModel):
    id: str
    title: str
    type: str
    duration_minutes: int
    content_url: Optional[str]
    content_text: Optional[str]
    quiz_data: Optional[dict]
    is_completed: bool
    next_lesson_id: Optional[str]
    prev_lesson_id: Optional[str]

    class Config:
        from_attributes = True


class EnrollmentResponse(BaseModel):
    message: str
    enrollment_id: str


class CompletionResponse(BaseModel):
    message: str
    progress: int


# ===== 课程列表 =====

@router.get("", response_model=CourseListResponse)
async def list_courses(
    category: Optional[str] = Query(None, description="分类: sales, social, advanced"),
    level: Optional[str] = Query(None, description="难度: beginner, intermediate, advanced"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """获取课程列表"""
    # 构建查询
    query = (
        select(Course)
        .options(selectinload(Course.instructor))
        .where(Course.is_published == True)
        .order_by(Course.sort_order)
    )
    
    if category:
        query = query.where(Course.category == category)
    if level:
        query = query.where(Course.level == level)
    
    # 分页
    offset = (page - 1) * size
    query = query.offset(offset).limit(size)
    
    result = await db.execute(query)
    courses = result.scalars().all()
    
    # 获取用户学习进度
    user_progress = {}
    if current_user:
        enrollments_result = await db.execute(
            select(CourseEnrollment).where(CourseEnrollment.user_id == current_user.id)
        )
        for enrollment in enrollments_result.scalars().all():
            user_progress[enrollment.course_id] = enrollment.progress_percent
    
    # 统计总数
    count_query = select(func.count(Course.id)).where(Course.is_published == True)
    if category:
        count_query = count_query.where(Course.category == category)
    if level:
        count_query = count_query.where(Course.level == level)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    items = []
    for course in courses:
        item = CourseListItem(
            id=course.id,
            title=course.title,
            description=course.description,
            category=course.category,
            level=course.level,
            duration_minutes=course.duration_minutes,
            cover_image=course.cover_image,
            is_pro=course.is_pro,
            is_new=course.is_new,
            rating=float(course.rating),
            enrolled_count=course.enrolled_count,
            instructor=InstructorResponse.model_validate(course.instructor) if course.instructor else None,
            progress=user_progress.get(course.id, 0),
        )
        items.append(item)
    
    return CourseListResponse(items=items, total=total, page=page, size=size)


# ===== 课程详情 =====

@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """获取课程详情"""
    result = await db.execute(
        select(Course)
        .options(
            selectinload(Course.instructor),
            selectinload(Course.chapters).selectinload(Chapter.lessons),
        )
        .where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 获取用户进度和完成的课时
    is_enrolled = False
    progress = 0
    completed_lesson_ids = set()
    
    if current_user:
        # 查询报名信息
        enrollment_result = await db.execute(
            select(CourseEnrollment).where(
                CourseEnrollment.user_id == current_user.id,
                CourseEnrollment.course_id == course_id,
            )
        )
        enrollment = enrollment_result.scalar_one_or_none()
        if enrollment:
            is_enrolled = True
            progress = enrollment.progress_percent
        
        # 查询完成的课时
        completions_result = await db.execute(
            select(LessonCompletion.lesson_id)
            .join(Lesson)
            .join(Chapter)
            .where(
                LessonCompletion.user_id == current_user.id,
                Chapter.course_id == course_id,
            )
        )
        completed_lesson_ids = {row[0] for row in completions_result.all()}
    
    # 构建章节和课时数据
    chapters_data = []
    for chapter in sorted(course.chapters, key=lambda c: c.order):
        lessons_data = []
        for lesson in sorted(chapter.lessons, key=lambda l: l.order):
            lessons_data.append(LessonResponse(
                id=lesson.id,
                title=lesson.title,
                type=lesson.type,
                duration_minutes=lesson.duration_minutes,
                order=lesson.order,
                is_free=lesson.is_free,
                is_completed=lesson.id in completed_lesson_ids,
            ))
        chapters_data.append(ChapterResponse(
            id=chapter.id,
            title=chapter.title,
            description=chapter.description,
            order=chapter.order,
            lessons=lessons_data,
        ))
    
    return CourseDetailResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        full_description=course.full_description,
        category=course.category,
        level=course.level,
        duration_minutes=course.duration_minutes,
        cover_image=course.cover_image,
        is_pro=course.is_pro,
        is_new=course.is_new,
        rating=float(course.rating),
        enrolled_count=course.enrolled_count,
        objectives=course.objectives or [],
        requirements=course.requirements or [],
        instructor=InstructorResponse.model_validate(course.instructor) if course.instructor else None,
        chapters=chapters_data,
        is_enrolled=is_enrolled,
        progress=progress,
    )


# ===== 报名课程 =====

@router.post("/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """报名课程"""
    # 检查课程是否存在
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="课程不存在")
    
    # 检查是否已报名
    enrollment_result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.user_id == current_user.id,
            CourseEnrollment.course_id == course_id,
        )
    )
    if enrollment_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="您已报名该课程")
    
    # 创建报名记录
    import uuid
    enrollment = CourseEnrollment(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        course_id=course_id,
        progress_percent=0,
    )
    db.add(enrollment)
    
    # 更新课程报名人数
    course.enrolled_count += 1
    
    await db.commit()
    
    return EnrollmentResponse(
        message="报名成功",
        enrollment_id=enrollment.id,
    )


# ===== 获取课程进度 =====

@router.get("/{course_id}/progress")
async def get_course_progress(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取课程学习进度"""
    # 查询报名信息
    enrollment_result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.user_id == current_user.id,
            CourseEnrollment.course_id == course_id,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    
    if not enrollment:
        return {"is_enrolled": False, "progress": 0, "completed_lessons": []}
    
    # 查询完成的课时
    completions_result = await db.execute(
        select(LessonCompletion.lesson_id)
        .join(Lesson)
        .join(Chapter)
        .where(
            LessonCompletion.user_id == current_user.id,
            Chapter.course_id == course_id,
        )
    )
    completed_lessons = [row[0] for row in completions_result.all()]
    
    return {
        "is_enrolled": True,
        "progress": enrollment.progress_percent,
        "last_lesson_id": enrollment.last_lesson_id,
        "completed_lessons": completed_lessons,
        "completed_at": enrollment.completed_at,
    }


# ===== 获取课时内容 =====

@router.get("/lessons/{lesson_id}", response_model=LessonContentResponse)
async def get_lesson(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """获取课时内容"""
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.chapter).selectinload(Chapter.course))
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="课时不存在")
    
    course = lesson.chapter.course
    
    # 检查是否已报名（免费课时除外）
    if not lesson.is_free and current_user:
        enrollment_result = await db.execute(
            select(CourseEnrollment).where(
                CourseEnrollment.user_id == current_user.id,
                CourseEnrollment.course_id == course.id,
            )
        )
        if not enrollment_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="请先报名课程")
    elif not lesson.is_free and not current_user:
        raise HTTPException(status_code=401, detail="请先登录")
    
    # 检查是否已完成
    is_completed = False
    if current_user:
        completion_result = await db.execute(
            select(LessonCompletion).where(
                LessonCompletion.user_id == current_user.id,
                LessonCompletion.lesson_id == lesson_id,
            )
        )
        is_completed = completion_result.scalar_one_or_none() is not None
    
    # 获取上一课和下一课
    all_lessons_result = await db.execute(
        select(Lesson)
        .join(Chapter)
        .where(Chapter.course_id == course.id)
        .order_by(Chapter.order, Lesson.order)
    )
    all_lessons = all_lessons_result.scalars().all()
    
    current_index = next((i for i, l in enumerate(all_lessons) if l.id == lesson_id), -1)
    prev_lesson_id = all_lessons[current_index - 1].id if current_index > 0 else None
    next_lesson_id = all_lessons[current_index + 1].id if current_index < len(all_lessons) - 1 else None
    
    return LessonContentResponse(
        id=lesson.id,
        title=lesson.title,
        type=lesson.type,
        duration_minutes=lesson.duration_minutes,
        content_url=lesson.content_url,
        content_text=lesson.content_text,
        quiz_data=lesson.quiz_data,
        is_completed=is_completed,
        next_lesson_id=next_lesson_id,
        prev_lesson_id=prev_lesson_id,
    )


# ===== 标记课时完成 =====

@router.post("/lessons/{lesson_id}/complete", response_model=CompletionResponse)
async def complete_lesson(
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记课时完成"""
    import uuid
    from datetime import datetime
    
    # 获取课时和课程信息
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.chapter).selectinload(Chapter.course))
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="课时不存在")
    
    course = lesson.chapter.course
    
    # 检查是否已报名
    enrollment_result = await db.execute(
        select(CourseEnrollment).where(
            CourseEnrollment.user_id == current_user.id,
            CourseEnrollment.course_id == course.id,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        # 自动报名
        enrollment = CourseEnrollment(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            course_id=course.id,
            progress_percent=0,
        )
        db.add(enrollment)
        course.enrolled_count += 1
    
    # 检查是否已完成
    completion_result = await db.execute(
        select(LessonCompletion).where(
            LessonCompletion.user_id == current_user.id,
            LessonCompletion.lesson_id == lesson_id,
        )
    )
    if not completion_result.scalar_one_or_none():
        # 创建完成记录
        completion = LessonCompletion(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            lesson_id=lesson_id,
        )
        db.add(completion)
    
    # 更新学习进度
    enrollment.last_lesson_id = lesson_id
    
    # 计算进度百分比
    total_lessons_result = await db.execute(
        select(func.count(Lesson.id))
        .join(Chapter)
        .where(Chapter.course_id == course.id)
    )
    total_lessons = total_lessons_result.scalar() or 1
    
    completed_lessons_result = await db.execute(
        select(func.count(LessonCompletion.id))
        .join(Lesson)
        .join(Chapter)
        .where(
            LessonCompletion.user_id == current_user.id,
            Chapter.course_id == course.id,
        )
    )
    # +1 因为当前完成的还没提交
    completed_count = (completed_lessons_result.scalar() or 0) + 1
    
    progress = min(100, int((completed_count / total_lessons) * 100))
    enrollment.progress_percent = progress
    
    # 如果全部完成
    if progress == 100 and not enrollment.completed_at:
        enrollment.completed_at = datetime.utcnow().isoformat()
    
    await db.commit()
    
    return CompletionResponse(message="完成学习", progress=progress)
