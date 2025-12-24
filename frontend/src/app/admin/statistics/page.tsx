"use client";

/**
 * 数据统计页面 - 真实数据版本
 */

import { useState, useEffect } from "react";
import LineChart from "@/components/admin/charts/LineChart";
import BarChart from "@/components/admin/charts/BarChart";
import PieChart from "@/components/admin/charts/PieChart";
import { adminApi, DashboardStats, UserGrowthData, SessionTrendData, ScenarioDistribution } from "@/lib/api/admin";

export default function StatisticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthData[]>([]);
  const [sessionTrendData, setSessionTrendData] = useState<SessionTrendData[]>([]);
  const [scenarioDistribution, setScenarioDistribution] = useState<ScenarioDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, growthData, trendData, distributionData] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getUserGrowth(days),
        adminApi.getSessionTrend(days),
        adminApi.getScenarioDistribution(),
      ]);

      setStats(statsData);
      setUserGrowthData(growthData);
      setSessionTrendData(trendData);
      setScenarioDistribution(distributionData);
    } catch (err) {
      console.error("加载数据失败:", err);
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="material-symbols-outlined text-red-400 text-5xl">error</span>
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">数据统计</h1>
          <p className="text-text-secondary text-sm mt-1">查看系统整体运营数据</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-sm">时间范围:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-bg-elevated border border-border-strong rounded-lg px-3 py-1.5 text-sm text-white"
          >
            <option value={7}>最近 7 天</option>
            <option value={14}>最近 14 天</option>
            <option value={30}>最近 30 天</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "总用户数", value: stats?.total_users || 0, icon: "people", color: "violet" },
          { label: "活跃用户", value: stats?.active_users || 0, icon: "person_check", color: "green" },
          { label: "训练次数", value: stats?.total_sessions || 0, icon: "psychology", color: "blue" },
          { label: "平均得分", value: stats?.avg_score?.toFixed(1) || "0", icon: "emoji_events", color: "amber" },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg-card rounded-xl p-4 border border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-sm">{stat.label}</span>
              <span className={`material-symbols-outlined text-${stat.color}-400`}>{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Trend */}
        <div className="bg-bg-card rounded-xl border border-border-default p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">用户增长趋势</h3>
          {userGrowthData.length > 0 ? (
            <LineChart
              data={userGrowthData}
              xKey="date"
              yKeys={[
                { key: "new", color: "#8B5CF6", name: "新增用户" },
                { key: "total", color: "#10B981", name: "总用户数" },
              ]}
              height={280}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-text-muted">
              <p className="text-sm">暂无数据</p>
            </div>
          )}
        </div>

        {/* Session Trend */}
        <div className="bg-bg-card rounded-xl border border-border-default p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">训练完成趋势</h3>
          {sessionTrendData.length > 0 ? (
            <BarChart
              data={sessionTrendData}
              xKey="date"
              yKeys={[{ key: "sessions", color: "#6366F1", name: "训练次数" }]}
              height={280}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-text-muted">
              <p className="text-sm">暂无数据</p>
            </div>
          )}
        </div>

        {/* Scenario Distribution */}
        <div className="bg-bg-card rounded-xl border border-border-default p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">场景分布</h3>
          {scenarioDistribution.length > 0 ? (
            <PieChart data={scenarioDistribution} height={280} />
          ) : (
            <div className="h-64 flex items-center justify-center text-text-muted">
              <p className="text-sm">暂无训练数据</p>
            </div>
          )}
        </div>

        {/* Score Trend */}
        <div className="bg-bg-card rounded-xl border border-border-default p-6">
          <h3 className="text-lg font-bold text-text-primary mb-4">平均得分趋势</h3>
          {sessionTrendData.length > 0 ? (
            <LineChart
              data={sessionTrendData}
              xKey="date"
              yKeys={[{ key: "avgScore", color: "#EC4899", name: "平均分" }]}
              height={280}
            />
          ) : (
            <div className="h-64 flex items-center justify-center text-text-muted">
              <p className="text-sm">暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="bg-bg-card rounded-xl border border-border-default p-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">更多统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-bg-elevated/50 rounded-lg">
            <p className="text-3xl font-bold text-violet-400">{stats?.total_scenarios || 0}</p>
            <p className="text-sm text-text-secondary mt-1">场景总数</p>
          </div>
          <div className="text-center p-4 bg-bg-elevated/50 rounded-lg">
            <p className="text-3xl font-bold text-blue-400">{stats?.total_courses || 0}</p>
            <p className="text-sm text-text-secondary mt-1">课程总数</p>
          </div>
          <div className="text-center p-4 bg-bg-elevated/50 rounded-lg">
            <p className="text-3xl font-bold text-green-400">{stats?.total_reports || 0}</p>
            <p className="text-sm text-text-secondary mt-1">报告总数</p>
          </div>
          <div className="text-center p-4 bg-bg-elevated/50 rounded-lg">
            <p className="text-3xl font-bold text-amber-400">{stats?.new_users_today || 0}</p>
            <p className="text-sm text-text-secondary mt-1">今日新增</p>
          </div>
        </div>
      </div>
    </div>
  );
}
