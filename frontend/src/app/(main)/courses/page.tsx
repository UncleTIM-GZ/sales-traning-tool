"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { courseApi, CourseListItem } from "@/lib/api";

const categories = [
  { key: "all", label: "全部课程" },
  { key: "sales", label: "销售技巧" },
  { key: "social", label: "社交沟通" },
  { key: "advanced", label: "进阶提升" },
];

export default function CoursesPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载课程数据
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const params: { category?: string } = {};
        if (activeCategory !== "all") {
          params.category = activeCategory;
        }
        const response = await courseApi.list(params);
        setCourses(response.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadCourses();
  }, [activeCategory]);

  // 本地搜索过滤
  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  // 加载骨架屏
  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="h-8 w-40 bg-surface-card rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-surface-card rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-80 bg-surface-card rounded animate-pulse"></div>
        </div>
        <div className="flex gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-10 w-24 bg-surface-card rounded animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-80 bg-surface-card rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="material-symbols-outlined text-6xl text-red-400 mb-4">error</span>
        <p className="text-text-secondary mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2">专属课程</h1>
          <p className="text-text-secondary">系统化的学习路径，助您快速提升销售与社交能力</p>
        </div>
        
        {/* Search */}
        <div className="relative w-full lg:w-80">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted material-symbols-outlined text-xl">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索课程..."
            className="w-full bg-surface-card border border-border-dark rounded-lg py-2.5 pl-12 pr-4 text-sm text-white placeholder-zinc-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat.key
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-surface-card text-text-secondary border border-border-dark hover:text-text-primary hover:border-gray-600"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <Link
            key={course.id}
            href={`/courses/${course.id}`}
            className="group bg-surface-card border border-border-dark rounded-xl overflow-hidden hover:border-blue-500/30 transition-all"
          >
            {/* Image */}
            <div className="relative h-40 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ 
                  backgroundImage: course.cover_image 
                    ? `url(${course.cover_image})` 
                    : "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)" 
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent" />
              
              {/* Tags */}
              <div className="absolute top-3 left-3 flex gap-2">
                {course.is_new && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-black uppercase">New</span>
                )}
                {course.is_pro && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-black uppercase">Pro</span>
                )}
              </div>
              
              {/* Progress */}
              {course.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-dark">
                  <div
                    className={`h-full ${course.progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getLevelColor(course.level)}`}>
                  {getLevelLabel(course.level)}
                </span>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-blue-500 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="text-xs font-medium text-blue-500">{course.rating.toFixed(1)}</span>
                </div>
              </div>

              <h3 className="font-bold text-text-primary mb-2 group-hover:text-blue-400 transition-colors line-clamp-1">
                {course.title}
              </h3>
              <p className="text-sm text-text-muted mb-4 line-clamp-2">{course.description}</p>

              <div className="flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    {formatDuration(course.duration_minutes)}
                  </span>
                  {course.instructor && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">person</span>
                      {course.instructor.name}
                    </span>
                  )}
                </div>
                <span>{course.enrolled_count.toLocaleString()}人学习</span>
              </div>

              {course.progress > 0 && course.progress < 100 && (
                <div className="mt-4 pt-4 border-t border-border-dark">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">学习进度</span>
                    <span className="text-blue-500 font-medium">{course.progress}%</span>
                  </div>
                </div>
              )}

              {course.progress === 100 && (
                <div className="mt-4 pt-4 border-t border-border-dark">
                  <div className="flex items-center gap-2 text-xs text-green-400">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    已完成学习
                  </div>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredCourses.length === 0 && (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-6xl text-text-muted mb-4">search_off</span>
          <p className="text-text-muted">未找到匹配的课程</p>
        </div>
      )}
    </div>
  );
}
