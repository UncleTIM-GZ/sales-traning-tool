"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：训练计划管理页面
 * 作用：查看和管理用户的训练计划（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Search,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Loader2,
  Target,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface TrainingPlan {
  id: string;
  name: string;
  duration_days: number;
  current_day: number;
  status: string;
  progress: number;
  user: { id: string | null; nickname: string };
  created_at: string;
}

interface Stats {
  total: number;
  active: number;
  completed: number;
  avg_completion: number;
}

export default function AdminPlansPage() {
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPlans = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/v1/admin/plans?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    }
  }, [token, page, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plans/stats", {
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
      await Promise.all([fetchPlans(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchPlans, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-400">
            <Play className="w-3 h-3" />
            进行中
          </span>
        );
      case "paused":
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-amber-500/20 text-amber-400">
            <Pause className="w-3 h-3" />
            已暂停
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-400">
            <CheckCircle className="w-3 h-3" />
            已完成
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs rounded-lg bg-bg-elevated text-text-secondary">
            {status}
          </span>
        );
    }
  };

  const statsCards = [
    { label: "总计划数", value: stats?.total.toString() || "0", icon: Calendar, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "进行中", value: stats?.active.toString() || "0", icon: Play, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "已完成", value: stats?.completed.toString() || "0", icon: CheckCircle, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "平均完成率", value: `${stats?.avg_completion || 0}%`, icon: Target, color: "text-amber-400", bg: "bg-amber-500/10" },
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
      <div>
        <h1 className="text-2xl font-bold text-text-primary">训练计划管理</h1>
        <p className="text-text-secondary text-sm mt-1">查看和管理用户的训练计划</p>
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
            placeholder="搜索用户..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部状态</option>
          <option value="active">进行中</option>
          <option value="paused">已暂停</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {/* 计划列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">用户</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">计划名称</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">进度</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">状态</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                  暂无训练计划
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {plan.user.nickname?.charAt(0) || "U"}
                      </div>
                      <span className="text-text-primary">{plan.user.nickname}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-text-primary font-medium">{plan.name}</p>
                      <p className="text-sm text-text-muted">
                        第 {plan.current_day} 天 / 共 {plan.duration_days} 天
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            plan.progress >= 100 ? "bg-emerald-500" :
                            plan.progress >= 50 ? "bg-blue-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(plan.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-text-secondary">{plan.progress.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(plan.status)}</td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {plan.created_at ? new Date(plan.created_at).toLocaleDateString("zh-CN") : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-primary disabled:opacity-50 cursor-pointer"
          >
            上一页
          </button>
          <span className="text-text-secondary">
            第 {page} 页 / 共 {Math.ceil(total / 20)} 页
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 bg-bg-card border border-border-default rounded-lg text-text-primary disabled:opacity-50 cursor-pointer"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
