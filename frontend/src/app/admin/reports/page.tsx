"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：训练报告管理页面
 * 作用：查看和分析用户训练报告（真实数据）
 * 创建时间：2025-12-23
 * 最后修改：2025-12-23
 */

import { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Download,
  Eye,
  TrendingUp,
  Users,
  Star,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface Report {
  id: string;
  user: { id: string | null; nickname: string; avatar: string | null };
  scenario: { id: string | null; name: string };
  total_score: number;
  mode: string;
  created_at: string;
}

interface Stats {
  total: number;
  today_count: number;
  avg_score: number;
  high_score_count: number;
}

export default function AdminReportsPage() {
  const { token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: "20",
      });
      if (searchQuery) params.append("search", searchQuery);
      
      const res = await fetch(`/api/v1/admin/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/v1/admin/reports/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchReports(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) fetchReports();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const statsCards = [
    { label: "总报告数", value: stats?.total.toString() || "0", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "今日新增", value: stats?.today_count.toString() || "0", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "平均分数", value: stats?.avg_score.toFixed(1) || "0", icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "优秀报告", value: stats?.high_score_count.toString() || "0", icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
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
          <h1 className="text-2xl font-bold text-text-primary">训练报告管理</h1>
          <p className="text-text-secondary text-sm mt-1">查看和分析用户的训练报告数据</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-bg-elevated hover:bg-bg-active text-text-primary rounded-xl font-medium transition-colors cursor-pointer">
          <Download className="w-4 h-4" />
          导出报告
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
            placeholder="搜索用户或场景..."
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500"
          />
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-4 py-2.5 bg-bg-card border border-border-default rounded-xl text-text-primary focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="">全部模式</option>
          <option value="train">训练模式</option>
          <option value="exam">测评模式</option>
        </select>
      </div>

      {/* 报告列表 */}
      <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">用户</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">场景</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">模式</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">评分</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">时间</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">操作</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                  暂无训练报告
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} className="border-b border-border-default/50 hover:bg-bg-elevated/30">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {report.user.nickname?.charAt(0) || "U"}
                      </div>
                      <span className="text-text-primary">{report.user.nickname}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text-primary">{report.scenario.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-lg ${
                      report.mode === "train" 
                        ? "bg-blue-500/20 text-blue-400" 
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {report.mode === "train" ? "训练" : "测评"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-lg font-bold ${
                      report.total_score >= 80 ? "text-emerald-400" : 
                      report.total_score >= 60 ? "text-amber-400" : "text-red-400"
                    }`}>
                      {report.total_score.toFixed(0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {report.created_at ? new Date(report.created_at).toLocaleString("zh-CN") : "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-bg-elevated rounded-lg transition-colors cursor-pointer">
                      <Eye className="w-4 h-4 text-text-secondary" />
                    </button>
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
