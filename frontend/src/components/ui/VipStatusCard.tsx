/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：VIP状态卡片组件
 * 作用：展示用户VIP等级、到期时间、剩余天数等信息
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

interface VipStatusCardProps {
  className?: string;
  compact?: boolean;
}

export function VipStatusCard({ className = "", compact = false }: VipStatusCardProps) {
  const { vipStatus } = useAuthStore();

  const isVip = vipStatus?.is_vip ?? false;
  const vipLevel = vipStatus?.vip_level_display ?? "普通用户";
  const daysRemaining = vipStatus?.days_remaining ?? 0;
  const expiresAt = vipStatus?.expires_at ?? null;

  // 格式化到期日期
  const formatExpiryDate = (dateStr: string | null) => {
    if (!dateStr) return "未开通";
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (compact) {
    return (
      <Link
        href="/vip"
        className={`block p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all group ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              workspace_premium
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">
              {isVip ? vipLevel : "开通会员"}
            </p>
            <p className="text-xs text-text-muted">
              {isVip ? `剩余 ${daysRemaining} 天` : "享受专属特权"}
            </p>
          </div>
          <span className="material-symbols-outlined text-text-muted group-hover:text-amber-400 transition-colors">
            arrow_forward_ios
          </span>
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 ${className}`}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                workspace_premium
              </span>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">会员状态</p>
              <p className="text-lg font-bold text-text-primary">
                {isVip ? vipLevel : "普通用户"}
              </p>
            </div>
          </div>
          {isVip && (
            <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
              已开通
            </span>
          )}
        </div>

        {isVip ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">到期时间</span>
              <span className="text-text-primary font-medium">{formatExpiryDate(expiresAt)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-muted">剩余天数</span>
              <span className={`font-bold ${daysRemaining <= 7 ? "text-red-400" : "text-amber-400"}`}>
                {daysRemaining} 天
              </span>
            </div>
            {daysRemaining <= 7 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
                <span className="text-xs text-red-400">会员即将到期，请及时续费</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              开通会员，解锁更多专属特权
            </p>
            <ul className="space-y-2">
              {["无限训练次数", "专属高级场景", "详细能力报告", "优先客服支持"].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="material-symbols-outlined text-amber-400 text-sm">check_circle</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={isVip ? "/vip" : "/vip/subscribe"}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20"
        >
          <span className="material-symbols-outlined text-lg">
            {isVip ? "manage_accounts" : "rocket_launch"}
          </span>
          {isVip ? "管理会员" : "立即开通"}
        </Link>
      </div>
    </motion.div>
  );
}
