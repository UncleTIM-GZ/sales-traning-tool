"use client";

/**
 * 开发：Excellent（11964948@qq.com）
 * 功能：积分展示组件
 * 作用：展示用户积分、等级、连续签到天数
 * 创建时间：2025-12-24
 * 最后修改：2025-12-24
 */

import { useState, useEffect } from "react";
import { Coins, Star, Flame, ChevronRight, Loader2 } from "lucide-react";
import { plazaExtApi, PointsBalance } from "@/lib/api";

interface PointsDisplayProps {
  onViewRecords?: () => void;
}

export default function PointsDisplay({ onViewRecords }: PointsDisplayProps) {
  const [points, setPoints] = useState<PointsBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const result = await plazaExtApi.getPointsBalance();
        setPoints(result);
      } catch (error) {
        console.error("Failed to fetch points:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPoints();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-card border border-border-dark rounded-xl p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!points) return null;

  const levelProgress = ((points.exp % 100) / 100) * 100;

  return (
    <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Coins className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-text-primary">我的积分</span>
        </div>
        {onViewRecords && (
          <button
            onClick={onViewRecords}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            明细
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{points.available_points}</p>
          <p className="text-xs text-text-muted">可用积分</p>
        </div>
        <div className="text-center border-x border-border-dark">
          <div className="flex items-center justify-center gap-1">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-2xl font-bold text-text-primary">Lv.{points.level}</span>
          </div>
          <p className="text-xs text-text-muted">当前等级</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-2xl font-bold text-text-primary">{points.streak_days}</span>
          </div>
          <p className="text-xs text-text-muted">连续签到</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-text-muted mb-1">
          <span>经验值</span>
          <span>{points.exp % 100}/100</span>
        </div>
        <div className="h-1.5 bg-surface-lighter rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
