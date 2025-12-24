"use client";

import { RealtimeMetrics } from "@/components/admin/dashboard/RealtimeMetrics";
import { GrowthTrendChart } from "@/components/admin/dashboard/GrowthTrendChart";

/**
 * 后台管理仪表盘 - 数据中心
 * 
 * 提供实时数据监控和业务分析
 */
export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">数据中心</h1>
        <p className="text-text-muted mt-1">实时监控系统核心指标</p>
      </div>

      {/* 实时指标卡片 */}
      <RealtimeMetrics />

      {/* 增长趋势图表 */}
      <GrowthTrendChart />

      {/* 其他数据看板模块待补充... */}
    </div>
  );
}
