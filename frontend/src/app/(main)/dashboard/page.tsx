/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：仪表盘页面
 * 作用：展示用户训练概况、能力评估、VIP状态、积分余额等
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AbilityRadarChart } from "@/components/charts";
import { TrendChart } from "@/components/charts";
import { FadeIn, StaggerContainer, StaggerItem, ScaleOnHover } from "@/components/animations";
import { TodayTaskCard, VipStatusCard, PointsBalanceCard } from "@/components/ui";
import { useAuthStore } from "@/stores/authStore";
import { dashboardApi, DashboardStats, plazaApi, PublicScenario, reportApi, ReportListItem } from "@/lib/api";

// 默认数据（API 加载前或失败时显示）
const defaultAbilityData = [
  { ability: "逻辑思维", value: 50, fullMark: 100 },
  { ability: "表达能力", value: 50, fullMark: 100 },
  { ability: "共情力", value: 50, fullMark: 100 },
  { ability: "反应速度", value: 50, fullMark: 100 },
  { ability: "抗压能力", value: 50, fullMark: 100 },
  { ability: "说服力", value: 50, fullMark: 100 },
];

const defaultTrendData = [
  { date: "今天", value: 50 },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hotScenarios, setHotScenarios] = useState<PublicScenario[]>([]);
  const [reports, setReports] = useState<ReportListItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, plazaData, reportsData] = await Promise.all([
          dashboardApi.getStats(),
          plazaApi.getHotScenarios({ size: 4 }).catch(() => ({ items: [] })),
          reportApi.list({ page: 1, size: 5 }).catch(() => ({ items: [] })),
        ]);
        setStats(statsData);
        setHotScenarios(plazaData.items);
        setReports(reportsData.items || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 格式化训练记录
  const trainingRecords = reports.map((r) => ({
    id: r.id,
    date: r.created_at ? new Date(r.created_at).toLocaleDateString("zh-CN") : "",
    scenario: r.scenario_name,
    score: r.total_score,
    mode: r.mode,
  }));

  // 从 stats 中提取数据
  const currentScore = stats?.current_score ?? 0;
  const streakDays = stats?.streak_days ?? 0;
  const weekHours = stats?.week_duration_hours ?? 0;
  const rankPercentile = stats?.rank_percentile ?? 50;
  const abilityData = stats?.ability_dimensions ?? defaultAbilityData;
  const trendData = stats?.score_trend?.map(item => ({
    date: item.date,
    value: item.score,
  })) ?? defaultTrendData;

  // 计算提升百分比
  const scoreImprovement = trendData.length >= 2 
    ? ((trendData[trendData.length - 1].value - trendData[0].value) / trendData[0].value * 100).toFixed(1)
    : "0";

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Welcome Section */}
      <FadeIn>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <motion.h2 
              className="text-2xl lg:text-3xl font-bold tracking-tight text-text-primary mb-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              欢迎回来，<span className="blue-gradient-text">{user?.nickname || "用户"}</span>
            </motion.h2>
            <motion.p 
              className="text-text-secondary text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {stats?.total_sessions === 0 
                ? "开始您的第一次训练，开启成长之旅！"
                : `您已完成 ${stats?.total_sessions} 次训练，继续保持！`}
            </motion.p>
          </div>
          <motion.button 
            onClick={() => router.push("/scenarios")}
            className="bg-blue-gradient text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="material-symbols-outlined text-lg">play_circle</span>
            开启今日特训
          </motion.button>
        </div>
      </FadeIn>

      {/* Stats Cards */}
      <StaggerContainer staggerDelay={0.1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Score Card */}
        <StaggerItem>
          <ScaleOnHover>
            <div className="bg-surface-card border border-border-dark rounded-xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
              <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-8xl text-blue-500">monitoring</span>
              </div>
              <div className="relative z-10">
                <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">综合能力评分</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <motion.span 
                    className="text-4xl font-extrabold text-text-primary tracking-tight"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    {currentScore.toFixed(1)}
                  </motion.span>
                  {parseFloat(scoreImprovement) > 0 && (
                    <span className="text-emerald-500 text-xs font-bold flex items-center bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <span className="material-symbols-outlined text-xs mr-1">trending_up</span>+{scoreImprovement}%
                    </span>
                  )}
                </div>
                <div className="mt-4 w-full bg-surface-dark h-1.5 rounded-full overflow-hidden border border-border-dark">
                  <motion.div 
                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${currentScore}%` }}
                    transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </ScaleOnHover>
        </StaggerItem>

        {/* Streak Card */}
        <StaggerItem>
          <ScaleOnHover>
            <div className="bg-surface-card border border-border-dark rounded-xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
              <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-8xl text-emerald-500">verified</span>
              </div>
              <div className="relative z-10">
                <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">连续训练天数</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <motion.span 
                    className="text-4xl font-extrabold text-text-primary tracking-tight"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                  >
                    {streakDays}
                  </motion.span>
                  <span className="text-text-muted text-sm font-normal">天</span>
                </div>
                <p className="text-[11px] text-text-muted mt-4 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 animate-pulse"></span>
                  {streakDays >= 14 ? "太棒了！保持这个势头" : `距 "自律徽章" 还需 ${14 - streakDays} 天`}
                </p>
              </div>
            </div>
          </ScaleOnHover>
        </StaggerItem>

        {/* Time Card */}
        <StaggerItem>
          <ScaleOnHover>
            <div className="bg-surface-card border border-border-dark rounded-xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
              <div className="absolute right-0 top-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                <span className="material-symbols-outlined text-8xl text-blue-500">schedule</span>
              </div>
              <div className="relative z-10">
                <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">本周实战时长</p>
                <div className="flex items-baseline gap-3 mt-2">
                  <motion.span 
                    className="text-4xl font-extrabold text-text-primary tracking-tight"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    {weekHours}
                  </motion.span>
                  <span className="text-text-muted text-sm font-normal">小时</span>
                </div>
                <p className="text-[11px] text-text-muted mt-4 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  超过 {rankPercentile}% 同级用户
                </p>
              </div>
            </div>
          </ScaleOnHover>
        </StaggerItem>
      </StaggerContainer>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 flex flex-col gap-6 lg:gap-8">
          {/* Training Cards */}
          <FadeIn delay={0.3}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {/* SCS Card */}
              <ScaleOnHover>
                <div 
                  onClick={() => router.push("/scenarios?type=scs")}
                  className="relative overflow-hidden rounded-xl bg-surface-card border border-blue-500/20 p-6 lg:p-8 flex flex-col justify-between min-h-[220px] group cursor-pointer hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)] transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-30 transition-opacity">
                    <span className="material-symbols-outlined text-[80px] lg:text-[100px] text-blue-500 leading-none" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>handshake</span>
                  </div>
                  <div className="relative z-10">
                    <div className="bg-blue-500/10 w-fit p-2.5 lg:p-3 rounded-lg mb-4 text-blue-500 border border-blue-500/20">
                      <span className="material-symbols-outlined text-2xl lg:text-3xl">emoji_events</span>
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-text-primary mb-2">销冠培养系统</h3>
                    <p className="text-text-secondary text-sm leading-relaxed max-w-[85%]">
                      深度解析顶级销售话术，AI 对抗演练，掌握成交密码。
                    </p>
                  </div>
                  <div className="relative z-10 flex items-center gap-2 text-blue-400 font-bold mt-4 text-sm uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    <span>进入实战</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              </ScaleOnHover>

              {/* SCC Card */}
              <ScaleOnHover>
                <div 
                  onClick={() => router.push("/scenarios?type=scc")}
                  className="relative overflow-hidden rounded-xl bg-surface-card border border-emerald-500/20 p-6 lg:p-8 flex flex-col justify-between min-h-[220px] group cursor-pointer hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-30 transition-opacity">
                    <span className="material-symbols-outlined text-[80px] lg:text-[100px] text-emerald-500 leading-none" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>record_voice_over</span>
                  </div>
                  <div className="relative z-10">
                    <div className="bg-emerald-500/10 w-fit p-2.5 lg:p-3 rounded-lg mb-4 text-emerald-400 border border-emerald-500/20">
                      <span className="material-symbols-outlined text-2xl lg:text-3xl">psychology_alt</span>
                    </div>
                    <h3 className="text-xl lg:text-2xl font-bold text-text-primary mb-2">社恐脱敏训练</h3>
                    <p className="text-text-secondary text-sm leading-relaxed max-w-[85%]">
                      循序渐进的社交场景模拟，AI 引导式脱敏，重塑社交自信。
                    </p>
                  </div>
                  <div className="relative z-10 flex items-center gap-2 text-emerald-400 font-bold mt-4 text-sm uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    <span>开始疗愈</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              </ScaleOnHover>
            </div>
          </FadeIn>

          {/* Ability Chart */}
          <FadeIn delay={0.4}>
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                  能力维度透视
                </h3>
                <div className="flex gap-2">
                  <button className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">
                    本周
                  </button>
                  <button className="text-xs text-text-secondary border border-border-dark px-3 py-1.5 rounded-lg hover:bg-surface-lighter transition-colors">
                    本月
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-8 items-center">
                {/* Radar Chart */}
                <div className="w-full lg:w-1/2 min-h-[280px]">
                  <AbilityRadarChart data={abilityData} />
                </div>
                
                {/* Trend Chart */}
                <div className="w-full lg:w-1/2">
                  <div className="mb-4">
                    <p className="text-sm text-text-secondary mb-1">综合评分趋势</p>
                    <p className="text-2xl font-bold text-text-primary">
                      {currentScore.toFixed(1)} {parseFloat(scoreImprovement) > 0 && (
                        <span className="text-sm text-emerald-500 font-normal">+{scoreImprovement}% 本周</span>
                      )}
                    </p>
                  </div>
                  <TrendChart data={trendData} height={180} />
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Training Records */}
          <FadeIn delay={0.5}>
            <div className="bg-surface-card border border-border-dark rounded-xl overflow-hidden">
              <div className="p-6 border-b border-border-dark">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    训练记录
                  </h3>
                  {trainingRecords.length > 0 && (
                    <Link href="/replay" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      查看全部
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>
              
              {trainingRecords.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface-dark">
                        <tr>
                          <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">日期</th>
                          <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">场景</th>
                          <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">得分</th>
                          <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">模式</th>
                          <th className="text-right text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-dark">
                        {trainingRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-surface-lighter/50 transition-colors">
                            <td className="px-6 py-4 text-sm text-text-secondary">{record.date}</td>
                            <td className="px-6 py-4 text-sm text-text-primary font-medium">{record.scenario}</td>
                            <td className="px-6 py-4">
                              <span className={`text-sm font-bold ${record.score >= 90 ? "text-blue-500" : record.score >= 80 ? "text-green-400" : "text-text-secondary"}`}>
                                {record.score}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-text-secondary">
                              {record.mode === "exam" ? "考核" : "训练"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link 
                                href={`/report/${record.id}`}
                                className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                              >
                                查看报告
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-border-dark">
                    {trainingRecords.map((record) => (
                      <div key={record.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{record.scenario}</p>
                            <p className="text-xs text-text-muted mt-0.5">{record.date}</p>
                          </div>
                          <span className={`text-lg font-bold ${record.score >= 90 ? "text-blue-500" : "text-emerald-400"}`}>
                            {record.score}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-3">
                          <span className="text-xs text-text-muted">{record.mode === "exam" ? "考核" : "训练"}</span>
                          <Link 
                            href={`/report/${record.id}`}
                            className="text-xs text-blue-400"
                          >
                            查看报告
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-text-muted">
                  <span className="material-symbols-outlined text-4xl mb-2">history</span>
                  <p>暂无训练记录</p>
                  <button
                    onClick={() => router.push("/scenarios")}
                    className="mt-4 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    开始第一次训练
                  </button>
                </div>
              )}
            </div>
          </FadeIn>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* VIP Status Card */}
          <FadeIn delay={0.45}>
            <VipStatusCard compact />
          </FadeIn>

          {/* Points Balance Card */}
          <FadeIn delay={0.48}>
            <PointsBalanceCard compact />
          </FadeIn>

          {/* Today's Tasks */}
          <FadeIn delay={0.5}>
            <TodayTaskCard />
          </FadeIn>

          {/* Quick Actions */}
          <FadeIn delay={0.6}>
            <div className="bg-surface-card border border-border-dark rounded-xl p-6">
              <h3 className="text-lg font-bold text-text-primary mb-4">快捷入口</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "explore", label: "场景广场", href: "/plaza", color: "blue" },
                  { icon: "groups", label: "精英圈层", href: "/community", color: "emerald" },
                  { icon: "history", label: "训练记录", href: "/replay", color: "blue" },
                  { icon: "settings", label: "系统设置", href: "/settings", color: "zinc" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-surface-dark border border-border-dark hover:border-blue-500/20 hover:bg-surface-lighter transition-all group"
                  >
                    <span className={`material-symbols-outlined text-2xl ${
                      item.color === "blue" ? "text-blue-500" :
                      item.color === "emerald" ? "text-emerald-500" : "text-text-muted"
                    } group-hover:scale-110 transition-transform`}>
                      {item.icon}
                    </span>
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>

          {/* Hot Scenarios */}
          {hotScenarios.length > 0 && (
            <FadeIn delay={0.65}>
              <div className="bg-surface-card border border-border-dark rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500">local_fire_department</span>
                    热门场景
                  </h3>
                  <Link href="/plaza" className="text-xs text-blue-400 hover:underline">
                    查看更多
                  </Link>
                </div>
                <div className="space-y-3">
                  {hotScenarios.slice(0, 3).map((scenario, index) => (
                    <div
                      key={scenario.id}
                      onClick={() => router.push(`/training/${scenario.id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface-dark border border-border-dark hover:border-blue-500/20 transition-all cursor-pointer group"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 flex items-center justify-center">
                        <span className={`text-sm font-bold ${
                          index === 0 ? "text-orange-400" : 
                          index === 1 ? "text-text-primary" : "text-amber-600"
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate group-hover:text-blue-400 transition-colors">
                          {scenario.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">play_arrow</span>
                            {scenario.train_count}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">favorite</span>
                            {scenario.likes_count}
                          </span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-text-muted group-hover:text-blue-400 transition-colors">
                        arrow_forward_ios
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Achievement Badge */}
          <FadeIn delay={0.7}>
            <div className="bg-gradient-to-br from-blue-900/20 to-surface-card border border-blue-500/20 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                  animate={{ 
                    boxShadow: [
                      "0 0 20px rgba(59, 130, 246, 0.3)",
                      "0 0 30px rgba(59, 130, 246, 0.5)",
                      "0 0 20px rgba(59, 130, 246, 0.3)",
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <span className="material-symbols-outlined text-2xl text-text-primary">military_tech</span>
                </motion.div>
                <div>
                  <p className="text-blue-400 text-sm font-bold">
                    {streakDays >= 14 ? "已获得" : "即将解锁"}
                  </p>
                  <p className="text-text-primary font-bold">自律徽章</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {streakDays >= 14 ? "连续训练14天达成！" : `再坚持 ${14 - streakDays} 天连续训练`}
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
