/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：积分余额卡片组件
 * 作用：展示用户积分余额，提供快捷入口
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";

interface PointsBalanceCardProps {
  className?: string;
  compact?: boolean;
}

export function PointsBalanceCard({ className = "", compact = false }: PointsBalanceCardProps) {
  const { pointsBalance } = useAuthStore();

  if (compact) {
    return (
      <Link
        href="/points"
        className={`block p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all group ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl">
              toll
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">
              {pointsBalance.toLocaleString()} 积分
            </p>
            <p className="text-xs text-text-muted">
              点击查看详情
            </p>
          </div>
          <span className="material-symbols-outlined text-text-muted group-hover:text-blue-400 transition-colors">
            arrow_forward_ios
          </span>
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-500/20 ${className}`}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="material-symbols-outlined text-white text-2xl">
                toll
              </span>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium">积分余额</p>
              <motion.p 
                className="text-2xl font-bold text-text-primary"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
              >
                {pointsBalance.toLocaleString()}
              </motion.p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            积分可用于兑换会员、优惠券等
          </p>
          
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/points"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              积分明细
            </Link>
            <Link
              href="/points#redeem"
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">redeem</span>
              兑换码
            </Link>
          </div>
        </div>

        <Link
          href="/points"
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-sm hover:from-blue-400 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/20"
        >
          <span className="material-symbols-outlined text-lg">
            storefront
          </span>
          积分商城
        </Link>
      </div>
    </motion.div>
  );
}
