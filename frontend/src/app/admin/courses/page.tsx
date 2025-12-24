"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：课程管理页面
 * 作用：管理员课程 CRUD、章节课时管理
 * 创建时间：2024-12-24
 * 最后修改：2024-12-24
 */

import { useState, useEffect, useCallback } from "react";
import { getAdminToken } from "@/lib/api/admin";
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Users,
  Star,
  Clock,
  X,
  Save,
  Loader2,
  Video,
  FileText,
  HelpCircle,
  Target,
  Layers,
} from "lucide-react";

interface Instructor {
  id: string;
  name: string;
  title: string | null;
  avatar?: string;
  bio?: string;
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  content_url: string | null;
  content_text: string | null;
  quiz_data: Record<string, unknown> | null;
  order: number;
  is_free: boolean;
}

interface Chapter {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string;
  full_description?: string;
  category: string;
  level: string;
  duration_minutes: number;
  cover_image: string | null;
  instructor_id?: string;
  price: number;
  is_pro: boolean;
  is_new: boolean;
  is_published: boolean;
  rating: number;
  enrolled_count: number;
  objectives?: string[];
  requirements?: string[];
  sort_order: number;
  chapters_count?: number;
  chapters?: Chapter[];
  instructor: Instructor | null;
  created_at?: string;
}

