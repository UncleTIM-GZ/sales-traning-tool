"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：成就勋章管理页面
 * 作用：管理成就系统和勋章配置（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect, useCallback } from "react";
import {
  Award,
  Search,
  Plus,
  Edit2,
  Trash2,
  Users,
  Star,
  Trophy,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  condition: Record<string, unknown>;
  points_reward: number;
  rarity: string;
  sort_order: number;
  is_active: boolean;
  unlock_count: number;
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  total_unlocks: number;
  categories: Array<{ category: string; count: number }>;
}

export default function AdminAchievementsPage() {
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("trophy");
  const [formCategory, setFormCategory] = useState("session");
  const [formConditionType, setFormConditionType] = useState("sessions_count");
  const [formConditionValue, setFormConditionValue] = useState(10);
  const [formPointsReward, setFormPointsReward] = useState(100);
  const [formRarity, setFormRarity] = useState("common");

  const fetchAchievements = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
      if (categoryFilter) params.append("category", categoryFilter);

      const res = await fetch(`/api/v1/admin/achievements?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch achievements:", error);
    }
  }, [token, categoryFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/achievements/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchAchievements(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchAchievements, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormIcon("trophy");
    setFormCategory("session");
    setFormConditionType("sessions_count");
    setFormConditionValue(10);
    setFormPointsReward(100);
    setFormRarity("common");
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formName || !formDescription) return;

    setSaving(true);
    try {
      const url = editingId
        ? `/api/v1/admin/achievements/${editingId}`
        : "/api/v1/admin/achievements";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          icon: formIcon,
          category: formCategory,
          condition: { type: formConditionType, value: formConditionValue },
          points_reward: formPointsReward,
          rarity: formRarity,
          sort_order: 0,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchData();
      }
    } catch (error) {
      console.error("Failed to save achievement:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (achievement: Achievement) => {
    setEditingId(achievement.id);
    setFormName(achievement.name);
    setFormDescription(achievement.description);
    setFormIcon(achievement.icon);
    setFormCategory(achievement.category);
    setFormConditionType((achievement.condition as { type?: string })?.type || "sessions_count");
    setFormConditionValue((achievement.condition as { value?: number })?.value || 10);
    setFormPointsReward(achievement.points_reward);
    setFormRarity(achievement.rarity);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个成就吗？")) return;

    try {
      const res = await fetch(`/api/v1/admin/achievements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete achievement:", error);
    }
  };

  const getRarityBadge = (rarity: string) => {
    const styles: Record<string, string> = {
      common: "bg-surface-hover text-text-muted",
      rare: "bg-blue-500/20 text-blue-400",
      epic: "bg-purple-500/20 text-purple-400",
      legendary: "bg-amber-500/20 text-amber-400",
    };
    const labels: Record<string, string> = {
      common: "普通",
      rare: "稀有",
      epic: "史诗",
      legendary: "传说",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-lg ${styles[rarity] || styles.common}`}>
        {labels[rarity] || rarity}
      </span>
    );
  };

  const categoryLabels: Record<string, string> = {
    session: "训练相关",
    score: "分数相关",
    streak: "连续打卡",
    social: "社交相关",
  };

  const statsCards = [
    { label: "总成就数", value: stats?.total.toString() || "0", icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "已启用", value: stats?.active.toString() || "0", icon: Award, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "总解锁次数", value: stats?.total_unlocks.toString() || "0", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "成就类别", value: stats?.categories.length.toString() || "0", icon: Star, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">成就勋章管理</h1>
          <p className="text-text-secondary text-sm mt-1">管理成就系统和勋章配置</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          添加成就
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, idx) => (
          <div key={idx} className="bg-bg-card border border-border-default rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索成就名称..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部类别</option>
          <option value="session">训练相关</option>
          <option value="score">分数相关</option>
          <option value="streak">连续打卡</option>
          <option value="social">社交相关</option>
        </select>
      </div>

      {/* 成就列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">成就</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">类别</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">稀有度</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">奖励积分</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">解锁人数</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {achievements.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                  暂无成就配置
                </td>
              </tr>
            ) : (
              achievements.map((achievement) => (
                <tr key={achievement.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-text-primary font-medium">{achievement.name}</p>
                        <p className="text-sm text-text-muted line-clamp-1">{achievement.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs rounded-lg bg-bg-elevated text-text-secondary">
                      {categoryLabels[achievement.category] || achievement.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">{getRarityBadge(achievement.rarity)}</td>
                  <td className="px-6 py-4 text-text-primary font-medium">+{achievement.points_reward}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <Users className="w-4 h-4" />
                      {achievement.unlock_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(achievement)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 text-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDelete(achievement.id)}
                        className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer"
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

      {/* 创建/编辑成就弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">
                {editingId ? "编辑成就" : "添加成就"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-bg-elevated rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">成就名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="如：初出茅庐"
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">成就描述</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="完成首次训练"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">类别</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="session">训练相关</option>
                    <option value="score">分数相关</option>
                    <option value="streak">连续打卡</option>
                    <option value="social">社交相关</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">稀有度</label>
                  <select
                    value={formRarity}
                    onChange={(e) => setFormRarity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="common">普通</option>
                    <option value="rare">稀有</option>
                    <option value="epic">史诗</option>
                    <option value="legendary">传说</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">解锁条件</label>
                  <select
                    value={formConditionType}
                    onChange={(e) => setFormConditionType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="sessions_count">完成训练次数</option>
                    <option value="score_above">分数达到</option>
                    <option value="streak_days">连续打卡天数</option>
                    <option value="scenarios_created">创建场景数</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">条件值</label>
                  <input
                    type="number"
                    value={formConditionValue}
                    onChange={(e) => setFormConditionValue(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">奖励积分</label>
                <input
                  type="number"
                  value={formPointsReward}
                  onChange={(e) => setFormPointsReward(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 bg-bg-elevated border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName || !formDescription}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editingId ? "保存" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
