"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { courseApi, CourseDetail, ChapterItem, LessonItem, LessonContent } from "@/lib/api";

export default function LearnPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [currentLesson, setCurrentLesson] = useState<LessonItem | null>(null);
  const [currentChapter, setCurrentChapter] = useState<ChapterItem | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 同时加载课程信息和课时内容
        const [courseData, contentData] = await Promise.all([
          courseApi.get(resolvedParams.id),
          courseApi.getLesson(resolvedParams.lessonId),
        ]);

        setCourse(courseData);
        setLessonContent(contentData);

        // 找到当前课时和章节
        for (const chapter of courseData.chapters) {
          const lesson = chapter.lessons.find((l) => l.id === resolvedParams.lessonId);
          if (lesson) {
            setCurrentLesson(lesson);
            setCurrentChapter(chapter);
            break;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [resolvedParams.id, resolvedParams.lessonId]);

  const handleMarkComplete = async () => {
    if (!lessonContent) return;
    
    try {
      setIsMarkingComplete(true);
      await courseApi.completeLesson(lessonContent.id);
      // 更新本地状态
      setLessonContent({ ...lessonContent, is_completed: true });
      if (currentLesson) {
        setCurrentLesson({ ...currentLesson, is_completed: true });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "标记失败");
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block animate-pulse">school</span>
          <p className="text-text-secondary">课程加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !course || !lessonContent || !currentLesson || !currentChapter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
        <p className="text-text-secondary mb-4">{error || "课程不存在"}</p>
        <Link href={`/courses/${resolvedParams.id}`} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          返回课程
        </Link>
      </div>
    );
  }

  // 找到所有课时的扁平列表
  const allLessons: { lesson: LessonItem; chapter: ChapterItem }[] = [];
  course.chapters.forEach((ch) => {
    ch.lessons.forEach((l) => {
      allLessons.push({ lesson: l, chapter: ch });
    });
  });

  const currentIndex = allLessons.findIndex((item) => item.lesson.id === currentLesson.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const completedCount = allLessons.filter((item) => item.lesson.is_completed).length;
  const progress = Math.round((completedCount / allLessons.length) * 100);

  const getLessonIcon = (type: string, isCompleted: boolean) => {
    if (isCompleted) return "check_circle";
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

  return (
    <div className="flex h-[calc(100vh-80px)] -mx-4 lg:-mx-8 -mt-4 lg:-mt-8">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "w-80" : "w-0"
        } shrink-0 bg-surface-card border-r border-border-dark transition-all duration-300 overflow-hidden`}
      >
        <div className="w-80 h-full flex flex-col">
          {/* Course Header */}
          <div className="p-4 border-b border-border-dark">
            <Link
              href={`/courses/${course.id}`}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-3 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              返回课程
            </Link>
            <h2 className="font-medium text-text-primary line-clamp-2">{course.title}</h2>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>学习进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Chapters */}
          <div className="flex-1 overflow-y-auto">
            {course.chapters.map((chapter) => (
              <div key={chapter.id} className="border-b border-border-dark">
                <div className="px-4 py-3 bg-surface-dark/50">
                  <h3 className="text-sm font-medium text-text-primary">{chapter.title}</h3>
                </div>
                <div>
                  {chapter.lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/courses/${course.id}/learn/${lesson.id}`}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        lesson.id === currentLesson.id
                          ? "bg-blue-500/10 border-l-2 border-blue-500"
                          : "hover:bg-surface-dark/50"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${
                          lesson.is_completed
                            ? "text-green-400"
                            : lesson.id === currentLesson.id
                              ? "text-blue-400"
                              : "text-text-muted"
                        }`}
                        style={lesson.is_completed ? { fontVariationSettings: "'FILL' 1" } : {}}
                      >
                        {getLessonIcon(lesson.type, lesson.is_completed)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm truncate ${
                            lesson.id === currentLesson.id ? "text-text-primary" : "text-text-secondary"
                          }`}
                        >
                          {lesson.title}
                        </p>
                        <p className="text-xs text-text-muted">{formatDuration(lesson.duration_minutes)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 bg-surface-card border-b border-border-dark flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-surface-dark rounded-lg transition-colors text-text-secondary hover:text-text-primary"
            >
              <span className="material-symbols-outlined">{isSidebarOpen ? "menu_open" : "menu"}</span>
            </button>
            <div>
              <p className="text-xs text-text-muted">{currentChapter.title}</p>
              <p className="text-sm font-medium text-text-primary">{currentLesson.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {prevLesson && (
              <Link
                href={`/courses/${course.id}/learn/${prevLesson.lesson.id}`}
                className="p-2 hover:bg-surface-dark rounded-lg transition-colors text-text-secondary hover:text-text-primary"
              >
                <span className="material-symbols-outlined">navigate_before</span>
              </Link>
            )}
            {nextLesson && (
              <Link
                href={`/courses/${course.id}/learn/${nextLesson.lesson.id}`}
                className="p-2 hover:bg-surface-dark rounded-lg transition-colors text-text-secondary hover:text-text-primary"
              >
                <span className="material-symbols-outlined">navigate_next</span>
              </Link>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8">
            {/* Lesson Type Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  lessonContent.type === "video"
                    ? "bg-blue-500/10 text-blue-400"
                    : lessonContent.type === "practice"
                      ? "bg-purple-500/10 text-purple-400"
                      : lessonContent.type === "quiz"
                        ? "bg-orange-500/10 text-orange-400"
                        : "bg-green-500/10 text-green-400"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{getLessonIcon(lessonContent.type, false)}</span>
                {lessonContent.type === "video"
                  ? "视频"
                  : lessonContent.type === "practice"
                    ? "实战练习"
                    : lessonContent.type === "quiz"
                      ? "测验"
                      : "阅读"}
              </span>
              <span className="text-xs text-text-muted">{formatDuration(lessonContent.duration_minutes)}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-text-primary mb-6">{lessonContent.title}</h1>

            {/* Video Player Placeholder (for video type) */}
            {lessonContent.type === "video" && (
              <div className="aspect-video bg-bg-card rounded-xl mb-8 flex items-center justify-center border border-border-dark">
                {lessonContent.content_url ? (
                  <video 
                    src={lessonContent.content_url} 
                    controls 
                    className="w-full h-full rounded-xl"
                  />
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-text-muted mb-2 block">play_circle</span>
                    <p className="text-text-muted">视频播放器</p>
                    <p className="text-xs text-text-muted mt-1">（视频内容准备中）</p>
                  </div>
                )}
              </div>
            )}

            {/* Practice Entry (for practice type) */}
            {lessonContent.type === "practice" && (
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-8 mb-8 text-center">
                <span className="material-symbols-outlined text-6xl text-purple-400 mb-4 block">psychology</span>
                <h2 className="text-xl font-bold text-text-primary mb-2">实战模拟练习</h2>
                <p className="text-text-secondary mb-6">
                  通过 AI 对话模拟，实践本章学习的技巧
                </p>
                <Link
                  href="/scenarios"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  开始练习
                </Link>
              </div>
            )}

            {/* Quiz (for quiz type) */}
            {lessonContent.type === "quiz" && lessonContent.quiz_data && (
              <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-8 mb-8">
                <div className="text-center mb-8">
                  <span className="material-symbols-outlined text-6xl text-orange-400 mb-4 block">quiz</span>
                  <h2 className="text-xl font-bold text-text-primary mb-2">章节测验</h2>
                  <p className="text-text-secondary">检验你对本章内容的理解</p>
                </div>
                <div className="text-center text-text-secondary">
                  测验功能即将上线...
                </div>
              </div>
            )}

            {/* Content */}
            {lessonContent.content_text && (
              <div className="prose prose-invert prose-sm max-w-none">
                <div
                  className="text-text-primary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: lessonContent.content_text.replace(/\n/g, '<br/>') }}
                />
              </div>
            )}

            {!lessonContent.content_text && !lessonContent.content_url && lessonContent.type !== "practice" && lessonContent.type !== "quiz" && (
              <div className="text-center py-12">
                <span className="material-symbols-outlined text-6xl text-text-muted mb-4 block">construction</span>
                <p className="text-text-secondary">课程内容正在准备中...</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="h-16 bg-surface-card border-t border-border-dark flex items-center justify-between px-6 shrink-0">
          <div>
            {prevLesson && (
              <Link
                href={`/courses/${course.id}/learn/${prevLesson.lesson.id}`}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span className="hidden sm:inline">上一课：{prevLesson.lesson.title}</span>
                <span className="sm:hidden">上一课</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!lessonContent.is_completed && (
              <button
                onClick={handleMarkComplete}
                disabled={isMarkingComplete}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors disabled:opacity-50"
              >
                {isMarkingComplete ? (
                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">check</span>
                )}
                {isMarkingComplete ? "保存中..." : "标记完成"}
              </button>
            )}
            {lessonContent.is_completed && (
              <span className="flex items-center gap-2 text-green-400">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                已完成
              </span>
            )}
          </div>

          <div>
            {nextLesson ? (
              <Link
                href={`/courses/${course.id}/learn/${nextLesson.lesson.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <span className="hidden sm:inline">下一课</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            ) : (
              <Link
                href={`/courses/${course.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                完成课程
                <span className="material-symbols-outlined">flag</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