interface CourseStats {
  total_courses: number;
  published_courses: number;
  draft_courses: number;
  total_enrollments: number;
  total_instructors: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function CoursesManagementPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Modal states
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    full_description: "",
    category: "sales",
    level: "beginner",
    duration_minutes: 0,
    cover_image: "",
    instructor_id: "",
    price: 0,
    is_pro: false,
    is_new: false,
    is_published: false,
    objectives: [] as string[],
    requirements: [] as string[],
    sort_order: 0,
  });

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
      });
      if (categoryFilter) params.set("category", categoryFilter);
      if (levelFilter) params.set("level", levelFilter);
      if (publishedFilter) params.set("is_published", publishedFilter);
      if (search) params.set("search", search);

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/courses?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("加载课程列表失败", err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, levelFilter, publishedFilter, search, page]);

  const fetchInstructors = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/instructors?size=100`, { headers });
      if (res.ok) {
        const data = await res.json();
        setInstructors(data.items || []);
      }
    } catch (err) {
      console.error("加载讲师列表失败", err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/courses/statistics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("加载统计数据失败", err);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchInstructors();
    fetchStats();
  }, [fetchCourses, fetchInstructors, fetchStats]);

  const fetchCourseDetail = async (courseId: string) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/courses/${courseId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedCourse(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error("加载课程详情失败", err);
    }
  };

  const handleCreate = () => {
    setEditingCourse(null);
    setFormData({
      title: "",
      description: "",
      full_description: "",
      category: "sales",
      level: "beginner",
      duration_minutes: 0,
      cover_image: "",
      instructor_id: "",
      price: 0,
      is_pro: false,
      is_new: false,
      is_published: false,
      objectives: [],
      requirements: [],
      sort_order: 0,
    });
    setShowCourseModal(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      full_description: course.full_description || "",
      category: course.category,
      level: course.level,
      duration_minutes: course.duration_minutes,
      cover_image: course.cover_image || "",
      instructor_id: course.instructor_id || "",
      price: course.price,
      is_pro: course.is_pro,
      is_new: course.is_new,
      is_published: course.is_published,
      objectives: course.objectives || [],
      requirements: course.requirements || [],
      sort_order: course.sort_order,
    });
    setShowCourseModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const url = editingCourse
        ? `${API_BASE}/admin/courses/${editingCourse.id}`
        : `${API_BASE}/admin/courses`;
      const method = editingCourse ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCourseModal(false);
        fetchCourses();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "保存失败");
      }
    } catch (err) {
      console.error("保存课程失败", err);
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`确定要删除课程「${course.title}」吗？此操作不可恢复。`)) return;

    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/courses/${course.id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchCourses();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "删除失败");
      }
    } catch (err) {
      console.error("删除课程失败", err);
      alert("删除失败");
    }
  };

  const handleTogglePublish = async (course: Course) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const action = course.is_published ? "unpublish" : "publish";
      const res = await fetch(`${API_BASE}/admin/courses/${course.id}/${action}`, {
        method: "PUT",
        headers,
      });

      if (res.ok) {
        fetchCourses();
        fetchStats();
      }
    } catch (err) {
      console.error("操作失败", err);
    }
  };

  const getLevelText = (level: string) => {
    const map: Record<string, string> = {
      beginner: "入门",
      intermediate: "进阶",
      advanced: "高级",
    };
    return map[level] || level;
  };

  const getLevelStyle = (level: string) => {
    const map: Record<string, string> = {
      beginner: "bg-emerald-500/15 text-emerald-400",
      intermediate: "bg-amber-500/15 text-amber-400",
      advanced: "bg-red-500/15 text-red-400",
    };
    return map[level] || "bg-zinc-500/15 text-text-secondary";
  };

  const getCategoryText = (cat: string) => {
    const map: Record<string, string> = {
      sales: "销售技能",
      social: "社交沟通",
      advanced: "高阶进修",
    };
    return map[cat] || cat;
  };

  const getLessonTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="w-4 h-4" />;
      case "article":
        return <FileText className="w-4 h-4" />;
      case "quiz":
        return <HelpCircle className="w-4 h-4" />;
      case "practice":
        return <Target className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">课程管理</h1>
          <p className="text-text-secondary text-sm mt-1">共 {total} 门课程</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          创建课程
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "总课程数", value: stats?.total_courses || 0, icon: BookOpen, color: "violet" },
          { label: "已发布", value: stats?.published_courses || 0, icon: Eye, color: "emerald" },
          { label: "草稿", value: stats?.draft_courses || 0, icon: EyeOff, color: "amber" },
          { label: "报名人次", value: stats?.total_enrollments || 0, icon: Users, color: "blue" },
          { label: "讲师数", value: stats?.total_instructors || 0, icon: GraduationCap, color: "pink" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded-xl p-4 border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-sm">{stat.label}</span>
              <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
            </div>
            <p className="text-2xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索课程名称..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部分类</option>
            <option value="sales">销售技能</option>
            <option value="social">社交沟通</option>
            <option value="advanced">高阶进修</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部难度</option>
            <option value="beginner">入门</option>
            <option value="intermediate">进阶</option>
            <option value="advanced">高级</option>
          </select>
          <select
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部状态</option>
            <option value="true">已发布</option>
            <option value="false">草稿</option>
          </select>
        </div>
      </div>

      {/* Course List */}
      <div className="bg-bg-card rounded-xl border border-border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">课程</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">分类</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">难度</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">时长</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">报名</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">评分</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                    暂无课程数据
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr key={course.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-violet-500/15 flex items-center justify-center overflow-hidden">
                          {course.cover_image ? (
                            <img src={course.cover_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen className="w-6 h-6 text-violet-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-text-primary font-medium flex items-center gap-2">
                            {course.title}
                            {course.is_pro && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-violet-500/15 text-violet-400">Pro</span>
                            )}
                            {course.is_new && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-400">新</span>
                            )}
                          </div>
                          <div className="text-text-muted text-sm">
                            {course.instructor?.name || "未指定讲师"} | {course.chapters_count || 0} 章节
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{getCategoryText(course.category)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${getLevelStyle(course.level)}`}>
                        {getLevelText(course.level)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{course.duration_minutes} 分钟</td>
                    <td className="px-6 py-4 text-text-secondary">{course.enrolled_count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-text-primary">{course.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${course.is_published ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-text-muted"}`}>
                        {course.is_published ? "已发布" : "草稿"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => fetchCourseDetail(course.id)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Layers className="w-4 h-4 text-text-secondary hover:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleEdit(course)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-text-secondary hover:text-violet-400" />
                        </button>
                        <button
                          onClick={() => handleTogglePublish(course)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title={course.is_published ? "下架" : "发布"}
                        >
                          {course.is_published ? (
                            <EyeOff className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(course)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-text-secondary hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-6 py-4 border-t border-border-default flex items-center justify-between">
            <span className="text-text-muted text-sm">
              共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-bg-elevated border border-border-strong rounded-lg text-text-secondary hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
                className="px-3 py-1.5 bg-bg-elevated border border-border-strong rounded-lg text-text-secondary hover:bg-bg-active disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Course Form Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingCourse ? "编辑课程" : "创建课程"}
              </h2>
              <button onClick={() => setShowCourseModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">课程名称 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  placeholder="输入课程名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">课程简介 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="简短描述课程内容"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">分类</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    <option value="sales">销售技能</option>
                    <option value="social">社交沟通</option>
                    <option value="advanced">高阶进修</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">难度</label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    <option value="beginner">入门</option>
                    <option value="intermediate">进阶</option>
                    <option value="advanced">高级</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">讲师</label>
                  <select
                    value={formData.instructor_id}
                    onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    <option value="">选择讲师</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">时长（分钟）</label>
                  <input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">封面图片 URL</label>
                <input
                  type="text"
                  value={formData.cover_image}
                  onChange={(e) => setFormData({ ...formData, cover_image: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_pro}
                    onChange={(e) => setFormData({ ...formData, is_pro: e.target.checked })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">Pro 课程</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_new}
                    onChange={(e) => setFormData({ ...formData, is_new: e.target.checked })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">新课程标签</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">立即发布</span>
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-bg-card border-t border-border-default px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowCourseModal(false)}
                className="px-4 py-2 bg-bg-elevated border border-border-strong rounded-xl text-text-secondary hover:bg-bg-active"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title || !formData.description}
                className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course Detail Modal */}
      {showDetailModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">课程详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6">
              {/* Course Info */}
              <div className="flex gap-4 mb-6">
                <div className="w-24 h-24 rounded-xl bg-violet-500/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedCourse.cover_image ? (
                    <img src={selectedCourse.cover_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-10 h-10 text-violet-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                    {selectedCourse.title}
                    {selectedCourse.is_pro && (
                      <span className="px-2 py-0.5 rounded text-xs bg-violet-500/15 text-violet-400">Pro</span>
                    )}
                  </h3>
                  <p className="text-text-secondary mt-1">{selectedCourse.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-4 h-4" />
                      {selectedCourse.instructor?.name || "未指定"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedCourse.duration_minutes} 分钟
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {selectedCourse.enrolled_count} 人报名
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400" />
                      {selectedCourse.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chapters */}
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  章节内容 ({selectedCourse.chapters?.length || 0} 章)
                </h4>
                {selectedCourse.chapters && selectedCourse.chapters.length > 0 ? (
                  <div className="space-y-3">
                    {selectedCourse.chapters.map((chapter, idx) => (
                      <ChapterItem key={chapter.id} chapter={chapter} index={idx} getLessonTypeIcon={getLessonTypeIcon} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted bg-bg-elevated rounded-xl">
                    暂无章节内容
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Chapter Item Component
function ChapterItem({
  chapter,
  index,
  getLessonTypeIcon,
}: {
  chapter: Chapter;
  index: number;
  getLessonTypeIcon: (type: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-bg-elevated rounded-xl border border-border-default overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-active transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <span className="text-text-primary font-medium">
            第 {index + 1} 章：{chapter.title}
          </span>
          <span className="text-text-muted text-sm">({chapter.lessons.length} 课时)</span>
        </div>
      </button>
      {expanded && chapter.lessons.length > 0 && (
        <div className="border-t border-border-default">
          {chapter.lessons.map((lesson, lessonIdx) => (
            <div
              key={lesson.id}
              className="px-4 py-2.5 flex items-center gap-3 hover:bg-bg-active/50 border-b border-border-default/50 last:border-b-0"
            >
              <span className="text-text-muted text-sm w-8">{lessonIdx + 1}.</span>
              <span className="text-text-muted">{getLessonTypeIcon(lesson.type)}</span>
              <span className="text-text-primary flex-1">{lesson.title}</span>
              <span className="text-text-muted text-sm">{lesson.duration_minutes} 分钟</span>
              {lesson.is_free && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-400">试看</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
