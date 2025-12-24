"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：场景管理页面
 * 作用：管理员场景 CRUD、审核、标记官方/精选
 * 创建时间：2024-12-24
 * 最后修改：2024-12-24
 */

import { useState, useEffect, useCallback } from "react";
import { getAdminToken } from "@/lib/api/admin";
import {
  Target,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Archive,
  Star,
  Shield,
  X,
  Save,
  Loader2,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  MessageSquare,
  Heart,
  GitFork,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  track: string;
  mode: string;
  difficulty: number;
  description: string | null;
  config: Record<string, unknown>;
  rubric_version: string;
  status: string;
  visibility: string;
  is_official: boolean;
  is_featured: boolean;
  cover_image: string | null;
  train_count: number;
  likes_count: number;
  comments_count: number;
  fork_count: number;
  collections_count: number;
  avg_score: number;
  hot_score: number;
  created_by: string | null;
  creator?: { id: string; nickname: string; avatar: string | null };
  forked_from: string | null;
  created_at: string | null;
  published_at: string | null;
}

interface ScenarioStats {
  total_scenarios: number;
  published_scenarios: number;
  draft_scenarios: number;
  official_scenarios: number;
  featured_scenarios: number;
  user_created_scenarios: number;
  total_train_count: number;
  track_stats: { track: string; count: number }[];
  status_stats: { status: string; count: number }[];
  difficulty_stats: { difficulty: number; count: number }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export default function ScenariosManagementPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [stats, setStats] = useState<ScenarioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackFilter, setTrackFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [officialFilter, setOfficialFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // Modal states
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    track: "sales",
    mode: "train",
    difficulty: 3,
    description: "",
    config: {} as Record<string, unknown>,
    rubric_version: "1.0",
    status: "draft",
    is_official: true,
    is_featured: false,
    cover_image: "",
  });

  // Config form fields
  const [configFields, setConfigFields] = useState({
    channel: "",
    persona: "",
    ai_name: "",
    ai_personality: "",
    ai_attitude: "",
    background: "",
    user_role: "",
    objective: "",
  });

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
      });
      if (trackFilter) params.set("track", trackFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      if (officialFilter) params.set("is_official", officialFilter);
      if (search) params.set("search", search);

      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("加载场景列表失败", err);
    } finally {
      setLoading(false);
    }
  }, [trackFilter, statusFilter, difficultyFilter, officialFilter, search, page]);

  const fetchStats = useCallback(async () => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios/statistics`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("加载统计数据失败", err);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
    fetchStats();
  }, [fetchScenarios, fetchStats]);

  const fetchScenarioDetail = async (scenarioId: string) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios/${scenarioId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSelectedScenario(data);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error("加载场景详情失败", err);
    }
  };

  const handleCreate = () => {
    setEditingScenario(null);
    setFormData({
      name: "",
      track: "sales",
      mode: "train",
      difficulty: 3,
      description: "",
      config: {},
      rubric_version: "1.0",
      status: "draft",
      is_official: true,
      is_featured: false,
      cover_image: "",
    });
    setConfigFields({
      channel: "",
      persona: "",
      ai_name: "",
      ai_personality: "",
      ai_attitude: "",
      background: "",
      user_role: "",
      objective: "",
    });
    setShowScenarioModal(true);
  };

  const handleEdit = (scenario: Scenario) => {
    setEditingScenario(scenario);
    const config = scenario.config || {};
    setFormData({
      name: scenario.name,
      track: scenario.track,
      mode: scenario.mode,
      difficulty: scenario.difficulty,
      description: scenario.description || "",
      config: config,
      rubric_version: scenario.rubric_version,
      status: scenario.status,
      is_official: scenario.is_official,
      is_featured: scenario.is_featured,
      cover_image: scenario.cover_image || "",
    });
    setConfigFields({
      channel: (config.channel as string) || "",
      persona: (config.persona as string) || "",
      ai_name: (config.ai_name as string) || "",
      ai_personality: (config.ai_personality as string) || "",
      ai_attitude: (config.ai_attitude as string) || "",
      background: (config.background as string) || "",
      user_role: (config.user_role as string) || "",
      objective: (config.objective as string) || "",
    });
    setShowScenarioModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Build config from fields
      const config = {
        ...formData.config,
        channel: configFields.channel,
        persona: configFields.persona,
        ai_name: configFields.ai_name,
        ai_personality: configFields.ai_personality,
        ai_attitude: configFields.ai_attitude,
        background: configFields.background,
        user_role: configFields.user_role,
        objective: configFields.objective,
      };

      const url = editingScenario
        ? `${API_BASE}/admin/scenarios/${editingScenario.id}`
        : `${API_BASE}/admin/scenarios`;
      const method = editingScenario ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ ...formData, config }),
      });

      if (res.ok) {
        setShowScenarioModal(false);
        fetchScenarios();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "保存失败");
      }
    } catch (err) {
      console.error("保存场景失败", err);
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scenario: Scenario) => {
    if (!confirm(`确定要删除场景「${scenario.name}」吗？此操作不可恢复。`)) return;

    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        fetchScenarios();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || "删除失败");
      }
    } catch (err) {
      console.error("删除场景失败", err);
      alert("删除失败");
    }
  };

  const handlePublish = async (scenario: Scenario) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}/publish`, {
        method: "PUT",
        headers,
      });

      if (res.ok) {
        fetchScenarios();
        fetchStats();
      }
    } catch (err) {
      console.error("发布失败", err);
    }
  };

  const handleArchive = async (scenario: Scenario) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/admin/scenarios/${scenario.id}/archive`, {
        method: "PUT",
        headers,
      });

      if (res.ok) {
        fetchScenarios();
        fetchStats();
      }
    } catch (err) {
      console.error("归档失败", err);
    }
  };

  const handleToggleOfficial = async (scenario: Scenario) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/admin/scenarios/${scenario.id}/official?is_official=${!scenario.is_official}`,
        { method: "PUT", headers }
      );

      if (res.ok) {
        fetchScenarios();
        fetchStats();
      }
    } catch (err) {
      console.error("操作失败", err);
    }
  };

  const handleToggleFeatured = async (scenario: Scenario) => {
    try {
      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/admin/scenarios/${scenario.id}/featured?is_featured=${!scenario.is_featured}`,
        { method: "PUT", headers }
      );

      if (res.ok) {
        fetchScenarios();
        fetchStats();
      }
    } catch (err) {
      console.error("操作失败", err);
    }
  };

  const getDifficultyText = (d: number) => {
    if (d <= 2) return "入门";
    if (d <= 4) return "进阶";
    return "高级";
  };

  const getDifficultyStyle = (d: number) => {
    if (d <= 2) return "bg-emerald-500/15 text-emerald-400";
    if (d <= 4) return "bg-amber-500/15 text-amber-400";
    return "bg-red-500/15 text-red-400";
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      draft: "草稿",
      published: "已发布",
      archived: "已归档",
    };
    return map[status] || status;
  };

  const getStatusStyle = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-zinc-500/15 text-text-muted",
      published: "bg-emerald-500/15 text-emerald-400",
      archived: "bg-amber-500/15 text-amber-400",
    };
    return map[status] || "bg-zinc-500/15 text-text-muted";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">场景管理</h1>
          <p className="text-text-secondary text-sm mt-1">共 {total} 个场景</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          创建场景
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: "总场景", value: stats?.total_scenarios || 0, icon: Target, iconColor: "text-violet-400" },
          { label: "已发布", value: stats?.published_scenarios || 0, icon: CheckCircle, iconColor: "text-emerald-400" },
          { label: "草稿", value: stats?.draft_scenarios || 0, icon: Clock, iconColor: "text-zinc-400" },
          { label: "官方", value: stats?.official_scenarios || 0, icon: Shield, iconColor: "text-blue-400" },
          { label: "精选", value: stats?.featured_scenarios || 0, icon: Star, iconColor: "text-amber-400" },
          { label: "用户创建", value: stats?.user_created_scenarios || 0, icon: Users, iconColor: "text-pink-400" },
          { label: "总训练次数", value: stats?.total_train_count || 0, icon: TrendingUp, iconColor: "text-cyan-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded-xl p-4 border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-xs">{stat.label}</span>
              <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            </div>
            <p className="text-xl font-bold text-text-primary">{stat.value.toLocaleString()}</p>
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
                placeholder="搜索场景名称..."
                className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部赛道</option>
            <option value="sales">销售赛道</option>
            <option value="social">社交赛道</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部难度</option>
            <option value="1">1 - 入门</option>
            <option value="2">2 - 入门</option>
            <option value="3">3 - 进阶</option>
            <option value="4">4 - 进阶</option>
            <option value="5">5 - 高级</option>
          </select>
          <select
            value={officialFilter}
            onChange={(e) => setOfficialFilter(e.target.value)}
            className="px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
          >
            <option value="">全部来源</option>
            <option value="true">官方场景</option>
            <option value="false">用户场景</option>
          </select>
        </div>
      </div>

      {/* Scenario List */}
      <div className="bg-bg-card rounded-xl border border-border-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default text-left">
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">场景</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">赛道</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">难度</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">训练</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">标签</th>
                <th className="px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : scenarios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    暂无场景数据
                  </td>
                </tr>
              ) : (
                scenarios.map((scenario) => (
                  <tr key={scenario.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center overflow-hidden">
                          {scenario.cover_image ? (
                            <img src={scenario.cover_image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Target className="w-5 h-5 text-violet-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-text-primary font-medium">{scenario.name}</div>
                          <div className="text-text-muted text-sm line-clamp-1 max-w-xs">
                            {scenario.description || "暂无描述"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${scenario.track === "sales" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                        {scenario.track === "sales" ? "销售" : "社交"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${getDifficultyStyle(scenario.difficulty)}`}>
                        Lv.{scenario.difficulty} {getDifficultyText(scenario.difficulty)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs ${getStatusStyle(scenario.status)}`}>
                        {getStatusText(scenario.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 text-text-muted text-sm">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {scenario.train_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" />
                          {scenario.likes_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {scenario.is_official && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/15 text-blue-400">官方</span>
                        )}
                        {scenario.is_featured && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">精选</span>
                        )}
                        {!scenario.is_official && scenario.created_by && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-violet-500/15 text-violet-400">用户</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => fetchScenarioDetail(scenario.id)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4 text-text-secondary hover:text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleEdit(scenario)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-text-secondary hover:text-violet-400" />
                        </button>
                        <button
                          onClick={() => handleToggleOfficial(scenario)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title={scenario.is_official ? "取消官方" : "标记官方"}
                        >
                          <Shield className={`w-4 h-4 ${scenario.is_official ? "text-blue-400" : "text-text-secondary hover:text-blue-400"}`} />
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(scenario)}
                          className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                          title={scenario.is_featured ? "取消精选" : "标记精选"}
                        >
                          <Star className={`w-4 h-4 ${scenario.is_featured ? "text-amber-400 fill-amber-400" : "text-text-secondary hover:text-amber-400"}`} />
                        </button>
                        {scenario.status === "draft" && (
                          <button
                            onClick={() => handlePublish(scenario)}
                            className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                            title="发布"
                          >
                            <CheckCircle className="w-4 h-4 text-text-secondary hover:text-emerald-400" />
                          </button>
                        )}
                        {scenario.status === "published" && (
                          <button
                            onClick={() => handleArchive(scenario)}
                            className="p-2 hover:bg-bg-active rounded-lg transition-colors"
                            title="归档"
                          >
                            <Archive className="w-4 h-4 text-text-secondary hover:text-amber-400" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(scenario)}
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

      {/* Scenario Form Modal */}
      {showScenarioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {editingScenario ? "编辑场景" : "创建场景"}
              </h2>
              <button onClick={() => setShowScenarioModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">场景名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  placeholder="输入场景名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">场景描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500 resize-none"
                  placeholder="描述场景内容和目标"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">赛道</label>
                  <select
                    value={formData.track}
                    onChange={(e) => setFormData({ ...formData, track: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    <option value="sales">销售赛道</option>
                    <option value="social">社交赛道</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">模式</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    <option value="train">训练模式</option>
                    <option value="exam">考核模式</option>
                    <option value="replay">回放模式</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">难度 (1-5)</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-strong rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  >
                    {[1, 2, 3, 4, 5].map((d) => (
                      <option key={d} value={d}>{d} - {getDifficultyText(d)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AI Config */}
              <div className="border-t border-border-default pt-4">
                <h3 className="text-sm font-medium text-text-primary mb-3">AI 角色配置</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">渠道</label>
                    <input
                      type="text"
                      value={configFields.channel}
                      onChange={(e) => setConfigFields({ ...configFields, channel: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="电话/面对面/微信"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">AI 名称</label>
                    <input
                      type="text"
                      value={configFields.ai_name}
                      onChange={(e) => setConfigFields({ ...configFields, ai_name: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="AI 角色名称"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-text-secondary mb-1">AI 身份/人设</label>
                    <input
                      type="text"
                      value={configFields.persona}
                      onChange={(e) => setConfigFields({ ...configFields, persona: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="如：30岁女性，某公司采购经理"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">AI 性格</label>
                    <input
                      type="text"
                      value={configFields.ai_personality}
                      onChange={(e) => setConfigFields({ ...configFields, ai_personality: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="谨慎/热情/冷淡"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">AI 态度</label>
                    <input
                      type="text"
                      value={configFields.ai_attitude}
                      onChange={(e) => setConfigFields({ ...configFields, ai_attitude: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="友好/中立/抗拒"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-text-secondary mb-1">背景设定</label>
                    <textarea
                      value={configFields.background}
                      onChange={(e) => setConfigFields({ ...configFields, background: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500 resize-none"
                      placeholder="场景背景描述"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">用户角色</label>
                    <input
                      type="text"
                      value={configFields.user_role}
                      onChange={(e) => setConfigFields({ ...configFields, user_role: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="销售代表/客服"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">训练目标</label>
                    <input
                      type="text"
                      value={configFields.objective}
                      onChange={(e) => setConfigFields({ ...configFields, objective: e.target.value })}
                      className="w-full px-3 py-2 bg-bg-elevated border border-border-strong rounded-lg text-text-primary text-sm focus:outline-none focus:border-violet-500"
                      placeholder="成功预约拜访"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_official}
                    onChange={(e) => setFormData({ ...formData, is_official: e.target.checked })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">官方场景</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">精选推荐</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.status === "published"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? "published" : "draft" })}
                    className="w-4 h-4 rounded border-border-strong text-violet-500 focus:ring-violet-500"
                  />
                  <span className="text-text-secondary">立即发布</span>
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-bg-card border-t border-border-default px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowScenarioModal(false)}
                className="px-4 py-2 bg-bg-elevated border border-border-strong rounded-xl text-text-secondary hover:bg-bg-active"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name}
                className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Detail Modal */}
      {showDetailModal && selectedScenario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-bg-card border-b border-border-default px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">场景详情</h2>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-bg-active rounded-lg">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-6">
              {/* Basic Info */}
              <div className="flex gap-4 mb-6">
                <div className="w-20 h-20 rounded-xl bg-violet-500/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedScenario.cover_image ? (
                    <img src={selectedScenario.cover_image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Target className="w-8 h-8 text-violet-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-text-primary flex items-center gap-2">
                    {selectedScenario.name}
                    {selectedScenario.is_official && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/15 text-blue-400">官方</span>
                    )}
                    {selectedScenario.is_featured && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">精选</span>
                    )}
                  </h3>
                  <p className="text-text-secondary mt-1">{selectedScenario.description || "暂无描述"}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                    <span className={`px-2 py-0.5 rounded text-xs ${selectedScenario.track === "sales" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                      {selectedScenario.track === "sales" ? "销售" : "社交"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyStyle(selectedScenario.difficulty)}`}>
                      Lv.{selectedScenario.difficulty}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(selectedScenario.status)}`}>
                      {getStatusText(selectedScenario.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedScenario.train_count}</div>
                  <div className="text-xs text-text-muted">训练次数</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedScenario.likes_count}</div>
                  <div className="text-xs text-text-muted">点赞</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedScenario.comments_count}</div>
                  <div className="text-xs text-text-muted">评论</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <GitFork className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedScenario.fork_count}</div>
                  <div className="text-xs text-text-muted">Fork</div>
                </div>
                <div className="bg-bg-elevated rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-muted mb-1">
                    <Star className="w-4 h-4" />
                  </div>
                  <div className="text-lg font-semibold text-text-primary">{selectedScenario.avg_score.toFixed(1)}</div>
                  <div className="text-xs text-text-muted">平均分</div>
                </div>
              </div>

              {/* Config */}
              {selectedScenario.config && Object.keys(selectedScenario.config).length > 0 && (
                <div className="border-t border-border-default pt-4">
                  <h4 className="text-sm font-medium text-text-secondary mb-3">AI 配置</h4>
                  <div className="bg-bg-elevated rounded-xl p-4 space-y-2 text-sm">
                    {Object.entries(selectedScenario.config).map(([key, value]) => {
                      if (!value) return null;
                      return (
                        <div key={key} className="flex">
                          <span className="text-text-muted w-24 flex-shrink-0">{key}:</span>
                          <span className="text-text-primary">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Creator */}
              {selectedScenario.creator && (
                <div className="border-t border-border-default pt-4 mt-4">
                  <h4 className="text-sm font-medium text-text-secondary mb-2">创建者</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center overflow-hidden">
                      {selectedScenario.creator.avatar ? (
                        <img src={selectedScenario.creator.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                    <span className="text-text-primary">{selectedScenario.creator.nickname}</span>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t border-border-default pt-4 mt-4 text-sm text-text-muted">
                <div className="flex justify-between">
                  <span>创建时间: {selectedScenario.created_at ? new Date(selectedScenario.created_at).toLocaleString() : "-"}</span>
                  <span>发布时间: {selectedScenario.published_at ? new Date(selectedScenario.published_at).toLocaleString() : "-"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
