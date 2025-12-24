"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { courseApi, CourseDetail, ChapterItem, LessonItem } from "@/lib/api";

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "chapters">("overview");
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await courseApi.get(resolvedParams.id);
        setCourse(data);
        // 默认展开第一个章节
        if (data.chapters.length > 0) {
          setExpandedChapters(new Set([data.chapters[0].id]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [resolvedParams.id]);

  const handleEnroll = async () => {
    if (!course) return;
    
    try {
      setIsEnrolling(true);
      await courseApi.enroll(course.id);
      // 刷新课程数据
      const data = await courseApi.get(course.id);
      setCourse(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "报名失败");
    } finally {
      setIsEnrolling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="h-6 w-32 bg-surface-card rounded mb-6"></div>
        <div className="bg-surface-card rounded-xl h-96 mb-8"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-surface-card rounded-xl"></div>
          <div className="h-48 bg-surface-card rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
        <p className="text-text-secondary mb-4">{error || "课程不存在"}</p>
        <Link href="/courses" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          返回课程列表
        </Link>
      </div>
    );
  }

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "beginner": return "入门";
      case "intermediate": return "进阶";
      case "advanced": return "高级";
      default: return level;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "beginner": return "text-green-400 bg-green-500/10 border-green-500/20";
      case "intermediate": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "advanced": return "text-red-400 bg-red-500/10 border-red-500/20";
      default: return "text-text-secondary bg-gray-500/10 border-gray-500/20";
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return "play_circle";
      case "article": return "article";
      case "quiz": return "quiz";
      case "practice": return "psychology";
      default: return "play_circle";
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  // 统计完成的课时
  const completedLessons = course.chapters.reduce(
    (acc, ch) => acc + ch.lessons.filter((l) => l.is_completed).length,
    0
  );
  const totalLessons = course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);

  // 找到下一个未完成的课时
  const findNextLesson = (): string | null => {
    for (const chapter of course.chapters) {
      for (const lesson of chapter.lessons) {
        if (!lesson.is_completed) {
          return lesson.id;
        }
      }
    }
    return null;
  };

  const nextLessonId = findNextLesson();

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
        返回课程列表
      </Link>

      {/* Course Header */}
      <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden mb-8">
        <div className="relative h-48 lg:h-64">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: course.cover_image 
                ? `url(${course.cover_image})` 
                : "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)" 
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent" />
          
          {/* Tags */}
          <div className="absolute top-4 left-4 flex gap-2">
            {course.is_new && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-black uppercase">New</span>
            )}
            {course.is_pro && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-black uppercase">Pro</span>
            )}
          </div>
        </div>

        <div className="p-6 lg:p-8 -mt-20 relative">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getLevelColor(course.level)}`}>
                  {getLevelLabel(course.level)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-yellow-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="text-sm font-medium text-yellow-500">{course.rating.toFixed(1)}</span>
                  <span className="text-sm text-text-muted">({course.enrolled_count.toLocaleString()}人学习)</span>
                </div>
              </div>
              
              <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-3">{course.title}</h1>
              <p className="text-text-secondary mb-4 max-w-2xl">{course.full_description || course.description}</p>

              {/* Instructor */}
              {course.instructor && (
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-black font-bold text-sm"
                    style={course.instructor.avatar ? { backgroundImage: `url(${course.instructor.avatar})`, backgroundSize: "cover" } : {}}
                  >
                    {!course.instructor.avatar && course.instructor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{course.instructor.name}</p>
                    {course.instructor.title && (
                      <p className="text-xs text-text-muted">{course.instructor.title}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Card */}
            <div className="bg-surface-dark border border-border-dark rounded-xl p-6 lg:w-80 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-text-secondary">学习进度</span>
                <span className="text-lg font-bold text-text-primary">
                  {totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 bg-bg-elevated rounded-full mb-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${completedLessons === totalLessons && totalLessons > 0 ? "bg-green-500" : "bg-blue-500"}`}
                  style={{ width: `${totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}%` }}
                />
              </div>
              <div className="text-sm text-text-muted mb-6">
                已完成 {completedLessons} / {totalLessons} 课时
              </div>

              {completedLessons === totalLessons && totalLessons > 0 ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                  <span className="material-symbols-outlined">check_circle</span>
                  课程已完成
                </div>
              ) : course.is_enrolled ? (
                nextLessonId && (
                  <Link
                    href={`/courses/${course.id}/learn/${nextLessonId}`}
                    className="flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined">play_arrow</span>
                    {completedLessons === 0 ? "开始学习" : "继续学习"}
                  </Link>
                )
              ) : (
                <button 
                  onClick={handleEnroll}
                  disabled={isEnrolling}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isEnrolling ? (
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined">add</span>
                  )}
                  {isEnrolling ? "报名中..." : "立即报名"}
                </button>
              )}

              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  {formatDuration(course.duration_minutes)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">play_lesson</span>
                  {totalLessons}课时
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-card border border-border-dark rounded-lg p-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-blue-500/10 text-blue-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          课程概览
        </button>
        <button
          onClick={() => setActiveTab("chapters")}
          className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "chapters"
              ? "bg-blue-500/10 text-blue-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          课程目录
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Objectives */}
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">flag</span>
              学习目标
            </h3>
            <ul className="space-y-3">
              {course.objectives.map((obj, index) => (
                <li key={index} className="flex items-start gap-3 text-text-primary">
                  <span className="material-symbols-outlined text-green-400 text-lg mt-0.5">check_circle</span>
                  {obj}
                </li>
              ))}
            </ul>
          </div>

          {/* Requirements */}
          <div className="bg-surface-card border border-border-dark rounded-xl p-6">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-400">checklist</span>
              前置要求
            </h3>
            <ul className="space-y-3">
              {course.requirements.map((req, index) => (
                <li key={index} className="flex items-start gap-3 text-text-primary">
                  <span className="material-symbols-outlined text-text-muted text-lg mt-0.5">radio_button_unchecked</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {course.chapters.map((chapter, chapterIndex) => {
            const chapterCompleted = chapter.lessons.filter((l) => l.is_completed).length;
            const isExpanded = expandedChapters.has(chapter.id);

            return (
              <div key={chapter.id} className="bg-surface-card border border-border-dark rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-dark/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-blue-400 font-bold">{chapterIndex + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-text-primary">{chapter.title}</h4>
                      {chapter.description && (
                        <p className="text-sm text-text-muted">{chapter.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-text-muted">
                      {chapterCompleted}/{chapter.lessons.length} 完成
                    </span>
                    <span className={`material-symbols-outlined text-text-secondary transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border-dark">
                    {chapter.lessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={course.is_enrolled || lesson.is_free ? `/courses/${course.id}/learn/${lesson.id}` : "#"}
                        onClick={(e) => {
                          if (!course.is_enrolled && !lesson.is_free) {
                            e.preventDefault();
                            alert("请先报名课程");
                          }
                        }}
                        className={`flex items-center gap-4 p-4 pl-8 border-b border-border-dark last:border-0 transition-colors ${
                          !course.is_enrolled && !lesson.is_free
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-surface-dark/50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          lesson.is_completed
                            ? "bg-green-500/10 text-green-400"
                            : !course.is_enrolled && !lesson.is_free
                              ? "bg-bg-elevated text-text-muted"
                              : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {lesson.is_completed ? (
                            <span className="material-symbols-outlined text-lg">check</span>
                          ) : !course.is_enrolled && !lesson.is_free ? (
                            <span className="material-symbols-outlined text-lg">lock</span>
                          ) : (
                            <span className="material-symbols-outlined text-lg">{getLessonIcon(lesson.type)}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${lesson.is_completed ? "text-text-secondary" : "text-text-primary"}`}>
                            {lesson.title}
                          </p>
                        </div>
                        {lesson.is_free && !course.is_enrolled && (
                          <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                            试看
                          </span>
                        )}
                        <span className="text-sm text-text-muted">{lesson.duration_minutes}分钟</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
