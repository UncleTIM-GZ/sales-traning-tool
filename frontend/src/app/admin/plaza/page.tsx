"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：广场内容审核页面
 * 作用：审核用户分享的场景、管理精选推荐、处理举报（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  Star,
  Clock,
  Flag,
  Eye,
  Loader2,
  ThumbsUp,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface Scenario {
  id: string;
  name: string;
  description: string;
  track: string;
  difficulty: string;
  is_featured?: boolean;
  likes_count?: number;
  trains_count?: number;
  creator: { id: string | null; nickname: string };
  created_at: string;
}

interface ScenarioReport {
  id: string;
  scenario: { id: string | null; name: string };
  reporter: { id: string | null; nickname: string };
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface Stats {
  pending: number;
  approved: number;
  featured: number;
  pending_reports: number;
}

export default function AdminPlazaPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "reports">("pending");
  const [pendingScenarios, setPendingScenarios] = useState<Scenario[]>([]);
  const [approvedScenarios, setApprovedScenarios] = useState<Scenario[]>([]);
  const [reports, setReports] = useState<ScenarioReport[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza/pending?page=1&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingScenarios(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending:", error);
    }
  }, [token]);

  const fetchApproved = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza/approved?page=1&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApprovedScenarios(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch approved:", error);
    }
  }, [token]);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza/reports?status=pending&page=1&page_size=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/plaza/stats", {
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
      await Promise.all([fetchPending(), fetchApproved(), fetchReports(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchPending, fetchApproved, fetchReports, fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/v1/admin/plaza/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/v1/admin/plaza/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to reject:", error);
    } finally {
      setProcessing(null);
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/v1/admin/plaza/${id}/feature?featured=${!isFeatured}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to toggle featured:", error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReport = async (reportId: string, action: string) => {
    setProcessing(reportId);
    try {
      const res = await fetch(`/api/v1/admin/plaza/reports/${reportId}/handle?action=${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to handle report:", error);
    } finally {
      setProcessing(null);
    }
  };

  const statsCards = [
    { label: "待审核", value: stats?.pending.toString() || "0", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "已上架", value: stats?.approved.toString() || "0", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "精选推荐", value: stats?.featured.toString() || "0", icon: Star, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "待处理举报", value: stats?.pending_reports.toString() || "0", icon: Flag, color: "text-red-400", bg: "bg-red-500/10" },
  ];

  const difficultyColors: Record<string, string> = {
    easy: "bg-emerald-500/20 text-emerald-400",
    medium: "bg-amber-500/20 text-amber-400",
    hard: "bg-red-500/20 text-red-400",
  };

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
        <h1 className="text-2xl font-bold text-text-primary">广场内容审核</h1>
        <p className="text-text-secondary text-sm mt-1">审核用户分享的场景、管理精选推荐</p>
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

      {/* Tab切换 */}
      <div className="flex items-center gap-4 border-b border-border-default">
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 px-1 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "pending"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          待审核 ({stats?.pending || 0})
        </button>
        <button
          onClick={() => setActiveTab("approved")}
          className={`pb-3 px-1 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "approved"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          已上架 ({stats?.approved || 0})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 px-1 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "reports"
              ? "text-violet-400 border-b-2 border-violet-400"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          举报处理 ({stats?.pending_reports || 0})
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === "pending" && (
        <div className="grid gap-4">
          {pendingScenarios.length === 0 ? (
            <div className="bg-bg-card border border-border-default rounded-xl p-12 text-center text-text-muted">
              暂无待审核场景
            </div>
          ) : (
            pendingScenarios.map((scenario) => (
              <div key={scenario.id} className="bg-bg-card border border-border-default rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-text-primary">{scenario.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${difficultyColors[scenario.difficulty] || "bg-bg-elevated text-text-secondary"}`}>
                        {scenario.difficulty === "easy" ? "简单" : scenario.difficulty === "medium" ? "中等" : "困难"}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mt-1 line-clamp-2">{scenario.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-text-muted">
                      <span>创作者: {scenario.creator.nickname}</span>
                      <span>赛道: {scenario.track}</span>
                      <span>提交时间: {scenario.created_at ? new Date(scenario.created_at).toLocaleDateString("zh-CN") : "-"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleReject(scenario.id)}
                      disabled={processing === scenario.id}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 inline mr-1" />
                      拒绝
                    </button>
                    <button
                      onClick={() => handleApprove(scenario.id)}
                      disabled={processing === scenario.id}
                      className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {processing === scenario.id ? (
                        <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                      )}
                      通过
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "approved" && (
        <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">场景</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">创作者</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">数据</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">精选</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
              </tr>
            </thead>
            <tbody>
              {approvedScenarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    暂无已上架场景
                  </td>
                </tr>
              ) : (
                approvedScenarios.map((scenario) => (
                  <tr key={scenario.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-text-primary font-medium">{scenario.name}</p>
                        <p className="text-sm text-text-muted">{scenario.track}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{scenario.creator.nickname}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm text-text-secondary">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-4 h-4" />
                          {scenario.likes_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {scenario.trains_count || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {scenario.is_featured ? (
                        <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      ) : (
                        <Star className="w-5 h-5 text-text-muted" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleFeatured(scenario.id, scenario.is_featured || false)}
                        disabled={processing === scenario.id}
                        className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-active text-text-secondary rounded-lg text-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {scenario.is_featured ? "取消精选" : "设为精选"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="grid gap-4">
          {reports.length === 0 ? (
            <div className="bg-bg-card border border-border-default rounded-xl p-12 text-center text-text-muted">
              暂无待处理举报
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="bg-bg-card border border-border-default rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Flag className="w-5 h-5 text-red-400" />
                      <h3 className="text-lg font-medium text-text-primary">{report.scenario.name}</h3>
                    </div>
                    <p className="text-text-secondary text-sm mt-2">
                      <span className="text-text-muted">举报原因: </span>
                      {report.reason}
                    </p>
                    {report.description && (
                      <p className="text-text-secondary text-sm mt-1">
                        <span className="text-text-muted">详细描述: </span>
                        {report.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-text-muted">
                      <span>举报人: {report.reporter.nickname}</span>
                      <span>时间: {report.created_at ? new Date(report.created_at).toLocaleDateString("zh-CN") : "-"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleReport(report.id, "dismiss")}
                      disabled={processing === report.id}
                      className="px-4 py-2 bg-bg-elevated hover:bg-bg-active text-text-secondary rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      驳回
                    </button>
                    <button
                      onClick={() => handleReport(report.id, "remove")}
                      disabled={processing === report.id}
                      className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {processing === report.id ? (
                        <Loader2 className="w-4 h-4 inline animate-spin mr-1" />
                      ) : null}
                      下架场景
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
